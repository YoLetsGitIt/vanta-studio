'use client';

import { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

// Renders at 512px (crisp when printed) but displays at `displaySize`. Always
// black-on-white with a quiet zone, since a themed/tinted QR scans unreliably.
// Saves the QR inside the element with this id as a PNG (for a button placed elsewhere).
export function downloadQR(id, filename = 'qr-code') {
  const canvas = document.getElementById(id)?.querySelector('canvas');
  if (!canvas) return;
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = `${filename}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export default function DownloadableQR({ value, filename = 'qr-code', displaySize = 96, label = 'Download QR', id, hideButton = false }) {
  const wrapRef = useRef(null);
  if (!value) return null;

  function download() {
    const canvas = wrapRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
      <div ref={wrapRef} id={id} style={{ background: '#fff', padding: 6, borderRadius: 8, lineHeight: 0 }}>
        <QRCodeCanvas value={value} size={512} marginSize={2} bgColor="#ffffff" fgColor="#000000"
          style={{ width: displaySize, height: displaySize }} />
      </div>
      {!hideButton && <button type="button" onClick={download}
        style={{ background: 'var(--accent-tint)', border: '1px solid var(--accent-tint-border)', borderRadius: 6, padding: '0.35rem 0.85rem', fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }}>
        {label}
      </button>}
    </div>
  );
}
