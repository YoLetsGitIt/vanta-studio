'use client';

// Settings → Appointment types → Artist rates: each artist's hourly, half-day and
// full-day rates. Artists can set their own in the Vanta app; the studio can change
// them here. Appointment types are priced from the assigned artist's rate.
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { setArtistRates } from '@/lib/api';
import { PRICE_BASES, refreshArtistRates, useArtistRates } from '@/lib/appointmentTypes';
import { showFeedback } from '@/lib/feedback';
import styles from './AppointmentTypesSettings.module.css';

const toText = v => (v == null ? '' : String(v));
const toRate = v => (v.trim() === '' ? null : Number(v));

export default function ArtistRatesSettings({ styles: s }) {
  const { list, loading, error } = useArtistRates();
  return (
    <section className="settings-span-12" style={s.card} aria-labelledby="artist-rates-title">
      <div style={s.settingsSectionHeader}>
        <h2 id="artist-rates-title" style={s.sectionTitle}>Artist rates</h2>
        <p style={s.sectionDesc}>Appointment types are priced from the assigned artist’s rate. Artists can set their own in the Vanta app, or you can set them here.</p>
      </div>
      {error && <p role="alert" style={s.errorText}>{error}</p>}
      {loading && <p role="status" style={s.sectionDesc}>Loading artist rates…</p>}
      {!loading && !error && list.length === 0 && <p style={s.sectionDesc}>No artists at your studio yet.</p>}
      {list.length > 0 && (
        <div className={styles.rates}>
          <div className={styles.rateHead} aria-hidden="true">
            <span>Artist</span>
            {PRICE_BASES.map(b => <span key={b.value}>{b.label}</span>)}
            <span />
          </div>
          {list.map(rates => <RateRow key={rates.artist_id} rates={rates} />)}
        </div>
      )}
    </section>
  );
}

function RateRow({ rates }) {
  const initial = () => Object.fromEntries(PRICE_BASES.map(b => [b.field, toText(rates[b.field])]));
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState('');
  useEffect(() => { setValues(initial()); }, [rates]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = PRICE_BASES.some(b => values[b.field] !== toText(rates[b.field]));
  const name = rates.artist_name || 'Artist';

  async function save() {
    if (PRICE_BASES.some(b => values[b.field].trim() !== '' && !(Number(values[b.field]) >= 0))) { setProblem('Rates must be numbers.'); return; }
    setSaving(true); setProblem('');
    try {
      await setArtistRates(rates.artist_id, Object.fromEntries(PRICE_BASES.map(b => [b.field, toRate(values[b.field])])));
      await refreshArtistRates();
      showFeedback(`${name}’s rates saved`, 'success');
    } catch (e) { setProblem(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className={styles.rateRow}>
      <span className={styles.rateArtist}>
        <span aria-hidden="true" className={styles.rateAvatar}>{name.trim().charAt(0).toUpperCase()}</span>
        <span>{name}</span>
      </span>
      {PRICE_BASES.map(b => (
        <label key={b.field}>
          <span className={styles.rateLabel}>{b.label}</span>
          <span className={styles.rateInput}>
            <span aria-hidden="true">$</span>
            <input inputMode="decimal" aria-label={`${name} ${b.label.toLowerCase()}`} placeholder="Not set" value={values[b.field]} disabled={saving}
              onChange={e => { setValues(v => ({ ...v, [b.field]: e.target.value })); setProblem(''); }}
              onKeyDown={e => { if (e.key === 'Enter' && dirty) save(); }} />
          </span>
        </label>
      ))}
      <span className={styles.rateSave}>
        {dirty && <Button size="sm" onClick={save} loading={saving} loadingLabel="Saving…">Save</Button>}
      </span>
      {problem && <p role="alert" className="studio-field-error" style={{ gridColumn: '1 / -1', margin: 0 }}>{problem}</p>}
    </div>
  );
}
