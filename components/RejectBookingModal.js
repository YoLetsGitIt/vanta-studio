'use client';
import { useState, useRef } from 'react';
import { useLanguage } from '@/lib/i18n';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Field, { Textarea } from '@/components/ui/Field';

export default function RejectBookingModal({
  onConfirm, onCancel, saving,
  title = 'Reject Booking',
  placeholder = 'e.g. Not available on the requested date, design outside my style…',
  confirmLabel = 'Reject Booking',
}) {
  const { t } = useLanguage();
  const reasonRef = useRef(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  function handleSubmit() {
    if (saving) return;
    if (!reason.trim()) { setError('Please provide a reason.'); reasonRef.current?.focus(); return; }
    setError('');
    onConfirm(reason.trim());
  }

  return (
    <Dialog
      title={title}
      onClose={onCancel}
      dismissDisabled={saving}
      initialFocusRef={reasonRef}
      maxWidth={420}
      footer={(
        <>
          <Button variant="secondary" onClick={onCancel} disabled={saving}>{t('back')}</Button>
          <Button variant="danger" onClick={handleSubmit} loading={saving} loadingLabel={t('saving')}>
            {confirmLabel}
          </Button>
        </>
      )}
    >
      <Field label={t('reason')} required error={error}>
        <Textarea
          ref={reasonRef}
          rows={4}
          placeholder={placeholder}
          value={reason}
          disabled={saving}
          onChange={e => { setReason(e.target.value); if (error) setError(''); }}
        />
      </Field>
    </Dialog>
  );
}
