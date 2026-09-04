'use client';

const FEEDBACK_EVENT = 'vanta:feedback';
const CONFIRM_EVENT = 'vanta:confirm';

export function showFeedback(message, type = 'error', action = null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FEEDBACK_EVENT, {
    detail: { message: message || 'Something went wrong. Please try again.', type, action, actions: Array.isArray(action) ? action : null },
  }));
}

export function showError(error) {
  showFeedback(error?.message || error || 'Something went wrong. Please try again.', 'error');
}

export function requestConfirmation({ title = 'Are you sure?', message, confirmLabel = 'Confirm', danger = false }) {
  if (typeof window === 'undefined') return Promise.resolve(false);
  return new Promise(resolve => {
    window.dispatchEvent(new CustomEvent(CONFIRM_EVENT, {
      detail: { title, message, confirmLabel, danger, resolve },
    }));
  });
}

export { FEEDBACK_EVENT, CONFIRM_EVENT };
