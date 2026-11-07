'use client';

// Settings → Appointment types: the studio's own booking presets. Each has a name,
// length and colour, and optionally a price and deposit that fill in a new booking.
// Bookings are coloured by their type on the schedule.
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Field, { Input, Select } from '@/components/ui/Field';
import { createAppointmentType, deleteAppointmentType, updateAppointmentType } from '@/lib/api';
import { TYPE_COLORS, formatMoney, formatTypeLength, refreshAppointmentTypes, useAppointmentTypes } from '@/lib/appointmentTypes';
import { showError, showFeedback } from '@/lib/feedback';
import styles from './AppointmentTypesSettings.module.css';

const HOURS = Array.from({ length: 25 }, (_, h) => h);
const MINUTES = [0, 15, 30, 45];

export default function AppointmentTypesSettings({ styles: s }) {
  const { active, types, loading, error } = useAppointmentTypes();
  const [editing, setEditing] = useState(null); // null | 'new' | type
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      await deleteAppointmentType(removing.id);
      await refreshAppointmentTypes();
      showFeedback(`${removing.name} removed`, 'success');
      setRemoving(null);
    } catch (e) { showError(e); }
    finally { setBusy(false); }
  }

  // A new type gets the first colour no other type is using.
  const usedColors = new Set(active.map(type => type.color));
  const nextColor = TYPE_COLORS.find(c => !usedColors.has(c.value))?.value ?? TYPE_COLORS[0].value;

  return (
    <section className="settings-span-12" style={s.card} aria-labelledby="appointment-types-title">
      <div className={styles.head}>
        <div style={s.settingsSectionHeader}>
          <h2 id="appointment-types-title" style={s.visuallyHidden}>Appointment types</h2>
          <p style={s.sectionDesc}>Presets for the bookings you make most, like a full day or a small tattoo. Picking one fills in the length, price and deposit, and colours the booking on your schedule.</p>
        </div>
        {active.length > 0 && <Button onClick={() => setEditing('new')}>Add type</Button>}
      </div>

      {error && <p role="alert" style={s.errorText}>{error}</p>}
      {loading && <p role="status" style={s.sectionDesc}>Loading appointment types…</p>}

      {!loading && !error && active.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptySwatches} aria-hidden="true">
            {TYPE_COLORS.slice(0, 4).map(c => <span key={c.value} style={{ background: c.value }} />)}
          </div>
          <p className={styles.emptyTitle}>No appointment types yet</p>
          <p className={styles.emptyText}>Add your first, for example “Full day, 8 hours”.</p>
          <Button onClick={() => setEditing('new')}>Add appointment type</Button>
        </div>
      )}

      {active.length > 0 && (
        <ul className={styles.list}>
          {active.map(type => (
            <li key={type.id} className={styles.row}>
              <span className={styles.swatch} style={{ background: type.color }} aria-hidden="true" />
              <span className={styles.rowText}>
                <span className={styles.rowName}>{type.name}</span>
                <span className={styles.rowMeta}>
                  {[formatTypeLength(type.duration_minutes), type.price != null ? formatMoney(type.price) : null, type.deposit ? `${formatMoney(type.deposit)} deposit` : null].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className={styles.rowActions}>
                <Button variant="ghost" size="sm" onClick={() => setEditing(type)}>Edit</Button>
                <Button variant="ghost" size="sm" className={styles.removeBtn} onClick={() => setRemoving(type)}>Remove</Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {types.length > active.length && <p style={{ ...s.sectionDesc, fontSize: '0.85rem' }}>Removed types stay on the bookings that already have them.</p>}

      {editing && (
        <TypeDialog type={editing === 'new' ? null : editing} defaultColor={nextColor} onClose={() => setEditing(null)} />
      )}
      {removing && (
        <Dialog title={`Remove ${removing.name}?`} description="It won’t be offered for new bookings. Bookings that already have it keep it and its colour."
          onClose={() => setRemoving(null)} maxWidth={440}
          footer={<>
            <Button variant="secondary" onClick={() => setRemoving(null)}>Keep it</Button>
            <Button variant="danger" onClick={remove} loading={busy} loadingLabel="Removing…">Remove</Button>
          </>}>
          {null}
        </Dialog>
      )}
    </section>
  );
}

function TypeDialog({ type, defaultColor, onClose }) {
  const [name, setName] = useState(type?.name ?? '');
  const [hours, setHours] = useState(type ? Math.floor(type.duration_minutes / 60) : 1);
  const [minutes, setMinutes] = useState(type ? type.duration_minutes % 60 : 0);
  const [color, setColor] = useState(type?.color ?? defaultColor);
  const [price, setPrice] = useState(type?.price != null ? String(type.price) : '');
  const [deposit, setDeposit] = useState(type?.deposit != null ? String(type.deposit) : '');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState('');

  const length = Number(hours) * 60 + Number(minutes);
  const money = v => (v.trim() === '' ? null : Number(v));

  async function save(event) {
    event?.preventDefault();
    if (!name.trim()) { setProblem('Give it a name.'); return; }
    if (length < 15) { setProblem('Make it at least 15 minutes long.'); return; }
    if ([price, deposit].some(v => v.trim() !== '' && !(Number(v) >= 0))) { setProblem('Price and deposit must be numbers.'); return; }
    setSaving(true); setProblem('');
    try {
      const body = { name: name.trim(), duration_minutes: length, color, price: money(price), deposit: money(deposit) };
      if (type) await updateAppointmentType(type.id, body);
      else await createAppointmentType(body);
      await refreshAppointmentTypes();
      showFeedback(type ? 'Appointment type saved' : `${body.name} added`, 'success');
      onClose();
    } catch (e) { setProblem(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Dialog title={type ? 'Edit appointment type' : 'New appointment type'} onClose={onClose} maxWidth={520}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} loading={saving} loadingLabel="Saving…">{type ? 'Save' : 'Add type'}</Button>
      </>}>
      <form className={styles.form} onSubmit={save}>
        <div className={styles.preview} aria-hidden="true" style={{ '--type-color': color }}>
          <span className={styles.previewTitle}>{name.trim() || 'Appointment type'}</span>
          <span className={styles.previewMeta}>{formatTypeLength(length)}</span>
        </div>
        <Field label="Name" required>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Full day" maxLength={60} autoFocus />
        </Field>
        <fieldset className={styles.fieldset}>
          <legend className="studio-field-label">Length</legend>
          <div className={styles.lengthRow}>
            <Select aria-label="Hours" value={hours} onChange={e => setHours(Number(e.target.value))}>
              {HOURS.map(h => <option key={h} value={h}>{h} h</option>)}
            </Select>
            <Select aria-label="Minutes" value={minutes} onChange={e => setMinutes(Number(e.target.value))}>
              {MINUTES.map(m => <option key={m} value={m}>{m} min</option>)}
            </Select>
          </div>
        </fieldset>
        <fieldset className={styles.fieldset}>
          <legend className="studio-field-label">Colour</legend>
          <div className={styles.colors} role="radiogroup" aria-label="Colour">
            {TYPE_COLORS.map(c => (
              <button key={c.value} type="button" role="radio" aria-checked={color === c.value} aria-label={c.name} title={c.name}
                className={styles.color} style={{ '--swatch': c.value }} onClick={() => setColor(c.value)} />
            ))}
          </div>
        </fieldset>
        <div className={styles.moneyRow}>
          <Field label="Price" hint="Optional">
            <Input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="$0" />
          </Field>
          <Field label="Deposit" hint="Optional">
            <Input inputMode="decimal" value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="$0" />
          </Field>
        </div>
        {problem && <p role="alert" className="studio-field-error">{problem}</p>}
      </form>
    </Dialog>
  );
}
