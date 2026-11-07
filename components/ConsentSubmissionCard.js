'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import { Pill, Fact, detailStyles as d } from '@/components/ui/DetailParts';
import { downloadConsentPdf } from '@/lib/api';
import { showError } from '@/lib/feedback';

const headStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', width: '100%', minHeight: 44, padding: 0, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: 'inherit' };
const rowStyle = { display: 'flex', alignItems: 'center', gap: '0.7rem', width: '100%', padding: '0.6rem 0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: 'inherit' };
const docIconStyle = { width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', flexShrink: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-dim)' };
const signatureStyle = { maxWidth: '100%', height: 64, objectFit: 'contain', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', display: 'block' };

// One signed consent form as the client completed it: answers (with the form's own
// question labels where the template still has them), photo ID, signatures and a PDF.
// Shows its name and signing date; opening it shows the whole form in a window of its own,
// so the side panel behind stays put.
// compact: one row per form, for the booking and client panels.
export default function ConsentSubmissionCard({ sub, templates = [], compact = false }) {
  const fields = templates.find(t => t.id === sub.template_id)?.fields ?? [];
  const labelFor = id => fields.find(f => f.id === id)?.label || id;
  const answers = Object.entries(sub.answers ?? {}).filter(([k, v]) => k !== '__agreed__' && v !== '' && v != null);
  const [open, setOpen] = useState(false);
  const signed = `Signed ${new Date(sub.submitted_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}${sub.signer_name ? ` by ${sub.signer_name}` : ''}`;
  const pdfName = `consent-${(sub.signer_name || 'form').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`;

  // compact: a row with the form's name, when and by whom it was signed, opening the form.
  const signedOn = new Date(sub.submitted_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  const trigger = compact ? (
    <button type="button" className="studio-consent-row" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`View ${sub.template_name || 'consent form'}, ${signed}`} style={rowStyle}>
      <span aria-hidden="true" style={docIconStyle}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></svg>
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', minWidth: 0, flex: 1 }}>
        <span style={{ ...d.itemTitle, display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.template_name || 'Consent form'}</span>
          {sub.is_minor && <Pill tone="warning">Minor</Pill>}
        </span>
        <span style={{ ...d.hint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Signed {signedOn}{sub.signer_name ? ` · ${sub.signer_name}` : ''}
        </span>
      </span>
      <span aria-hidden="true" className="studio-row-chevron" style={{ color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: 1, flexShrink: 0 }}>›</span>
    </button>
  ) : null;

  return (
    <div style={compact ? undefined : d.subCard}>
      {trigger}
      {!compact && <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" style={headStyle}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>{sub.template_name || 'Consent form'}</span>
            {sub.is_minor && <Pill tone="warning">Minor</Pill>}
          </span>
          <span style={d.hint}>{signed}</span>
        </span>
        <span style={{ color: 'var(--color-info)', fontSize: '0.85rem', fontWeight: 600, flexShrink: 0 }}>View</span>
      </button>}
      {open && (
      <Dialog
        title={sub.template_name || 'Consent form'}
        description={signed}
        onClose={() => setOpen(false)}
        maxWidth={640}
        footer={<>
          <Button variant="secondary" onClick={() => downloadConsentPdf(sub.id, pdfName).catch(showError)}>Download PDF</Button>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </>}
      >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {sub.is_minor && <div><Pill tone="warning">Minor</Pill></div>}
      {answers.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {answers.map(([k, v]) => sub.photo_id_urls?.[k] ? (
            <div key={k}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.3rem' }}>{labelFor(k)}</p>
              <a href={sub.photo_id_urls[k]} target="_blank" rel="noopener noreferrer" title="Open full size">
                <img src={sub.photo_id_urls[k]} alt="Client photo ID" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
              </a>
            </div>
          ) : (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{labelFor(k)}</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text)', lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                {String(v).startsWith('ids/') ? 'Photo ID provided' : v === true || v === 'true' ? 'Yes' : String(v)}
              </span>
            </div>
          ))}
        </div>
      )}
      {sub.client_signature_url && (
        <div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.3rem' }}>Client signature</p>
          <img src={sub.client_signature_url} alt="Client signature" style={signatureStyle} />
        </div>
      )}
      {sub.guardian_name && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <span style={d.subLabel}>Guardian</span>
          <Fact label={sub.guardian_relationship ?? 'Guardian'}>{sub.guardian_name}</Fact>
          {sub.guardian_email && <span style={d.hint}>{sub.guardian_email}</span>}
          {sub.guardian_phone && <span style={d.hint}>{sub.guardian_phone}</span>}
          {sub.guardian_signature_url && <img src={sub.guardian_signature_url} alt="Guardian signature" style={signatureStyle} />}
        </div>
      )}
      {answers.length === 0 && !sub.client_signature_url && <p style={d.hint}>No answers were saved with this form.</p>}
      </div>
      </Dialog>
      )}
    </div>
  );
}
