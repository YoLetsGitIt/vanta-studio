'use client';

import { useEffect, useMemo, useState } from 'react';
import { createStudioReimbursement, getStudioClients } from '@/lib/api';
import { formatDob } from '@/lib/format';
import { showError, showFeedback } from '@/lib/feedback';

export default function DashboardQuickActions({ artists = [] }) {
  const [dialog, setDialog] = useState(null);

  const actions = [
    { icon: '⌕', label: 'Find a client', detail: 'Open a client quick view', action: () => setDialog('client') },
    { icon: '$', label: 'Record reimbursement', detail: 'Add an approved artist expense', action: () => setDialog('reimbursement') },
  ];

  return (
    <>
      <div style={styles.grid} className="studio-home-four-col">
        {actions.map(action => (
          <button key={action.label} type="button" style={styles.action} onClick={action.action}>
            <span style={styles.icon}>{action.icon}</span>
            <span style={styles.copy}><span>{action.label}</span><small style={styles.detail}>{action.detail}</small></span>
            <span style={styles.arrow}>→</span>
          </button>
        ))}
      </div>
      {dialog === 'client' && <FindClientDialog onClose={() => setDialog(null)} />}
      {dialog === 'reimbursement' && <ReimbursementDialog artists={artists} onClose={() => setDialog(null)} />}
    </>
  );
}

