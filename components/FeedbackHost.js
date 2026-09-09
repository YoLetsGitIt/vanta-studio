'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CONFIRM_EVENT, FEEDBACK_EVENT } from '@/lib/feedback';
import Dialog, { getActiveDialog } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';

export default function FeedbackHost() {
  const [notice, setNotice] = useState(null);
  const [noticeHost, setNoticeHost] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const timerRef = useRef(null);
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    function onFeedback(event) {
      clearTimeout(timerRef.current);
      setNotice(event.detail);
      const hasActions = event.detail?.actions?.length || event.detail?.action;
      if (!hasActions) timerRef.current = setTimeout(() => setNotice(null), 5000);
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
    if (!notice) return undefined;
    // Native dialogs occupy the top layer. Their notices must live inside the
    // active dialog to stay visible and keyboard-accessible above its backdrop.
    function updateHost() {
      setNoticeHost(getActiveDialog() ?? document.body);
    }
    updateHost();
    const observer = new MutationObserver(updateHost);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
    return () => observer.disconnect();
  }, [notice]);

  function close(result) {
    confirmation?.resolve(result);
    setConfirmation(null);
  }

  return (
    <>
      {notice && noticeHost && createPortal(
        <div role="status" aria-live="polite" style={{ ...styles.notice, ...(noticeHost.tagName === 'DIALOG' ? styles.dialogNotice : {}), ...(notice.type === 'success' ? styles.success : styles.error) }}>
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
      , noticeHost)}
      {confirmation && (
        <Dialog
          title={confirmation.title}
          description={confirmation.message}
          role="alertdialog"
          onClose={() => close(false)}
          initialFocusRef={cancelButtonRef}
          maxWidth={430}
          footer={(
            <>
              <Button ref={cancelButtonRef} variant="secondary" onClick={() => close(false)}>Cancel</Button>
              <Button variant={confirmation.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
                {confirmation.confirmLabel}
              </Button>
            </>
          )}
        />
      )}
    </>
  );
}

const styles = {
  notice: { position: 'fixed', zIndex: 10000, right: 24, top: 24, width: 'min(430px, calc(100vw - 32px))', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '0.8rem 0.9rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-modal)', color: 'var(--text)', boxShadow: '0 16px 45px rgba(0,0,0,0.32)', fontSize: '0.84rem' },
  dialogNotice: { position: 'relative', top: 'auto', right: 'auto', width: 'calc(100% - 32px)', margin: '16px auto', flexShrink: 0, order: -1 },
  error: { borderColor: 'var(--color-danger-border)' },
  success: { borderColor: 'var(--color-success-border)' },
  noticeMessage: { flex: 1, minWidth: 0 },
  noticeActions: { width: '100%', display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 24 },
  noticeAction: { flexShrink: 0, border: '1px solid var(--accent-tint-border)', borderRadius: 7, background: 'var(--accent-tint)', color: 'var(--accent)', padding: '0.38rem 0.62rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 },
  dismiss: { minWidth: 32, minHeight: 32, marginLeft: 'auto', border: 0, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 },
};
