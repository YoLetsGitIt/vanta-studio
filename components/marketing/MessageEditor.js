'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import Button from '@/components/ui/Button';
import Field, { Textarea } from '@/components/ui/Field';
import { uploadMarketingPhoto } from '@/lib/api';
import { toDisplay, fromDisplay, insertPhoto } from '@/lib/marketingPhotos.mjs';
import { showError } from '@/lib/feedback';
import styles from './marketing.module.css';

const MAX_GIF_BYTES = 5 * 1024 * 1024;

/**
 * The message box. Photos show as [file name]; Preview shows the real photos. Saved as plain text (see lib/marketingPhotos.mjs).
 * Ref: insertText(text) puts text at the cursor.
 */
const MessageEditor = forwardRef(function MessageEditor({ label, value, onChange, disabled, onFocus }, ref) {
  const { t: mt } = useLanguage();
  const box = useRef(null);
  const fileInput = useRef(null);
  const [uploading, setUploading] = useState(false);
  const { text, photos } = toDisplay(value);
  const latest = useRef(value);
  latest.current = value;

  function placeCursor(position) {
    requestAnimationFrame(() => { box.current?.focus(); box.current?.setSelectionRange(position, position); });
  }

  useImperativeHandle(ref, () => ({
    insertText(insert) {
      const el = box.current;
      const start = el?.selectionStart ?? text.length, end = el?.selectionEnd ?? text.length;
      onChange(fromDisplay(text.slice(0, start) + insert + text.slice(end), photos));
      placeCursor(start + insert.length);
    },
  }));

  async function addPhoto(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { showError(new Error(mt('Choose a photo (JPG, PNG or GIF).'))); return; }
    if (file.type === 'image/gif' && file.size > MAX_GIF_BYTES) { showError(new Error(mt('GIFs must be 5 MB or smaller.'))); return; }
    const at = box.current?.selectionEnd ?? text.length;
    setUploading(true);
    try {
      const url = await uploadMarketingPhoto(file);
      // Use the latest message: the studio may have kept typing during the upload.
      const current = latest.current;
      const { body, cursor } = insertPhoto(current, Math.min(at, toDisplay(current).text.length), url, file.name);
      onChange(body);
      placeCursor(cursor);
    } catch (err) { showError(err); } finally { setUploading(false); }
  }

  const photoIn = event => [...(event.clipboardData?.files ?? event.dataTransfer?.files ?? [])].find(file => file.type.startsWith('image/'));

  return (
    <div className={styles.messageField}>
      <Field label={label}>
        <Textarea
          ref={box}
          rows={10}
          maxLength={50000}
          disabled={disabled}
          value={text}
          onFocus={onFocus}
          onChange={event => onChange(fromDisplay(event.target.value, photos))}
          onPaste={event => { const file = photoIn(event); if (file) { event.preventDefault(); addPhoto(file); } }}
          onDragOver={event => { if ([...(event.dataTransfer?.types ?? [])].includes('Files')) event.preventDefault(); }}
          onDrop={event => { const file = photoIn(event); if (file && !disabled) { event.preventDefault(); addPhoto(file); } }}
        />
      </Field>
      <div className={styles.photosHead}>
        <input ref={fileInput} type="file" accept="image/*" hidden tabIndex={-1} aria-hidden="true" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; addPhoto(file); }} />
        <Button size="sm" variant="secondary" disabled={disabled || uploading} loading={uploading} loadingLabel={mt('Uploading photo…')} onClick={() => fileInput.current?.click()}>
          <span aria-hidden="true">＋</span>{mt('Add photo')}
        </Button>
        <p className={styles.hint}>{mt('Photos show here by file name, like [flash-sheet.jpg]. Use Preview to see them. Delete the name to remove a photo.')}</p>
      </div>
    </div>
  );
});

export default MessageEditor;
