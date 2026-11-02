// Client photo ID for consent forms. The photo is shrunk to a JPEG in the browser,
// uploaded privately, and its storage path becomes the form answer.

const MAX_SIDE = 2000;

// Downscale to keep uploads small and readable. Falls back to the original file
// when the browser can't decode it (for example HEIC outside Safari).
export async function prepareIdPhoto(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (blob) return blob;
  } catch {}
  return file;
}

// Replaces File answers with uploaded storage paths. `sign` posts { mime_type, byte_size }
// to an id-upload-sign endpoint and returns { upload_url, storage_object_path }.
export async function uploadPhotoIdAnswers(answers, sign) {
  const out = { ...answers };
  for (const [fieldId, value] of Object.entries(answers ?? {})) {
    if (!(value instanceof Blob)) continue;
    const photo = await prepareIdPhoto(value);
    const type = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(photo.type) ? photo.type : 'image/jpeg';
    const slot = await sign({ mime_type: type, byte_size: photo.size });
    const res = await fetch(slot.upload_url, { method: 'PUT', headers: { 'Content-Type': type }, body: photo });
    if (!res.ok) throw new Error('Your ID photo didn’t upload. Please try again.');
    out[fieldId] = slot.storage_object_path;
  }
  return out;
}

export async function signStudioPhotoId(backend, studioId, file) {
  const res = await fetch(`${backend}/studios/${studioId}/id-upload-sign`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(file),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Could not prepare your ID upload');
  return data;
}
