'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { listStudioBookings, getStudioClients, getClientConsents, getNotes, addNote, deleteNote, ensureStudioClient, patchStudioClient, generateConsentLink, listConsentTemplates, getClientConsentSubmissions, getBatchClientConsentSubmissions } from '@/lib/api';

const TATTOO_STYLES = [
  'Traditional', 'Neo Traditional', 'Blackwork', 'Fine Line', 'Realism',
  'Japanese', 'Watercolor', 'Geometric', 'Tribal', 'Dotwork',
  'Illustrative', 'New School', 'Biomechanical', 'Lettering', 'Minimalist',
];
import { getCached, setCached } from '@/lib/cache';
import { statusColors, capitalise } from '@/lib/status';
import { formatDob } from '@/lib/format';
import { useLanguage } from '@/lib/i18n';
import { showError } from '@/lib/feedback';

const CLIENTS_PER_PAGE = 25;

async function listAllStudioBookings() {
  const bookings = [];
  const seenCursors = new Set();
  let cursor = '';

  do {
    const data = await listStudioBookings('', cursor);
    bookings.push(...(data.bookings ?? []));
    const nextCursor = data.next_cursor ?? '';
    if (!nextCursor || seenCursors.has(nextCursor)) break;
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  } while (cursor);

  return bookings;
}

