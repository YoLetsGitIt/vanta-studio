'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Field, { Input, Select } from '@/components/ui/Field';
import styles from './marketing.module.css';

const DAY = 24 * 60 * 60 * 1000;
const PAGE = 100;
const NO_FILTERS = { search: '', tattoos: 'any', last: 'any', lastDays: '90', upcoming: 'any', upcomingDays: '30', added: 'any', addedDays: '30' };

const PRESETS = [
  ['Lapsed 90+ days', { last: 'before', lastDays: '90' }],
  ['Tattooed in last 30 days', { last: 'within', lastDays: '30' }],
  ['Regulars', { tattoos: 'repeat' }],
  ['No tattoo yet', { tattoos: 'none' }],
  ['Nothing booked', { upcoming: 'none' }],
  ['New this month', { added: 'within', addedDays: '30' }],
];
const VIEWS = [['all', 'All'], ['selected', 'Selected'], ['unselected', 'Not selected']];

// Blank or out-of-range input is not a usable number of days.
function parseDays(value) {
  const n = Number(value);
  return String(value).trim() !== '' && Number.isInteger(n) && n >= 1 && n <= 3650 ? n : null;
}

function matches(c, f, now) {
  const q = f.search.trim().toLowerCase();
  if (q && !`${c.name} ${c.email}`.toLowerCase().includes(q)) return false;

  if (f.tattoos === 'none' && c.completed_count > 0) return false;
  if (f.tattoos === 'some' && c.completed_count < 1) return false;
  if (f.tattoos === 'repeat' && c.completed_count < 2) return false;

  const last = c.last_visit ? new Date(c.last_visit).getTime() : null;
  const lastDays = parseDays(f.lastDays);
  if (f.last === 'within' && lastDays && !(last && last >= now - lastDays * DAY)) return false;
  if (f.last === 'before' && lastDays && !(last && last < now - lastDays * DAY)) return false;

  const next = c.next_appointment ? new Date(c.next_appointment).getTime() : null;
  const upcomingDays = parseDays(f.upcomingDays);
  if (f.upcoming === 'none' && next) return false;
  if (f.upcoming === 'any_time' && !next) return false;
  if (f.upcoming === 'within' && upcomingDays && !(next && next < now + upcomingDays * DAY)) return false;

  const addedDays = parseDays(f.addedDays);
  if (f.added === 'within' && addedDays && !(new Date(c.created_at).getTime() >= now - addedDays * DAY)) return false;
  return true;
}

const fmtDate = iso => new Date(iso).toLocaleDateString('en-AU', { dateStyle: 'medium' });

function history(c) {
  const parts = [c.completed_count > 0
    ? `${c.completed_count} tattoo${c.completed_count === 1 ? '' : 's'}${c.last_visit ? `, last ${fmtDate(c.last_visit)}` : ''}`
    : 'No tattoo yet'];
  if (c.next_appointment) parts.push(`booked ${fmtDate(c.next_appointment)}`);
  return parts.join(' · ');
}

function DaysField({ label, value, onChange }) {
  return (
    <Field label={label} error={parseDays(value) ? undefined : 'Enter a number of days from 1 to 3650.'}>
      <Input type="number" inputMode="numeric" min={1} max={3650} value={value} onChange={e => onChange(e.target.value)} />
    </Field>
  );
}

