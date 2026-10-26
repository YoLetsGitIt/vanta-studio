'use client';

import { useLanguage } from '@/lib/i18n';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Field, { Input, Select } from '@/components/ui/Field';
import { listMarketingAudiences, saveMarketingAudience, deleteMarketingAudience } from '@/lib/api';
import { requestConfirmation, showError, showFeedback } from '@/lib/feedback';
import styles from './marketing.module.css';

const DAY = 24 * 60 * 60 * 1000;
const PAGE = 100;
const NO_FILTERS = { search: '', sessions: 'any', last: 'any', lastDays: '90', upcoming: 'any', upcomingDays: '30', added: 'any', addedDays: '30' };

const PRESETS = [
  ['Regulars', { sessions: 'repeat' }],
  ['No visit in 90+ days', { last: 'before', lastDays: '90' }],
  ['Visited in the last 30 days', { last: 'within', lastDays: '30' }],
  ['New this month', { added: 'within', addedDays: '30' }],
  ['No completed visit yet', { sessions: 'none' }],
  ['Nothing booked', { upcoming: 'none' }],
];

// Blank or out-of-range input is not a usable number of days.
function parseDays(value) {
  const n = Number(value);
  return String(value).trim() !== '' && Number.isInteger(n) && n >= 1 && n <= 3650 ? n : null;
}