function FindClientDialog({ onClose }) {
  const [clients, setClients] = useState([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getStudioClients()
      .then(data => setClients(data.clients ?? []))
      .catch(err => setError(err?.message || 'Clients could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return clients.slice(0, 8);
    return clients.filter(client => [client.name, client.email, client.phone].some(value => String(value ?? '').toLowerCase().includes(needle))).slice(0, 12);
  }, [clients, query]);

  return (
    <Dialog title="Find a client" onClose={onClose}>
      <input autoFocus type="search" value={query} onChange={event => { setQuery(event.target.value); setSelected(null); }} placeholder="Search name, email, or phone…" aria-label="Search clients" style={styles.input} />
      {loading && <p role="status" style={styles.muted}>Loading clients…</p>}
      {error && <p role="alert" style={styles.error}>{error}</p>}
      {!loading && !error && !selected && (
        <div role="listbox" aria-label="Clients" style={styles.results}>
          {matches.map(client => (
            <button key={client.id ?? client.email ?? client.phone ?? client.name} type="button" role="option" onClick={() => setSelected(client)} style={styles.result}>
              <strong>{client.name || 'Unnamed client'}</strong>
              <span style={styles.muted}>{[client.email, client.phone].filter(Boolean).join(' · ') || 'No contact details'}</span>
            </button>
          ))}
          {matches.length === 0 && <p style={styles.muted}>No matching clients.</p>}
        </div>
      )}
      {selected && (
        <div style={styles.clientCard}>
          <button type="button" onClick={() => setSelected(null)} style={styles.back}>← Results</button>
          <strong style={styles.clientName}>{selected.name || 'Unnamed client'}</strong>
          <ClientField label="Email" value={selected.email} />
          <ClientField label="Phone" value={selected.phone} />
          <ClientField label="Date of birth" value={selected.dob ? formatDob(selected.dob) : null} />
          <ClientField label="Allergies" value={selected.allergies} />
          <ClientField label="Notes" value={selected.notes} />
        </div>
      )}
    </Dialog>
  );
}

function ClientField({ label, value }) {
  return <div style={styles.clientField}><span style={styles.fieldLabel}>{label}</span><span>{value || 'Not recorded'}</span></div>;
}

function ReimbursementDialog({ artists, onClose }) {
  const [artistId, setArtistId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
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
    <Dialog title="Record reimbursement" onClose={onClose}>
      <form onSubmit={submit} style={styles.form}>
        <label style={styles.label}>Artist<select autoFocus value={artistId} onChange={event => setArtistId(event.target.value)} style={styles.input}><option value="">Select artist</option>{artists.map(artist => <option key={artist.artistId ?? artist.id} value={artist.artistId ?? artist.id}>{artist.name}</option>)}</select></label>
        <label style={styles.label}>Amount<div style={styles.money}><span>$</span><input type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} style={styles.moneyInput} /></div></label>
        <label style={styles.label}>Description<textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="What was reimbursed?" style={{ ...styles.input, minHeight: 82, resize: 'vertical' }} /></label>
        {artists.length === 0 && <p role="alert" style={styles.error}>There are no approved artists to reimburse.</p>}
        {error && <p role="alert" style={styles.error}>{error}</p>}
        <div style={styles.actions}><button type="button" onClick={onClose} style={styles.cancel}>Cancel</button><button type="submit" disabled={saving || artists.length === 0} style={styles.confirm}>{saving ? 'Recording…' : 'Record reimbursement'}</button></div>
      </form>
    </Dialog>
  );
}

function Dialog({ title, onClose, children }) {
  useEffect(() => {
    const handler = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
  return <div style={styles.overlay} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-label={title} style={styles.dialog}><div style={styles.header}><h2 style={styles.title}>{title}</h2><button type="button" onClick={onClose} aria-label="Close" style={styles.close}>×</button></div>{children}</section></div>;
}

const styles = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.65rem' },
  action: { minHeight: 70, padding: '0.8rem 0.9rem', border: '1px solid var(--border-faint)', borderRadius: 10, background: 'var(--bg-card)', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.65rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' },
  icon: { width: 27, height: 27, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 7, background: 'var(--accent-tint)', color: 'var(--accent)', fontSize: '0.88rem' },
  copy: { display: 'flex', flexDirection: 'column', gap: 3 }, detail: { color: 'var(--text-ghost)', fontSize: '0.66rem', fontWeight: 400 }, arrow: { marginLeft: 'auto', color: 'var(--text-ghost)' },
  overlay: { position: 'fixed', inset: 0, zIndex: 1200, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(5,7,10,0.72)', backdropFilter: 'blur(3px)' },
  dialog: { width: 'min(500px, 100%)', maxHeight: 'min(720px, calc(100vh - 40px))', overflow: 'auto', padding: '1.25rem', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-modal)', boxShadow: 'var(--shadow-modal)' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }, title: { margin: 0, color: 'var(--text)', fontSize: '1.05rem' }, close: { border: 0, background: 'transparent', color: 'var(--text-muted)', fontSize: '1.35rem', cursor: 'pointer' },
  input: { width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.75rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', font: 'inherit' },
  results: { display: 'flex', flexDirection: 'column', marginTop: '0.75rem' }, result: { display: 'flex', flexDirection: 'column', gap: 3, padding: '0.75rem', textAlign: 'left', border: 0, borderBottom: '1px solid var(--border-faint)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }, muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.78rem' }, error: { margin: 0, color: '#e86f6f', fontSize: '0.78rem' },
  clientCard: { display: 'flex', flexDirection: 'column', gap: '0.8rem' }, back: { alignSelf: 'flex-start', border: 0, padding: 0, background: 'transparent', color: 'var(--accent)', cursor: 'pointer' }, clientName: { color: 'var(--text)', fontSize: '1rem' }, clientField: { display: 'grid', gridTemplateColumns: '110px 1fr', gap: 12, color: 'var(--text)', fontSize: '0.82rem' }, fieldLabel: { color: 'var(--text-ghost)' },
  form: { display: 'flex', flexDirection: 'column', gap: '0.9rem' }, label: { display: 'flex', flexDirection: 'column', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.76rem' }, money: { display: 'flex', alignItems: 'center', gap: 7, paddingLeft: '0.75rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-muted)' }, moneyInput: { width: '100%', padding: '0.65rem 0.75rem 0.65rem 0', border: 0, outline: 0, background: 'transparent', color: 'var(--text)', font: 'inherit' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: '0.35rem' }, cancel: { border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.8rem', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }, confirm: { border: 0, borderRadius: 8, padding: '0.6rem 0.8rem', background: 'var(--accent)', color: 'var(--accent-contrast)', fontWeight: 700, cursor: 'pointer' },
};
