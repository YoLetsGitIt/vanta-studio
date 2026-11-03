'use client';

import { useLanguage } from '@/lib/i18n';

import Link from 'next/link';
import Button from '@/components/ui/Button';
import { senderSummary } from './SenderSettings';
import styles from './marketing.module.css';

// The sender lives in Settings → Client messages, shared with booking emails.
const SENDER_SETTINGS = '/dashboard/settings?tab=messages#email-sender';

export default function MarketingSettings({ data, onReload, onTemplates, onHistory }) {
  const { t: mt } = useLanguage();
  const { stats, settings, available, ready } = data;
  const steps = [
    { done: ready, title: mt("Set up your sending email"), hint: mt("So client replies reach you."), action: <Link href={SENDER_SETTINGS} className="studio-button studio-button--primary studio-button--sm">{mt("Add it")}</Link> },
    { done: stats.consented_clients > 0, title: mt("Choose who can be emailed"), hint: mt("Tick “agreed to marketing emails” on a client."), action: <Link href="/dashboard/clients" className="studio-button studio-button--secondary studio-button--sm">{mt("Go to clients")}</Link> },
    { done: stats.sent_this_month > 0, title: mt("Create a template and send an email"), action: <Button size="sm" variant="secondary" onClick={onTemplates}>{mt("Create a template")}</Button> },
  ];

  return (
    <>
      <div>
        <h2 className={styles.cardTitle}>{mt("Marketing settings")}</h2>
        <p className={styles.desc}>{mt("Your sending overview and setup.")}</p>
      </div>

      <section className={styles.card} aria-labelledby="marketing-overview-title">
        <h3 className={styles.cardTitle} id="marketing-overview-title">{mt("Sending overview")}</h3>
        <ul className={styles.stats} aria-label={mt("Marketing summary")}>
          <li><strong>{stats.consented_clients}</strong> {mt("can be emailed")}</li>
          <li><strong>{stats.sent_this_month}</strong> {mt("sent this month")}</li>
          <li><strong>{stats.unsubscribed}</strong> {mt("unsubscribed")}</li>
          {stats.failed_this_month > 0 && <li><button type="button" className={styles.statBad} onClick={onHistory}><strong>{stats.failed_this_month}</strong> {mt("failed this month")}</button></li>}
        </ul>
        {!available && <p className={styles.notice} role="status">{mt("Sending is off for now. You can create templates and finish setup here.")}</p>}
      </section>

      {steps.some(step => !step.done) && (
        <section className={styles.setup} aria-labelledby="marketing-setup-title">
          <h3 className={styles.setupTitle} id="marketing-setup-title">{mt("Setup checklist")}</h3>
          <ol className={styles.steps}>
            {steps.map((step, i) => (
              <li key={step.title} className={`${styles.step} ${step.done ? styles.stepDone : ''}`}>
                <span className={styles.stepMark} aria-hidden="true">{step.done ? '✓' : i + 1}</span>
                <span className={styles.stepText}>{step.title}
                  {!step.done && step.hint && <span className={styles.stepHint}>{step.hint}</span>}
                  {step.done && <span className="sr-only"> {mt("(done)")}</span>}
                </span>
                {!step.done && step.action}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section id="marketing-sender-settings" className={styles.card} aria-labelledby="marketing-sender-title">
        <div className={styles.sectionHead}>
          <h3 className={styles.cardTitle} id="marketing-sender-title">{mt("Sending email")}</h3>
          <Link href={SENDER_SETTINGS} className="studio-button studio-button--secondary studio-button--sm">{mt("Change in Settings")}</Link>
        </div>
        <p className={styles.desc}>
          {senderSummary(settings, mt)
            ? <>{mt("Emails send from")} <strong>{senderSummary(settings, mt)}</strong>. {mt("Your booking emails and reminders use the same sender.")}</>
            : mt("Not set up yet. Your studio has one sender for marketing and booking emails, set in Settings → Client messages.")}
        </p>
        {data.sender_error && <p className={styles.notice} role="alert">{data.sender_error}</p>}
      </section>
    </>
  );
}
