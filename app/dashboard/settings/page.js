'use client';

import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import { WidgetPreview, ConsentFormPreview, CONSENT_DEFAULT_BG, CONSENT_DEFAULT_ACCENT } from '@/components/forms/FormPreviews';
import { isLightHex as isLightColorHex } from '@/lib/formTheme';
import StudioLogoUpload from '@/components/StudioLogoUpload';
import StickyPreview from '@/components/StickyPreview';
// import SmartSchedulingSettings from '@/components/SmartSchedulingSettings'; // smart scheduling temporarily hidden
import SMSSettings from '@/components/SMSSettings';
import AppointmentTypesSettings from '@/components/AppointmentTypesSettings';
import DepositPaymentOptions from '@/components/DepositPaymentOptions';
import { StudioSetupLinks } from '@/components/StudioSetupChecklist';

import { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getMyStudioAccount, updateStudioProfile,
  getStudioHours, updateStudioHours,
  getStations, addStation, removeStation, renameStation, setStationLastDay, updateFormStyle,
  setStationUnavailability, clearStationUnavailability,
  listConsentTemplates, createConsentTemplate, updateConsentTemplate,
  getStripeStatus, startStripeOnboarding, disconnectStripe,
  getFormConfig, updateFormConfig,
  startBillingCheckout, getBillingDetails, cancelBillingSubscription, reactivateBillingSubscription, openBillingPortal, getBookingLink, updateBookingLink, checkBookingLink } from '@/lib/api';
import { getSupabase } from '@/lib/supabase';
import { invalidate } from '@/lib/cache';
import { getTheme, setTheme } from '@/lib/theme';
import ThemePicker from '@/components/ThemePicker';
import accountStyles from './AccountSettings.module.css';
import { useLanguage, LANGUAGES } from '@/lib/i18n';
import { requestConfirmation, showError, showFeedback } from '@/lib/feedback';

import DownloadableQR, { downloadQR } from '@/components/DownloadableQR';
import WalkInFormSettings from '@/components/WalkInFormSettings';
import BookingManagementSettings from '@/components/BookingManagementSettings';
import EmailSenderSettings from '@/components/EmailSenderSettings';
import PushNotificationSettings from '@/components/PushNotificationSettings';
import ArtistCommissionOverrides from '@/components/ArtistCommissionOverrides';
import { useBookingManagement } from '@/lib/bookingManagement';
import { MOBILE_MEDIA } from '@/lib/responsive';

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function defaultHours() {
  return DAY_KEYS.map((_, i) => ({
    day_of_week: i,
    open_time: '09:00',
    close_time: '17:00',
    is_closed: i >= 5,
  }));
}

function formatCents(cents) {
  const dollars = (cents ?? 0) / 100;
  return dollars % 1 === 0 ? `$${dollars.toFixed(0)}` : `$${dollars.toFixed(2)}`;
}

function cardBrandLabel(brand) {
  const labels = {
    visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', discover: 'Discover',
    diners: 'Diners Club', jcb: 'JCB', unionpay: 'UnionPay', cartes_bancaires: 'Cartes Bancaires',
  };
  return labels[brand] ?? (brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : 'Card');
}

function cardBrandColor(brand) {
  const colors = {
    visa: 'linear-gradient(135deg, #1a1f71, #2d3fa8)',
    mastercard: 'linear-gradient(135deg, #3a2418, #6b3a1f)',
    amex: 'linear-gradient(135deg, #006fcf, #00a8e8)',
    discover: 'linear-gradient(135deg, #86592d, #d97b29)',
  };
  return colors[brand] ?? 'linear-gradient(135deg, #2a2a2e, #444448)';
}

