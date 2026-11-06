'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getStudioClients, getStudioClient, getClientConsents, getNotes, addNote, deleteNote, ensureStudioClient, patchStudioClient, updateStudioClientContact, generateConsentLink, listConsentTemplates, getClientConsentSubmissions, getBatchClientConsentSubmissions } from '@/lib/api';

const TATTOO_STYLES = [
  'Traditional', 'Neo Traditional', 'Blackwork', 'Fine Line', 'Realism',
  'Japanese', 'Watercolor', 'Geometric', 'Tribal', 'Dotwork',
  'Illustrative', 'New School', 'Biomechanical', 'Lettering', 'Minimalist',
];
import { statusColors, capitalise } from '@/lib/status';
import { formatDob } from '@/lib/format';
import { invalidate } from '@/lib/cache';
import { COUNTRIES, splitPhone, joinPhone } from '@/lib/phoneCountries';
import DateOfBirthInput from '@/components/ui/DateOfBirthInput';
import { useLanguage } from '@/lib/i18n';
import { showError } from '@/lib/feedback';
import Button from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import MarketingConsent from '@/components/MarketingConsent';
import ConsentSubmissionCard from '@/components/ConsentSubmissionCard';
import ClientTemplateSend from '@/components/marketing/ClientTemplateSend';
import { Pill, Section, Fact, SkeletonBar, DetailSkeleton, PanelBackdrop, detailStyles } from '@/components/ui/DetailParts';

import panelLayout from '@/components/ui/DetailPanelLayout.module.css';

const CLIENTS_PER_PAGE = 25;

// Client list orderings. Clients without the value being sorted on go last.
const time = value => (value ? new Date(value).getTime() : NaN);
function byTime(field, newestFirst) {
  return (a, b) => {
    const x = time(a[field]), y = time(b[field]);
    if (Number.isNaN(x) && Number.isNaN(y)) return a.name.localeCompare(b.name);
    if (Number.isNaN(x)) return 1;
    if (Number.isNaN(y)) return -1;
    return newestFirst ? y - x : x - y;
  };
}
const CLIENT_SORTS = {
  recent: { label: 'Most recent booking', compare: byTime('lastBooking', true) },
  longest: { label: 'Longest since last booking', compare: byTime('lastBooking', false) },
  added: { label: 'Newest clients', compare: byTime('addedAt', true) },
  sessions: { label: 'Most sessions', compare: (a, b) => b.bookingCount - a.bookingCount || a.name.localeCompare(b.name) },
  name: { label: 'Name (A–Z)', compare: (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) },
};

