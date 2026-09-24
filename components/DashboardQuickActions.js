'use client';

import { useEffect, useRef, useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Field, { Input, Select, Textarea } from '@/components/ui/Field';
import { createStudioReimbursement, getStudioClient, getStudioClients } from '@/lib/api';
import { formatDob, initials } from '@/lib/format';
import { showError, showFeedback } from '@/lib/feedback';

export default function DashboardQuickActions({ artists = [] }) {
  const [dialog, setDialog] = useState(null);

  const actions = [
    { icon: '⌕', label: 'Find a client', tone: 'info', action: () => setDialog('client') },
    { icon: '$', label: 'Record reimbursement', tone: 'success', action: () => setDialog('reimbursement') },
  ];

  return (
    <>
      <div style={styles.grid}>
        {actions.map(action => (
          <button key={action.label} type="button" style={styles.action} onClick={action.action}>
            <span style={styles.icon(action.tone)} aria-hidden="true">{action.icon}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>
      {dialog === 'client' && <FindClientDialog onClose={() => setDialog(null)} />}
      {dialog === 'reimbursement' && <ReimbursementDialog artists={artists} onClose={() => setDialog(null)} />}
    </>
  );
}

function FindClientDialog({ onClose }) {
  const searchRef = useRef(null);
  const [clients, setClients] = useState([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const search = query.trim();
    if (!search) {
      setClients([]);
      setLoading(false);
      setError('');
      return undefined;
    }

    let active = true;
    setClients([]);
    setLoading(true);
    setError('');
    const timer = window.setTimeout(() => {
      getStudioClients(search)
        .then(data => { if (active) setClients(data.clients ?? []); })
        .catch(err => { if (active) setError(err?.message || 'Clients could not be loaded.'); })
        .finally(() => { if (active) setLoading(false); });
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  async function selectClient(client) {
    setDetailLoading(true);
    setError('');
    try {
      const data = await getStudioClient(client.id);
      setSelected(data.client);
    } catch (err) {
      setError(err?.message || 'Client details could not be loaded.');
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <Dialog title="Find a client" onClose={onClose} initialFocusRef={searchRef} maxWidth={500} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {!selected && <div style={styles.searchWrap}>
        <span aria-hidden="true" style={styles.searchIcon}>⌕</span>
        <input ref={searchRef} type="search" value={query} onChange={event => { setQuery(event.target.value); setSelected(null); }} placeholder="Search name, email, or phone…" aria-label="Search clients" style={styles.searchInput} />
      </div>}
      {(loading || detailLoading) && <p role="status" style={styles.muted}>{detailLoading ? 'Loading client details…' : 'Searching clients…'}</p>}
      {error && <p role="alert" style={styles.error}>{error}</p>}
      {!loading && !error && !selected && (
        <div role="group" aria-label="Client search results" style={styles.results}>
          {clients.map(client => (
            <button key={client.id ?? client.email ?? client.phone ?? client.name} type="button" disabled={detailLoading} onClick={() => selectClient(client)} style={styles.result}>
              <strong>{client.name || 'Unnamed client'}</strong>
              <span style={styles.muted}>{[client.email, client.phone].filter(Boolean).join(' · ') || 'No contact details'}</span>
            </button>
          ))}
          {!query.trim() && <p style={styles.muted}>Start typing to search clients.</p>}
          {query.trim() && clients.length === 0 && <p style={styles.muted}>No matching clients.</p>}
        </div>
      )}
      {selected && (
        <div style={styles.clientCard}>
          <button type="button" onClick={() => setSelected(null)} style={styles.back}><span aria-hidden="true">←</span> Back to results</button>
          <div style={styles.clientIdentity}>
            <span style={styles.clientAvatar}>{initials(selected.name || '?')}</span>
            <div style={styles.clientIdentityCopy}>
              <strong style={styles.clientName}>{selected.name || 'Unnamed client'}</strong>
              <span style={styles.clientIdentityMeta}>{selected.email || selected.phone || 'No contact details'}</span>
            </div>
          </div>
          <div style={styles.clientSection}>
            <span style={styles.clientSectionLabel}>Contact</span>
            <div style={styles.clientFields}>
              <ClientField label="Email" value={selected.email} />
              <ClientField label="Phone" value={selected.phone} />
              <ClientField label="Date of birth" value={selected.dob ? formatDob(selected.dob) : null} />
            </div>
          </div>
          <div style={styles.clientSection}>
            <span style={styles.clientSectionLabel}>Client information</span>
            <div style={styles.clientFields}>
              <ClientField label="Allergies" value={selected.allergies} />
              <ClientField label="Notes" value={selected.notes} />
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function ClientField({ label, value }) {
  const missing = !value;
  return <div style={styles.clientField}><span style={styles.fieldLabel}>{label}</span><span style={missing ? styles.missingValue : styles.fieldValue}>{value || 'Not recorded'}</span></div>;
}

function ReimbursementDialog({ artists, onClose }) {
  const [artistId, setArtistId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const value = Number(amount);
    if (!artistId || !description.trim() || !Number.isFinite(value) || value <= 0) {
      setError('Choose an artist, enter a positive amount, and add a description.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createStudioReimbursement(artistId, value, description.trim());
      showFeedback('Reimbursement recorded.', 'success');
      window.dispatchEvent(new CustomEvent('reimbursement-created'));
      onClose();
    } catch (err) {
      setError(err?.message || 'The reimbursement could not be recorded.');
      showError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog title="Record reimbursement" onClose={onClose} dismissDisabled={saving} maxWidth={500}>
      <form onSubmit={submit} style={styles.form}>
        <Field label="Artist" required><Select disabled={saving} value={artistId} onChange={event => setArtistId(event.target.value)}><option value="">Select artist</option>{artists.map(artist => <option key={artist.artistId ?? artist.id} value={artist.artistId ?? artist.id}>{artist.name}</option>)}</Select></Field>
        <Field label="Amount" hint="Amount in dollars" required><Input disabled={saving} className="reimbursement-number-input" type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} /></Field>
        <Field label="Description" required><Textarea disabled={saving} value={description} onChange={event => setDescription(event.target.value)} placeholder="What was reimbursed?" /></Field>
        {artists.length === 0 && <p role="alert" style={styles.error}>There are no approved artists to reimburse.</p>}
        {error && <p role="alert" style={styles.error}>{error}</p>}
        <div style={styles.actions}><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" loading={saving} loadingLabel="Recording…" disabled={artists.length === 0}>Record reimbursement</Button></div>
      </form>
    </Dialog>
  );
}

const styles = {
  grid: { display: 'flex', flexWrap: 'wrap', gap: '0.6rem' },
  action: { padding: '0.5rem 0.9rem 0.5rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 999, background: 'var(--bg-card)', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  icon: tone => ({ width: 28, height: 28, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '50%', background: `var(--color-${tone}-surface)`, border: `1px solid var(--color-${tone}-border)`, color: `var(--color-${tone})`, fontSize: '0.95rem', fontWeight: 700 }),

  searchWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  searchIcon: { position: 'absolute', left: '0.8rem', color: 'var(--text-ghost)', fontSize: '1rem', pointerEvents: 'none' },
  searchInput: { width: '100%', boxSizing: 'border-box', padding: '0.7rem 0.8rem 0.7rem 2.25rem', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', font: 'inherit' },
  results: { display: 'flex', flexDirection: 'column', marginTop: '0.75rem' }, result: { display: 'flex', flexDirection: 'column', gap: 3, padding: '0.75rem', textAlign: 'left', border: 0, borderBottom: '1px solid var(--border-faint)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }, muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.78rem' }, error: { margin: 0, color: 'var(--color-danger)', fontSize: '0.78rem' },
  clientCard: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  back: { alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.4rem', border: 0, padding: 0, background: 'transparent', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' },
  clientIdentity: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.9rem', borderRadius: 10, background: 'var(--bg-input)', border: '1px solid var(--border-faint)' },
  clientAvatar: { width: 42, height: 42, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '50%', background: 'var(--accent-tint)', border: '1px solid var(--accent-tint-border)', color: 'var(--accent)', fontSize: '0.78rem', fontWeight: 700 },
  clientIdentityCopy: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  clientName: { color: 'var(--text)', fontSize: '1rem' },
  clientIdentityMeta: { color: 'var(--text-secondary)', fontSize: '0.74rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  clientSection: { display: 'flex', flexDirection: 'column', gap: '0.55rem' },
  clientSectionLabel: { color: 'var(--text-ghost)', fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase' },
  clientFields: { overflow: 'hidden', borderRadius: 9, border: '1px solid var(--border-faint)', background: 'var(--bg-card)' },
  clientField: { display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr)', gap: 12, padding: '0.65rem 0.75rem', borderBottom: '1px solid var(--border-faint)', color: 'var(--text)', fontSize: '0.8rem' },
  fieldLabel: { color: 'var(--text-secondary)' },
  fieldValue: { color: 'var(--text-dim)', overflowWrap: 'anywhere' },
  missingValue: { color: 'var(--text-ghost)', fontStyle: 'italic' },
  form: { display: 'flex', flexDirection: 'column', gap: '0.9rem' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: '0.35rem' },
};
