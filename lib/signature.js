// A drawn signature, saved as dark ink on white like paper, whatever colour it was
// drawn in on screen. It then reads on every dashboard theme and in PDFs.
export const SIGNATURE_INK = '#111008';

export function signatureBlob(canvas, done) {
  const ink = document.createElement('canvas');
  ink.width = canvas.width;
  ink.height = canvas.height;
  const ictx = ink.getContext('2d');
  ictx.drawImage(canvas, 0, 0);
  ictx.globalCompositeOperation = 'source-in';
  ictx.fillStyle = SIGNATURE_INK;
  ictx.fillRect(0, 0, ink.width, ink.height);

  const paper = document.createElement('canvas');
  paper.width = canvas.width;
  paper.height = canvas.height;
  const pctx = paper.getContext('2d');
  pctx.fillStyle = '#ffffff';
  pctx.fillRect(0, 0, paper.width, paper.height);
  pctx.drawImage(ink, 0, 0);
  paper.toBlob(done, 'image/png');
}

// The pen colour on screen: the form's text colour.
export function penColour(canvas) {
  return getComputedStyle(canvas).color || SIGNATURE_INK;
}