function ClientsInner() {
  const { t } = useLanguage();
  const params = useSearchParams();
  const [bookings, setBookings] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [consents, setConsents] = useState({});
  const [consentVersion, setConsentVersion] = useState('1');
  const [consentTemplates, setConsentTemplates] = useState([]);
  const [submissionsByEmail, setSubmissionsByEmail] = useState({});

  // Auto-select a client when navigated from booking detail.
  useEffect(() => {
    const client = params.get('client');
    if (client) setSelected(client);
  }, [params]);

  useEffect(() => {
    async function load() {
      const key = 'clients:all:v2';
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
        const [data, contactData, templateData] = await Promise.all([
          listAllStudioBookings(),
          getStudioClients().catch(() => ({ clients: [] })), // contact book is optional
          listConsentTemplates().catch(() => ({ templates: [] })),
        ]);
        setConsentTemplates(templateData.templates ?? []);
        const b = data;
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

  // Once bookings load, batch-fetch consent statuses from both systems.
  useEffect(() => {
    if (bookings.length === 0) return;
    const emails = [...new Set(bookings.map(b => b.requester_email).filter(Boolean))];
    if (emails.length === 0) return;
    getClientConsents(emails)
      .then(data => {
        setConsents(data.consents ?? {});
        setConsentVersion(data.current_version ?? '1');
      })
      .catch(showError);
    getBatchClientConsentSubmissions(emails)
      .then(data => {
        const map = {};
        for (const sub of (data.submissions ?? [])) {
          if (!sub.client_email) continue;
          if (!map[sub.client_email]) map[sub.client_email] = [];
          map[sub.client_email].push(sub);
        }
        setSubmissionsByEmail(map);
      })
      .catch(showError);
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

  const pageCount = Math.max(1, Math.ceil(filtered.length / CLIENTS_PER_PAGE));
  const paginatedClients = useMemo(() => {
    const start = (page - 1) * CLIENTS_PER_PAGE;
    return filtered.slice(start, start + CLIENTS_PER_PAGE);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    setPage(current => Math.min(current, pageCount));
  }, [pageCount]);

  const selectedClient = selected ? clients.find(c => (c.email || c.name) === selected) : null;

  // Client data export disabled for now — re-enable when the export flow is finalised.
  // function exportCSV() {
  //   const rows = [
  //     ['Name', 'Email', 'Phone', 'DOB', 'Total Bookings', 'Last Booking'],
  //     ...clients.map(c => [
  //       c.name,
  //       c.email ?? '',
  //       c.phone ?? '',
  //       c.dob ?? '',
  //       c.bookings.length,
  //       c.lastBooking ? new Date(c.lastBooking).toLocaleDateString('en-AU') : '',
  //     ]),
  //   ];
  //   const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  //   const a = document.createElement('a');
  //   a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  //   a.download = 'clients.csv';
  //   a.click();
  // }

  const handleSendConsentLink = useCallback(async (email, templateId, dob) => {
    await generateConsentLink(email, templateId, dob);
  }, []);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={s.title}>{t('nav_clients')}</h1>
          {/* Client data export disabled for now — re-enable when the export flow is finalised.
          <button
            onClick={exportCSV}
            disabled={clients.length === 0}
            style={s.exportBtn}
            title="Export client list as CSV"
          >
            Export CSV
          </button>
          */}
        </div>
        <div style={s.searchWrap}>
          <input
            type="text"
            placeholder={t('clients_search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={s.searchInput}
          />
        </div>
      </div>

      <div style={s.layout}>
        <div style={s.list}>
          {loading && <p style={s.msg}>{t('loading')}</p>}
          {error && <p style={{ ...s.msg, color: '#e86f6f' }}>{error}</p>}
          {!loading && !error && filtered.length === 0 && (
            <p style={s.msg}>{t('clients_none')}</p>
          )}
          {paginatedClients.map(client => {
            const key = client.email || client.name;
            const active = selected === key;
            const consent = client.email ? consents[client.email] : null;
            const clientSubs = client.email ? (submissionsByEmail[client.email] ?? []) : [];
            const consentStatus = getConsentStatus(consent, consentVersion, clientSubs, consentTemplates);
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
                  <span style={s.sessionCount}>{client.bookings.length} {t('clients_sessions')}</span>
                  {client.imported && <span style={{ ...s.badge, ...s.badgeGrey }}>{t('clients_imported')}</span>}
                  <ConsentBadge status={consentStatus} />
                </div>
              </div>
            );
          })}
          {!loading && !error && filtered.length > 0 && (
            <div style={s.pagination}>
              <span style={s.pageSummary}>
                {`${(page - 1) * CLIENTS_PER_PAGE + 1}–${Math.min(page * CLIENTS_PER_PAGE, filtered.length)} of ${filtered.length}`}
              </span>
              <div style={s.pageActions}>
                <button
                  type="button"
                  onClick={() => setPage(current => Math.max(1, current - 1))}
                  disabled={page === 1}
                  style={{ ...s.pageButton, opacity: page === 1 ? 0.4 : 1 }}
                >
                  Previous
                </button>
                <span style={s.pageNumber}>Page {page} of {pageCount}</span>
                <button
                  type="button"
                  onClick={() => setPage(current => Math.min(pageCount, current + 1))}
                  disabled={page === pageCount}
                  style={{ ...s.pageButton, opacity: page === pageCount ? 0.4 : 1 }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {selectedClient && (
          <ClientDetail
            client={selectedClient}
            onClose={() => setSelected(null)}
            consentTemplates={consentTemplates}
            onSendConsentLink={handleSendConsentLink}
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

function getConsentStatus(consent, currentVersion, submissions = [], templates = []) {
  // New system (template-based submissions) takes priority.
  if (submissions.length > 0) {
    const activeTemplate = templates[0];
    if (activeTemplate) {
      const sub = submissions.find(s => s.template_id === activeTemplate.id);
      if (sub) {
        const outdated = new Date(sub.submitted_at) < new Date(activeTemplate.updated_at);
        return outdated ? 'outdated' : 'current';
      }
    }
    // Has submissions but none match the active template — treat as current.
    return 'current';
  }
  // Fall back to old version-based system.
  if (!consent) return 'none';
  if (consent.consent_version === currentVersion) return 'current';
  return 'outdated';
}

function ConsentBadge({ status }) {
  const { t } = useLanguage();
  if (status === 'current') return <span style={{ ...s.badge, ...s.badgeGreen }}>{t('clients_consented')}</span>;
  if (status === 'outdated') return <span style={{ ...s.badge, ...s.badgeYellow }}>{t('clients_outdated')}</span>;
  return <span style={{ ...s.badge, ...s.badgeRed }}>{t('clients_no_consent')}</span>;
}

function ClientDetail({ client, onClose, consentTemplates = [], onSendConsentLink }) {
  const { t } = useLanguage();
  const [linkGeneratingId, setLinkGeneratingId] = useState(null);
  const [linkSentId,       setLinkSentId]       = useState(null);
  const [submissions,      setSubmissions]      = useState([]);
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

  useEffect(() => {
    if (!client.email) { setSubmissions([]); return; }
    setSubmissions([]);
    getClientConsentSubmissions(client.email)
      .then(d => setSubmissions(d.submissions ?? []))
      .catch(() => setSubmissions([]));
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
    } catch (error) { showError(error); }
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

  async function handleSendLink(templateId) {
    if (!client.email) return;
    setLinkGeneratingId(templateId);
    try {
      await onSendConsentLink(client.email, templateId, client.dob || undefined);
      setLinkSentId(templateId);
      setTimeout(() => setLinkSentId(null), 3000);
    } catch (e) {
      showError(e);
    } finally {
      setLinkGeneratingId(null);
    }
  }

  return (
    <aside style={s.panel}>
      <div style={s.panelHeader}>
        <span style={s.panelTitle}>{client.name}</span>
        <button onClick={onClose} style={s.closeBtn}>✕</button>
      </div>
      <div style={s.panelBody}>
        {client.email ? (
          <div style={s.contactRowStatic}>
            <span style={s.contactIcon}>✉</span>
            <span style={s.contactValueStatic}>{client.email}</span>
          </div>
        ) : (
          <div style={s.contactRowMissing}><span style={s.contactIcon}>✉</span><span>{t('clients_no_email')}</span></div>
        )}
        {client.phone ? (
          <button onClick={() => { const a = document.createElement('a'); a.href = `sms:${client.phone}`; a.click(); }} style={s.contactRow}>
            <span style={s.contactIcon}>✆</span>
            <span style={s.contactValue}>{client.phone}</span>
            <span style={s.contactArrow}>↗</span>
          </button>
        ) : (
          <div style={s.contactRowMissing}><span style={s.contactIcon}>✆</span><span>{t('clients_no_phone')}</span></div>
        )}
        {client.dob && <Field label={t('clients_dob')}>{formatDob(client.dob)}</Field>}
        <Field label={t('clients_total_sessions')}>{client.bookings.length}</Field>
        <Field label={t('status_completed')}>{client.bookings.filter(b => b.outcome === 'completed').length}</Field>

        {consentTemplates.length > 0 && (
          <div style={s.consentSection}>
            <span style={s.sectionLabel}>{t('clients_consent_form')}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              {/* Multi-template: change .slice(0, 1) to consentTemplates when multiple forms are re-enabled */}
              {consentTemplates.slice(0, 1).map(ct => {
                const sub = submissions.find(s => s.template_id === ct.id);
                const outdated = !!sub && new Date(sub.submitted_at) < new Date(ct.updated_at);
                const status = !sub ? 'none' : outdated ? 'outdated' : 'current';
                const sentId = linkSentId === ct.id;
                const loadingId = linkGeneratingId === ct.id;
                const badgeStyle = status === 'current'
                  ? { bg: 'rgba(76,201,138,0.12)', color: '#4cc98a', border: 'rgba(76,201,138,0.25)' }
                  : status === 'outdated'
                  ? { bg: 'rgba(245,158,58,0.12)', color: '#f59e3a', border: 'rgba(245,158,58,0.25)' }
                  : { bg: 'rgba(232,111,111,0.1)', color: '#e86f6f', border: 'rgba(232,111,111,0.2)' };
                const badgeLabel = status === 'current' ? 'CONSENTED' : status === 'outdated' ? 'OUTDATED' : 'NOT CONSENTED';
                return (
                  <div key={ct.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: '0.6rem', padding: '0.55rem 0.7rem',
                    background: 'var(--bg-chip)', borderRadius: 8,
                    border: '1px solid var(--border-faint)',
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: 0 }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ct.name}</span>
                      {sub && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-ghost)' }}>
                          {new Date(sub.submitted_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.04em',
                        padding: '0.15rem 0.45rem', borderRadius: 20,
                        background: badgeStyle.bg, color: badgeStyle.color,
                        border: `1px solid ${badgeStyle.border}`,
                      }}>
                        {badgeLabel}
                      </span>
                      {client.email && status !== 'current' && (
                        <button
                          onClick={() => handleSendLink(ct.id)}
                          disabled={loadingId}
                          style={{
                            background: 'none',
                            border: `1px solid ${sentId ? '#4cc98a' : 'var(--accent)'}`,
                            borderRadius: 6, padding: '0.15rem 0.5rem',
                            color: sentId ? '#4cc98a' : 'var(--accent)',
                            fontSize: '0.7rem', fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'inherit',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {sentId ? 'Sent ✓' : loadingId ? '…' : 'Send link →'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Profile fields */}
        <div style={{ borderTop: '1px solid var(--border-faint)', paddingTop: '1rem', marginTop: '0.25rem' }}>
          <span style={s.sectionLabel}>{t('clients_profile')}</span>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

            {/* Design preferences — multiselect pills */}
            <div>
              <span style={s.fieldLabel}>{t('clients_design_prefs')}</span>
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
              <span style={s.fieldLabel}>{t('clients_allergies')}</span>
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
                    >{opt === 'No' ? t('no') : t('yes')}</button>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem' }}>
                <span style={s.fieldLabel}>{t('clients_pain')}</span>
                {pain !== '' && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)' }}>{pain}/10</span>
                )}
              </div>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={pain === '' ? 5 : Number(pain)}
                onChange={e => setPain(e.target.value)}
                style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-ghost)' }}>0 — very sensitive</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-ghost)' }}>10 — very high</span>
              </div>
              {pain === '' && (
                <button
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => setPain('5')}
                  style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: 'var(--text-ghost)', background: 'none', border: '1px dashed var(--border-faint)', borderRadius: 5, padding: '0.2rem 0.55rem', cursor: 'pointer' }}
                >{t('clients_set_pain')}</button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <button onClick={handleSaveProfile} disabled={profSaving} style={s.consentBtn}>
                {t(profSaving ? 'saving' : profSaved ? 'saved' : 'clients_save_profile')}
              </button>
              {profErr && <span style={{ fontSize: '0.72rem', color: '#e86f6f' }}>{profErr}</span>}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div style={{ borderTop: '1px solid var(--border-faint)', paddingTop: '1rem', marginTop: '0.25rem' }}>
          <span style={s.sectionLabel}>{t('clients_notes')}</span>
          <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <textarea
              rows={2}
              placeholder={t('clients_add_note')}
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddNote(); }}
              style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', background: 'var(--bg-input)', border: '1px solid var(--border-faint)', borderRadius: 6, padding: '0.45rem 0.6rem', fontSize: '0.8rem', color: 'var(--text)', fontFamily: 'inherit', lineHeight: 1.5 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {noteErr && <span style={{ fontSize: '0.72rem', color: '#e86f6f' }}>{noteErr}</span>}
              <span style={{ fontSize: '0.68rem', color: 'var(--text-ghost)', marginLeft: 'auto', marginRight: '0.5rem' }}>{t('clients_cmd_to_save')}</span>
              <button
                onClick={handleAddNote}
                disabled={noteAdding || !noteInput.trim()}
                style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.75rem', borderRadius: 5, border: '1px solid var(--border-faint)', background: 'var(--bg-chip)', color: 'var(--text-dim)', cursor: 'pointer', opacity: (!noteInput.trim() || noteAdding) ? 0.45 : 1 }}
              >
                {t(noteAdding ? 'saving' : 'clients_add_note_btn')}
              </button>
            </div>
            {notes === null && <p style={{ fontSize: '0.78rem', color: 'var(--text-ghost)' }}>{t('loading')}</p>}
            {notes !== null && notes.length === 0 && <p style={{ fontSize: '0.78rem', color: 'var(--text-ghost)' }}>{t('clients_no_notes')}</p>}
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
                    {t('delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border-faint)', paddingTop: '1rem', marginTop: '0.25rem' }}>
          <span style={s.sectionLabel}>{t('clients_booking_history')}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.75rem' }}>
            {sorted.map(b => (
              <div key={b.id} style={s.historyRow}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text)', fontWeight: 600 }}>
                    {[b.session_type ? capitalise(b.session_type.replace(/_/g, ' ')) : null, b.artist_name || null].filter(Boolean).join(' · ') || '—'}
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
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    padding: '0.75rem 0.1rem 0.25rem',
  },
  pageSummary: {
    color: 'var(--text-faint)',
    fontSize: '0.75rem',
  },
  pageActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
  },
  pageButton: {
    padding: '0.4rem 0.7rem',
    borderRadius: 7,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  pageNumber: {
    minWidth: 84,
    color: 'var(--text-dim)',
    fontSize: '0.75rem',
    textAlign: 'center',
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
  contactRow: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '0.5rem 0.75rem',
    cursor: 'pointer', width: '100%', textAlign: 'left', marginBottom: '0.35rem',
  },
  contactRowStatic: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    background: 'var(--bg-input)', border: '1px solid var(--border-faint)',
    borderRadius: 8, padding: '0.5rem 0.75rem',
    width: '100%', marginBottom: '0.35rem',
  },
  contactRowMissing: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.5rem 0.75rem', marginBottom: '0.35rem',
    fontSize: '0.78rem', color: 'var(--text-ghost)',
  },
  contactIcon: { fontSize: '0.85rem', color: 'var(--text-ghost)', flexShrink: 0, width: 16, textAlign: 'center' },
  contactValue: { fontSize: '0.82rem', color: 'var(--accent)', fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  contactValueStatic: { fontSize: '0.82rem', color: 'var(--text-dim)', fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  contactArrow: { fontSize: '0.7rem', color: 'var(--text-ghost)', flexShrink: 0 },
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