function matches(c, f, now) {
  const q = f.search.trim().toLowerCase();
  if (q && !`${c.name} ${c.email}`.toLowerCase().includes(q)) return false;

  if (f.sessions === 'none' && c.completed_count > 0) return false;
  if (f.sessions === 'some' && c.completed_count < 1) return false;
  if (f.sessions === 'repeat' && c.completed_count < 2) return false;

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

const fmtDate = iso => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
const initials = name => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

// The one thing most worth knowing about a client, as a coloured label.
function tag(c, now) {
  const last = c.last_visit ? new Date(c.last_visit).getTime() : null;
  if (last && last < now - 90 * DAY) return ['warn', 'Lapsed'];
  if (c.completed_count >= 2) return ['good', 'Regular'];
  if (new Date(c.created_at).getTime() >= now - 30 * DAY) return ['info', 'New'];
  return c.completed_count === 0 ? ['plain', 'No completed visit yet'] : null;
}

function history(c, mt) {
  const parts = [];
  if (c.completed_count > 0) parts.push(`${mt('Sessions')}: ${c.completed_count}${c.last_visit ? ` · ${mt('Last visit')}: ${fmtDate(c.last_visit)}` : ''}`);
  if (c.next_appointment) parts.push(`${mt('Upcoming appointment')}: ${fmtDate(c.next_appointment)}`);
  return parts.join(' · ') || c.email;
}

// Saved audiences come back from the server, so only known filter keys with string values are applied.
function savedFilters(raw) {
  const out = { ...NO_FILTERS };
  Object.keys(NO_FILTERS).forEach(k => { if (k !== 'search' && typeof raw?.[k] === 'string') out[k] = raw[k]; });
  delete out.search;
  return out;
}

function DaysField({ label, value, onChange }) {
  const { t: mt } = useLanguage();
  return (
    <Field label={label} error={parseDays(value) ? undefined : mt('Enter a number of days from 1 to 3650.')}>
      <Input type="number" inputMode="numeric" min={1} max={3650} value={value} onChange={e => onChange(e.target.value)} />
    </Field>
  );
}

/** Lists every client who can be emailed, narrows the list with one search and one group choice, and keeps the ticked set across changes. */
export default function AudiencePicker({ clients, error, onRetry, selected, onChange }) {
  const { t: mt } = useLanguage();
  const [filters, setFilters] = useState(NO_FILTERS);
  const [onlySelected, setOnlySelected] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [custom, setCustom] = useState(false);
  const set = patch => setFilters(prev => ({ ...prev, ...patch }));
  const [saved, setSaved] = useState([]);
  const [naming, setNaming] = useState(null);
  // Saved audiences are a convenience; the picker works without them.
  useEffect(() => { listMarketingAudiences().then(data => setSaved(data.audiences)).catch(() => {}); }, []);
  useEffect(() => { setLimit(PAGE); }, [filters, onlySelected]);
  useEffect(() => { if (selected.size === 0) setOnlySelected(false); }, [selected]);

  const now = useMemo(() => Date.now(), [clients]);
  const filtered = useMemo(() => (clients || []).filter(c => matches(c, filters, now)), [clients, filters, now]);
  // How many clients each group holds, so a studio can see its size before picking it.
  const presetCounts = useMemo(() => PRESETS.map(([, patch]) => (clients || []).filter(c => matches(c, { ...NO_FILTERS, ...patch }, now)).length), [clients, now]);

  if (error) {
    return <p className={styles.error} role="alert">{error} <button type="button" className={styles.chip} onClick={onRetry}>{mt("Try again")}</button></p>;
  }
  if (!clients) return <p className={styles.muted} role="status">{mt("Loading clients…")}</p>;
  if (clients.length === 0) {
    return (
      <p className={styles.hint}> {mt("No clients can be emailed yet. Tick “agreed to marketing emails” on a client first.")} <Link href="/dashboard/clients" className={styles.chip}>{mt("Go to clients")}</Link>
      </p>
    );
  }

  const is = patch => Object.keys(NO_FILTERS).every(k => k === 'search' || (k.endsWith('Days') && !(k in patch)) || filters[k] === ({ ...NO_FILTERS, ...patch })[k]);
  const presetIndex = PRESETS.findIndex(([, patch]) => is(patch));
  const savedMatch = saved.find(a => is(savedFilters(a.filters)));
  // The dropdown always names what the list is showing.
  const group = custom ? 'custom' : is({}) ? 'all' : presetIndex >= 0 ? `p${presetIndex}` : savedMatch ? `s${savedMatch.id}` : 'custom';
  const shown = onlySelected ? filtered.filter(c => selected.has(c.id)) : filtered;
  const shownSelected = shown.filter(c => selected.has(c.id)).length;
  const hiddenSelected = selected.size - filtered.filter(c => selected.has(c.id)).length;

  function pick(value) {
    setCustom(value === 'custom');
    if (value === 'custom') return;
    const patch = value === 'all' ? {} : value[0] === 'p' ? PRESETS[Number(value.slice(1))][1] : savedFilters(saved.find(a => `s${a.id}` === value)?.filters);
    setFilters({ ...NO_FILTERS, ...patch, search: filters.search });
  }
  function toggle(ids, on) {
    const next = new Set(selected);
    ids.forEach(id => (on ? next.add(id) : next.delete(id)));
    onChange(next);
  }
  async function saveAudience() {
    const { search, ...rest } = filters;
    try {
      const audience = await saveMarketingAudience(naming, rest);
      setSaved(prev => [...prev, audience]);
      setNaming(null); setCustom(false);
      showFeedback(mt('Saved “{name}”. Find it under Show.', { name: audience.name }), 'success');
    } catch (err) { showError(err); }
  }
  async function removeAudience(audience) {
    if (!await requestConfirmation({ title: mt("Delete saved group"), message: mt('Delete “{name}”? This only removes the saved filters, not any clients.', { name: audience.name }), confirmLabel: mt("Delete"), danger: true })) return;
    try { await deleteMarketingAudience(audience.id); setSaved(prev => prev.filter(a => a.id !== audience.id)); pick('all'); } catch (err) { showError(err); }
  }

  return (
    <>
      <div className={styles.findRow}>
        <Field label={mt("Search")}><Input type="search" value={filters.search} placeholder={mt("Name or email")} onChange={e => set({ search: e.target.value })} /></Field>
        <Field label={mt("Show")}>
          <Select value={group} onChange={e => pick(e.target.value)}>
            <option value="all">{mt("Everyone (")}{clients.length})</option>
            {PRESETS.map(([label], i) => <option key={label} value={`p${i}`}>{mt(label)} ({presetCounts[i]})</option>)}
            {saved.length > 0 && <optgroup label={mt("Your saved groups")}>{saved.map(a => <option key={a.id} value={`s${a.id}`}>{a.name}</option>)}</optgroup>}
            <option value="custom">{mt("Custom filters…")}</option>
          </Select>
        </Field>
      </div>
      {savedMatch && !custom && <p className={styles.hint}><button type="button" className={styles.link} onClick={() => removeAudience(savedMatch)}>{mt("Delete this saved group")}</button></p>}

      {custom && (
        <div className={styles.filterPanel}>
          <div className={styles.row}>
            <Field label={mt("Sessions completed here")}>
              <Select value={filters.sessions} onChange={e => set({ sessions: e.target.value })}>
                <option value="any">{mt("Any number")}</option>
                <option value="none">{mt("None yet")}</option>
                <option value="some">{mt("At least one")}</option>
                <option value="repeat">{mt("Two or more")}</option>
              </Select>
            </Field>
            <Field label={mt("Last visit")}>
              <Select value={filters.last} onChange={e => set({ last: e.target.value })}>
                <option value="any">{mt("Any time")}</option>
                <option value="within">{mt("Within the last…")}</option>
                <option value="before">{mt("More than… ago")}</option>
              </Select>
            </Field>
            {filters.last !== 'any' && <DaysField label={filters.last === 'within' ? mt("Within the last (days)") : mt("More than (days) ago")} value={filters.lastDays} onChange={v => set({ lastDays: v })} />}
            <Field label={mt("Upcoming appointment")}>
              <Select value={filters.upcoming} onChange={e => set({ upcoming: e.target.value })}>
                <option value="any">{mt("Doesn’t matter")}</option>
                <option value="none">{mt("Nothing booked")}</option>
                <option value="any_time">{mt("Has one booked")}</option>
                <option value="within">{mt("Booked in the next…")}</option>
              </Select>
            </Field>
            {filters.upcoming === 'within' && <DaysField label={mt("In the next (days)")} value={filters.upcomingDays} onChange={v => set({ upcomingDays: v })} />}
            <Field label={mt("Added to your clients")}>
              <Select value={filters.added} onChange={e => set({ added: e.target.value })}>
                <option value="any">{mt("Any time")}</option>
                <option value="within">{mt("In the last…")}</option>
              </Select>
            </Field>
            {filters.added === 'within' && <DaysField label={mt("Added in the last (days)")} value={filters.addedDays} onChange={v => set({ addedDays: v })} />}
          </div>
          {naming === null ? (
            <div className={styles.actions}>
              <Button size="sm" variant="secondary" disabled={is({})} onClick={() => setNaming('')}>{mt("Save as a group")}</Button>
            </div>
          ) : (
            <form className={styles.saveRow} onSubmit={e => { e.preventDefault(); if (naming.trim()) saveAudience(); }}>
              <Field label={mt("Name this group")}><Input autoFocus value={naming} maxLength={80} placeholder={mt("For example, Lapsed regulars")} onChange={e => setNaming(e.target.value)} /></Field>
              <Button size="sm" type="submit" disabled={!naming.trim()}>{mt("Save")}</Button>
              <Button size="sm" variant="ghost" onClick={() => setNaming(null)}>{mt("Cancel")}</Button>
            </form>
          )}
        </div>
      )}

      <div className={styles.listBar}>
        <label className={styles.checkAll}>
          <input type="checkbox" checked={shown.length > 0 && shownSelected === shown.length} disabled={shown.length === 0}
            ref={el => { if (el) el.indeterminate = shownSelected > 0 && shownSelected < shown.length; }}
            onChange={e => toggle(shown.map(c => c.id), e.target.checked)} />
          <span>{mt("Select all")} {shown.length}</span>
        </label>
        <p className={styles.selectedNote} role="status">
          <span className={`${styles.audience} ${selected.size > 0 ? styles.audienceOn : ''}`}>{selected.size} {mt("selected")}</span>
          {hiddenSelected > 0 && !onlySelected && <span>{hiddenSelected} {mt("not in this view")}</span>}
          {selected.size > 0 && <>
            <button type="button" className={styles.link} aria-pressed={onlySelected} onClick={() => setOnlySelected(!onlySelected)}>{onlySelected ? mt("Show everyone") : mt("Show selected")}</button>
            <button type="button" className={styles.link} onClick={() => onChange(new Set())}>{mt("Clear")}</button>
          </>}
        </p>
      </div>

      {shown.length === 0 ? (
        <p className={styles.empty}> {mt("No clients match.")} <button type="button" className={styles.chip} onClick={() => { setFilters(NO_FILTERS); setCustom(false); setOnlySelected(false); }}>{mt("Show everyone")}</button>
        </p>
      ) : (
        <ul className={styles.clientList} aria-label={mt("Clients")}>
          {shown.slice(0, limit).map(c => {
            const on = selected.has(c.id), label = tag(c, now);
            return (
              <li key={c.id}>
                <label className={`${styles.clientRow} ${on ? styles.clientOn : ''}`}>
                  <input type="checkbox" checked={on} onChange={e => toggle([c.id], e.target.checked)} />
                  <span className={`${styles.avatar} ${styles[label?.[0] || 'plain']}`} aria-hidden="true">{initials(c.name)}</span>
                  <span className={styles.clientMain}>{c.name}<span className={styles.rowSub}>{history(c, mt)}</span></span>
                  {label && <span className={`${styles.tag} ${styles[label[0]]}`}>{mt(label[1])}</span>}
                </label>
              </li>
            );
          })}
          {shown.length > limit && (
            <li className={styles.more}><Button size="sm" variant="ghost" onClick={() => setLimit(limit + PAGE)}>{mt("Show more (")}{shown.length - limit} {mt("left)")}</Button></li>
          )}
        </ul>
      )}
    </>
  );
}
