'use client';

import { useEffect, useId, useRef } from 'react';
import styles from './Dialog.module.css';

let scrollLocks = 0;
let originalBodyOverflow;
const openDialogs = [];

/** The topmost shared modal, in showModal order rather than DOM order. */
export function getActiveDialog() {
  for (let index = openDialogs.length - 1; index >= 0; index -= 1) {
    const dialog = openDialogs[index];
    if (dialog.isConnected && dialog.open) return dialog;
  }
  return null;
}

function lockPageScroll() {
  if (scrollLocks === 0) {
    originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLocks += 1;
  return () => {
    scrollLocks -= 1;
    if (scrollLocks === 0) document.body.style.overflow = originalBodyOverflow;
  };
}

function focusableElements(dialog) {
  return [...dialog.querySelectorAll(
    'a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex], [contenteditable="true"]',
  )].filter(element => element.tabIndex >= 0
    && !element.matches(':disabled')
    && !element.closest('[inert]')
    && element.closest('dialog') === dialog
    && element.getClientRects().length > 0
    && getComputedStyle(element).visibility !== 'hidden');
}

function containDialogKeydown(event, dialog, heading) {
  if (!(event.target instanceof Element) || event.target.closest('dialog') !== dialog) return;
  if (event.key === 'Escape') {
    // Leave native cancel handling in charge without dismissing a panel beneath us.
    event.stopPropagation();
    return;
  }
  if (event.key !== 'Tab' || event.defaultPrevented) return;
  event.stopPropagation();
  const elements = focusableElements(dialog);
  const first = elements[0];
  const last = elements[elements.length - 1];
  if (!first) {
    event.preventDefault();
    heading?.focus();
  } else if (event.shiftKey && (document.activeElement === first || !elements.includes(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function isOutside(dialog, event) {
  const rect = dialog.getBoundingClientRect();
  return event.clientX < rect.left || event.clientX > rect.right
    || event.clientY < rect.top || event.clientY > rect.bottom;
}

/** A modal surface with native background isolation, keyboard and focus handling. */
export default function Dialog({
  open = true,
  title,
  description,
  children,
  footer,
  onClose,
  dismissDisabled = false,
  initialFocusRef,
  role = 'dialog',
  maxWidth = 480,
  className = '',
  style,
  contentStyle,
  ariaLabelledBy,
}) {
  const id = useId();
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const backdropPointerDown = useRef(false);

  useEffect(() => {
    if (!open) return undefined;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const unlockScroll = lockPageScroll();

    dialog.showModal();
    openDialogs.push(dialog);
    // Listen on the DOM node so controls portalled into this modal participate too.
    const onKeyDown = event => containDialogKeydown(event, dialog, headingRef.current);
    dialog.addEventListener('keydown', onKeyDown);
    (initialFocusRef?.current ?? headingRef.current ?? dialog).focus({ preventScroll: true });

    return () => {
      dialog.removeEventListener('keydown', onKeyDown);
      const stackIndex = openDialogs.lastIndexOf(dialog);
      if (stackIndex !== -1) openDialogs.splice(stackIndex, 1);
      dialog.close();
      unlockScroll();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [open, initialFocusRef]);

  if (!open) return null;

  function dismiss() {
    if (!dismissDisabled) onClose?.();
  }

  return (
    <dialog
      ref={dialogRef}
      role={role}
      aria-modal="true"
      aria-labelledby={ariaLabelledBy ?? `${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      className={`${styles.dialog} ${className}`.trim()}
      style={{ maxWidth, ...style }}
      tabIndex={-1}
      onCancel={event => { event.preventDefault(); event.stopPropagation(); dismiss(); }}
      onPointerDown={event => {
        backdropPointerDown.current = event.target === event.currentTarget && isOutside(event.currentTarget, event);
      }}
      onClick={event => {
        if (backdropPointerDown.current && event.target === event.currentTarget && isOutside(event.currentTarget, event)) dismiss();
        backdropPointerDown.current = false;
      }}
    >
      <header className={styles.header}>
        <h2 ref={headingRef} id={`${id}-title`} className={styles.title} tabIndex={-1}>{title}</h2>
        {description && <p id={`${id}-description`} className={styles.description}>{description}</p>}
      </header>
      <div className={styles.content} style={contentStyle}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </dialog>
  );
}