function ClientsInner() {
  const { t } = useLanguage();
  const params = useSearchParams();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  useEffect(() => {
    const saved = window.localStorage.getItem('vanta:clients-sort');
    if (saved && CLIENT_SORTS[saved]) setSortBy(saved);
  }, []);
  function changeSort(value) {
    setSortBy(value);
    window.localStorage.setItem('vanta:clients-sort', value);
  }
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [consents, setConsents] = useState({});
  const [consentVersion, setConsentVersion] = useState('1');
  const [consentTemplates, setConsentTemplates] = useState([]);
  const [marketingOverrides, setMarketingOverrides] = useState({});
  const [submissionsByEmail, setSubmissionsByEmail] = useState({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [contactData, templateData] = await Promise.all([
          getStudioClients(),
          listConsentTemplates().catch(() => ({ templates: [] })),
        ]);
        setConsentTemplates(templateData.templates ?? []);
        const c = contactData.clients ?? [];
        setContacts(c);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [loadAttempt]);

  const clients = useMemo(() => {
    return contacts.map(contact => ({
        id: contact.id,
        name: contact.name,
        email: contact.email ?? null,
        phone: contact.phone ?? null,
        bookingCount: Number(contact.booking_count ?? 0),
        lastBooking: contact.last_booking ?? null,
        addedAt: contact.created_at ?? null,
        imported: contact.source === 'import' || contact.source === 'imported',
        contactId: contact.id,
        marketingKnown: contact.email_marketing_opt_in !== undefined,
        marketingOptIn: contact.email_marketing_opt_in === true,
        smsMarketingOptIn: contact.sms_marketing_opt_in === true,
        unsubscribed: contact.email_unsubscribed === true,
        smsOptedOut: contact.sms_opted_out === true,
      })).sort(CLIENT_SORTS[sortBy]?.compare ?? CLIENT_SORTS.recent.compare);
  }, [contacts, sortBy]);

  const marketingFor = useCallback(client => {
    if (!client || !client.marketingKnown) return null;
    const override = marketingOverrides[client.id];
    return { optIn: override?.optIn ?? client.marketingOptIn, smsOptIn: override?.smsOptIn ?? client.smsMarketingOptIn, unsubscribed: client.unsubscribed, smsOptedOut: client.smsOptedOut };
  }, [marketingOverrides]);

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
  }, [search, sortBy]);

  useEffect(() => {
    setPage(current => Math.min(current, pageCount));
  }, [pageCount]);

  useEffect(() => {
    const requested = params.get('client');
    if (!requested || clients.length === 0) return;
    const match = clients.find(client => client.email === requested || client.name === requested || client.id === requested);
    if (match) setSelected(match.id);
  }, [params, clients]);

  useEffect(() => {
    if (!selected) { setSelectedClient(null); return; }
    let active = true;
    setSelectedClient(null);
    setDetailLoading(true);
    getStudioClient(selected)
      .then(data => {
        if (!active) return;
        const detail = data.client ?? {};
        setSelectedClient({
          ...detail,
          contactId: detail.id,
          bookings: data.bookings ?? [],
          designPreferences: parseStyles(detail.design_preferences),
          painTolerance: detail.pain_tolerance ?? null,
        });
      })
      .catch(showError)
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [selected]);

  useEffect(() => {
    const emails = paginatedClients.map(client => client.email).filter(Boolean);
    if (emails.length === 0) return;
    getClientConsents(emails).then(data => {
      setConsents(current => ({ ...current, ...(data.consents ?? {}) }));
      setConsentVersion(data.current_version ?? '1');
    }).catch(showError);
    getBatchClientConsentSubmissions(emails).then(data => {
      const map = {};
      for (const sub of (data.submissions ?? [])) {
        if (!sub.client_email) continue;
        if (!map[sub.client_email]) map[sub.client_email] = [];
        map[sub.client_email].push(sub);
      }
      setSubmissionsByEmail(current => ({ ...current, ...map }));
    }).catch(showError);
  }, [paginatedClients]);

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
    <div className="studio-feature-page studio-clients-page" style={s.page}>
      <div className="studio-feature-header" style={s.header}>
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
            type="search"
            aria-label={t('clients_search')}
            placeholder={t('clients_search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={s.searchInput}
          />
          <Select aria-label="Sort clients" value={sortBy} onChange={e => changeSort(e.target.value)} style={s.sortSelect}>
            {Object.entries(CLIENT_SORTS).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}
          </Select>
        </div>
      </div>

      <div style={s.layout}>
        <div className="studio-feature-body studio-client-list" style={s.list}>
          {loading && <p role="status" style={s.msg}>{t('loading')}</p>}
          {error && <div role="alert" style={s.msg}><p style={{ color: 'var(--status-rejected)' }}>{error}</p><Button onClick={() => setLoadAttempt(value => value + 1)}>{t('Try again')}</Button></div>}
          {!loading && !error && filtered.length === 0 && (
            <p style={s.msg}>{t('clients_none')}</p>
          )}
          {paginatedClients.map(client => {
            const key = client.id;
            const active = selected === key;
            const consent = client.email ? consents[client.email] : null;
            const clientSubs = client.email ? (submissionsByEmail[client.email] ?? []) : [];
            const consentStatus = getConsentStatus(consent, consentVersion, clientSubs, consentTemplates);
            return (
              <div
                key={key}
                className="studio-client-row"
                role="button"
                tabIndex={0}
                aria-expanded={active}
                aria-controls={active ? 'client-detail' : undefined}
                onClick={() => setSelected(prev => prev === key ? null : key)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelected(prev => prev === key ? null : key);
                  }
                }}
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
                <div className="studio-client-stats" style={s.clientStats}>
                  <span style={s.sessionCount}>{client.bookingCount} {t('clients_sessions')}</span>
                  {client.imported && <span style={{ ...s.badge, ...s.badgeGrey }}>{t('clients_imported')}</span>}
                  <ConsentBadge status={consentStatus} />
                  <MarketingBadge marketing={marketingFor(client)} />
                </div>
              </div>
            );
          })}
          {!loading && !error && filtered.length > 0 && (
            <div style={s.pagination}>
              <span style={s.pageSummary}>
                {`${(page - 1) * CLIENTS_PER_PAGE + 1}–${Math.min(page * CLIENTS_PER_PAGE, filtered.length)} of ${filtered.length}`}
              </span>
              <div className="studio-client-pagination" style={s.pageActions}>
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

        {(detailLoading || selectedClient) && <PanelBackdrop onClose={() => setSelected(null)} />}

        {detailLoading && (
          <aside id="client-detail" className={`studio-client-detail ${panelLayout.panel}`} aria-label="Loading client details" aria-busy="true" style={s.panel}>
            <div style={s.panelHeader}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', minWidth: 0 }}>
                <span style={s.panelTitle}>{clients.find(c => c.id === selected)?.name ?? <SkeletonBar w={180} h={22} />}</span>
                <SkeletonBar w={220} h={14} />
              </div>
              <button type="button" aria-label="Close client details" onClick={() => setSelected(null)} style={s.closeBtn}>✕</button>
            </div>
            <div className={panelLayout.body} style={s.panelBody}><DetailSkeleton label="Loading client details…" /></div>
          </aside>
        )}
        {!detailLoading && selectedClient && (
          <ClientDetail
            client={selectedClient}
            marketing={marketingFor(clients.find(c => c.id === selected))}
            onMarketingChange={next => setMarketingOverrides(current => ({ ...current, [selected]: next }))}
            clientKey={selected}
            onClose={() => setSelected(null)}
            consentTemplates={consentTemplates}
            legacyConsent={selectedClient.email ? consents[selectedClient.email] : null}
            consentVersion={consentVersion}
            onSendConsentLink={handleSendConsentLink}
            onContactSaved={updated => {
              setSelectedClient(current => ({ ...current, ...updated }));
              setContacts(list => list.map(c => (c.id === selected ? { ...c, ...updated } : c)));
              invalidate('clients:contacts'); // booking panels re-read the contact book
            }}
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

function MarketingBadge({ marketing }) {
  if (!marketing) return null;
  if (marketing.unsubscribed) return <span style={{ ...s.badge, ...s.badgeGrey }}>Unsubscribed</span>;
  if (marketing.optIn || marketing.smsOptIn) return <span style={{ ...s.badge, ...s.badgeGreen }}>Marketing</span>;
  return null;
}

// Edit first name, last name, email, phone (with its country code) and date of birth.
// A client with a Vanta account keeps the email from their account; renaming them only
// changes the studio's name for them.
function ContactEditor({ client, onSave, onCancel }) {
  const hasAccount = Boolean(client.user_id && client.user_id !== '00000000-0000-0000-0000-000000000000' && client.is_stub === false);
  const [firstName, setFirstName] = useState(() => (client.name ?? '').trim().split(/\s+/)[0] ?? '');
  const [lastName, setLastName] = useState(() => (client.name ?? '').trim().split(/\s+/).slice(1).join(' '));
  const [email, setEmail] = useState(client.email ?? '');
  const initialPhone = splitPhone(client.phone);
  const [phoneCountry, setPhoneCountry] = useState(initialPhone.country);
  const [phoneNumber, setPhoneNumber] = useState(initialPhone.number);
  const [dob, setDob] = useState(client.dob ? String(client.dob).slice(0, 10) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const phone = joinPhone(phoneCountry, phoneNumber);
  const emailBad = email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const phoneBad = phoneNumber.trim() && phone.replace(/[^0-9]/g, '').length < 8;
  const problem = !firstName.trim() ? 'Enter the client’s first name.' : emailBad ? 'Enter a valid email address.' : phoneBad ? 'Enter a valid phone number.' : '';
  const input = { width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '0.6rem 0.75rem', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--bg-input)', color: 'var(--text)', font: 'inherit', fontSize: '0.95rem' };
  const label = { fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dim)' };
  const field = { display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 0 };

  async function save(event) {
    event.preventDefault();
    if (problem || saving) { setError(problem); return; }
    setSaving(true); setError('');
    const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
    try { await onSave({ name, email: email.trim(), phone, dob }); }
    catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
        <label style={field}><span style={label}>First name</span>
          <input style={input} value={firstName} onChange={e => setFirstName(e.target.value)} autoComplete="off" /></label>
        <label style={field}><span style={label}>Last name</span>
          <input style={input} value={lastName} onChange={e => setLastName(e.target.value)} autoComplete="off" /></label>
      </div>
      <label style={field}><span style={label}>Email</span>
        <input style={input} type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={hasAccount} autoComplete="off" /></label>
      {hasAccount && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '-0.4rem' }}>Their email comes from their Vanta account.</span>}
      <div style={field}><span style={label} id="client-phone-label">Phone</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select aria-label="Phone country code" style={{ ...input, width: 'auto', flex: '0 0 auto', paddingRight: '1.8rem' }} value={phoneCountry} onChange={e => setPhoneCountry(e.target.value)}>
            {COUNTRIES.map(c => <option key={c.id} value={c.id}>{c.flag} {c.dial}</option>)}
          </select>
          <input aria-labelledby="client-phone-label" style={{ ...input, flex: 1 }} type="tel" inputMode="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="400 000 000" autoComplete="off" />
        </div>
      </div>
      <div style={field}><span style={label}>Date of birth</span>
        <DateOfBirthInput style={input} required={false} value={dob} onChange={setDob} /></div>
      {error && <p role="alert" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-danger)' }}>{error}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="submit" size="sm" loading={saving} loadingLabel="Saving…">Save</Button>
      </div>
    </form>
  );
}

function ClientDetail({ client, marketing, onMarketingChange, clientKey, onClose, consentTemplates = [], legacyConsent = null, consentVersion, onSendConsentLink, onContactSaved }) {
  const { t } = useLanguage();
  const [linkGeneratingId, setLinkGeneratingId] = useState(null);
  const [linkSentId,       setLinkSentId]       = useState(null);
  const [submissions,      setSubmissions]      = useState([]);
  const [notes,       setNotes]       = useState(null); // null = loading
  const [noteInput,   setNoteInput]   = useState('');
  const [noteAdding,  setNoteAdding]  = useState(false);
  const [noteErr,     setNoteErr]     = useState('');

  const [editingContact, setEditingContact] = useState(false);
  const [showOlderForms, setShowOlderForms] = useState(false);
  const [showAllBookings, setShowAllBookings] = useState(false);
  useEffect(() => { setEditingContact(false); setShowOlderForms(false); setShowAllBookings(false); }, [client.id]);

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

  // Same rule as the client list, so the row and this panel always agree.
  const consentState = consentTemplates.length === 0 && submissions.length === 0 && !legacyConsent ? null
    : getConsentStatus(legacyConsent, consentVersion, submissions, consentTemplates);
  const consentTone = { current: 'success', outdated: 'warning', none: 'danger' }[consentState];
  const consentLabelText = { current: 'Consented', outdated: 'Consent outdated', none: 'Not consented' }[consentState];
  const router = useRouter();
  const completedCount = client.bookings.filter(b => b.outcome === 'completed').length;
  const lastVisit = sorted[0]?.created_at ?? null;

  return (
    <aside id="client-detail" className={`studio-client-detail ${panelLayout.panel}`} aria-label={`${client.name} details`} style={s.panel}>
      <div style={s.panelHeader}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', minWidth: 0 }}>
          <span style={s.panelTitle}>{client.name}</span>
          <span style={s.headerStats}>
            {client.bookings.length === 0 ? 'No bookings yet' : [
              `${client.bookings.length} session${client.bookings.length === 1 ? '' : 's'}`,
              `${completedCount} completed`,
              lastVisit ? `last booked ${new Date(lastVisit).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: new Date(lastVisit).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })}` : null,
            ].filter(Boolean).join(' · ')}
          </span>
        </div>
        <button type="button" aria-label="Close client details" onClick={onClose} style={s.closeBtn}>✕</button>
      </div>
      <div className={panelLayout.body} style={s.panelBody}>
        <div className={panelLayout.cards}>
        {editingContact ? (
        <Section title="Contact">
          <ContactEditor
            client={client}
            onCancel={() => setEditingContact(false)}
            onSave={async fields => {
              let id = contactId ?? client.id;
              try {
                await updateStudioClientContact(id, fields);
              } catch (e) {
                if (e.status !== 404) throw e;
                // No contact-book record yet (e.g. a client known only from bookings): make one.
                const { client: c } = await ensureStudioClient(client.name, client.email ?? '', client.phone ?? '');
                id = c.id;
                setContactId(id);
                await updateStudioClientContact(id, fields);
              }
              onContactSaved?.({ name: fields.name, email: fields.email || null, phone: fields.phone || null, dob: fields.dob || null });
              setEditingContact(false);
            }}
          />
        </Section>
        ) : (
        <Section title="Contact" aside={<button type="button" style={detailStyles.textLink} onClick={() => setEditingContact(true)}>Edit</button>}>
          <Fact label="Email">{client.email || <span style={{ color: 'var(--text-muted)' }}>{t('clients_no_email')}</span>}</Fact>
          <Fact label="Phone">
            {client.phone ? (
              <button onClick={() => { const a = document.createElement('a'); a.href = `sms:${client.phone}`; a.click(); }} style={s.phoneBtn}>
                {client.phone} <span aria-hidden="true">↗</span>
              </button>
            ) : <span style={{ color: 'var(--text-muted)' }}>{t('clients_no_phone')}</span>}
          </Fact>
          {client.dob && <Fact label={t('clients_dob')}>{formatDob(client.dob)}</Fact>}
        </Section>
        )}

        {/* ── Consent: status, then the signed forms (newest first, each opens in a window) ── */}
        {(consentState || submissions.length > 0) && (() => {
          const sorted = [...submissions].sort((x, y) => new Date(y.submitted_at || 0) - new Date(x.submitted_at || 0));
          const shown = showOlderForms ? sorted : sorted.slice(0, 1);
          const template = consentTemplates[0];
          return (
            <Section title="Consent" aside={consentState && <Pill tone={consentTone}>{consentLabelText}</Pill>}>
              {shown.map(sub => <ConsentSubmissionCard key={sub.id} sub={sub} templates={consentTemplates} compact />)}
              {!sorted.length && legacyConsent?.agreed_at && (
                <span style={detailStyles.hint}>Signed {new Date(legacyConsent.agreed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              )}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {template && client.email && consentState !== 'current' && (
                  <button type="button" onClick={() => handleSendLink(template.id)} disabled={linkGeneratingId === template.id} style={{ ...detailStyles.textLink, fontSize: '0.85rem' }}>
                    {linkSentId === template.id ? 'Link sent ✓' : linkGeneratingId === template.id ? 'Sending…' : 'Send consent link'}
                  </button>
                )}
                {sorted.length > 1 && (
                  <button type="button" onClick={() => setShowOlderForms(v => !v)} style={{ ...detailStyles.textLink, fontSize: '0.85rem' }}>
                    {showOlderForms ? 'Hide earlier forms' : `${sorted.length - 1} earlier form${sorted.length === 2 ? '' : 's'}`}
                  </button>
                )}
              </div>
            </Section>
          );
        })()}

        {/* ── Marketing: email and SMS separately ── */}
        {marketing && (client.email || client.phone) && (
          <Section title="Marketing">
            <MarketingConsent email={client.email} phone={client.phone} clientKey={clientKey} marketing={marketing} onChange={onMarketingChange} />
          </Section>
        )}

        <Section title="Send an email">
          <ClientTemplateSend key={clientKey} clientKey={clientKey} email={client.email} marketing={marketing} />
        </Section>

        {/* Client profile hidden for now.
        <Section title={t('clients_profile')}>
          <div>
            <span style={s.fieldLabel}>{t('clients_design_prefs')}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {TATTOO_STYLES.map(style => {
                const active = styles.includes(style);
                return (
                  <button
                    key={style}
                    aria-pressed={active}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => setStyles(prev => active ? prev.filter(x => x !== style) : [...prev, style])}
                    style={{
                      fontSize: '0.85rem', fontWeight: 600, padding: '0.3rem 0.75rem',
                      borderRadius: 20, border: `1px solid ${active ? 'var(--color-info-border)' : 'var(--border-strong)'}`,
                      background: active ? 'var(--color-info-surface)' : 'transparent',
                      color: active ? 'var(--color-info)' : 'var(--text-dim)',
                      cursor: 'pointer',
                    }}
                  >{style}</button>
                );
              })}
            </div>
          </div>

          <div>
            <span style={s.fieldLabel}>{t('clients_allergies')}</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['No', 'Yes'].map(opt => {
                const active = opt === 'Yes' ? hasAllergies : !hasAllergies;
                const danger = opt === 'Yes' && active;
                return (
                  <button
                    key={opt}
                    aria-pressed={active}
                    aria-label={`${t('clients_allergies')}: ${opt === 'No' ? t('no') : t('yes')}`}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => setHasAllergies(opt === 'Yes')}
                    style={{
                      fontSize: '0.9rem', fontWeight: 600, padding: '0.4rem 1.1rem',
                      borderRadius: 8, border: `1px solid ${danger ? 'var(--color-danger-border)' : active ? 'var(--accent)' : 'var(--border-strong)'}`,
                      background: danger ? 'var(--color-danger-surface)' : active ? 'var(--accent)' : 'transparent',
                      color: danger ? 'var(--color-danger)' : active ? 'var(--accent-contrast)' : 'var(--text-dim)',
                      cursor: 'pointer',
                    }}
                  >{opt === 'No' ? t('no') : t('yes')}</button>
                );
              })}
            </div>
            {hasAllergies && (
              <textarea
                aria-label="Allergy details"
                rows={2}
                placeholder="e.g. latex allergy, sensitive skin, keloid-prone…"
                value={allergyDetails}
                onChange={e => setAllergyDetails(e.target.value)}
                style={{ ...s.profileInput, marginTop: '0.5rem' }}
              />
            )}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem' }}>
              <span style={{ ...s.fieldLabel, marginBottom: 0 }}>{t('clients_pain')}</span>
              {pain !== '' && <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>{pain}/10</span>}
            </div>
            <input
              type="range"
              aria-label={t('clients_pain')}
              aria-valuetext={pain === '' ? 'Not recorded; adjust to set a value out of 10' : `${pain} out of 10`}
              min={0}
              max={10}
              step={1}
              value={pain === '' ? 5 : Number(pain)}
              onChange={e => setPain(e.target.value)}
              style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem' }}>
              <span style={detailStyles.hint}>0 — very sensitive</span>
              <span style={detailStyles.hint}>10 — very high</span>
            </div>
            {pain === '' && (
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => setPain('5')}
                style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-dim)', background: 'none', border: '1px dashed var(--border-strong)', borderRadius: 8, padding: '0.3rem 0.75rem', cursor: 'pointer' }}
              >{t('clients_set_pain')}</button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Button onClick={handleSaveProfile} loading={profSaving} loadingLabel={t('saving')}>
              {t(profSaved ? 'saved' : 'clients_save_profile')}
            </Button>
            {profErr && <span style={{ fontSize: '0.875rem', color: 'var(--color-danger)' }}>{profErr}</span>}
          </div>
        </Section>
        */}

        <Section title={t('clients_notes')}>
          <textarea
            aria-label={t('clients_add_note')}
            rows={3}
            placeholder={t('clients_add_note')}
            value={noteInput}
            onChange={e => setNoteInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddNote(); }}
            style={detailStyles.noteInput}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
            <span style={detailStyles.hint}>{noteErr ? <span style={{ color: 'var(--color-danger)' }}>{noteErr}</span> : t('clients_cmd_to_save')}</span>
            <Button size="sm" variant="secondary" onClick={handleAddNote} disabled={noteAdding || !noteInput.trim()}>
              {t(noteAdding ? 'saving' : 'clients_add_note_btn')}
            </Button>
          </div>
          {notes === null && <p style={{ ...detailStyles.hint, margin: 0 }}>{t('loading')}</p>}
          {notes !== null && notes.length === 0 && <p style={{ ...detailStyles.hint, margin: 0 }}>{t('clients_no_notes')}</p>}
          {notes !== null && notes.map(n => (
            <div key={n.id} style={detailStyles.subCard}>
              <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.content}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={detailStyles.hint}>
                  {new Date(n.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <button onClick={() => handleDeleteNote(n.id)} style={{ ...detailStyles.textLink, color: 'var(--color-danger)' }}>
                  {t('delete')}
                </button>
              </div>
            </div>
          ))}
        </Section>

        <Section title={`${t('clients_booking_history')}${sorted.length ? ` (${sorted.length})` : ''}`}>
          {sorted.length === 0 && <p style={{ ...detailStyles.hint, margin: 0 }}>No bookings yet.</p>}
          {(showAllBookings ? sorted : sorted.slice(0, 5)).map(b => (
            <button key={b.id} type="button" onClick={() => router.push(`/dashboard/appointments?booking=${b.id}`)} style={s.historyRow} aria-label={`Open booking from ${new Date(b.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: 0, textAlign: 'left' }}>
                <span style={{ fontSize: '0.95rem', color: 'var(--text)', fontWeight: 600 }}>
                  {[b.session_type ? capitalise(b.session_type.replace(/_/g, ' ')) : null, b.artist_name || null].filter(Boolean).join(' · ') || '—'}
                </span>
                <span style={detailStyles.hint}>
                  {new Date(b.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                <Pill colors={statusColors(b.outcome === 'no_show' ? 'cancelled' : b.status)}>{capitalise((b.outcome ?? b.status).replace(/_/g, ' '))}</Pill>
                <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>›</span>
              </span>
            </button>
          ))}
          {sorted.length > 5 && (
            <button type="button" onClick={() => setShowAllBookings(v => !v)} style={{ ...detailStyles.textLink, fontSize: '0.85rem', alignSelf: 'flex-start' }}>
              {showAllBookings ? 'Show fewer' : `Show all ${sorted.length}`}
            </button>
          )}
        </Section>
        </div>
      </div>
    </aside>
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
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.02em',
  },
  exportBtn: {
    padding: '0.35rem 0.85rem', borderRadius: 20,
    border: '1px solid var(--border)', background: 'transparent',
    color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 500,
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  searchWrap: {
    display: 'flex',
    gap: '0.6rem',
    flexWrap: 'wrap',
  },
  sortSelect: {
    width: 'auto',
    flex: '0 0 auto',
  },
  searchInput: {
    flex: '1 1 260px',
    maxWidth: 440,
    minWidth: 0,
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.65rem 1rem',
    fontSize: '0.95rem',
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
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    padding: '0.75rem 0.1rem 0.25rem',
  },
  pageSummary: {
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
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
    color: 'var(--text-dim)',
    fontSize: '0.85rem',
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
    gap: '0.9rem',
    padding: '1rem 1.1rem',
    borderRadius: 12,
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    transition: 'background 0.12s, border-color 0.12s',
  },
  clientAvatar: {
    width: 42,
    height: 42,
    borderRadius: '50%',
    background: 'var(--color-info-surface)',
    border: '1px solid var(--color-info-border)',
    color: 'var(--color-info)',
    fontSize: '1rem',
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
    fontSize: '1.02rem',
    fontWeight: 700,
    color: 'var(--text)',
  },
  clientMeta: {
    fontSize: '0.875rem',
    color: 'var(--text-muted)',
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
    fontSize: '0.875rem',
    color: 'var(--text-dim)',
    fontWeight: 600,
  },
  badge: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.15rem 0.6rem',
    borderRadius: 99,
    border: '1px solid transparent',
  },
  badgeGreen: {
    background: 'var(--color-success-surface)',
    borderColor: 'var(--color-success-border)',
    color: 'var(--color-success)',
  },
  badgeYellow: {
    background: 'var(--color-warning-surface)',
    borderColor: 'var(--color-warning-border)',
    color: 'var(--color-warning)',
  },
  badgeRed: {
    background: 'var(--color-danger-surface)',
    borderColor: 'var(--color-danger-border)',
    color: 'var(--color-danger)',
  },
  badgeGrey: {
    background: 'var(--bg-chip)',
    borderColor: 'var(--border)',
    color: 'var(--text-muted)',
  },
  panel: {
    position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(960px, 100%)',
    background: 'var(--bg-panel)',
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 10,
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.75rem',
    padding: '1rem 1.25rem',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  panelTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.01em',
    overflowWrap: 'anywhere',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '1.05rem',
    cursor: 'pointer',
    padding: '0.25rem',
  },
  panelBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem 1.25rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  headerStats: { fontSize: '0.9rem', color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' },
  phoneBtn: { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-info)', fontSize: '0.95rem', fontWeight: 600, fontFamily: 'inherit' },
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
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-dim)',
    marginBottom: '0.4rem',
  },
  profileInput: {
    width: '100%',
    boxSizing: 'border-box',
    resize: 'vertical',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.6rem 0.8rem',
    fontSize: '0.95rem',
    color: 'var(--text)',
    fontFamily: 'inherit',
    lineHeight: 1.5,
    outline: 'none',
  },
  historyRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
    width: '100%',
    padding: '0.6rem 0.7rem',
    margin: '0 -0.7rem',
    boxSizing: 'content-box',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 10,
    color: 'inherit',
    font: 'inherit',
    cursor: 'pointer',
  },
};
