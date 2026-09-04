'use client';

import { useEffect, useRef, useState } from 'react';
import { CONFIRM_EVENT, FEEDBACK_EVENT } from '@/lib/feedback';

export default function FeedbackHost() {
  const [notice, setNotice] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const timerRef = useRef(null);
  const confirmButtonRef = useRef(null);

  useEffect(() => {
    function onFeedback(event) {
      clearTimeout(timerRef.current);
      setNotice(event.detail);
      timerRef.current = setTimeout(() => setNotice(null), event.detail?.action ? 8000 : 5000);
    }
    function onConfirm(event) { setConfirmation(event.detail); }
    window.addEventListener(FEEDBACK_EVENT, onFeedback);
    window.addEventListener(CONFIRM_EVENT, onConfirm);
    return () => {
      clearTimeout(timerRef.current);
      window.removeEventListener(FEEDBACK_EVENT, onFeedback);
      window.removeEventListener(CONFIRM_EVENT, onConfirm);
    };
  }, []);

  useEffect(() => {
    if (!confirmation) return;
    confirmButtonRef.current?.focus();
    function onKeyDown(event) {
      if (event.key === 'Escape') close(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmation]);

  function close(result) {
    confirmation?.resolve(result);
    setConfirmation(null);
  }

  return (
    <>
      {notice && (
        <div role="status" aria-live="polite" style={{ ...styles.notice, ...(notice.type === 'success' ? styles.success : styles.error) }}>
          <span aria-hidden="true">{notice.type === 'success' ? '✓' : '!'}</span>
          <span style={styles.noticeMessage}>{notice.message}</span>
          <button aria-label="Dismiss message" onClick={() => setNotice(null)} style={styles.dismiss}>×</button>
          {(notice.actions?.length || notice.action) && (
            <div style={styles.noticeActions}>
              {(notice.actions ?? [notice.action]).map((action, index) => (
                <button
                  key={`${action.label}-${index}`}
                  onClick={() => {
                    clearTimeout(timerRef.current);
                    setNotice(null);
                    action.onClick?.();
                  }}
                  style={styles.noticeAction}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {confirmation && (
        <div style={styles.overlay} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(false); }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="vanta-confirm-title" aria-describedby="vanta-confirm-message" style={styles.dialog}>
            <h2 id="vanta-confirm-title" style={styles.title}>{confirmation.title}</h2>
            <p id="vanta-confirm-message" style={styles.message}>{confirmation.message}</p>
            <div style={styles.actions}>
              <button onClick={() => close(false)} style={styles.cancel}>Cancel</button>
              <button ref={confirmButtonRef} onClick={() => close(true)} style={{ ...styles.confirm, ...(confirmation.danger ? styles.danger : {}) }}>
                {confirmation.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  notice: { position: 'fixed', zIndex: 10000, right: 24, top: 24, width: 'min(430px, calc(100vw - 32px))', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '0.8rem 0.9rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-modal)', color: 'var(--text)', boxShadow: '0 16px 45px rgba(0,0,0,0.32)', fontSize: '0.84rem' },
  error: { borderColor: 'rgba(224,96,96,0.42)' },
  success: { borderColor: 'var(--accent-tint-border)' },
  noticeMessage: { flex: 1, minWidth: 0 },
  noticeActions: { width: '100%', display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 24 },
  noticeAction: { flexShrink: 0, border: '1px solid var(--accent-tint-border)', borderRadius: 7, background: 'var(--accent-tint)', color: 'var(--accent)', padding: '0.38rem 0.62rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 },
  dismiss: { marginLeft: 'auto', border: 0, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 },
  overlay: { position: 'fixed', inset: 0, zIndex: 10001, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(3px)' },
  dialog: { width: 'min(430px, 100%)', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-modal)', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', padding: '1.4rem' },
  title: { margin: 0, color: 'var(--text)', fontSize: '1.05rem' },
  message: { margin: '0.65rem 0 1.3rem', color: 'var(--text-muted)', fontSize: '0.87rem', lineHeight: 1.55 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8 },
  cancel: { border: '1px solid var(--border)', borderRadius: 8, background: 'transparent', color: 'var(--text-muted)', padding: '0.58rem 0.85rem', cursor: 'pointer' },
  confirm: { border: 0, borderRadius: 8, background: 'var(--accent)', color: 'var(--accent-contrast)', padding: '0.58rem 0.85rem', cursor: 'pointer', fontWeight: 700 },
  danger: { background: '#cf5555', color: '#fff' },
};