function AddressAutocomplete({ value, onChange, onSelect, inputStyle }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const mapkitRef = useRef(null);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.mapkit && mapkitRef.current) return;
    if (window.mapkit) { initMapKit(window.mapkit); return; }

    const script = document.createElement('script');
    script.src = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js';
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.onerror = () => console.error('[MapKit] Failed to load MapKit JS script');
    script.onload = () => initMapKit(window.mapkit);
    document.head.appendChild(script);
  }, []);

  function initMapKit(mk) {
    if (!mk || mapkitRef.current) return;
    mapkitRef.current = mk;
    mk.init({
      authorizationCallback: (done) => {
        fetch(`${BACKEND}/api/mapkit-token`)
          .then(r => { if (!r.ok) throw new Error(`token endpoint ${r.status}`); return r.json(); })
          .then(d => { done(d.token); })
          .catch(() => { done(''); });
      },
    });
    try {
      searchRef.current = new mk.Search({ language: 'en-GB', getsUserLocation: false });
    } catch (e) {
      console.error('[MapKit] Search init error:', e);
    }
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleInput(e) {
    const q = e.target.value;
    onChange(q);
    clearTimeout(debounceRef.current);
    if (!q.trim() || q.length < 3) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(() => runAutocomplete(q), 300);
  }

  function runAutocomplete(q) {
    if (!searchRef.current) return;
    searchRef.current.autocomplete(q, (err, data) => {
      if (err) { setSuggestions([]); setOpen(false); return; }
      if (!data?.results?.length) { setSuggestions([]); setOpen(false); return; }
      setSuggestions(data.results.slice(0, 5));
      setOpen(true);
    });
  }

  function handleSelect(result) {
    setOpen(false);
    setSuggestions([]);
    const label = result.displayLines?.join(', ') ?? result.completionDescription ?? '';
    onChange(label);
    if (!searchRef.current) { onSelect(label, null, null); return; }
    searchRef.current.search(result, (err, data) => {
      if (!err && data?.places?.length) {
        const place = data.places[0];
        const addr = place.formattedAddress ?? label;
        onSelect(addr, place.coordinate?.latitude ?? null, place.coordinate?.longitude ?? null);
      } else {
        onSelect(label, null, null);
      }
    });
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        style={inputStyle}
        value={value}
        onChange={handleInput}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder="Search address"
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 300,
          background: 'color-mix(in srgb, var(--bg-base) 88%, white 12%)',
          border: '1px solid var(--border-faint)',
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
        }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => handleSelect(s)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '0.55rem 0.9rem',
                background: 'none', border: 'none',
                borderBottom: i < suggestions.length - 1 ? '1px solid var(--border-faint)' : 'none',
                cursor: 'pointer', color: 'var(--text)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <span style={{ fontSize: '0.82rem', fontWeight: 500, display: 'block', lineHeight: 1.3 }}>
                {s.displayLines?.[0] ?? s.completionDescription}
              </span>
              {s.displayLines?.[1] && (
                <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.3 }}>
                  {s.displayLines[1]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const SHORT_LINK_BASE = (process.env.NEXT_PUBLIC_MARKETING_URL || 'https://vanta.tattoo').replace(/\/$/, '');

// Settings sections. On phones they're a list you tap into; on larger screens, tabs.
const SETTINGS_TABS = [
  { id: 'studio',   label: 'Studio',           hint: 'Profile, logo, opening hours and stations' },
  { id: 'types',    label: 'Appointment types', hint: 'Presets with length, colour, price and deposit' },
  { id: 'requests', label: 'Booking requests', hint: 'Who confirms times, booking form, link and widget' },
  { id: 'walkins',  label: 'Walk-ins',         hint: 'Walk-in link, QR code and form fields' },
  { id: 'consent',  label: 'Consent form',     hint: 'Build the form clients sign' },
  { id: 'messages', label: 'Client messages',  hint: 'Emails, reminders and SMS' },
  { id: 'payments', label: 'Payments',         hint: 'Commission, Stripe and deposit options' },
  { id: 'account',  label: 'Account',          hint: 'Account details, billing and preferences' },
];
// Older links (setup checklist, tour, bookmarks) used a single Bookings tab.
const LEGACY_TABS = { bookings: 'requests' };

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(MOBILE_MEDIA);
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return mobile;
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const { lang, switchLanguage, t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [addressLat, setAddressLat] = useState(null);
  const [addressLng, setAddressLng] = useState(null);
  const [email, setEmail] = useState('');
  const [aftercareInstructions, setAftercareInstructions] = useState('');
  const [piercingAftercareInstructions, setPiercingAftercareInstructions] = useState('');
  const [widgetBgColor, setWidgetBgColor] = useState('#111111');
  const [logoUrl, setLogoUrl] = useState('');
  const [widgetAccentColor, setWidgetAccentColor] = useState('#d5d0c7');
  const [schedulingMode, setSchedulingMode] = useState('all');
  const [timezone, setTimezone] = useState('Australia/Sydney');
  const [walkinCut, setWalkinCut] = useState('0');
  const [personalCut, setPersonalCut] = useState('0');
  const [paymentRecordingReq, setPaymentRecordingReq] = useState('studio_only');
  const [payForfeitedDeposits, setPayForfeitedDeposits] = useState(false);
  // Artist's share of a forfeited deposit, as typed; '' = their usual commission share.
  const [forfeitPct, setForfeitPct] = useState('');
  // The studio's form colours (booking form + website widget, walk-in form, consent
  // form), edited in Studio → Logo and colours and saved a moment after the last change.
  const [formStyleState, setFormStyleState] = useState('idle'); // idle | saving | saved | error
  const formStyleTouched = useRef(false);
  useEffect(() => {
    if (!formStyleTouched.current) return undefined;
    const valid = v => /^#[0-9a-f]{6}$/i.test(v);
    if (!valid(widgetBgColor) || !valid(widgetAccentColor)) return undefined;
    setFormStyleState('saving');
    const timer = setTimeout(() => {
      updateFormStyle({ bg_color: widgetBgColor, accent_color: widgetAccentColor })
        .then(() => setFormStyleState('saved')).catch(() => setFormStyleState('error'));
    }, 600);
    return () => clearTimeout(timer);
  }, [widgetBgColor, widgetAccentColor]);
  const changeFormColour = setter => value => { formStyleTouched.current = true; setter(value); };
  const validHex = v => /^#[0-9a-f]{6}$/i.test(v);
  const [sendReminder7d, setSendReminder7d] = useState(true);
  const [sendReminder3d, setSendReminder3d] = useState(false);
  const [sendReminder24h, setSendReminder24h] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [copied, setCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [walkInUrl, setWalkInUrl] = useState('');
  const [bookingSlug, setBookingSlug] = useState('');
  const [slugDraft, setSlugDraft] = useState('');
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugError, setSlugError] = useState('');
  // Result of the "Check" button for the link name: null, or
  // { slug, state: 'short' | 'yours' | 'checking' | 'available' | 'taken' | 'error', message }.
  const [slugCheck, setSlugCheck] = useState(null);
  const [editingSlug, setEditingSlug] = useState(false);
  const latestSlugDraft = useRef(slugDraft);
  latestSlugDraft.current = slugDraft;
  // Editing the name clears the last result.
  useEffect(() => { setSlugError(''); setSlugCheck(null); }, [slugDraft]);
  const consentUrl = bookingSlug ? `${SHORT_LINK_BASE}/c/${bookingSlug}` : walkInUrl.replace('/studio-booking?s=', '/consent?s=');
  const [studioId, setStudioId] = useState('');
  const [theme, setThemeState] = useState('dark');
  const [tab, setTabState] = useState('studio');
  const isMobile = useIsMobile();
  const bookingManagement = useBookingManagement();
  // One-line summaries for the phone settings list.
  function settingsSummary(id) {
    switch (id) {
      case 'studio': return name ? `${name} · profile, hours and stations` : SETTINGS_TABS[0].hint;
      case 'requests': return bookingManagement === 'studio' ? 'The studio confirms times · form, link and widget'
        : bookingManagement === 'artist' ? 'Artists confirm times · form, link and widget' : SETTINGS_TABS[1].hint;
      case 'consent': return consentTemplates.length ? 'Set up' : 'Not set up yet';
      case 'payments': return stripeStatus?.charges_enabled ? 'Stripe connected · commission and deposits' : SETTINGS_TABS[5].hint;
      case 'account': return email ? `${email} · billing and notifications` : SETTINGS_TABS[6].hint;
      default: return SETTINGS_TABS.find(tb => tb.id === id)?.hint ?? '';
    }
  }

  // The open section lives in the URL (?tab=…), so links, refresh and Back all work.
  const setTab = id => {
    setTabState(id);
    router[isMobile ? 'push' : 'replace'](`/dashboard/settings?tab=${id}`, { scroll: false });
  };

  useEffect(() => { setThemeState(getTheme()); }, []);

  useEffect(() => {
    const wanted = LEGACY_TABS[requestedTab] ?? requestedTab;
    if (SETTINGS_TABS.some(tb => tb.id === wanted)) setTabState(wanted);
  }, [requestedTab]);

  function chooseTheme(next) {
    setThemeState(setTheme(next));
  }

  // ── Consent templates ──────────────────────────────────────────────────────
  const [consentTemplates, setConsentTemplates] = useState([]);
  const [widgetConsentTemplateId, setWidgetConsentTemplateId] = useState('');
  const [editingTemplate, setEditingTemplate] = useState(null); // null = new
  const [templateName, setTemplateName] = useState('');
  const [templateRequiresSig, setTemplateRequiresSig] = useState(true);
  const [templateRequiresGuardian, setTemplateRequiresGuardian] = useState(false);
  const [templateFields, setTemplateFields] = useState([]);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateError, setTemplateError] = useState('');

  const [stripeStatus, setStripeStatus] = useState(null); // null = loading
  const [stripeConnecting, setStripeConnecting] = useState(false);
  const [stripeError, setStripeError] = useState('');

  const [subscriptionStatus, setSubscriptionStatus] = useState('');
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState('');
  const [billingNotice, setBillingNotice] = useState('');
  const [billingDetails, setBillingDetails] = useState(null); // full response from getBillingDetails()
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);

  const [formFields, setFormFields] = useState(null); // null = loading
  const [formFieldsSaving, setFormFieldsSaving] = useState(false);

  const [hours, setHours] = useState(defaultHours());
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursSaved, setHoursSaved] = useState(false);

  const [stations, setStations] = useState([]);
  const [stationLoading, setStationLoading] = useState(false);
  const [expandedStation, setExpandedStation] = useState(null);
  const [unavailDate, setUnavailDate] = useState('');
  const [stationLastDayTarget, setStationLastDayTarget] = useState(null); // { id, endDate }

  useEffect(() => {
    async function load() {
      try {
        const [account, { data: { session } }, hoursData, stationsData, templateData, stripeData, formConfigData, billingData] = await Promise.all([
          getMyStudioAccount(),
          getSupabase().auth.getSession(),
          getStudioHours().catch(() => ({ hours: [] })),
          getStations().catch(() => ({ stations: [] })),
          listConsentTemplates().catch(() => ({ templates: [] })),
          getStripeStatus().catch(() => null),
          getFormConfig().catch(() => ({ fields: {} })),
          getBillingDetails().catch(() => null),
        ]);
        setName(account.studio?.name ?? '');
        const addr = account.studio?.addressString ?? '';
        setAddress(addr);
        if (account.studio?.latitude != null) setAddressLat(account.studio.latitude);
        if (account.studio?.longitude != null) setAddressLng(account.studio.longitude);
        setAftercareInstructions(account.studio?.aftercare_instructions ?? '');
        setPiercingAftercareInstructions(account.studio?.piercing_aftercare_instructions ?? '');
        setWidgetBgColor(account.studio?.widget_bg_color || '#111111');
        setWidgetAccentColor(account.studio?.widget_accent_color || '#d5d0c7');
        setTimezone(account.studio?.timezone || 'Australia/Sydney');
        setSchedulingMode(account.studio?.scheduling_mode || 'all');
        setWalkinCut(String(account.studio?.walkin_cut_percent ?? account.studio?.studio_cut_percent ?? 0));
        setPersonalCut(String(account.studio?.personal_cut_percent ?? account.studio?.studio_cut_percent ?? 0));
        setPaymentRecordingReq(account.studio?.payment_recording_requirement ?? 'studio_only');
        setPayForfeitedDeposits(account.studio?.pay_artist_on_forfeited_deposits ?? false);
        setForfeitPct(account.studio?.forfeited_deposit_artist_percent != null ? String(Number(account.studio.forfeited_deposit_artist_percent)) : '');
        setSendReminder7d(account.studio?.send_reminder_7d ?? true);
        setSendReminder3d(account.studio?.send_reminder_3d ?? false);
        setSendReminder24h(account.studio?.send_reminder_24h ?? true);
        setEmail(session?.user?.email ?? '');
        setStudioId(account.studio_id);
        setWalkInUrl(window.location.origin + '/studio-booking?s=' + account.studio_id);
        // Swap in the short vanta.tattoo link once it loads; the long link still works.
        getBookingLink().then(({ slug }) => { if (!slug) return; setBookingSlug(slug); setSlugDraft(slug); setWalkInUrl(`${SHORT_LINK_BASE}/b/${slug}`); }).catch(() => {});
        if (hoursData.hours?.length === 7) setHours(hoursData.hours);
        setStations(stationsData.stations ?? []);
        setConsentTemplates(templateData.templates ?? []);
        setWidgetConsentTemplateId(account.studio?.widget_consent_template_id ?? '');
        setLogoUrl(account.studio?.logo_url ?? '');
        setStripeStatus(stripeData ?? { connected: false, charges_enabled: false });
        setFormFields(formConfigData?.fields ?? {});
        setSubscriptionStatus(account.studio?.subscription_status ?? '');
        setBillingDetails(billingData);

        // Handle return from the self-serve billing checkout.
        const billingParam = new URLSearchParams(window.location.search).get('billing');
        if (billingParam === 'success' || billingParam === 'canceled') {
          const params2 = new URLSearchParams(window.location.search);
          params2.delete('billing');
          const newSearch2 = params2.toString();
          window.history.replaceState({}, '', window.location.pathname + (newSearch2 ? '?' + newSearch2 : ''));
          setBillingNotice(billingParam === 'success' ? 'Billing added — thank you!' : 'Billing setup was canceled.');
        }

        // Handle return from Stripe onboarding.
        const params = new URLSearchParams(window.location.search);
        const stripeParam = params.get('stripe');
        if (stripeParam === 'return' || stripeParam === 'refresh') {
          params.delete('stripe');
          const newSearch = params.toString();
          window.history.replaceState({}, '', window.location.pathname + (newSearch ? '?' + newSearch : ''));
          if (stripeParam === 'refresh') {
            // Account link expired — re-trigger onboarding automatically.
            setStripeConnecting(true);
            try {
              const returnTo = window.location.href;
              const result = await startStripeOnboarding(returnTo);
              window.location.href = result.onboarding_url;
            } catch (e) {
              setStripeError(e.message);
              setStripeConnecting(false);
            }
          } else {
            // Returned from completed onboarding — re-fetch Stripe status.
            getStripeStatus().then(setStripeStatus).catch(() => {});
          }
        }
      } catch {
        setProfileError('Failed to load settings.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const selectedReminderCount = [sendReminder7d, sendReminder3d, sendReminder24h].filter(Boolean).length;

  function toggleEmailReminder(enabled, setEnabled) {
    if (!enabled && selectedReminderCount >= 2) {
      showError('You can select up to 2 email reminders. Turn one off to choose another.');
      return;
    }
    setEnabled(!enabled);
  }

  async function saveProfile() {
    if (selectedReminderCount > 2) { setProfileError('Choose up to 2 reminder emails. Turn one off before saving.'); return; }
    if (!name.trim()) { setProfileError('Studio name is required.'); return; }
    setSaving(true); setProfileError('');
    try {
      const wc = parseFloat(walkinCut);
      const pc = parseFloat(personalCut);
      const fp = forfeitPct.trim() === '' ? null : parseFloat(forfeitPct);
      if (fp != null && !(fp >= 0 && fp <= 100)) { setProfileError('The artist’s share of forfeited deposits must be between 0 and 100%.'); setSaving(false); return; }
      await updateStudioProfile(name.trim(), address.trim(), undefined, undefined, isNaN(wc) ? 0 : wc, isNaN(pc) ? 0 : pc, aftercareInstructions, timezone, addressLat, addressLng, paymentRecordingReq, undefined, widgetConsentTemplateId || null, sendReminder7d, sendReminder24h, payForfeitedDeposits, schedulingMode, piercingAftercareInstructions, sendReminder3d, fp);
      invalidate('studio-account');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleSaveProfile(e) {
    e.preventDefault();
    saveProfile();
  }

  async function handleSaveHours() {
    setHoursSaving(true);
    try {
      await updateStudioHours(hours);
      setHoursSaved(true);
      setTimeout(() => setHoursSaved(false), 2500);
    } catch {
      // silent — hours aren't critical to block on
    } finally {
      setHoursSaving(false);
    }
  }

  function setHourField(dayIndex, field, value) {
    setHours(h => h.map((d, i) => i === dayIndex ? { ...d, [field]: value } : d));
  }

  async function refreshStations() {
    const data = await getStations();
    setStations(data.stations ?? []);
  }

  async function handleAddStation() {
    setStationLoading(true);
    try {
      const station = await addStation();
      setStations(s => [...s, station]);
    } catch (e) {
      showError(e);
    } finally {
      setStationLoading(false);
    }
  }

  // Renaming a station in place: { id, name } while editing.
  const [renaming, setRenaming] = useState(null);
  async function saveStationName() {
    const name = renaming?.name.trim();
    const current = stations.find(st => st.id === renaming?.id);
    if (!renaming || !name || name === current?.name) { setRenaming(null); return; }
    setStationLoading(true);
    try {
      await renameStation(renaming.id, name);
      setStations(list => list.map(st => (st.id === renaming.id ? { ...st, name } : st)));
      setRenaming(null);
      showFeedback('Station renamed', 'success');
    } catch (e) {
      showError(e.message);
    } finally {
      setStationLoading(false);
    }
  }

  async function handleRemoveStation(id) {
    if (stations.length <= 1) {
      showError('A studio must have at least one station. Add another station before removing this one.');
      return;
    }
    setStationLoading(true);
    try {
      await removeStation(id);
      setStations(s => s.filter(st => st.id !== id));
      if (expandedStation === id) setExpandedStation(null);
    } catch (e) {
      showError(e);
    } finally {
      setStationLoading(false);
    }
  }

  async function confirmStationLastDay(lastDay) {
    if (!stationLastDayTarget) return;
    setStationLoading(true);
    try {
      await setStationLastDay(stationLastDayTarget.id, lastDay ?? null);
      setStationLastDayTarget(null);
      const data = await getStations();
      setStations(data.stations ?? []);
    } catch (e) {
      showError(e);
    } finally {
      setStationLoading(false);
    }
  }

  async function handleSetUnavailable(stationId) {
    if (!unavailDate) return;
    try {
      await setStationUnavailability(stationId, unavailDate);
      setUnavailDate('');
      await refreshStations();
    } catch (e) {
      showError(e);
    }
  }

  async function handleClearUnavailable(stationId, date) {
    try {
      await clearStationUnavailability(stationId, date.split('T')[0]);
      await refreshStations();
    } catch (e) {
      showError(e);
    }
  }

  // ── Consent template helpers ──────────────────────────────────────────────

  // Studios have one consent form for now (the API allows more). It's the form used on
  // the booking link, or else the first one; with none yet, saving creates it.
  const consentForm = consentTemplates.find(x => x.id === widgetConsentTemplateId) ?? consentTemplates[0] ?? null;
  const consentDraft = { name: templateName, requiresSig: templateRequiresSig, fields: templateFields };
  const consentSaved = consentForm
    ? { name: consentForm.name, requiresSig: consentForm.requires_signature, fields: consentForm.fields ?? [] }
    : { name: 'Consent form', requiresSig: true, fields: [] };
  const consentDirty = JSON.stringify(consentDraft) !== JSON.stringify(consentSaved);
  const consentLoadedFor = useRef(undefined);
  useEffect(() => {
    if (loading) return;
    const id = consentForm?.id ?? null;
    if (consentLoadedFor.current === id) return;
    consentLoadedFor.current = id;
    setEditingTemplate(consentForm);
    setTemplateName(consentSaved.name);
    setTemplateRequiresSig(consentSaved.requiresSig);
    setTemplateRequiresGuardian(consentForm?.requires_minor_guardian ?? false);
    setTemplateFields(consentSaved.fields);
    setTemplateError('');
  }, [loading, consentForm?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function resetConsentForm() {
    setTemplateName(consentSaved.name);
    setTemplateRequiresSig(consentSaved.requiresSig);
    setTemplateFields(consentSaved.fields);
    setTemplateError('');
  }

  function addField(type) {
    // A photo ID field starts labelled and required; studios can change both.
    setTemplateFields(prev => [...prev, { id: `f_${Date.now()}`, type, label: type === 'photo_id' ? 'Photo ID' : '', required: type === 'photo_id' }]);
  }

  function updateField(id, changes) {
    setTemplateFields(prev => prev.map(f => f.id === id ? { ...f, ...changes } : f));
  }

  function removeField(id) {
    setTemplateFields(prev => prev.filter(f => f.id !== id));
  }

  function moveField(id, dir) {
    setTemplateFields(prev => {
      const idx = prev.findIndex(f => f.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  async function saveTemplate() {
    if (!templateName.trim()) { setTemplateError('Give the form a name.'); return; }
    setTemplateSaving(true);
    setTemplateError('');
    try {
      const payload = {
        name: templateName.trim(),
        requires_signature: templateRequiresSig,
        requires_minor_guardian: templateRequiresGuardian,
        fields: templateFields,
      };
      if (consentForm) {
        const updated = await updateConsentTemplate(consentForm.id, payload);
        setConsentTemplates(prev => prev.map(t => t.id === consentForm.id ? updated : t));
      } else {
        const created = await createConsentTemplate(payload);
        consentLoadedFor.current = created.id;
        setConsentTemplates(prev => [...prev, created]);
      }
      showFeedback('Consent form saved.', 'success');
    } catch (e) {
      setTemplateError(e.message);
    } finally {
      setTemplateSaving(false);
    }
  }

  async function handleFormFieldToggle(key, prop, value) {
    const next = { ...formFields, [key]: { ...formFields[key], [prop]: value } };
    setFormFields(next);
    setFormFieldsSaving(true);
    try {
      await updateFormConfig(next);
    } catch (e) {
      showError(e);
    } finally {
      setFormFieldsSaving(false);
    }
  }

  async function handleAddBilling() {
    setBillingLoading(true);
    setBillingError('');
    try {
      if (isCanceling) {
        // Subscription is still active, just scheduled to cancel — undo that in place
        // rather than sending the studio through Checkout again (which would re-offer
        // a trial it's already had and create a second, redundant subscription).
        await reactivateBillingSubscription();
        const fresh = await getBillingDetails();
        setBillingDetails(fresh);
        setBillingLoading(false);
        return;
      }
      const { checkout_url } = await startBillingCheckout();
      window.location.href = checkout_url;
    } catch (e) {
      setBillingError(e.message);
      setBillingLoading(false);
    }
  }

  async function handleCancelSubscription(reason) {
    setCancelLoading(true);
    setCancelError('');
    try {
      await cancelBillingSubscription(reason);
      // subscription_status stays "active" — Stripe keeps access live until the
      // current period ends. Refetch to pick up cancel_at_period_end.
      const fresh = await getBillingDetails();
      setBillingDetails(fresh);
      setCancelModalOpen(false);
    } catch (e) {
      setCancelError(e.message);
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleUpdateCard() {
    setPortalLoading(true);
    setBillingError('');
    try {
      const result = await openBillingPortal();
      if (result.portal_url) {
        window.location.href = result.portal_url;
        return;
      }
      // Mock studio (e.g. demo account) — card was cycled locally, no redirect.
      const fresh = await getBillingDetails();
      setBillingDetails(fresh);
      setPortalLoading(false);
    } catch (e) {
      setBillingError(e.message);
      setPortalLoading(false);
    }
  }

  async function handleStripeConnect() {
    setStripeConnecting(true);
    setStripeError('');
    try {
      // Come back to Settings → Payments after Stripe.
      const returnTo = `${window.location.href.split('?')[0]}?tab=payments`;
      const result = await startStripeOnboarding(returnTo);
      window.location.href = result.onboarding_url;
    } catch (e) {
      setStripeError(e.message);
      setStripeConnecting(false);
    }
  }

  async function handleStripeDisconnect() {
    if (!await requestConfirmation({ title: 'Disconnect Stripe?', message: 'Clients won’t be able to pay deposits by card. PayID and bank transfer stay as they are.', confirmLabel: 'Disconnect', danger: true })) return;
    setStripeError('');
    try {
      await disconnectStripe();
      setStripeStatus({ connected: false, charges_enabled: false, details_submitted: false, payouts_enabled: false });
    } catch (e) {
      setStripeError(e.message);
    }
  }

  async function handleSignOut() {
    const { data: { session } } = await getSupabase().auth.getSession();
    if (session?.user?.id) {
      sessionStorage.removeItem(`vanta-studio-tour-session:${session.user.id}`);
      sessionStorage.removeItem(`vanta-studio-tour-start:${session.user.id}`);
    }
    await getSupabase().auth.signOut();
    window.location.replace('/'); // full load; see dashboard/layout.js
  }

  async function checkBookingSlug() {
    const draft = slugDraft;
    if (draft.length < 3) { setSlugCheck({ slug: draft, state: 'short' }); return; }
    if (draft === bookingSlug) { setSlugCheck({ slug: draft, state: 'yours' }); return; }
    setSlugCheck({ slug: draft, state: 'checking' });
    try {
      const result = await checkBookingLink(draft);
      // Ignore the answer if the name changed while checking.
      if (latestSlugDraft.current !== draft) return;
      setSlugCheck({ slug: result.slug || draft, state: result.available ? 'available' : 'taken', message: result.message });
    } catch {
      if (latestSlugDraft.current === draft) setSlugCheck({ slug: draft, state: 'error' });
    }
  }

  // Check the new link name a moment after typing stops.
  useEffect(() => {
    if (!editingSlug) return undefined;
    if (slugDraft === bookingSlug) { setSlugCheck(null); return undefined; }
    if (slugDraft.length < 3) { setSlugCheck({ slug: slugDraft, state: 'short' }); return undefined; }
    const timer = setTimeout(checkBookingSlug, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugDraft, editingSlug, bookingSlug]);

  async function saveBookingSlug(event) {
    event.preventDefault();
    setSlugError('');
    setSlugCheck(null);
    setSlugSaving(true);
    try {
      const { slug } = await updateBookingLink(slugDraft);
      setBookingSlug(slug); setSlugDraft(slug); setWalkInUrl(`${SHORT_LINK_BASE}/b/${slug}`);
      setEditingSlug(false);
      showFeedback('Booking link changed', 'success');
    } catch (err) {
      setSlugError(err.message === 'that link is already taken' ? `Another studio already uses vanta.tattoo/b/${slugDraft}. Try a different name.` : err.message);
    } finally {
      setSlugSaving(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(walkInUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const isBillingExempt = billingDetails?.billing_exempt === true;
  const isCanceling = billingDetails?.cancel_at_period_end === true;
  const periodEndLabel = billingDetails?.current_period_end
    ? new Date(billingDetails.current_period_end).toLocaleDateString()
    : '';
  const hasBillingPeriod = !!billingDetails?.current_period_end;
  const billingHeroLabel = isCanceling ? 'Access ends' : hasBillingPeriod ? 'Next payment' : 'Estimated monthly';
  const billingHeroCents = hasBillingPeriod ? (billingDetails?.next_amount_due_cents ?? 0) : (billingDetails?.estimated_monthly_cents ?? 3000);
  const billingSeatCount = billingDetails?.seat_count ?? 0;

  const embedSnippet = studioId
    ? `<div data-vanta-studio="${studioId}"></div>\n<script src="https://studio.vanta.tattoo/embed.js"><\/script>`
    : '';

  function copyEmbed() {
    navigator.clipboard.writeText(embedSnippet).then(() => {
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 2000);
    });
  }

  if (loading) return <div style={s.page}><div style={s.loadingDot} /></div>;

  return (
    <div className="studio-settings-page" style={s.page}>
      {isMobile && !requestedTab ? (
        // Phones: a list of sections with a one-line summary each.
        <>
          <h1 style={s.pageTitle}>{t('settings')}</h1>
          <nav aria-label="Settings sections" style={s.settingsList}>
            {SETTINGS_TABS.map(tb => (
              <button key={tb.id} type="button" data-tour-settings-tab={tb.id} onClick={() => setTab(tb.id)} style={s.settingsRow}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, textAlign: 'left' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)' }}>{tb.label}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{settingsSummary(tb.id)}</span>
                </span>
                <span aria-hidden="true" style={{ color: 'var(--text-ghost)', fontSize: '1.1rem', flexShrink: 0 }}>›</span>
              </button>
            ))}
          </nav>
        </>
      ) : <>
      <div className="studio-settings-header" style={s.pageHeader}>
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <button type="button" onClick={() => (window.history.length > 1 ? router.back() : router.push('/dashboard/settings'))} style={s.settingsBack}>
              <span aria-hidden="true">←</span> Settings
            </button>
            <h1 style={s.pageTitle}>{SETTINGS_TABS.find(tb => tb.id === tab)?.label}</h1>
            <p style={s.tabIntro}>{SETTINGS_TABS.find(tb => tb.id === tab)?.hint}</p>
          </div>
        ) : (
          <>
            <h1 style={s.pageTitle}>{t('settings')}</h1>
            <div className="studio-settings-tabs" role="tablist" aria-label="Settings sections" style={s.tabBar}>
              {SETTINGS_TABS.map(tb => (
                <button
                  key={tb.id}
                  role="tab"
                  aria-selected={tab === tb.id}
                  aria-pressed={tab === tb.id}
                  title={tb.hint}
                  data-tour-settings-tab={tb.id}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => setTab(tb.id)}
                  style={{ ...s.tabBtn, ...(tab === tb.id ? s.tabBtnActive : {}) }}
                >
                  {tb.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {!isMobile && (
        <div style={s.tabIntroWrap}>
          <h2 style={s.tabIntroTitle}>{SETTINGS_TABS.find(tb => tb.id === tab)?.label}</h2>
          <p style={s.tabIntro}>{SETTINGS_TABS.find(tb => tb.id === tab)?.hint}</p>
        </div>
      )}


      <div className={`settings-bento ${tab === 'account' ? accountStyles.grid : ''}`}>

        {tab === 'studio' && <>
        {/* Two columns that stack their own cards, so short cards don't stretch. */}
        <div className="settings-span-7 settings-column">
        <section style={s.card}>
          <h2 style={s.sectionTitle}>{t('profile')}</h2>
          <p style={s.sectionDesc}>Your studio’s name and address, as clients see them.</p>
          <form onSubmit={handleSaveProfile} style={s.form}>
            <div style={s.field}>
              <label htmlFor="studio-name" style={s.label}>Studio Name</label>
              <input id="studio-name" autoComplete="organization" style={s.input} value={name} onChange={e => setName(e.target.value)} placeholder="Studio name" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Address</label>
              <AddressAutocomplete
                value={address}
                onChange={setAddress}
                onSelect={(addr, lat, lng) => { setAddress(addr); setAddressLat(lat); setAddressLng(lng); }}
                inputStyle={s.input}
              />
            </div>
            <div style={s.field}>
              <label htmlFor="studio-timezone" style={s.label}>Timezone</label>
              <select id="studio-timezone" style={s.input} value={timezone} onChange={e => setTimezone(e.target.value)}>
                <optgroup label="Australia">
                  <option value="Australia/Sydney">Sydney / Melbourne (AEST/AEDT)</option>
                  <option value="Australia/Brisbane">Brisbane (AEST, no DST)</option>
                  <option value="Australia/Adelaide">Adelaide (ACST/ACDT)</option>
                  <option value="Australia/Perth">Perth (AWST)</option>
                  <option value="Australia/Darwin">Darwin (ACST, no DST)</option>
                  <option value="Australia/Hobart">Hobart (AEST/AEDT)</option>
                </optgroup>
                <optgroup label="New Zealand">
                  <option value="Pacific/Auckland">Auckland (NZST/NZDT)</option>
                </optgroup>
                <optgroup label="Asia">
                  <option value="Asia/Singapore">Singapore (SGT)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                  <option value="Asia/Seoul">Seoul (KST)</option>
                  <option value="Asia/Bangkok">Bangkok (ICT)</option>
                  <option value="Asia/Dubai">Dubai (GST)</option>
                </optgroup>
                <optgroup label="Europe">
                  <option value="Europe/London">London (GMT/BST)</option>
                  <option value="Europe/Paris">Paris / Berlin (CET/CEST)</option>
                  <option value="Europe/Helsinki">Helsinki (EET/EEST)</option>
                </optgroup>
                <optgroup label="Americas">
                  <option value="America/New_York">New York (EST/EDT)</option>
                  <option value="America/Chicago">Chicago (CST/CDT)</option>
                  <option value="America/Denver">Denver (MST/MDT)</option>
                  <option value="America/Los_Angeles">Los Angeles (PST/PDT)</option>
                  <option value="America/Toronto">Toronto (EST/EDT)</option>
                  <option value="America/Vancouver">Vancouver (PST/PDT)</option>
                </optgroup>
                <optgroup label="Other">
                  <option value="UTC">UTC</option>
                </optgroup>
              </select>
            </div>
            {profileError && <p role="alert" style={s.errorText}>{profileError}</p>}
            <button type="submit" style={s.saveBtn} disabled={saving}>
              {saving ? t('saving') : saved ? t('saved') : t('save_changes')}
            </button>
          </form>
        </section>

        <section style={s.card}>
          <h2 style={s.sectionTitle}>{t('hours')}</h2>
          <div style={s.hoursGrid}>
            {hours.map((day, i) => (
              <div key={i} className="studio-hours-row" style={s.hoursRow}>
                <span style={s.dayLabel}>{t(DAY_KEYS[i])}</span>
                <label style={s.closedToggle}>
                  <input
                    type="checkbox"
                    aria-label={`${t(DAY_KEYS[i])}: ${t('closed')}`}
                    checked={day.is_closed}
                    onChange={e => setHourField(i, 'is_closed', e.target.checked)}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <span style={{ color: day.is_closed ? 'var(--text-ghost)' : 'var(--text-muted)', fontSize: '0.82rem' }}>
                    {t('closed')}
                  </span>
                </label>
                {!day.is_closed && (
                  <div className="studio-hours-times" style={s.timePair}>
                    <input
                      type="time"
                      aria-label={`${t(DAY_KEYS[i])} opening time`}
                      value={day.open_time}
                      onChange={e => setHourField(i, 'open_time', e.target.value)}
                      style={s.timeInput}
                    />
                    <span style={s.timeSep}>–</span>
                    <input
                      type="time"
                      aria-label={`${t(DAY_KEYS[i])} closing time`}
                      value={day.close_time}
                      onChange={e => setHourField(i, 'close_time', e.target.value)}
                      style={s.timeInput}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <button onClick={handleSaveHours} style={s.saveBtn} disabled={hoursSaving}>
            {hoursSaving ? t('saving') : hoursSaved ? t('saved') : t('save_hours')}
          </button>
        </section>
        </div>
        <div className="settings-span-5 settings-column">
        <section style={s.card} aria-labelledby="branding-title">
          <h2 id="branding-title" style={s.sectionTitle}>Logo and colours</h2>
          <p style={s.sectionDesc}>Used on your booking form and website widget, walk-in form and consent form.</p>
          <StudioLogoUpload logoUrl={logoUrl} studioName={name} onChange={setLogoUrl} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem' }}>
              <h3 style={{ ...s.label, margin: 0 }}>Form colours</h3>
              <span role="status" style={{ fontSize: '0.8rem', color: formStyleState === 'error' ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                {formStyleState === 'saving' ? 'Saving…' : formStyleState === 'saved' ? 'Saved' : formStyleState === 'error' ? 'Couldn’t save' : 'Saves as you go'}
              </span>
            </div>
            <div className="studio-form-row" style={s.colorRow}>
              {[['Background', widgetBgColor, setWidgetBgColor], ['Highlight', widgetAccentColor, setWidgetAccentColor]].map(([label, value, setter]) => (
                <div key={label} style={s.colorField}>
                  <label style={s.label}>{label}</label>
                  <div style={s.colorInputWrap}>
                    <input aria-label={`Form ${label.toLowerCase()} colour`} type="color" value={validHex(value) ? value : '#000000'} onChange={e => changeFormColour(setter)(e.target.value)} style={s.colorSwatch} />
                    <input aria-label={`Form ${label.toLowerCase()} hex colour`} style={{ ...s.input, fontFamily: 'ui-monospace,monospace', fontSize: '0.82rem' }} value={value} maxLength={7} onChange={e => changeFormColour(setter)(e.target.value)} />
                  </div>
                </div>
              ))}
            </div>
            {/* A small sample of how the forms look in these colours. */}
            <div aria-hidden="true" style={{ ...s.colourSample, background: validHex(widgetBgColor) ? widgetBgColor : '#111111' }}>
              <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: validHex(widgetAccentColor) ? widgetAccentColor : '#d5d0c7' }}>{name || 'Your studio'}</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>Book an appointment</span>
              <span style={{ ...s.colourSampleButton, background: validHex(widgetAccentColor) ? widgetAccentColor : '#d5d0c7', color: isLightColorHex(validHex(widgetAccentColor) ? widgetAccentColor : '#d5d0c7') ? '#11151b' : '#fff' }}>Request booking</span>
            </div>
          </div>
        </section>

        <section style={s.card}>
          <h2 style={s.sectionTitle}>{t('stations')}</h2>
          <p style={s.sectionDesc}>Artists are assigned to a free station when a booking is accepted. Every studio must keep at least one active station.</p>
          {stationLastDayTarget && (
            <StationLastDayModal
              saving={stationLoading}
              existingEndDate={stationLastDayTarget.endDate}
              onConfirm={confirmStationLastDay}
              onCancel={() => setStationLastDayTarget(null)}
            />
          )}
          <div style={s.stationList}>
            {stations.map(st => (
              <div key={st.id} style={s.stationRow}>
                {renaming?.id === st.id ? (
                  <form style={s.stationTop} onSubmit={e => { e.preventDefault(); saveStationName(); }}>
                    <input
                      aria-label="Station name"
                      className="studio-control"
                      value={renaming.name}
                      maxLength={40}
                      autoFocus
                      onFocus={e => e.target.select()}
                      onChange={e => setRenaming(r => ({ ...r, name: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Escape') setRenaming(null); }}
                      style={s.stationNameInput}
                    />
                    <div style={s.stationActions}>
                      <Button size="sm" type="submit" loading={stationLoading} disabled={!renaming.name.trim()}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button>
                    </div>
                  </form>
                ) : (
                  <div className="studio-wrap-row" style={s.stationTop}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', minWidth: 0 }}>
                      <span style={s.stationName}>{st.name}</span>
                      {st.endDate && (
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f59e3a', background: 'rgba(245,158,58,0.1)', border: '1px solid rgba(245,158,58,0.25)', borderRadius: 20, padding: '0.12rem 0.5rem', whiteSpace: 'nowrap' }}>
                          Last day {new Date(st.endDate + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                    <div style={s.stationActions}>
                      <Button size="sm" variant="ghost" onClick={() => setRenaming({ id: st.id, name: st.name })} disabled={stationLoading}>Rename</Button>
                      <Button size="sm" variant="ghost" onClick={() => setStationLastDayTarget({ id: st.id, endDate: st.endDate ?? null })}
                        disabled={stationLoading || stations.length <= 1}
                        title={stations.length <= 1 ? 'Add another station before setting this station’s last day.' : undefined}>
                        {st.endDate ? 'Change last day' : 'Set last day'}
                      </Button>
                      <Button size="sm" variant="ghost" className="studio-danger-ghost" onClick={() => handleRemoveStation(st.id)}
                        disabled={stationLoading || stations.length <= 1}
                        title={stations.length <= 1 ? 'A studio must have at least one station.' : undefined}>
                        Remove
                      </Button>
                    </div>
                  </div>
                )}
                {/* Unavailability panel — re-enable with button above
                {expandedStation === st.id && (
                  <div style={s.unavailPanel}>
                    <div className="studio-wrap-row" style={s.unavailAdd}>
                      <input
                        type="date"
                        value={unavailDate}
                        onChange={e => setUnavailDate(e.target.value)}
                        style={s.dateInput}
                      />
                      <button
                        style={s.saveBtn}
                        onClick={() => handleSetUnavailable(st.id)}
                        disabled={!unavailDate}
                      >
                        Mark unavailable
                      </button>
                    </div>
                    {st.unavailability?.length > 0 && (
                      <div style={s.unavailList}>
                        {st.unavailability.map(u => (
                          <div key={u.date} style={s.unavailItem}>
                            <span style={s.unavailDate}>{u.date.split('T')[0]}</span>
                            <button style={s.clearBtn} onClick={() => handleClearUnavailable(st.id, u.date)}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                */}
              </div>
            ))}
          </div>
          <button onClick={handleAddStation} style={s.saveBtn} disabled={stationLoading}>
            {t('add_station')}
          </button>
        </section>
        </div>
        </>}

        {tab === 'payments' && <>

        <section className="settings-span-12" style={s.card}>
          <div style={s.settingsSectionHeader}>
            <h2 style={s.sectionTitle}>Commission</h2>
            <p style={s.sectionDesc}>Set the studio share for each booking source. The remainder is paid to the artist. Imported bookings aren’t included in payouts, since they were settled before you moved to Vanta.</p>
          </div>
          <form onSubmit={handleSaveProfile} style={s.paymentsForm}>
            <div style={s.field}>
              <div className="studio-commission-grid" style={s.commissionGrid}>
                {[
                  { label: 'Studio & walk-in', description: 'Bookings sourced or recorded by the studio.', sources: ['Studio', 'Walk-in'], value: walkinCut, set: setWalkinCut },
                  { label: 'Personal & app', description: 'Bookings brought in by an artist, or made in the Vanta app.', sources: ['Personal', 'App'], value: personalCut, set: setPersonalCut },
                ].map(({ label, description, sources, value, set }) => {
                  const parsedValue = parseFloat(value);
                  const studioShare = Number.isFinite(parsedValue) ? Math.min(100, Math.max(0, parsedValue)) : 0;
                  const formatShare = share => Number.isInteger(share) ? `${share}%` : `${share.toFixed(1)}%`;
                  return (
                    <div key={label} style={s.commissionTile}>
                      <div style={s.commissionTileHeader}>
                        <div style={{ minWidth: 0 }}>
                          <div style={s.commissionTitle}>{label}</div>
                          <div style={s.commissionDescription}>{description}</div>
                        </div>
                        <label style={s.commissionInputWrap}>
                          <span style={s.visuallyHidden}>{label} studio commission percentage</span>
                          <input
                            className="studio-commission-input"
                            style={s.commissionInput}
                            type="number" min="0" max="100" step="0.5"
                            inputMode="decimal"
                            value={value}
                            onChange={e => set(e.target.value)}
                            onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                            placeholder="0"
                          />
                          <span style={s.commissionPercent}>%</span>
                        </label>
                      </div>
                      <div style={s.commissionSplit}>
                        <span style={s.commissionSplitLabel}>Studio receives <strong style={s.commissionSplitValue}>{formatShare(studioShare)}</strong></span>
                        <span style={s.commissionSplitLabel}>Artist receives <strong style={s.commissionSplitValue}>{formatShare(100 - studioShare)}</strong></span>
                      </div>
                      <div style={s.sourceChips}>
                        {sources.map(source => <span key={source} style={s.sourceChip}>{source}</span>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="studio-payment-setting" style={s.paymentSetting}>
              <div style={s.paymentSettingCopy}>
                <label htmlFor="payment-recording-requirement" style={s.paymentSettingTitle}>Payment recording requirement</label>
                <p style={s.paymentSettingDescription}>
                  Choose who must record payment before a payout can be processed. This only affects bookings completed after you save the change.
                </p>
              </div>
              <select
                id="payment-recording-requirement"
                style={s.paymentSettingSelect}
                value={paymentRecordingReq}
                onChange={e => setPaymentRecordingReq(e.target.value)}
              >
                <option value="studio_only">Studio only</option>
                <option value="artist_only">Artist only</option>
                <option value="both">Studio and artist</option>
              </select>
            </div>
            <div className="studio-payment-setting" style={s.paymentSetting}>
              <div style={s.paymentSettingCopy}>
                <div style={s.paymentSettingTitle}>Pay artist on forfeited deposits</div>
                <p style={s.paymentSettingDescription}>
                  If a client cancels and you keep their deposit, give the assigned artist a share of it. This applies to future cancellations only.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={payForfeitedDeposits}
                aria-label="Pay artist on forfeited deposits"
                onClick={() => setPayForfeitedDeposits(v => !v)}
                style={{ width: 44, height: 24, padding: 0, border: 0, background: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                <span aria-hidden="true" style={{ display: 'block', width: 44, height: 24, borderRadius: 12, border: '1px solid var(--switch-edge)', background: payForfeitedDeposits ? 'var(--switch-on)' : 'var(--switch-off)', position: 'relative', transition: 'background 0.2s' }}>
                <span style={{
                  position: 'absolute', top: 2, left: payForfeitedDeposits ? 22 : 2, width: 18, height: 18,
                  borderRadius: '50%', background: 'var(--switch-thumb)', border: '1px solid var(--switch-edge)', boxShadow: '0 1px 3px rgba(0,0,0,0.65)', transition: 'left 0.2s',
                }} />
                </span>
              </button>
            </div>
            {payForfeitedDeposits && (() => {
              const usual = 100 - (Number.isFinite(parseFloat(walkinCut)) ? Math.min(100, Math.max(0, parseFloat(walkinCut))) : 0);
              const typed = parseFloat(forfeitPct);
              const example = Number.isFinite(typed) ? Math.min(100, Math.max(0, typed)) : usual;
              return (
                <div className="studio-payment-setting" style={{ ...s.paymentSetting, paddingTop: 0, borderTop: 'none' }}>
                  <div style={s.paymentSettingCopy}>
                    <label htmlFor="forfeit-percent" style={s.paymentSettingTitle}>Artist’s share of the deposit</label>
                    <p style={s.paymentSettingDescription}>
                      Leave blank to give them their usual commission share. With {Number.isInteger(example) ? example : example.toFixed(1)}%, a $100 forfeited deposit pays the artist ${(example).toFixed(2).replace(/\.00$/, '')}.
                    </p>
                  </div>
                  <label style={s.commissionInputWrap}>
                    <input
                      id="forfeit-percent"
                      className="studio-commission-input"
                      style={s.commissionInput}
                      type="number" min="0" max="100" step="1"
                      inputMode="decimal"
                      value={forfeitPct}
                      onChange={e => setForfeitPct(e.target.value)}
                      onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                      placeholder={String(usual)}
                    />
                    <span style={s.commissionPercent}>%</span>
                  </label>
                </div>
              );
            })()}
            {profileError && <p style={s.errorText}>{profileError}</p>}
            <button type="submit" style={s.saveBtn} disabled={saving}>
              {saving ? t('saving') : saved ? t('saved') : t('save_changes')}
            </button>
          </form>
        </section>

        <div className="settings-span-12 settings-cell"><DepositPaymentOptions styles={s} stripe={{ status: stripeStatus, connecting: stripeConnecting, error: stripeError, connect: handleStripeConnect, disconnect: handleStripeDisconnect }} /></div>
        <div className="settings-span-12 settings-cell"><ArtistCommissionOverrides styles={s} defaults={{ studio: walkinCut, personal: personalCut }} /></div>

        </>}


        {tab === 'types' && <AppointmentTypesSettings styles={s} />}

        {tab === 'requests' && <>




        <section className="settings-span-12" style={s.card} aria-labelledby="booking-link-title">
          <h2 id="booking-link-title" style={s.sectionTitle}>{t('booking_link')}</h2>
          <p style={s.sectionDesc}>Share this link or QR code so clients can send you booking requests.</p>
          <div style={s.linkBlock}>
            <DownloadableQR value={walkInUrl} id="booking-qr" filename="booking-qr" displaySize={84} hideButton />
            <div style={s.linkMain}>
              <span style={s.linkUrl}>{walkInUrl.replace(/^https?:\/\//, '')}</span>
              <div style={s.linkActions}>
                <Button size="sm" onClick={copyLink}>{copied ? t('copied') : t('copy_link')}</Button>
                <Button size="sm" variant="secondary" onClick={() => downloadQR('booking-qr', 'booking-qr')}>Download QR</Button>
                {bookingSlug && !editingSlug && (
                  <Button size="sm" variant="ghost" onClick={() => { setSlugDraft(bookingSlug); setSlugCheck(null); setSlugError(''); setEditingSlug(true); }}>Change link</Button>
                )}
              </div>
            </div>
          </div>
          {bookingSlug && editingSlug && (
            <form onSubmit={saveBookingSlug} style={s.slugForm}>
              <label htmlFor="booking-slug" style={s.label}>New link</label>
              <div className="studio-slug-field" style={s.slugField}>
                <span aria-hidden="true" style={s.slugPrefix}>vanta.tattoo/b/</span>
                <input id="booking-slug" value={slugDraft} autoFocus
                  onChange={e => setSlugDraft(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  onKeyDown={e => { if (e.key === 'Escape') setEditingSlug(false); }}
                  maxLength={40} autoCapitalize="none" autoCorrect="off" spellCheck={false} style={s.slugInput} />
              </div>
              <div aria-live="polite" style={{ minHeight: '1.15rem' }}>
                {slugError ? <p role="alert" style={{ ...s.slugNote, color: 'var(--color-danger)' }}>{slugError}</p>
                  : slugCheck?.state === 'short' ? <p style={s.slugNote}>Use at least 3 letters or numbers.</p>
                  : slugCheck?.state === 'checking' ? <p style={s.slugNote}>Checking…</p>
                  : slugCheck?.state === 'error' ? <p style={{ ...s.slugNote, color: 'var(--color-danger)' }}>Couldn’t check right now. Try again.</p>
                  : slugCheck?.state === 'available' ? <p style={{ ...s.slugNote, color: 'var(--color-success)' }}>✓ Available</p>
                  : slugCheck?.state === 'taken' ? <p style={{ ...s.slugNote, color: 'var(--color-danger)' }}>{slugCheck.message === 'that link is already taken' ? 'Another studio already uses this link. Try a different name.' : `${slugCheck.message.charAt(0).toUpperCase()}${slugCheck.message.slice(1)}.`}</p>
                  : null}
              </div>
              <div style={s.linkActions}>
                <Button size="sm" type="submit" loading={slugSaving} loadingLabel="Saving…" disabled={slugDraft === bookingSlug || slugCheck?.state !== 'available'}>Save link</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingSlug(false)}>Cancel</Button>
              </div>
              <p style={{ ...s.slugNote, color: 'var(--text-ghost)' }}>Your old link and printed QR codes will stop working.</p>
            </form>
          )}
        </section>

        <div className="settings-span-12 settings-cell"><BookingManagementSettings styles={s} availabilityRequired={!!(formFields?.availability_windows?.enabled && formFields?.availability_windows?.required)} /></div>

        <section className="settings-span-12" style={s.card} aria-labelledby="booking-form-title">
          <h2 id="booking-form-title" style={s.sectionTitle}>Booking form</h2>
          <p style={s.sectionDesc}>Choose what clients fill in on your booking link and website widget, and how the widget looks. Field switches save straight away.</p>
          <div className="studio-feature-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={s.label}>Form fields</label>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 0.35rem' }}>
                  Name, date of birth, email, and phone are always shown.
                </p>
                {formFields === null ? (
                  <div style={s.loadingDot} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {[
                      { key: 'artist_id',      label: 'Artist preference' },
                      { key: 'body_location',  label: 'Placement' },
                      { key: 'design_details', label: 'Design description' },
                      { key: 'retouch',        label: 'Touch-up / retouch' },
                      { key: 'size',           label: 'Size' },
                      { key: 'skin_tone',      label: 'Skin tone' },
                      { key: 'notes',          label: 'Additional notes' },
                      { key: 'allergies',      label: 'Allergies' },
                      { key: 'availability_windows', label: 'Weekly availability' },
                      { key: 'image_paths',    label: 'Reference photos' },
                    ].map(({ key, label }) => {
                      const entry = formFields[key] ?? { enabled: false, required: false };
                      return (
                        <div key={key} style={s.formFieldRow}>
                          <span style={{ flex: 1, fontSize: '0.95rem', fontWeight: 500, color: entry.enabled ? 'var(--text)' : 'var(--text-secondary)' }}>
                            {label}
                          </span>
                          {entry.enabled && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                aria-label={`${label} required`}
                                checked={entry.required}
                                onChange={e => handleFormFieldToggle(key, 'required', e.target.checked)}
                                style={{ accentColor: 'var(--accent)' }}
                                disabled={formFieldsSaving}
                              />
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Required</span>
                            </label>
                          )}
                          <button
                            role="switch"
                            aria-label={`${label} field`}
                            aria-checked={entry.enabled}
                            onClick={() => handleFormFieldToggle(key, 'enabled', !entry.enabled)}
                            disabled={formFieldsSaving}
                            style={s.switchBtn}
                          >
                            <span aria-hidden="true" style={{ ...s.switchTrack, background: entry.enabled ? 'var(--switch-on)' : 'var(--switch-off)' }}>
                              <span style={{ ...s.switchThumb, transform: entry.enabled ? 'translateX(16px)' : 'none' }} />
                            </span>
                          </button>
                        </div>
                      );
                    })}
                    {consentTemplates.length > 0 && (
                      <>
                        <div style={{ borderTop: '1px solid var(--border)', margin: '0.1rem 0' }} />
                        <div style={{ ...s.formFieldRow, flexWrap: 'wrap' }}>
                          <span style={{ flex: 1, fontSize: '0.83rem', fontWeight: 500, color: widgetConsentTemplateId ? 'var(--text)' : 'var(--text-ghost)' }}>
                            Consent form
                          </span>
                          {widgetConsentTemplateId && consentTemplates.length > 1 && (
                            <select
                              aria-label="Booking consent form template"
                              value={widgetConsentTemplateId}
                              onChange={e => setWidgetConsentTemplateId(e.target.value)}
                              style={{ ...s.input, flex: '1 1 180px', minWidth: 0, maxWidth: '100%', width: 'auto', fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                            >
                              {consentTemplates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          )}
                          <button
                            role="switch"
                            aria-label="Consent form field"
                            aria-checked={!!widgetConsentTemplateId}
                            onClick={() => setWidgetConsentTemplateId(widgetConsentTemplateId ? '' : (consentTemplates[0]?.id ?? ''))}
                            style={{
                              ...s.fieldToggleBtn,
                              background: widgetConsentTemplateId ? 'var(--accent-tint)' : 'var(--bg-chip)',
                              borderColor: widgetConsentTemplateId ? 'var(--accent-tint-border)' : 'var(--border)',
                              color: widgetConsentTemplateId ? 'var(--accent)' : 'var(--text-ghost)',
                            }}
                          >
                            {widgetConsentTemplateId ? 'On' : 'Off'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <p style={s.colourNote}>Colours and logo are set once for all your forms in <a href="/dashboard/settings?tab=studio" style={s.colourNoteLink}>Studio → Logo and colours</a>.</p>

              <button onClick={saveProfile} style={s.saveBtn} disabled={saving}>
                {saving ? t('saving') : saved ? t('saved') : t('save')}
              </button>

              <div style={{ ...s.embedCard, borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <h3 style={{ ...s.label, margin: 0 }}>Add it to your website</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>Paste this code where you want the booking form to appear on your site.</p>
                <pre style={s.codeBlock}>{embedSnippet}</pre>
                <button onClick={copyEmbed} style={s.copyBtn}>{embedCopied ? t('copied') : t('copy_snippet')}</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <WidgetPreview bg={widgetBgColor} accent={widgetAccentColor} logoUrl={logoUrl} studioName={name || 'Your Studio'} fields={formFields} consentTemplate={widgetConsentTemplateId ? consentTemplates.find(t => t.id === widgetConsentTemplateId) : null} />
            </div>
          </div>
        </section>



        {/* Smart scheduling — temporarily hidden
        <section className="settings-span-12" style={s.card}>
          <h2 style={s.sectionTitle}>Smart scheduling</h2>
          <SmartSchedulingSettings mode={schedulingMode} onChange={setSchedulingMode} disabled={saving} />
          {profileError && <p role="alert" style={s.errorText}>{profileError}</p>}
          <button onClick={saveProfile} style={s.saveBtn} disabled={saving}>
            {saving ? t('saving') : saved ? t('saved') : t('save')}
          </button>
        </section>
        */}

        </>}

        {tab === 'walkins' && <>
        <WalkInFormSettings styles={s} bg={validHex(widgetBgColor) ? widgetBgColor : undefined} accent={validHex(widgetAccentColor) ? widgetAccentColor : undefined} studioName={name} logoUrl={logoUrl} consentTemplates={consentTemplates} url={bookingSlug ? `${SHORT_LINK_BASE}/w/${bookingSlug}` : studioId ? `${typeof window === 'undefined' ? '' : window.location.origin}/walkin?s=${studioId}` : ''} />

        </>}

        {tab === 'consent' && <>
        {walkInUrl && (
          <section className="settings-span-12" style={s.card} aria-labelledby="consent-qr-title">
            <h2 id="consent-qr-title" style={s.sectionTitle}>Consent link</h2>
            <p style={s.sectionDesc}>Print the QR code or share the link. Clients open your consent form, sign in or create an account, then fill it in and sign.</p>
            <div style={s.linkBlock}>
              <DownloadableQR value={consentUrl} id="consent-qr" filename="consent-qr" displaySize={84} hideButton />
              <div style={s.linkMain}>
                <span style={s.linkUrl}>{consentUrl.replace(/^https?:\/\//, '')}</span>
                <div style={s.linkActions}>
                  <Button size="sm" onClick={() => navigator.clipboard.writeText(consentUrl).then(() => showFeedback('Consent link copied', 'success')).catch(() => {})}>Copy link</Button>
                  <Button size="sm" variant="secondary" onClick={() => downloadQR('consent-qr', 'consent-qr')}>Download QR</Button>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="settings-span-12 studio-consent-editor" style={s.card} aria-label="Consent form editor">
          <p style={{ ...s.sectionDesc, margin: 0 }}>Clients fill in and sign this before their appointment. The preview shows what they see.</p>
              <div className="studio-feature-grid studio-consent-editor-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
                {/* Left — editor */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={s.field}>
                    <label htmlFor="consent-form-name" style={s.label}>Form name <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                    <input id="consent-form-name" required style={s.input} type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. Tattoo Consent" />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={s.toggleRow}>
                      <input type="checkbox" checked={templateRequiresSig} onChange={e => setTemplateRequiresSig(e.target.checked)}
                        style={{ accentColor: 'var(--accent)' }} />
                      <span style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>Require client signature</span>
                    </label>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-ghost)', margin: 0, lineHeight: 1.5 }}>
                      Guardian consent fields appear automatically when the client's date of birth indicates they are under 18.
                    </p>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                    <div className="studio-consent-field-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Fields ({templateFields.length})</span>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {[['heading','Heading'],['paragraph','Paragraph'],['checkbox','Checkbox'],['text','Text'],['textarea','Textarea'],['yesno','Yes/No'],['photo_id','Photo ID']].map(([type, label]) => (
                          <button key={type} style={s.addFieldBtn} onClick={() => addField(type)}>+ {label}</button>
                        ))}
                      </div>
                    </div>

                    {templateFields.length === 0 && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-ghost)', fontStyle: 'italic' }}>No fields yet. Add fields using the buttons above.</p>
                    )}

                    {templateFields.map((f, idx) => (
                      <div key={f.id} style={s.fieldEditorRow}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                          <span style={s.fieldTypeBadge}>{f.type === 'photo_id' ? 'photo ID' : f.type}</span>
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem' }}>
                            <button aria-label={`Move field ${idx + 1} up`} style={s.fieldMoveBtn} onClick={() => moveField(f.id, -1)} disabled={idx === 0}>↑</button>
                            <button aria-label={`Move field ${idx + 1} down`} style={s.fieldMoveBtn} onClick={() => moveField(f.id, 1)} disabled={idx === templateFields.length - 1}>↓</button>
                            <button aria-label={`Remove field ${idx + 1}`} style={{ ...s.fieldMoveBtn, color: 'var(--color-danger)' }} onClick={() => removeField(f.id)}>✕</button>
                          </div>
                        </div>
                        {['heading','paragraph','checkbox'].includes(f.type) ? (
                          <textarea
                            aria-label={`Field ${idx + 1} ${f.type} content`}
                            style={{ ...s.input, minHeight: f.type === 'paragraph' ? 72 : 38, resize: 'vertical', fontSize: '0.82rem' }}
                            value={f.label}
                            onChange={e => updateField(f.id, { label: e.target.value })}
                            placeholder={f.type === 'heading' ? 'Section heading…' : f.type === 'paragraph' ? 'Paragraph text…' : 'Checkbox label (e.g. I agree to…)'}
                          />
                        ) : (
                          <input aria-label={`Field ${idx + 1} label`} style={{ ...s.input, fontSize: '0.82rem' }} type="text" value={f.label}
                            onChange={e => updateField(f.id, { label: e.target.value })}
                            placeholder="Field label…" />
                        )}
                        {!['heading','paragraph'].includes(f.type) && (
                          <label style={{ ...s.toggleRow, marginTop: '0.3rem' }}>
                            <input type="checkbox" checked={!!f.required} onChange={e => updateField(f.id, { required: e.target.checked })}
                              style={{ accentColor: 'var(--accent)' }} />
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-ghost)' }}>Required</span>
                          </label>
                        )}
                      </div>
                    ))}
                  </div>

                  <p style={{ ...s.colourNote, borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>Colours and logo are set once for all your forms in <a href="/dashboard/settings?tab=studio" style={s.colourNoteLink}>Studio → Logo and colours</a>.</p>
                </div>

                {/* Right — preview */}
                <StickyPreview>
                  <ConsentFormPreview
                    name={templateName}
                    fields={templateFields}
                    requiresSig={templateRequiresSig}
                    requiresGuardian={templateRequiresGuardian}
                    bg={validHex(widgetBgColor) ? widgetBgColor : CONSENT_DEFAULT_BG}
                    accent={validHex(widgetAccentColor) ? widgetAccentColor : CONSENT_DEFAULT_ACCENT}
                    studioName={name}
                  />
                </StickyPreview>
              </div>

          {templateError && <p role="alert" style={{ fontSize: '0.8rem', color: 'var(--color-danger)', margin: 0 }}>{templateError}</p>}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.6rem', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <span role="status" style={{ marginRight: 'auto', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {consentDirty ? 'Unsaved changes' : consentForm ? 'All changes saved' : 'Not saved yet'}
            </span>
            {consentDirty && consentForm && <button type="button" style={{ ...s.cancelBtn, flex: "none" }} disabled={templateSaving} onClick={resetConsentForm}>Discard</button>}
            <button type="button" style={s.saveBtn} onClick={saveTemplate} disabled={templateSaving || (!consentDirty && !!consentForm)}>
              {templateSaving ? 'Saving…' : consentForm ? 'Save form' : 'Create form'}
            </button>
          </div>
        </section>


        </>}

        {tab === 'messages' && <>
        <div id="email-sender" className="settings-span-12 settings-cell"><EmailSenderSettings /></div>
        <section className="settings-span-6" style={s.card}>
          <h2 style={s.sectionTitle}>Emails</h2>
          <p style={s.sectionDesc}>Booking confirmation is always sent. Choose up to 2 reminder emails for your clients.</p>
          <p id="email-reminder-limit" role="status" style={{ fontSize: '0.8rem', color: selectedReminderCount > 2 ? 'var(--color-danger)' : 'var(--text-muted)', margin: 0 }}>
            {selectedReminderCount > 2
              ? 'Turn off a reminder before saving. You can select up to 2.'
              : `${selectedReminderCount} of 2 selected.${selectedReminderCount === 2 ? ' Turn one off to choose another.' : ''}`}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>7-day reminder</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.45 }}>Sent to clients 7 days before their appointment</div>
              </div>
              <button
                type="button"
                disabled={saving}
                aria-describedby="email-reminder-limit"
                role="switch"
                aria-label="7-day reminder"
                aria-checked={sendReminder7d}
                onClick={() => toggleEmailReminder(sendReminder7d, setSendReminder7d)}
                style={{ width: 52, height: 44, padding: 0, border: 0, background: 'transparent', cursor: saving ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                <span aria-hidden="true" style={{ display: 'block', flex: 'none', boxSizing: 'border-box', width: 44, height: 24, borderRadius: 999, border: '1px solid var(--switch-edge)', background: sendReminder7d ? 'var(--switch-on)' : 'var(--switch-off)', position: 'relative', transition: 'background 0.2s' }}>
                <span style={{
                  position: 'absolute', top: 2, left: 2, transform: sendReminder7d ? 'translateX(20px)' : 'translateX(0)', width: 18, height: 18,
                  borderRadius: '50%', background: 'var(--switch-thumb)', boxShadow: '0 1px 3px rgba(0,0,0,0.65)', transition: 'transform 0.2s',
                }} />
                </span>
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>3-day reminder</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.45 }}>Sent to clients 3 days before their appointment</div>
              </div>
              <button
                type="button"
                disabled={saving}
                aria-describedby="email-reminder-limit"
                role="switch"
                aria-label="3-day reminder"
                aria-checked={sendReminder3d}
                onClick={() => toggleEmailReminder(sendReminder3d, setSendReminder3d)}
                style={{ width: 52, height: 44, padding: 0, border: 0, background: 'transparent', cursor: saving ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                <span aria-hidden="true" style={{ display: 'block', flex: 'none', boxSizing: 'border-box', width: 44, height: 24, borderRadius: 999, border: '1px solid var(--switch-edge)', background: sendReminder3d ? 'var(--switch-on)' : 'var(--switch-off)', position: 'relative', transition: 'background 0.2s' }}>
                <span style={{
                  position: 'absolute', top: 2, left: 2, transform: sendReminder3d ? 'translateX(20px)' : 'translateX(0)', width: 18, height: 18,
                  borderRadius: '50%', background: 'var(--switch-thumb)', boxShadow: '0 1px 3px rgba(0,0,0,0.65)', transition: 'transform 0.2s',
                }} />
                </span>
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 0' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>24-hour reminder</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.45 }}>Sent to clients 24 hours before their appointment</div>
              </div>
              <button
                type="button"
                disabled={saving}
                aria-describedby="email-reminder-limit"
                role="switch"
                aria-label="24-hour reminder"
                aria-checked={sendReminder24h}
                onClick={() => toggleEmailReminder(sendReminder24h, setSendReminder24h)}
                style={{ width: 52, height: 44, padding: 0, border: 0, background: 'transparent', cursor: saving ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                <span aria-hidden="true" style={{ display: 'block', flex: 'none', boxSizing: 'border-box', width: 44, height: 24, borderRadius: 999, border: '1px solid var(--switch-edge)', background: sendReminder24h ? 'var(--switch-on)' : 'var(--switch-off)', position: 'relative', transition: 'background 0.2s' }}>
                <span style={{
                  position: 'absolute', top: 2, left: 2, transform: sendReminder24h ? 'translateX(20px)' : 'translateX(0)', width: 18, height: 18,
                  borderRadius: '50%', background: 'var(--switch-thumb)', boxShadow: '0 1px 3px rgba(0,0,0,0.65)', transition: 'transform 0.2s',
                }} />
                </span>
              </button>
            </div>
          </div>
          <button onClick={saveProfile} style={s.saveBtn} disabled={saving || selectedReminderCount > 2}>
            {saving ? t('saving') : saved ? t('saved') : t('save')}
          </button>
        </section>

        <div className="settings-span-6 settings-cell"><SMSSettings styles={s} /></div>

        {/* Piercing aftercare instructions — temporarily hidden
        <section className="settings-span-12" style={s.card}>
          <h2 style={s.sectionTitle}>Piercing aftercare instructions</h2>
          <p style={s.sectionDesc}>Your studio’s guidance is attached to completed piercing appointments. Tattoo instructions are kept separate.</p>
          <textarea aria-label="Piercing aftercare instructions" style={{ ...s.input, minHeight: 120, resize: 'vertical', lineHeight: 1.6 }} value={piercingAftercareInstructions} onChange={e => setPiercingAftercareInstructions(e.target.value)} placeholder="Add your studio’s piercing aftercare instructions…" />
          <button onClick={saveProfile} style={s.saveBtn} disabled={saving}>{saving ? t('saving') : saved ? t('saved') : t('save')}</button>
        </section>
        */}

        {/* Aftercare instructions — temporarily hidden
        <section className="settings-span-12" style={s.card}>
          <h2 style={s.sectionTitle}>{t('aftercare_instructions')}</h2>
          <p style={s.sectionDesc}>Aftercare guidance that gets attached to every completed booking. Clients can see this on their booking record after their session.</p>
          <textarea
            style={{ ...s.input, minHeight: 120, resize: 'vertical', lineHeight: 1.6 }}
            value={aftercareInstructions}
            onChange={e => setAftercareInstructions(e.target.value)}
            placeholder="e.g. Keep the area clean and moisturised for the first 2 weeks. Avoid direct sunlight…"
          />
          <button onClick={saveProfile} style={s.saveBtn} disabled={saving}>
            {saving ? t('saving') : saved ? t('saved') : t('save')}
          </button>
        </section>
        */}

        </>}

        {tab === 'account' && <>

        <section className={`settings-span-6 ${accountStyles.identity}`} aria-labelledby="account-details-heading">
          <div className={accountStyles.identityCopy}>
            <h2 id="account-details-heading">{t('account_details')}</h2>
            <p><span>{t('signed_in_as')}</span> <span className={accountStyles.email}>{email}</span></p>
          </div>
          <button type="button" onClick={handleSignOut} className={accountStyles.signOut}>{t('sign_out')}</button>
        </section>

        <section className="settings-span-6" style={s.card}>
          <h2 style={s.sectionTitle}>Billing</h2>
          {isBillingExempt ? <div>
            <p style={s.sectionDesc}>This demo studio has complimentary access.</p>
            <p style={{ margin: '0.75rem 0 0', fontWeight: 600 }}>No billing required</p>
            <p style={s.sectionDesc}>No subscription, payment card or recurring charges.</p>
          </div> : <>

          <p style={s.sectionDesc}>
            {formatCents(billingDetails?.base_tier_cents ?? 3000)}/mo AUD covers up to {billingDetails?.base_tier_seats ?? 6} artists,
            then {formatCents(billingDetails?.per_extra_seat_cents ?? 500)}/artist beyond that.
          </p>

          {billingNotice && <p style={{ fontSize: '0.82rem', color: 'var(--accent)', margin: 0 }}>{billingNotice}</p>}

          <div style={{ ...s.stripeStatusRow, flexWrap: 'wrap' }}>
            <div style={s.billingStatusDot(isCanceling ? 'canceling' : subscriptionStatus)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: '0.87rem', fontWeight: 600, color: 'var(--text)' }}>
                {isCanceling
                  ? 'Canceling'
                  : subscriptionStatus === 'active'
                    ? 'Active'
                    : subscriptionStatus === 'trialing'
                      ? 'Free trial'
                      : subscriptionStatus === 'past_due'
                        ? 'Payment failed'
                        : subscriptionStatus === 'canceled'
                          ? 'Canceled'
                          : 'No billing set up'}
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {isCanceling
                  ? `You'll keep full access until ${periodEndLabel}, then your dashboard will lock.`
                  : subscriptionStatus === 'active'
                    ? 'Your subscription is active — thanks for being a Vanta studio.'
                    : subscriptionStatus === 'trialing'
                      ? "You're in your free trial period."
                      : subscriptionStatus === 'past_due'
                        ? 'Your last payment failed. Update your card to keep your dashboard active.'
                        : subscriptionStatus === 'canceled'
                          ? 'Your subscription was canceled. Add billing to reactivate.'
                          : 'Add a card to activate billing for this studio.'}
              </span>
            </div>
            {(subscriptionStatus !== 'active' || isCanceling) && (
              <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                <button style={s.saveBtn} onClick={handleAddBilling} disabled={billingLoading}>
                  {billingLoading
                    ? (isCanceling ? 'Reactivating…' : 'Starting checkout…')
                    : (isCanceling ? 'Undo cancellation' : 'Add billing')}
                </button>
              </div>
            )}
          </div>
          {billingError && <p style={s.errorText}>{billingError}</p>}

          <div style={s.billingHero}>
            <span style={s.billingHeroLabel}>{billingHeroLabel}</span>
            <div style={s.billingHeroValueRow}>
              <span style={s.billingHeroValue}>{isCanceling ? periodEndLabel : formatCents(billingHeroCents)}</span>
              {!isCanceling && hasBillingPeriod && <span style={s.billingHeroDate}>on {periodEndLabel}</span>}
            </div>
            <span style={s.billingHeroSub}>
              {isCanceling ? 'No further charges' : `For ${billingSeatCount} approved artist${billingSeatCount === 1 ? '' : 's'}`}
            </span>
          </div>

          {billingDetails?.card_last4 && (
            <div style={s.paymentMethodRow}>
              <div style={{ ...s.cardBadge, background: cardBrandColor(billingDetails.card_brand) }}>
                {cardBrandLabel(billingDetails.card_brand)}
              </div>
              <span style={s.paymentMethodNumber}>•••• {billingDetails.card_last4}</span>
              <div className="studio-wrap-row" style={s.billingActionsRow}>
                <button onClick={handleUpdateCard} style={s.updateCardBtn} disabled={portalLoading}>
                  {portalLoading ? (billingDetails.stripe_managed ? 'Opening…' : 'Updating…') : 'Update card'}
                </button>
                {subscriptionStatus === 'active' && !isCanceling && (
                  <button onClick={() => { setCancelError(''); setCancelModalOpen(true); }} style={s.cancelSubscriptionLink}>
                    Cancel subscription
                  </button>
                )}
              </div>
            </div>
          )}
          </>}
        </section>

        {cancelModalOpen && (
          <CancelSubscriptionModal
            saving={cancelLoading}
            error={cancelError}
            onConfirm={handleCancelSubscription}
            onCancel={() => setCancelModalOpen(false)}
          />
        )}

        <div className="settings-span-6 settings-cell"><PushNotificationSettings /></div>

        <section className="settings-span-6" style={s.card} aria-labelledby="account-preferences-heading">
          <h2 id="account-preferences-heading" style={s.sectionTitle}>{t('preferences')}</h2>
          <div className={accountStyles.preferences}>
            <div className={accountStyles.appearance}>
              <h3 className={accountStyles.preferenceTitle}>{t('appearance')}</h3>
              <ThemePicker value={theme} onChange={chooseTheme} />
            </div>
            <div className={accountStyles.language}>
              <label htmlFor="account-language" className={accountStyles.preferenceTitle}>{t('language')}</label>
              <select id="account-language" className={accountStyles.languageSelect} value={lang} onChange={event => switchLanguage(event.target.value)}>
                {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
        </section>

        <div className="settings-span-12"><StudioSetupLinks /></div>

        </>}

      </div>
      </>}
    </div>
  );
}

const s = {
  // Let Settings grow inside the dashboard scroller so the final card keeps its bottom padding.
  page: { flex: '1 0 auto', padding: '2rem 2.5rem calc(2rem + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: '1.25rem', minHeight: '100%', boxSizing: 'border-box', width: '100%', maxWidth: 1320 },
  tabIntroWrap: { display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.5rem' },
  tabIntroTitle: { margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' },
  tabIntro: { margin: 0, fontSize: '0.95rem', lineHeight: 1.5, color: 'var(--text-secondary)' },
  pageHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' },
  pageTitle: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' },
  settingsList: { display: 'flex', flexDirection: 'column', marginTop: '0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' },
  settingsRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', minHeight: 64, padding: '0.75rem 1rem', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-faint)', cursor: 'pointer', fontFamily: 'inherit', width: '100%' },
  settingsBack: { alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, marginLeft: -6, padding: '0 6px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  tabBar: { display: 'inline-flex', flexWrap: 'wrap', gap: 4, padding: 4, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12 },
  tabBtn: { padding: '0.5rem 1.1rem', borderRadius: 9, border: '1px solid transparent', background: 'transparent', color: 'var(--text-dim)', fontSize: '0.925rem', fontWeight: 500, cursor: 'pointer' },
  tabBtnActive: { background: 'var(--accent)', border: '1px solid var(--accent)', color: 'var(--accent-contrast)', fontWeight: 700 },
  grid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '1rem', alignItems: 'start' },
  groupLabel: { gridColumn: '1 / -1', margin: '0.5rem 0 -0.25rem', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' },
  card: { display: 'flex', flexDirection: 'column', gap: '1.1rem', minWidth: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.5rem 1.6rem' },
  switchBtn: { width: 52, height: 44, padding: 0, border: 0, background: 'transparent', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  switchTrack: { display: 'block', boxSizing: 'border-box', width: 38, height: 22, borderRadius: 999, border: '1px solid var(--switch-edge)', position: 'relative', transition: 'background 0.2s' },
  switchThumb: { position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: '50%', background: 'var(--switch-thumb)', boxShadow: '0 1px 3px rgba(0,0,0,0.5)', transition: 'transform 0.2s' },
  loadingDot: { width: 8, height: 8, borderRadius: '50%', background: 'var(--border)', margin: '4rem auto' },
  section: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  sectionTitle: { fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 0.1rem', letterSpacing: '-0.01em' },
  sectionDesc: { fontSize: '0.95rem', color: 'var(--text-dim)', margin: 0, lineHeight: 1.55, maxWidth: '72ch' },
  settingsSectionHeader: { display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingBottom: '0.15rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 },
  paymentsForm: { display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 1120 },
  field: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  label: { fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-dim)' },
  input: { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.95rem', fontSize: '0.95rem', color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' },
  errorText: { fontSize: '0.875rem', color: 'var(--color-danger)', margin: 0 },
  saveBtn: { alignSelf: 'flex-start', marginTop: 'auto', background: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 9, padding: '0.65rem 1.4rem', fontSize: '0.925rem', fontWeight: 700, color: 'var(--accent-contrast)', cursor: 'pointer' },
  commissionGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' },
  commissionTile: { display: 'flex', flexDirection: 'column', gap: '0.85rem', minWidth: 0, padding: '1rem', background: 'var(--bg-input)', border: '1px solid var(--border-faint)', borderRadius: 10 },
  commissionTileHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' },
  commissionTitle: { fontSize: '0.9rem', fontWeight: 650, color: 'var(--text)', lineHeight: 1.35 },
  commissionDescription: { marginTop: '0.25rem', maxWidth: 360, fontSize: '0.9rem', lineHeight: 1.45, color: 'var(--text-muted)' },
  commissionInputWrap: { display: 'flex', alignItems: 'center', flexShrink: 0, width: 96, height: 44, padding: '0 0.65rem', boxSizing: 'border-box', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 },
  commissionInput: { width: '100%', minWidth: 0, padding: 0, background: 'transparent', border: 0, outline: 'none', color: 'var(--text)', fontSize: '1rem', fontWeight: 650, fontFamily: 'inherit' },
  commissionPercent: { color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 },
  commissionSplit: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-faint)' },
  commissionSplitLabel: { display: 'flex', flexDirection: 'column', gap: 2, color: 'var(--text-secondary)', fontSize: '0.8rem' },
  commissionSplitValue: { color: 'var(--text)', fontSize: '0.9rem', fontWeight: 650 },
  sourceChips: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem' },
  sourceChip: { padding: '0.22rem 0.48rem', borderRadius: 999, background: 'var(--bg-chip)', border: '1px solid var(--border-faint)', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 },
  paymentSetting: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2rem', padding: '1rem 0', borderTop: '1px solid var(--border-faint)' },
  paymentSettingCopy: { display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: 0 },
  paymentSettingTitle: { fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' },
  paymentSettingDescription: { maxWidth: 680, margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 },
  paymentSettingSelect: { width: 230, flexShrink: 0, cursor: 'pointer', colorScheme: 'auto', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.8rem', color: 'var(--text)', fontSize: '0.9rem', fontFamily: 'inherit' },
  visuallyHidden: { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 },
  billingStatusDot: (status) => {
    const color = status === 'active' ? 'var(--color-success)' : status === 'canceling' ? 'var(--color-warning)' : status === 'past_due' ? 'var(--color-warning)' : status === 'canceled' ? 'var(--color-danger)' : 'var(--text-ghost)';
    return { width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: color };
  },
  cancelSubscriptionLink: { background: 'none', border: 'none', padding: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' },
  // Billing — the primary "what/when" number gets a hero treatment; seats are
  // supporting context underneath it rather than a competing tile.
  billingHero: { display: 'flex', flexDirection: 'column', gap: 3, background: 'var(--bg-base)', border: '1px solid var(--border-faint)', borderRadius: 10, padding: '0.9rem 1rem' },
  billingHeroLabel: { fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.04em' },
  billingHeroValueRow: { display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' },
  billingHeroValue: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' },
  billingHeroDate: { fontSize: '0.875rem', color: 'var(--text-secondary)' },
  billingHeroSub: { fontSize: '0.875rem', color: 'var(--text-secondary)' },
  // Payment method — a compact settings-style row, not another stat tile, since it's a
  // different kind of information (identity, not a number) and a lower priority.
  paymentMethodRow: { display: 'flex', alignItems: 'center', gap: '0.7rem', background: 'var(--bg-base)', border: '1px solid var(--border-faint)', borderRadius: 10, padding: '0.7rem 0.9rem', flexWrap: 'wrap' },
  cardBadge: { fontSize: '0.7rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em', borderRadius: 5, padding: '0.3rem 0.45rem' },
  paymentMethodNumber: { fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.02em' },
  billingActionsRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1.1rem', marginLeft: 'auto' },
  updateCardBtn: { background: 'var(--bg-card)', border: '1px solid var(--border-faint)', borderRadius: 8, padding: '0.45rem 0.8rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dim)', cursor: 'pointer', fontFamily: 'inherit' },
  // Hours
  hoursGrid: { display: 'flex', flexDirection: 'column', gap: 0 },
  hoursRow: { display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.55rem 0', borderBottom: '1px solid var(--border-faint)' },
  dayLabel: { fontSize: '0.95rem', fontWeight: 500, color: 'var(--text)', width: 110, flexShrink: 0 },
  closedToggle: { display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', flexShrink: 0 },
  timePair: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' },
  timeSep: { color: 'var(--text-secondary)', fontSize: '0.9rem' },
  timeInput: { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.6rem', fontSize: '0.9rem', color: 'var(--text)', outline: 'none', colorScheme: 'auto' },
  // Stations
  stationList: { display: 'flex', flexDirection: 'column' },
  stationRow: { borderBottom: '1px solid var(--border-faint)' },
  stationTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', minHeight: 56, padding: '0.5rem 0' },
  stationName: { fontSize: '0.95rem', fontWeight: 500, color: 'var(--text)' },
  stationActions: { display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 },
  stationNameInput: { flex: 1, minWidth: 0, minHeight: 'var(--control-height-sm)', padding: '0.3rem 0.65rem', fontSize: '0.95rem', fontWeight: 500 },
  stationToggleBtn: { background: 'var(--bg-chip)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.4rem 0.75rem', fontSize: '0.85rem', color: 'var(--text-dim)', cursor: 'pointer' },
  stationRemoveBtn: { background: 'transparent', border: '1px solid rgba(255,80,80,0.2)', borderRadius: 8, padding: '0.4rem 0.75rem', fontSize: '0.85rem', color: 'var(--color-danger)', cursor: 'pointer' },
  unavailPanel: { borderTop: '1px solid var(--border-faint)', padding: '0.75rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  unavailAdd: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  dateInput: { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.6rem', fontSize: '0.9rem', color: 'var(--text)', outline: 'none', colorScheme: 'auto' },
  unavailList: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' },
  unavailItem: { display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,180,0,0.08)', border: '1px solid rgba(255,180,0,0.2)', borderRadius: 6, padding: '0.2rem 0.5rem' },
  unavailDate: { fontSize: '0.85rem', color: 'rgba(255,200,60,0.8)' },
  clearBtn: { background: 'none', border: 'none', color: 'rgba(255,200,60,0.5)', cursor: 'pointer', fontSize: '0.78rem', padding: 0 },
  // Walk-in
  linkBlock: { display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem', borderRadius: 12, background: 'var(--bg-base)', border: '1px solid var(--border-faint)' },
  linkMain: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  linkUrl: { fontSize: '1rem', fontWeight: 600, color: 'var(--text)', wordBreak: 'break-all' },
  linkActions: { display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' },
  slugForm: { display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '1rem' },
  slugField: { display: 'flex', alignItems: 'center', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, paddingLeft: '0.7rem', overflow: 'hidden' },
  slugPrefix: { fontSize: '0.95rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' },
  slugInput: { flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', padding: '0.55rem 0.7rem 0.55rem 0', fontSize: '16px', color: 'var(--text)' },
  slugNote: { margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' },
  walkInCard: { display: 'flex', alignItems: 'center', gap: '1.5rem' },
  walkInLeft: { flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0 },
  walkInUrl: { fontSize: '0.85rem', color: 'var(--text-muted)', wordBreak: 'break-all' },
  copyBtn: { alignSelf: 'flex-start', background: 'var(--accent-tint)', border: '1px solid var(--accent-tint-border)', borderRadius: 6, padding: '0.35rem 0.85rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' },
  qrWrap: { flexShrink: 0, padding: '0.5rem', background: 'var(--bg-card)', borderRadius: 8 },
  // Widget appearance
  colourNote: { margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 },
  colourNoteLink: { color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2 },
  colourSample: { display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '1rem 1.1rem', borderRadius: 12, border: '1px solid var(--border-faint)', transition: 'background-color 0.2s ease' },
  colourSampleButton: { alignSelf: 'flex-start', marginTop: '0.35rem', padding: '0.45rem 0.9rem', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, transition: 'background-color 0.2s ease, color 0.2s ease' },
  colorRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  colorField: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  colorInputWrap: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  colorSwatch: { width: 36, height: 36, padding: 2, background: 'var(--bg-chip)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', flexShrink: 0 },
  // Embed
  embedCard: { display: 'flex', flexDirection: 'column', gap: '0.65rem' },
  codeBlock: { margin: 0, fontFamily: 'ui-monospace,monospace', fontSize: '0.85rem', color: 'var(--text-dim)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: 'var(--bg-base)', border: '1px solid var(--border-faint)', borderRadius: 8, padding: '0.75rem 1rem' },
  // Consent templates
  addTemplateBtn: { background: 'var(--accent-tint)', border: '1px solid var(--accent-tint-border)', borderRadius: 8, padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent)', cursor: 'pointer', flexShrink: 0 },
  templateRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', border: '1px solid var(--border-faint)', borderRadius: 8, padding: '0.65rem 0.9rem', gap: '0.75rem' },
  templateRowLeft: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', flex: 1, minWidth: 0 },
  templateRowActions: { display: 'flex', gap: '0.4rem', flexShrink: 0 },
  templateName: { fontSize: '0.87rem', fontWeight: 500, color: 'var(--text-dim)' },
  templateFieldCount: { fontSize: '0.8rem', color: 'var(--text-ghost)' },
  guardianBadge: { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.12rem 0.45rem', borderRadius: 4, background: 'var(--accent-tint)', color: 'var(--text-muted)' },
  inactiveBadge: { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.12rem 0.45rem', borderRadius: 4, background: 'rgba(255,255,255,0.04)', color: 'var(--text-ghost)' },
  formTypeBadge: { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.12rem 0.45rem', borderRadius: 4 },
  formTypeBadgeColors: {
    consent: { background: 'var(--accent-tint)', color: 'var(--accent)' },
    waiver:  { background: 'rgba(232,111,111,0.12)', color: '#e86f6f' },
    health:  { background: 'rgba(76,201,138,0.12)', color: '#4cc98a' },
  },
  templateActionBtn: { background: 'var(--bg-chip)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.25rem 0.65rem', fontSize: '0.82rem', color: 'var(--text-muted)', cursor: 'pointer' },
  // Template builder modal
  modalOverlay: { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2rem 1rem', overflowY: 'auto' },
  templateModal: { background: 'var(--bg-modal)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.75rem', width: '100%', maxWidth: 600, display: 'flex', flexDirection: 'column', gap: '1rem' },
  toggleRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' },
  addFieldBtn: { background: 'var(--bg-chip)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.25rem 0.55rem', fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer' },
  fieldEditorRow: { background: 'var(--bg-card)', border: '1px solid var(--border-faint)', borderRadius: 8, padding: '0.65rem 0.75rem', marginBottom: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  fieldTypeBadge: { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.1rem 0.45rem', borderRadius: 4, background: 'var(--bg-chip)', color: 'var(--text-ghost)' },
  fieldMoveBtn: { background: 'var(--bg-chip)', border: '1px solid var(--border)', borderRadius: 4, padding: '0.1rem 0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer' },
  cancelBtn: { flex: 1, background: 'var(--bg-chip)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' },
  formFieldRow: { display: 'flex', alignItems: 'center', gap: '1rem', minHeight: 48, padding: '0 0 0 0.1rem', borderBottom: '1px solid var(--border-faint)' },
  fieldToggleBtn: { border: '1px solid', borderRadius: 6, padding: '0.25rem 0.75rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', minWidth: 42, textAlign: 'center' },
  // Stripe
  stripeConnectBtn: { alignSelf: 'flex-start', background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '0.65rem 1.4rem', fontSize: '0.88rem', fontWeight: 700, color: 'var(--accent-contrast, #111)', cursor: 'pointer' },
  stripeDisconnectBtn: { alignSelf: 'flex-start', background: 'transparent', border: '1px solid rgba(255,80,80,0.2)', borderRadius: 6, padding: '0.35rem 0.85rem', fontSize: '0.85rem', color: 'rgba(255,100,100,0.65)', cursor: 'pointer' },
  stripeStatusRow: { display: 'flex', alignItems: 'center', gap: '0.85rem', background: 'var(--bg-base)', border: '1px solid var(--border-faint)', borderRadius: 10, padding: '0.9rem 1rem' },
  stripeStatusDot: (active) => ({ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: active ? 'var(--status-confirmed)' : 'var(--status-pending)' }),
  // Account

};

function StationLastDayModal({ onConfirm, onCancel, saving, existingEndDate }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const defaultDate = (() => {
    if (existingEndDate) return existingEndDate;
    const d = new Date(); d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  })();
  const [lastDay, setLastDay] = useState(defaultDate);
  const isToday = lastDay === todayStr;
  const isChanging = !!existingEndDate;

  return (
    <Dialog title={isChanging ? 'Change last day' : "Set station's last day"} description="No bookings will be available on or after the station’s last day." onClose={onCancel} dismissDisabled={saving} maxWidth={400}>
        <label htmlFor="last-day" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
          Last day
        </label>
        <input
          id="last-day"
          type="date"
          min={todayStr}
          value={lastDay}
          onChange={e => setLastDay(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)', border: `1px solid ${isToday ? 'rgba(232,111,111,0.5)' : 'var(--border-strong)'}`, borderRadius: 8, padding: '0.65rem 0.85rem', fontSize: '0.9rem', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', colorScheme: 'inherit', marginBottom: isToday ? '0.5rem' : '1.25rem' }}
        />
        {isToday && (
          <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#e86f6f', lineHeight: 1.4 }}>
            Setting today will deactivate this station immediately.
          </p>
        )}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={onCancel} disabled={saving} style={{ flex: 1, padding: '0.7rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button
            onClick={() => onConfirm(lastDay)}
            disabled={saving || !lastDay || lastDay < todayStr}
            style={{
              flex: 2, padding: '0.7rem', borderRadius: 8, border: 'none',
              background: saving ? 'var(--bg-chip)' : isToday ? 'rgba(232,111,111,0.85)' : 'var(--accent)',
              color: saving ? 'var(--text-ghost)' : isToday ? '#fff' : 'var(--accent-contrast)',
              cursor: saving ? 'default' : 'pointer', fontSize: '0.9rem', fontWeight: 700, fontFamily: 'inherit',
            }}
          >
            {saving ? 'Saving…' : isToday ? 'Deactivate now' : isChanging ? 'Update last day' : 'Set last day'}
          </button>
        </div>
    </Dialog>
  );
}

const CANCEL_REASON_MIN_LEN = 20;

function CancelSubscriptionModal({ onConfirm, onCancel, saving, error }) {
  const [reason, setReason] = useState('');
  const remaining = CANCEL_REASON_MIN_LEN - reason.trim().length;
  const canSubmit = reason.trim().length >= CANCEL_REASON_MIN_LEN;

  return (
    <Dialog title="Cancel subscription" description="You’ll keep full access through the end of your current billing period. After that, your dashboard will lock until billing is added again. Please tell us why you’re canceling." onClose={onCancel} dismissDisabled={saving} maxWidth={440}>
        <label htmlFor="cancel-subscription-reason" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
          Reason for canceling
        </label>
        <textarea id="cancel-subscription-reason" aria-describedby="cancel-subscription-hint" aria-invalid={reason.length > 0 && !canSubmit}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Tell us what's not working, or why you're leaving…"
          rows={4}
          style={{
            width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)',
            border: `1px solid ${reason.length > 0 && !canSubmit ? 'rgba(232,111,111,0.5)' : 'var(--border-strong)'}`,
            borderRadius: 8, padding: '0.65rem 0.85rem', fontSize: '0.87rem', color: 'var(--text)',
            outline: 'none', fontFamily: 'inherit', resize: 'vertical', minHeight: 90,
          }}
        />
        <p id="cancel-subscription-hint" style={{ margin: '0.4rem 0 1.1rem', fontSize: '0.82rem', color: canSubmit ? 'var(--text-ghost)' : '#e86f6f' }}>
          {canSubmit ? `${reason.trim().length} characters` : `${remaining} more character${remaining === 1 ? '' : 's'} required`}
        </p>
        {error && <p role="alert" style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#e86f6f' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={onCancel} disabled={saving} style={{ flex: 1, padding: '0.7rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, fontFamily: 'inherit' }}>
            Keep subscription
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            disabled={saving || !canSubmit}
            style={{
              flex: 2, padding: '0.7rem', borderRadius: 8, border: 'none',
              background: saving || !canSubmit ? 'var(--bg-chip)' : 'rgba(232,111,111,0.85)',
              color: saving || !canSubmit ? 'var(--text-ghost)' : '#fff',
              cursor: saving || !canSubmit ? 'default' : 'pointer', fontSize: '0.9rem', fontWeight: 700, fontFamily: 'inherit',
            }}
          >
            {saving ? 'Canceling…' : 'Cancel subscription'}
          </button>
        </div>
    </Dialog>
  );
}
