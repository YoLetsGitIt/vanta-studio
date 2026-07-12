'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { listStudioBookings, getStudioClients, getClientConsents, recordConsentInStudio, getNotes, addNote, deleteNote, ensureStudioClient, patchStudioClient } from '@/lib/api';

const TATTOO_STYLES = [
  'Traditional', 'Neo Traditional', 'Blackwork', 'Fine Line', 'Realism',
  'Japanese', 'Watercolor', 'Geometric', 'Tribal', 'Dotwork',
  'Illustrative', 'New School', 'Biomechanical', 'Lettering', 'Minimalist',
];
import { getCached, setCached } from '@/lib/cache';
import { statusColors, capitalise } from '@/lib/status';

function ClientsInner() {
  const params = useSearchParams();
  const [bookings, setBookings] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [consents, setConsents] = useState({});
  const [consentVersion, setConsentVersion] = useState('1');

  // Auto-select a client when navigated from booking detail.
  useEffect(() => {
    const client = params.get('client');
    if (client) setSelected(client);
  }, [params]);

  useEffect(() => {
    async function load() {
      const key = 'clients:all';
      const contactsKey = 'clients:contacts';
      const cached = getCached(key);
      const cachedContacts = getCached(contactsKey);
      if (cached && cachedContacts) {
        setBookings(cached);
        setContacts(cachedContacts);
        setLoading(false);
        return;
      }
      try {
        const [data, contactData] = await Promise.all([
          listStudioBookings(''),
          getStudioClients().catch(() => ({ clients: [] })), // contact book is optional
        ]);
        const b = data.bookings ?? [];
        const c = contactData.clients ?? [];
        setCached(key, b);
        setCached(contactsKey, c);
        setBookings(b);
        setContacts(c);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Once bookings load, batch-fetch consent statuses.
  useEffect(() => {
    if (bookings.length === 0) return;
    const emails = [...new Set(bookings.map(b => b.requester_email).filter(Boolean))];
    if (emails.length === 0) return;
    getClientConsents(emails)
      .then(data => {
        setConsents(data.consents ?? {});
        setConsentVersion(data.current_version ?? '1');
      })
      .catch(() => {});
  }, [bookings]);

  const clients = useMemo(() => {
    const map = new Map();
    for (const b of bookings) {
      const key = b.requester_email || b.requester_name;
      if (!map.has(key)) {
        map.set(key, {
          name: b.requester_name,
          email: b.requester_email,
          phone: b.requester_phone,
          dob: b.dob || null,
          bookings: [],
          lastBooking: null,
        });
      }
      const client = map.get(key);
      client.bookings.push(b);
      if (!client.dob && b.dob) client.dob = b.dob;
      const date = b.chosen_time || b.proposed_time_primary || b.created_at;
      if (date && (!client.lastBooking || new Date(date) > new Date(client.lastBooking))) {
        client.lastBooking = date;
      }
    }
    // Merge in imported contact-book entries (may have zero bookings).
    const byEmail = new Map();
    const byPhone = new Map();
    for (const c of map.values()) {
      if (c.email) byEmail.set(c.email.toLowerCase(), c);
      if (c.phone) byPhone.set(c.phone.replace(/[^0-9+]/g, ''), c);
    }
    for (const contact of contacts) {
      const existing =
        (contact.email && byEmail.get(contact.email)) ||
        (contact.phone && byPhone.get(contact.phone));
      if (existing) {
        if (!existing.dob && contact.dob) existing.dob = contact.dob;
        if (!existing.phone && contact.phone) existing.phone = contact.phone;
        existing.contactId = contact.id;
        existing.designPreferences = parseStyles(contact.design_preferences);
        existing.allergies = contact.allergies ?? null;
        existing.painTolerance = contact.pain_tolerance ?? null;
        continue;
      }
      map.set(contact.email || contact.phone || contact.name, {
        name: contact.name,
        email: contact.email ?? null,
        phone: contact.phone ?? null,
        dob: contact.dob ?? null,
        bookings: [],
        lastBooking: null,
        imported: true,
        contactId: contact.id,
        designPreferences: parseStyles(contact.design_preferences),
        allergies: contact.allergies ?? null,
        painTolerance: contact.pain_tolerance ?? null,
      });
    }

    return Array.from(map.values()).sort((a, b) => {
      if (!a.lastBooking) return 1;
      if (!b.lastBooking) return -1;
      return new Date(b.lastBooking) - new Date(a.lastBooking);
    });
  }, [bookings, contacts]);

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q),
    );
  }, [clients, search]);

  const selectedClient = selected ? filtered.find(c => (c.email || c.name) === selected) : null;

  function exportCSV() {
    const rows = [
      ['Name', 'Email', 'Phone', 'DOB', 'Total Bookings', 'Last Booking'],
      ...clients.map(c => [
        c.name,
        c.email ?? '',
        c.phone ?? '',
        c.dob ?? '',
        c.bookings.length,
        c.lastBooking ? new Date(c.lastBooking).toLocaleDateString('en-AU') : '',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'clients.csv';
    a.click();
  }

  const handleRecordConsent = useCallback(async (email) => {
    await recordConsentInStudio(email);
    setConsents(prev => ({
      ...prev,
      [email]: { consent_version: consentVersion, agreed_at: new Date().toISOString(), source: 'in_studio' },
    }));
  }, [consentVersion]);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={s.title}>Clients</h1>
          <button
            onClick={exportCSV}
            disabled={clients.length === 0}
            style={s.exportBtn}
            title="Export client list as CSV"
          >
            Export CSV
          </button>
        </div>
        <div style={s.searchWrap}>
          <input
            type="text"
            placeholder="Search by name, email or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={s.searchInput}
          />
        </div>
      </div>

      <div style={s.layout}>
        <div style={s.list}>
          {loading && <p style={s.msg}>Loading…</p>}
          {error && <p style={{ ...s.msg, color: '#e86f6f' }}>{error}</p>}
          {!loading && !error && filtered.length === 0 && (
            <p style={s.msg}>No clients found.</p>
          )}
          {filtered.map(client => {
            const key = client.email || client.name;
            const active = selected === key;
            const consent = client.email ? consents[client.email] : null;
            const consentStatus = getConsentStatus(consent, consentVersion);
            return (
              <div
                key={key}
                onClick={() => setSelected(prev => prev === key ? null : key)}
                style={{ ...s.row, background: active ? 'var(--bg-row-active)' : undefined, borderColor: active ? 'var(--border-strong)' : 'var(--border-faint)' }}
              >
                <div style={s.clientAvatar}>
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div style={s.clientInfo}>
                  <span style={s.clientName}>{client.name}</span>
                  <span style={s.clientMeta}>
                    {client.email || client.phone || '—'}
                  </span>
                </div>
                <div style={s.clientStats}>
                  <span style={s.sessionCount}>{client.bookings.length} session{client.bookings.length !== 1 ? 's' : ''}</span>
                  {client.imported && <span style={{ ...s.badge, ...s.badgeGrey }}>Imported</span>}
                  <ConsentBadge status={consentStatus} />
                </div>
              </div>
            );
          })}
        </div>

        {selectedClient && (
          <ClientDetail
            client={selectedClient}
            onClose={() => setSelected(null)}
            consent={selectedClient.email ? consents[selectedClient.email] : null}
            consentVersion={consentVersion}
            onRecordConsent={handleRecordConsent}
          />
        )}
      </div>
    </div>
  );
}

export default function ClientsPage() {
  return (
    <Suspense>
      <ClientsInner />
    </Suspense>
  );
}

function getConsentStatus(consent, currentVersion) {
  if (!consent) return 'none';
  if (consent.consent_version === currentVersion) return 'current';
  return 'outdated';
}

function ConsentBadge({ status }) {
  if (status === 'current') return <span style={{ ...s.badge, ...s.badgeGreen }}>Consented</span>;
  if (status === 'outdated') return <span style={{ ...s.badge, ...s.badgeYellow }}>Outdated</span>;
  return <span style={{ ...s.badge, ...s.badgeRed }}>No consent</span>;
}

function ClientDetail({ client, onClose, consent, consentVersion, onRecordConsent }) {
  const [recording,   setRecording]   = useState(false);
  const [recordErr,   setRecordErr]   = useState('');
  const [notes,       setNotes]       = useState(null); // null = loading
  const [noteInput,   setNoteInput]   = useState('');
  const [noteAdding,  setNoteAdding]  = useState(false);
  const [noteErr,     setNoteErr]     = useState('');

  // Profile fields
  const [contactId,      setContactId]      = useState(client.contactId ?? null);
  const [styles,         setStyles]         = useState(client.designPreferences ?? []);
  const [hasAllergies,   setHasAllergies]   = useState(!!(client.allergies));
  const [allergyDetails, setAllergyDetails] = useState(client.allergies ?? '');
  const [pain,           setPain]           = useState(client.painTolerance ?? '');
  const [profSaving,     setProfSaving]     = useState(false);
  const [profSaved,      setProfSaved]      = useState(false);
  const [profErr,        setProfErr]        = useState('');

  useEffect(() => {
    setContactId(client.contactId ?? null);
    setStyles(client.designPreferences ?? []);
    setHasAllergies(!!(client.allergies));
    setAllergyDetails(client.allergies ?? '');
    setPain(client.painTolerance ?? '');
    setProfSaved(false);
    setProfErr('');
  }, [client.email]);

  useEffect(() => {
    if (!client.email) { setNotes([]); return; }
    setNotes(null);
    getNotes('client', client.email)
      .then(d => setNotes(d.notes ?? []))
      .catch(() => setNotes([]));
  }, [client.email]);

  async function handleAddNote() {
    if (!noteInput.trim() || !client.email) return;
    setNoteAdding(true);
    setNoteErr('');
    try {
      const d = await addNote('client', client.email, noteInput.trim());
      setNotes(prev => [d.note, ...(prev ?? [])]);
      setNoteInput('');
    } catch (e) {
      setNoteErr(e.message);
    } finally {
      setNoteAdding(false);
    }
  }

  async function handleDeleteNote(id) {
    try {
      await deleteNote(id);
      setNotes(prev => (prev ?? []).filter(n => n.id !== id));
    } catch { /* silent */ }
  }

  async function handleSaveProfile() {
    setProfSaving(true);
    setProfErr('');
    try {
      let id = contactId;
      if (!id) {
        const { client: c } = await ensureStudioClient(client.name, client.email ?? '', client.phone ?? '');
        id = c.id;
        setContactId(id);
      }
      await patchStudioClient(id, {
        design_preferences: styles.length > 0 ? JSON.stringify(styles) : null,
        allergies: hasAllergies ? (allergyDetails || null) : null,
        pain_tolerance: pain !== '' ? pain : null,
      });
      setProfSaved(true);
      setTimeout(() => setProfSaved(false), 2500);
    } catch (e) {
      setProfErr(e.message);
    } finally {
      setProfSaving(false);
    }
  }

  const sorted = [...client.bookings].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at),
  );

  const consentStatus = getConsentStatus(consent, consentVersion);

  async function handleRecord() {
    if (!client.email) return;
    setRecording(true);
    setRecordErr('');
    try {
      await onRecordConsent(client.email);
    } catch (e) {
      setRecordErr(e.message);
    } finally {
      setRecording(false);
    }
  }

  return (
    <aside style={s.panel}>
      <div style={s.panelHeader}>
        <span style={s.panelTitle}>{client.name}</span>
        <button onClick={onClose} style={s.closeBtn}>✕</button>
      </div>
      <div style={s.panelBody}>
        {client.email && <Field label="Email">{client.email}</Field>}
        {client.phone && <Field label="Phone">{client.phone}</Field>}
        {client.dob && <Field label="Date of birth">{formatDob(client.dob)}</Field>}
        <Field label="Total sessions">{client.bookings.length}</Field>
        <Field label="Completed">{client.bookings.filter(b => b.outcome === 'completed').length}</Field>

        <div style={s.consentSection}>
          <span style={s.sectionLabel}>Consent form</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.5rem' }}>
            <ConsentBadge status={consentStatus} />
            {consent && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-ghost)' }}>
                v{consent.consent_version} · {new Date(consent.agreed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
          {(consentStatus === 'none' || consentStatus === 'outdated') && client.email && (
            <>
              <button
                onClick={handleRecord}
                disabled={recording}
                style={{ ...s.consentBtn, marginTop: '0.6rem' }}
              >
                {recording ? 'Recording…' : consentStatus === 'outdated' ? 'Record updated consent' : 'Record consent'}
              </button>
              {recordErr && <p style={{ fontSize: '0.72rem', color: '#e86f6f', margin: '0.3rem 0 0' }}>{recordErr}</p>}
            </>
          )}
        </div>

        {/* Profile fields */}
        <div style={{ borderTop: '1px solid var(--border-faint)', paddingTop: '1rem', marginTop: '0.25rem' }}>
          <span style={s.sectionLabel}>Client profile</span>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

            {/* Design preferences — multiselect pills */}
            <div>
              <span style={s.fieldLabel}>Design preferences</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.35rem' }}>
                {TATTOO_STYLES.map(style => {
                  const active = styles.includes(style);
                  return (
                    <button
                      key={style}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => setStyles(prev => active ? prev.filter(s => s !== style) : [...prev, style])}
                      style={{
                        fontSize: '0.72rem', fontWeight: 600, padding: '0.25rem 0.6rem',
                        borderRadius: 20, border: `1px solid ${active ? 'var(--accent-active-border)' : 'var(--border-faint)'}`,
                        background: active ? 'var(--accent-active-tint)' : 'transparent',
                        color: active ? 'var(--accent)' : 'var(--text-ghost)',
                        cursor: 'pointer', transition: 'all 0.1s',
                      }}
                    >{style}</button>
                  );
                })}
              </div>
            </div>

            {/* Allergies */}
            <div>
              <span style={s.fieldLabel}>Allergies / skin conditions</span>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
                {['No', 'Yes'].map(opt => {
                  const active = opt === 'Yes' ? hasAllergies : !hasAllergies;
                  return (
                    <button
                      key={opt}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => setHasAllergies(opt === 'Yes')}
                      style={{
                        fontSize: '0.75rem', fontWeight: 600, padding: '0.28rem 0.85rem',
                        borderRadius: 6, border: `1px solid ${active ? 'var(--accent-active-border)' : 'var(--border-faint)'}`,
                        background: active ? 'var(--accent-active-tint)' : 'transparent',
                        color: active ? 'var(--accent)' : 'var(--text-ghost)',
                        cursor: 'pointer',
                      }}
                    >{opt}</button>
                  );
                })}
              </div>
              {hasAllergies && (
                <textarea
                  rows={2}
                  placeholder="e.g. latex allergy, sensitive skin, keloid-prone…"
                  value={allergyDetails}
                  onChange={e => setAllergyDetails(e.target.value)}
                  style={{ ...s.profileInput, marginTop: '0.4rem' }}
                />
              )}
            </div>

            {/* Pain tolerance 0-10 */}
            <div>
              <span style={s.fieldLabel}>Pain tolerance</span>
              <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                {Array.from({ length: 11 }, (_, i) => String(i)).map(n => {
                  const active = pain === n;
                  return (
                    <button
                      key={n}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => setPain(prev => prev === n ? '' : n)}
                      style={{
                        width: 30, height: 30, borderRadius: 6, flexShrink: 0,
                        border: `1px solid ${active ? 'var(--accent-active-border)' : 'var(--border-faint)'}`,
                        background: active ? 'var(--accent-active-tint)' : 'transparent',
                        color: active ? 'var(--accent)' : 'var(--text-ghost)',
                        fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                      }}
                    >{n}</button>
                  );
                })}
              </div>
              {pain !== '' && (
                <p style={{ fontSize: '0.7rem', color: 'var(--text-ghost)', marginTop: '0.3rem' }}>
                  {pain === '0' ? 'No tolerance — very sensitive' :
                   pain <= '3' ? 'Low tolerance' :
                   pain <= '6' ? 'Moderate tolerance' :
                   pain <= '8' ? 'High tolerance' :
                   'Very high tolerance'}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <button onClick={handleSaveProfile} disabled={profSaving} style={s.consentBtn}>
                {profSaving ? 'Saving…' : profSaved ? 'Saved!' : 'Save profile'}
              </button>
              {profErr && <span style={{ fontSize: '0.72rem', color: '#e86f6f' }}>{profErr}</span>}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div style={{ borderTop: '1px solid var(--border-faint)', paddingTop: '1rem', marginTop: '0.25rem' }}>
          <span style={s.sectionLabel}>Notes</span>
          <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <textarea
              rows={2}
              placeholder="Add a note about this client…"
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddNote(); }}
              style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', background: 'var(--bg-input)', border: '1px solid var(--border-faint)', borderRadius: 6, padding: '0.45rem 0.6rem', fontSize: '0.8rem', color: 'var(--text)', fontFamily: 'inherit', lineHeight: 1.5 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {noteErr && <span style={{ fontSize: '0.72rem', color: '#e86f6f' }}>{noteErr}</span>}
              <span style={{ fontSize: '0.68rem', color: 'var(--text-ghost)', marginLeft: 'auto', marginRight: '0.5rem' }}>⌘↵ to save</span>
              <button
                onClick={handleAddNote}
                disabled={noteAdding || !noteInput.trim()}
                style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.75rem', borderRadius: 5, border: '1px solid var(--border-faint)', background: 'var(--bg-chip)', color: 'var(--text-dim)', cursor: 'pointer', opacity: (!noteInput.trim() || noteAdding) ? 0.45 : 1 }}
              >
                {noteAdding ? 'Saving…' : 'Add note'}
              </button>
            </div>
            {notes === null && <p style={{ fontSize: '0.78rem', color: 'var(--text-ghost)' }}>Loading…</p>}
            {notes !== null && notes.length === 0 && <p style={{ fontSize: '0.78rem', color: 'var(--text-ghost)' }}>No notes yet.</p>}
            {notes !== null && notes.map(n => (
              <div key={n.id} style={{ background: 'var(--bg-chip)', border: '1px solid var(--border-faint)', borderRadius: 6, padding: '0.5rem 0.65rem', position: 'relative' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.content}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-ghost)' }}>
                    {new Date(n.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <button
                    onClick={() => handleDeleteNote(n.id)}
                    style={{ fontSize: '0.68rem', color: '#e86f6f', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border-faint)', paddingTop: '1rem', marginTop: '0.25rem' }}>
          <span style={s.sectionLabel}>Booking history</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.75rem' }}>
            {sorted.map(b => (
              <div key={b.id} style={s.historyRow}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text)', fontWeight: 600 }}>
                    {[b.session_type ? capitalise(b.session_type.replace(/_/g, ' ')) : null, b.body_location || null].filter(Boolean).join(' · ') || '—'}
                  </span>
                  <span style={{ fontSize: '0.73rem', color: 'var(--text-faint)' }}>
                    {new Date(b.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: statusColors(b.status).text }}>
                  {capitalise(b.outcome ?? b.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>{children}</span>
    </div>
  );
}

function parseStyles(raw) {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function formatDob(dob) {
  if (!dob) return null;
  return new Date(dob + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

const s = {
  page: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
  header: {
    padding: '1.75rem 2rem 1.25rem',
    borderBottom: '1px solid var(--border-faint)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
    flexShrink: 0,
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.01em',
  },
  exportBtn: {
    padding: '0.35rem 0.85rem', borderRadius: 20,
    border: '1px solid var(--border)', background: 'transparent',
    color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 500,
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  searchWrap: {
    maxWidth: 360,
  },
  searchInput: {
    width: '100%',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0.55rem 0.85rem',
    fontSize: '0.85rem',
    color: 'var(--text)',
    outline: 'none',
  },
  layout: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  msg: {
    fontSize: '0.875rem',
    color: 'var(--text-faint)',
    padding: '0.5rem 0',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    padding: '0.85rem 1rem',
    borderRadius: 10,
    border: '1px solid var(--border-faint)',
    cursor: 'pointer',
    transition: 'background 0.12s, border-color 0.12s',
  },
  clientAvatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'var(--bg-chip)',
    color: 'var(--text-muted)',
    fontSize: '0.875rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  clientInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
    minWidth: 0,
  },
  clientName: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text)',
  },
  clientMeta: {
    fontSize: '0.75rem',
    color: 'var(--text-faint)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  clientStats: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '0.3rem',
    flexShrink: 0,
  },
  sessionCount: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  badge: {
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    padding: '0.15rem 0.45rem',
    borderRadius: 4,
  },
  badgeGreen: {
    background: 'rgba(76,201,138,0.12)',
    color: '#4cc98a',
  },
  badgeYellow: {
    background: 'rgba(245,158,58,0.12)',
    color: '#f59e3a',
  },
  badgeRed: {
    background: 'rgba(232,111,111,0.12)',
    color: '#e86f6f',
  },
  badgeGrey: {
    background: 'var(--bg-chip)',
    color: 'var(--text-secondary)',
  },
  panel: {
    position: 'absolute', top: 0, right: 0, bottom: 0, width: 320,
    background: 'var(--bg-panel)',
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 10,
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1.25rem 1.25rem 1rem',
    borderBottom: '1px solid var(--border-faint)',
    flexShrink: 0,
  },
  panelTitle: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: 'var(--text)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-faint)',
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  panelBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  consentSection: {
    borderTop: '1px solid var(--border-faint)',
    paddingTop: '0.85rem',
    display: 'flex',
    flexDirection: 'column',
  },
  sectionLabel: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'var(--text-ghost)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  consentBtn: {
    background: 'var(--bg-chip)',
    border: '1px solid var(--border-strong)',
    borderRadius: 7,
    color: 'var(--text-dim)',
    fontSize: '0.78rem',
    fontWeight: 600,
    padding: '0.45rem 0.75rem',
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  fieldLabel: {
    display: 'block',
    fontSize: '0.68rem',
    fontWeight: 600,
    color: 'var(--text-ghost)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '0.3rem',
  },
  profileInput: {
    width: '100%',
    boxSizing: 'border-box',
    resize: 'vertical',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-faint)',
    borderRadius: 6,
    padding: '0.4rem 0.6rem',
    fontSize: '0.8rem',
    color: 'var(--text)',
    fontFamily: 'inherit',
    lineHeight: 1.5,
    outline: 'none',
  },
  historyRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.5rem',
  },
};