/** Lists every client who can be emailed, narrows the list with filters, and keeps the ticked set across filter changes. */
export default function AudiencePicker({ clients, error, onRetry, selected, onChange }) {
  const [filters, setFilters] = useState(NO_FILTERS);
  const [view, setView] = useState('all');
  const [limit, setLimit] = useState(PAGE);
  const set = patch => setFilters(prev => ({ ...prev, ...patch }));
  useEffect(() => { setLimit(PAGE); }, [filters, view]);

  const filtered = useMemo(() => {
    const now = Date.now();
    return (clients || []).filter(c => matches(c, filters, now));
  }, [clients, filters]);
  const shown = view === 'all' ? filtered : filtered.filter(c => selected.has(c.id) === (view === 'selected'));

  if (error) {
    return <p className={styles.error} role="alert">{error} <button type="button" className={styles.chip} onClick={onRetry}>Try again</button></p>;
  }
  if (!clients) return <p className={styles.muted} role="status">Loading clients…</p>;
  if (clients.length === 0) {
    return (
      <p className={styles.hint}>
        No clients can be emailed yet. Tick “agreed to marketing emails” on a client first. <Link href="/dashboard/clients" className={styles.chip}>Go to clients</Link>
      </p>
    );
  }

  const filtersOn = Object.keys(NO_FILTERS).some(k => !k.endsWith('Days') && filters[k] !== NO_FILTERS[k]);
  const presetOn = patch => Object.entries({ ...NO_FILTERS, search: filters.search, ...patch }).every(([k, v]) => k.endsWith('Days') && !(k in patch) ? true : filters[k] === v);
  const shownSelected = shown.filter(c => selected.has(c.id)).length;
  const hiddenSelected = selected.size - filtered.filter(c => selected.has(c.id)).length;

  function toggle(ids, on) {
    const next = new Set(selected);
    ids.forEach(id => (on ? next.add(id) : next.delete(id)));
    onChange(next);
  }

  return (
    <>
      <div className={styles.chips} role="group" aria-label="Quick filters">
        {PRESETS.map(([label, patch]) => {
          const on = presetOn(patch);
          return (
            <button key={label} type="button" aria-pressed={on} className={`${styles.chip} ${on ? styles.chipOn : ''}`}
              onClick={() => setFilters(on ? { ...NO_FILTERS, search: filters.search } : { ...NO_FILTERS, search: filters.search, ...patch })}>{label}</button>
          );
        })}
      </div>

      <div className={styles.row}>
        <Field label="Tattoos done here">
          <Select value={filters.tattoos} onChange={e => set({ tattoos: e.target.value })}>
            <option value="any">Any number</option>
            <option value="none">None yet</option>
            <option value="some">At least one</option>
            <option value="repeat">Two or more</option>
          </Select>
        </Field>
        <Field label="Last tattoo">
          <Select value={filters.last} onChange={e => set({ last: e.target.value })}>
            <option value="any">Any time</option>
            <option value="within">Within the last…</option>
            <option value="before">More than… ago</option>
          </Select>
        </Field>
        {filters.last !== 'any' && <DaysField label={filters.last === 'within' ? 'Within the last (days)' : 'More than (days) ago'} value={filters.lastDays} onChange={v => set({ lastDays: v })} />}
        <Field label="Upcoming appointment">
          <Select value={filters.upcoming} onChange={e => set({ upcoming: e.target.value })}>
            <option value="any">Doesn’t matter</option>
            <option value="none">Nothing booked</option>
            <option value="any_time">Has one booked</option>
            <option value="within">Booked in the next…</option>
          </Select>
        </Field>
        {filters.upcoming === 'within' && <DaysField label="In the next (days)" value={filters.upcomingDays} onChange={v => set({ upcomingDays: v })} />}
        <Field label="Added to your clients">
          <Select value={filters.added} onChange={e => set({ added: e.target.value })}>
            <option value="any">Any time</option>
            <option value="within">In the last…</option>
          </Select>
        </Field>
        {filters.added === 'within' && <DaysField label="Added in the last (days)" value={filters.addedDays} onChange={v => set({ addedDays: v })} />}
      </div>

      <Field label="Find a client">
        <Input type="search" value={filters.search} placeholder="Search name or email" onChange={e => set({ search: e.target.value })} />
      </Field>

      <div className={styles.listBar}>
        <label className={styles.checkAll}>
          <input type="checkbox" checked={shown.length > 0 && shownSelected === shown.length} disabled={shown.length === 0}
            ref={el => { if (el) el.indeterminate = shownSelected > 0 && shownSelected < shown.length; }}
            onChange={e => toggle(shown.map(c => c.id), e.target.checked)} />
          <span>{shownSelected === shown.length && shown.length > 0 ? 'Deselect' : 'Select'} all {shown.length} shown</span>
        </label>
        <div className={styles.views} role="group" aria-label="Show">
          {VIEWS.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={view === id} className={styles.view} onClick={() => setView(id)}>{label}</button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className={styles.empty}>
          {view === 'selected' && selected.size === 0 ? 'No clients selected yet.' : 'No clients match.'}
          {(filtersOn || view !== 'all') && <button type="button" className={styles.chip} onClick={() => { setFilters(NO_FILTERS); setView('all'); }}>Show everyone</button>}
        </p>
      ) : (
        <ul className={styles.clientList} aria-label="Clients">
          {shown.slice(0, limit).map(c => (
            <li key={c.id}>
              <label className={styles.clientRow}>
                <input type="checkbox" checked={selected.has(c.id)} onChange={e => toggle([c.id], e.target.checked)} />
                <span className={styles.clientMain}>{c.name}<span className={styles.rowSub}>{c.email}</span></span>
                <span className={styles.clientMeta}>{history(c)}</span>
              </label>
            </li>
          ))}
          {shown.length > limit && (
            <li className={styles.more}><Button size="sm" variant="ghost" onClick={() => setLimit(limit + PAGE)}>Show more ({shown.length - limit} left)</Button></li>
          )}
        </ul>
      )}

      <div className={styles.actions}>
        <p className={styles.audience} role="status">
          {selected.size} of {clients.length} selected{hiddenSelected > 0 ? ` · ${hiddenSelected} hidden by filters` : ''}
        </p>
        {filtersOn && <Button size="sm" variant="ghost" onClick={() => setFilters(NO_FILTERS)}>Clear filters</Button>}
        {selected.size > 0 && <Button size="sm" variant="ghost" onClick={() => onChange(new Set())}>Clear selection</Button>}
      </div>
    </>
  );
}
