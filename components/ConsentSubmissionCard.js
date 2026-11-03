'use client';

import Button from '@/components/ui/Button';
import { Pill, Fact, detailStyles as d } from '@/components/ui/DetailParts';
import { downloadConsentPdf } from '@/lib/api';
import { showError } from '@/lib/feedback';

const signatureStyle = { maxWidth: '100%', height: 64, objectFit: 'contain', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', display: 'block' };

// One signed consent form as the client completed it: answers (with the form's own
// question labels where the template still has them), photo ID, signatures and a PDF.
export default function ConsentSubmissionCard({ sub, templates = [] }) {
  const fields = templates.find(t => t.id === sub.template_id)?.fields ?? [];
  const labelFor = id => fields.find(f => f.id === id)?.label || id;
  const answers = Object.entries(sub.answers ?? {}).filter(([k, v]) => k !== '__agreed__' && v !== '' && v != null);
  const pdfName = `consent-${(sub.signer_name || 'form').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`;

  return (
    <div style={d.subCard}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>{sub.template_name || 'Consent form'}</span>
        {sub.is_minor && <Pill tone="warning">Minor</Pill>}
      </div>
      <span style={d.hint}>Signed {new Date(sub.submitted_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}{sub.signer_name ? ` by ${sub.signer_name}` : ''}</span>
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
      <div>
        <Button variant="secondary" size="sm" onClick={() => downloadConsentPdf(sub.id, pdfName).catch(showError)}>Download PDF</Button>
      </div>
    </div>
  );
}
