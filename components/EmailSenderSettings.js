'use client';

import { useEffect, useState } from 'react';
import { getMarketing } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import Button from '@/components/ui/Button';
import SenderSettings from '@/components/marketing/SenderSettings';
import styles from '@/components/marketing/marketing.module.css';

// The studio's one email sender: every email it sends clients (booking emails,
// reminders, consent links) and its marketing go out from here.
export default function EmailSenderSettings() {
  const { t: mt } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    try { setData(await getMarketing()); setError(''); }
    catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, []);

  return (
    <div className={styles.panel} aria-labelledby="email-sender-title">
      <div>
        <h2 className={styles.cardTitle} id="email-sender-title">{mt("Email sender")}</h2>
        <p className={styles.desc}>{mt("Every email your studio sends clients comes from here: booking confirmations, offered times, reminders, consent links and marketing.")}</p>
      </div>
      {data?.sender_error && (
        <p className={styles.notice} role="alert">
          {mt("{error} Recent emails went out from Vanta’s address instead, with replies still coming to you. Reconnect or choose another way to send.", { error: data.sender_error })}
        </p>
      )}
      {error && (
        <div role="alert" className={styles.card}>
          <p className={styles.error}>{error}</p>
          <div className={styles.actions}><Button size="sm" variant="secondary" onClick={load}>{mt("Try again")}</Button></div>
        </div>
      )}
      {!data && !error && <p role="status" className={styles.hint}>{mt("Loading your email sender…")}</p>}
      {data && (
        <SenderSettings
          settings={data.settings}
          available={data.available}
          domainAvailable={data.domain_available ?? data.available}
          onSaved={load}
          onReload={load}
        />
      )}
    </div>
  );
}
