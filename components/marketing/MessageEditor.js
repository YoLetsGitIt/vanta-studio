'use client';

import { forwardRef, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import Button from '@/components/ui/Button';
import { uploadMarketingPhoto } from '@/lib/api';
import { toBlocks, fromBlocks, insertPhotoAt, removePhotoAt } from '@/lib/marketingPhotos.mjs';
import { showError } from '@/lib/feedback';
import styles from './marketing.module.css';

const MAX_GIF_BYTES = 5 * 1024 * 1024;

/**
 * The message box: text with photos shown in place, as they'll appear in the
 * email. Saved as plain text (see lib/marketingPhotos.mjs).
 * Ref: insertText(text) puts text at the cursor of the last text box used.
 */
const MessageEditor = forwardRef(function MessageEditor({ label, value, onChange, disabled, onFocus }, ref) {
  const { t: mt } = useLanguage();
  const labelId = useId();
  const fileInput = useRef(null);
  const boxes = useRef([]);
  const lastText = useRef(null);
  const [uploading, setUploading] = useState(false);
  const blocks = toBlocks(value);
  const textCount = blocks.filter(b => b.type === 'text').length;

  // Grow each text box to fit its text, so the message reads as one page.
  useLayoutEffect(() => {
    for (const el of boxes.current) {
      if (!el) continue;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight + 2}px`;
    }
  });

  function cursor() {
    const index = lastText.current ?? blocks.length - 1;
    const el = boxes.current[index];
    const text = blocks[index]?.text ?? '';
    return { index, start: el?.selectionStart ?? text.length, end: el?.selectionEnd ?? text.length };
  }

  function focusAt(index, position) {
    requestAnimationFrame(() => {
      const el = boxes.current[index];
      el?.focus();
      el?.setSelectionRange(position, position);
    });
  }

  useImperativeHandle(ref, () => ({
    insertText(text) {
      const { index, start, end } = cursor();
      const current = blocks[index].text;
      const next = blocks.slice();
      next[index] = { type: 'text', text: current.slice(0, start) + text + current.slice(end) };
      onChange(fromBlocks(next));
      focusAt(index, start + text.length);
    },
  }));

  async function addPhoto(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { showError(new Error(mt('Choose a photo (JPG, PNG or GIF).'))); return; }
    if (file.type === 'image/gif' && file.size > MAX_GIF_BYTES) { showError(new Error(mt('GIFs must be 5 MB or smaller.'))); return; }
    const { index, end } = cursor();
    setUploading(true);
    try {
      const url = await uploadMarketingPhoto(file);
      // Re-read the message: the studio may have kept typing during the upload.
      onChange(current => {
        const latest = toBlocks(current);
        const at = Math.min(end, latest[index]?.text?.length ?? 0);
        return fromBlocks(insertPhotoAt(latest, latest[index]?.type === 'text' ? index : latest.length - 1, at, url));
      });
      lastText.current = index + 2;
      focusAt(index + 2, 0);
    } catch (err) { showError(err); } finally { setUploading(false); }
  }

  function photoFrom(event) {
    const items = [...(event.clipboardData?.files ?? event.dataTransfer?.files ?? [])];
    return items.find(file => file.type.startsWith('image/'));
  }

  function removePhoto(index) {
    const before = blocks[index - 1].text.replace(/\s+$/, '');
    onChange(fromBlocks(removePhotoAt(blocks, index)));
    lastText.current = index - 1;
    focusAt(index - 1, before.length);
  }

  let photoNumber = 0, textNumber = 0;
  return (
    <div className="studio-field">
      <span id={labelId} className="studio-field-label">{label}</span>
      <div className={styles.messageEditor} data-disabled={disabled || undefined}
        onDragOver={event => { if (!disabled && [...(event.dataTransfer?.types ?? [])].includes('Files')) event.preventDefault(); }}
        onDrop={event => { const file = photoFrom(event); if (file && !disabled) { event.preventDefault(); addPhoto(file); } }}>
        {blocks.map((block, index) => {
          if (block.type === 'photo') {
            const n = ++photoNumber;
            return (
              <figure key={`photo-${index}`} className={styles.messagePhoto}>
                <img src={block.url} alt={block.caption || mt('Photo {n}', { n })} />
                <button type="button" disabled={disabled} className={styles.photoRemove} aria-label={mt('Remove photo {n}', { n })} title={mt('Remove photo')} onClick={() => removePhoto(index)}>×</button>
              </figure>
            );
          }
          const n = textNumber++;
          const only = textCount === 1;
          return (
            <textarea
              key={`text-${index}`}
              ref={el => { boxes.current[index] = el; }}
              className={styles.messageText}
              data-only={only || undefined}
              aria-labelledby={n === 0 ? labelId : undefined}
              aria-label={n === 0 ? undefined : mt('Message, after photo {n}', { n })}
              rows={only ? 8 : 1}
              placeholder={only ? undefined : mt('Write more here…')}
              maxLength={50000}
              disabled={disabled}
              value={block.text}
              onFocus={() => { lastText.current = index; onFocus?.(); }}
              onPaste={event => { const file = photoFrom(event); if (file) { event.preventDefault(); addPhoto(file); } }}
              onChange={event => {
                const next = blocks.slice();
                next[index] = { type: 'text', text: event.target.value };
                onChange(fromBlocks(next));
              }}
            />
          );
        })}
      </div>
      <div className={styles.photosHead}>
        <input ref={fileInput} type="file" accept="image/*" hidden tabIndex={-1} aria-hidden="true" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; addPhoto(file); }} />
        <Button size="sm" variant="secondary" disabled={disabled || uploading} loading={uploading} loadingLabel={mt('Uploading photo…')} onClick={() => fileInput.current?.click()}>
          <span aria-hidden="true">＋</span>{mt('Add photo')}
        </Button>
        <p className={styles.hint}>{mt('Photos go in where your cursor is. You can also paste or drag a photo into the message.')}</p>
      </div>
    </div>
  );
});

export default MessageEditor;
