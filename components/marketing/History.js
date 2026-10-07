'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { listMarketingCampaigns, getMarketingCampaignRecipients } from '@/lib/api';
import { showError } from '@/lib/feedback';
import PreviewDialog from './PreviewDialog';
import styles from './marketing.module.css';

const FAILED = { failed: 'Failed', bounced: 'Bounced', complained: 'Marked as spam', suppressed: 'Skipped, no longer opted in' };

// One label per recipient, most meaningful outcome first.
function outcome(r) {
  if (FAILED[r.status]) return { label: FAILED[r.status], tone: 'pillBad', group: 'failed' };
  if (r.status === 'unknown') return { label: 'Check Sent mail', tone: 'pillBad', group: 'failed' };
  if (r.clicked_at) return { label: 'Clicked', tone: 'pillOn', group: 'opened' };
  if (r.opened_at) return { label: 'Opened', tone: 'pillOn', group: 'opened' };
  if (r.delivered_at) return { label: 'Delivered', tone: 'pillBusy', group: 'unopened' };
  if (r.sent_at || r.status === 'sent') return { label: 'Sent', tone: 'pillBusy', group: 'unopened' };
  return { label: 'Waiting to send', tone: '', group: 'waiting' };
}

function statusPill(c) {
  if (c.status === 'sent') return <span className={`${styles.pill} ${styles.pillOn}`}>Sent</span>;
  if (c.status === 'needs_review') return <span className={`${styles.pill} ${styles.pillBad}`}>Check Sent mail</span>;
  if (c.status === 'finished_with_errors') return <span className={`${styles.pill} ${styles.pillBad}`}>Finished with errors</span>;
  return <span className={`${styles.pill} ${styles.pillBusy}`}>Sending · {c.queued} left</span>;
}

function Stat({ value, label, tone }) {
  return <div className={styles.miniStat}><span className={`${styles.miniValue} ${tone ? styles[tone] : ''}`}>{value}</span><span className={styles.miniLabel}>{label}</span></div>;
}

function Recipients({ campaign, onResend }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('all');

  useEffect(() => {
    let active = true;
    getMarketingCampaignRecipients(campaign.id)
      .then(data => { if (active) setList(data.recipients.map(r => ({ ...r, outcome: outcome(r) }))); })
      .catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [campaign.id, campaign.queued]);

  if (error) return <p className={styles.error} role="alert">{error}</p>;
  if (!list) return <p className={styles.muted} role="status">Loading recipients…</p>;

  const count = group => list.filter(r => r.outcome.group === group).length;
  const views = [['all', 'Everyone', list.length], ['opened', 'Opened', count('opened')], ['unopened', 'Not opened', count('unopened')], ['failed', 'Not delivered', count('failed')]];
  const shown = view === 'all' ? list : list.filter(r => r.outcome.group === view);
  const unopened = list.filter(r => r.outcome.group === 'unopened');
  // Opens are only recorded for domain sending, so only offer this when this campaign recorded some.
  const tracksOpens = campaign.opened > 0;

  return (
    <div className={styles.recipients}>
      <div className={styles.listBar}>
        <div className={styles.views} role="group" aria-label="Show">
          {views.filter(([id, , n]) => id === 'all' || n > 0).map(([id, label, n]) => (
            <button key={id} type="button" aria-pressed={view === id} className={styles.view} onClick={() => setView(id)}>{label} {n}</button>
          ))}
        </div>
        {tracksOpens && unopened.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => onResend(unopened.map(r => r.client_id))}>Email the {unopened.length} who didn’t open</Button>
        )}
      </div>
      {!tracksOpens && campaign.sent > 0 && <p className={styles.hint}>No opens recorded. Emails sent from a connected Gmail or Outlook account don’t report opens or clicks.</p>}
      <ul className={styles.clientList} aria-label="Recipients">
        {shown.map(r => (
          <li key={r.client_id} className={styles.clientRow} style={{ cursor: 'default' }}>
            <span className={styles.clientMain}>{r.name || r.email}<span className={styles.rowSub}>{r.name ? r.email : ''}{r.error && r.outcome.group === 'failed' ? ` · ${r.error}` : ''}</span></span>
            <span className={`${styles.pill} ${r.outcome.tone ? styles[r.outcome.tone] : ''}`}>{r.outcome.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Every campaign sent, with who got it and what happened to each email. */
export default function History({ onResend, onCompose }) {
  const [campaigns, setCampaigns] = useState(null);
  const [open, setOpen] = useState('');
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    let active = true, timer;
    async function load() {
      try {
        const list = (await listMarketingCampaigns()).campaigns;
        if (!active) return;
        setCampaigns(list);
        // Keep counts moving while emails are still going out.
        if (list.some(c => c.queued > 0)) timer = setTimeout(load, 10000);
      } catch (err) { if (active) { showError(err); setCampaigns(prev => prev || []); } }
    }
    load();
    return () => { active = false; clearTimeout(timer); };
  }, []);

  if (campaigns === null) return <p className={styles.muted} role="status">Loading campaigns…</p>;
  if (campaigns.length === 0) {
    return (
      <section className={`${styles.card} ${styles.blank}`}>
        <h2 className={styles.cardTitle}>Nothing sent yet</h2>
        <p className={styles.desc}>Campaigns you send show up here with who received them and who opened them.</p>
        <div><Button onClick={onCompose}>Send your first email</Button></div>
      </section>
    );
  }

  return (
    <>
      {campaigns.some(c => c.unknown > 0) && <p className={styles.notice} role="status">Some send outcomes are unknown. Check your connected mailbox’s Sent folder before resending those messages.</p>}
      {campaigns.map(c => {
        const reached = c.delivered || c.sent;
        const isOpen = open === c.id;
        return (
          <section key={c.id} className={styles.card} aria-label={c.name}>
            <div className={styles.sectionHead}>
              <div>
                <h2 className={styles.cardTitle}>{c.name}</h2>
                <p className={styles.desc}>{new Date(c.created_at).toLocaleDateString('en-AU', { dateStyle: 'medium' })} · “{c.subject}”</p>
              </div>
              {statusPill(c)}
            </div>
            <div className={styles.miniStats}>
              <Stat value={c.recipient_count} label="Recipients" />
              <Stat value={reached} label={c.delivered ? 'Delivered' : 'Sent'} />
              <Stat value={c.opened} label={reached && c.opened ? `Opened · ${Math.round((c.opened / reached) * 100)}%` : 'Opened'} />
              <Stat value={c.clicked} label="Clicked" />
              {c.failed + c.unknown > 0 && <Stat value={c.failed + c.unknown} label="Not delivered" tone="bad" />}
            </div>
            <div className={styles.actions}>
              <Button size="sm" variant="secondary" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? '' : c.id)}>{isOpen ? 'Hide recipients' : 'See recipients'}</Button>
              <Button size="sm" variant="ghost" onClick={() => setPreview(c)}>View email</Button>
            </div>
            {isOpen && <Recipients campaign={c} onResend={onResend} />}
          </section>
        );
      })}
      {preview && <PreviewDialog subject={preview.subject} body={preview.body} onClose={() => setPreview(null)} />}
    </>
  );
}
