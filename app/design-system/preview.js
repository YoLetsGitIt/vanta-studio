'use client';

import { useRef, useState } from 'react';
import Button, { IconButton } from '@/components/ui/Button';
import Field, { Input, Select, Textarea } from '@/components/ui/Field';
import StatePanel from '@/components/ui/StatePanel';
import Dialog from '@/components/ui/Dialog';
import { setTheme } from '@/lib/theme';
import FeedbackHost from '@/components/FeedbackHost';
import { requestConfirmation, showError, showFeedback } from '@/lib/feedback';
import { statusColors, statusLabel } from '@/lib/status';

export default function DesignSystemPreview() {
  const [open, setOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [nested, setNested] = useState(false);
  const cancel = useRef(null);
  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: 'var(--space-6, 24px)' }}>
      <FeedbackHost />
      <h1>Studio design system</h1>
      <p style={{ color: 'var(--text-muted)', margin: '1rem 0' }}>Local preview for keyboard, responsive, and theme checks.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <Button onClick={() => setTheme('dark')}>Dark theme</Button>
        <Button variant="secondary" onClick={() => setTheme('light')}>Light theme</Button>
      </div>
      <section aria-label="Controls" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <Button>Save changes</Button>
        <Button variant="secondary">Cancel</Button>
        <Button variant="danger">Delete</Button>
        <Button disabled>Unavailable</Button>
        <Button loading loadingLabel="Saving…">Save</Button>
        <IconButton aria-label="Add item">+</IconButton>
      </section>
      <section aria-label="Fields" style={{ display: 'grid', gap: 16, marginBottom: 24 }}>
        <Field label="Client name" required hint="Use the name the client prefers."><Input autoComplete="off" /></Field>
        <Field label="Email" error="Enter a valid email address."><Input type="email" defaultValue="incomplete" /></Field>
        <Field label="Payment method"><Select defaultValue="cash"><option value="cash">Cash</option><option value="card">Card</option></Select></Field>
        <Field label="Notes"><Textarea rows={3} /></Field>
      </section>
      <section aria-label="Booking statuses" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        {['pending', 'awaiting_payment', 'requires_confirmation', 'confirmed', 'completed', 'cancelled', 'deposit_expired'].map(status => {
          const colors = statusColors(status);
          return <span key={status} style={{ color: colors.text, background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '6px 10px' }}>{statusLabel(status)}</span>;
        })}
      </section>
      <StatePanel title="No appointments yet" description="New appointments will appear here." />
      <StatePanel title="Could not load appointments" description="Try again in a moment." tone="error" action={<Button>Try again</Button>} />
      <Button onClick={() => setOpen(true)} style={{ marginTop: 24 }}>Open example dialog</Button>
      {open && (
        <Dialog title="Record session" description="Example only — no data is saved." onClose={() => setOpen(false)} dismissDisabled={locked} initialFocusRef={cancel}
          footer={<><Button ref={cancel} variant="secondary" onClick={() => setOpen(false)} disabled={locked}>Cancel</Button><Button onClick={() => setOpen(false)} disabled={locked}>Done</Button></>}>
          <Field label="Final price"><Input type="number" min="0" /></Field>
          <label style={{ display: 'flex', gap: 8, margin: '16px 0' }}><input type="checkbox" checked={locked} onChange={event => setLocked(event.target.checked)} />Prevent dismissal while saving</label>
          <Button variant="secondary" onClick={() => showError("Example save failed")}>Show example error</Button>
          <Button variant="secondary" onClick={() => showFeedback("Example with action", "success", [{ label: "Example action", onClick: () => showFeedback("Example action done", "success") }])}>Show example action notice</Button>
          <Button variant="secondary" onClick={() => {
            requestConfirmation({ title: 'Feedback confirmation', message: 'Example only.', confirmLabel: 'Confirm example' });
            showFeedback('Confirmation action notice', 'success', [{ label: 'Confirm notice action', onClick: () => showFeedback('Confirmation action done', 'success') }]);
          }}>Open feedback confirmation</Button>
          <Button variant="secondary" onClick={() => setNested(true)}>Open nested confirmation</Button>
          {nested && <Dialog title="Confirm example" role="alertdialog" onClose={() => setNested(false)} footer={<Button onClick={() => setNested(false)}>Back to session</Button>}>The first dialog remains open underneath.</Dialog>}
        </Dialog>
      )}
    </main>
  );
}
