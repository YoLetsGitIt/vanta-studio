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

  // Auto-dismiss after 5s; hovering or focusing the notice pauses the countdown.
  const DISMISS_MS = 5000;
  const remainingRef = useRef(DISMISS_MS);
  const startedRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leaveTimerRef = useRef(null);
  const seqRef = useRef(0);

  function startTimer(ms) {
    clearTimeout(timerRef.current);
    remainingRef.current = ms;
    startedRef.current = Date.now();
    timerRef.current = setTimeout(() => dismiss(), ms);
  }
  function pause() {
    if (!notice || notice.sticky || paused) return;
    clearTimeout(timerRef.current);
    remainingRef.current = Math.max(remainingRef.current - (Date.now() - startedRef.current), 600);
    setPaused(true);
  }
  function resume() {
    if (!notice || notice.sticky || !paused) return;
    setPaused(false);
    startTimer(remainingRef.current);
  }
  // Plays the exit, then removes the notice.
  function dismiss() {
    clearTimeout(timerRef.current);
    setLeaving(true);
    clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = setTimeout(() => { setNotice(null); setLeaving(false); }, 160);
  }

  useEffect(() => {
    function onFeedback(event) {
      clearTimeout(leaveTimerRef.current);
      setLeaving(false);
      setPaused(false);
      const hasActions = event.detail?.actions?.length || event.detail?.action;
      seqRef.current += 1;
      setNotice({ ...event.detail, sticky: Boolean(hasActions), seq: seqRef.current });
      if (hasActions) clearTimeout(timerRef.current);
      else startTimer(DISMISS_MS);
    }
    function onConfirm(event) { setConfirmation(event.detail); }
    window.addEventListener(FEEDBACK_EVENT, onFeedback);
    window.addEventListener(CONFIRM_EVENT, onConfirm);
    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(leaveTimerRef.current);
      window.removeEventListener(FEEDBACK_EVENT, onFeedback);
      window.removeEventListener(CONFIRM_EVENT, onConfirm);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <div role="status" aria-live="polite"
          className="studio-toast"
          data-leaving={leaving || undefined}
          data-paused={paused || undefined}
          onMouseEnter={pause} onMouseLeave={resume} onFocus={pause} onBlur={resume}
          style={{ ...styles.notice, ...(noticeHost.tagName === 'DIALOG' ? styles.dialogNotice : {}), ...(notice.type === 'success' ? styles.success : styles.error) }}>
          <span key={`icon-${notice.seq}`} aria-hidden="true" className={`studio-toast-icon studio-toast-icon--${notice.type === 'success' ? 'success' : 'error'}`}>
            {notice.type === 'success' ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path className="studio-toast-check" d="M2.5 6.2 5 8.6l4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            ) : '!'}
          </span>
          <span key={`msg-${notice.seq}`} className="studio-toast-message" style={styles.noticeMessage}>{notice.message}</span>
          <button aria-label="Dismiss message" className="studio-toast-dismiss" onClick={dismiss} style={styles.dismiss}>×</button>
          {(notice.actions?.length || notice.action) && (
            <div style={styles.noticeActions}>
              {(notice.actions ?? [notice.action]).map((action, index) => (
                <button
                  key={`${action.label}-${index}`}
                  className="studio-toast-action"
                  onClick={() => {
                    dismiss();
                    action.onClick?.();
                  }}
                  style={styles.noticeAction}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
          {!notice.sticky && <span key={`bar-${notice.seq}`} aria-hidden="true" className="studio-toast-timer" style={{ animationDuration: `${DISMISS_MS}ms` }} />}
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
  notice: { position: 'fixed', zIndex: 10000, right: 24, top: 24, width: 'min(430px, calc(100vw - 32px))', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '0.8rem 0.9rem', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-modal)', color: 'var(--text)', boxShadow: '0 16px 45px rgba(0,0,0,0.32)', fontSize: '0.84rem' },
  dialogNotice: { position: 'relative', top: 'auto', right: 'auto', width: 'calc(100% - 32px)', margin: '16px auto', flexShrink: 0, order: -1 },
  error: { borderColor: 'var(--color-danger-border)' },
  success: { borderColor: 'var(--color-success-border)' },
  noticeMessage: { flex: 1, minWidth: 0 },
  noticeActions: { width: '100%', display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 24 },
  noticeAction: { flexShrink: 0, border: '1px solid var(--accent-tint-border)', borderRadius: 7, background: 'var(--accent-tint)', color: 'var(--accent)', padding: '0.38rem 0.62rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 },
  dismiss: { minWidth: 32, minHeight: 32, marginLeft: 'auto', border: 0, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 },
};
