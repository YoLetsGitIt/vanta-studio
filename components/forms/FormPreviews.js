// Shared by the live Studio settings and the guided product walkthrough.

function isLightColor(hex) {
  if (!hex || hex[0] !== '#') return false;
  const h = hex.slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
}

const ALL_PLACEMENTS = [
  'Ankle','Arm','Back','Calf','Chest','Foot','Forearm',
  'Hand','Head','Hip','Knee','Neck','Ribs','Shoulder',
  'Stomach','Thigh','Wrist','Other',
];

function hexToRgbaStr(hex, alpha) {
  if (!hex || hex[0] !== '#') return `rgba(213,208,199,${alpha})`;
  const h = hex.slice(1).length === 3
    ? hex.slice(1).split('').map(c => c+c).join('')
    : hex.slice(1);
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function WidgetPreview({ bg, accent, studioName, fields, consentTemplate }) {
  const light = isLightColor(accent);
  const inp = { height: 38, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 };
  const lbl = { fontSize: '0.65rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 4, display: 'block' };
  const fld = { display: 'flex', flexDirection: 'column' };
  // fields may be null while loading — default all enabled for preview
  const f = (key) => fields?.[key] ?? { enabled: true, required: false };
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-faint)', borderRadius: 12, padding: '1.25rem' }}>
      <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 0.85rem' }}>Preview</p>
      <div style={{ background: bg, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>Studio booking</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>{studioName}</span>
        </div>

        {/* First + Last — always shown */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
          <div style={fld}><span style={lbl}>First name *</span><div style={inp} /></div>
          <div style={fld}><span style={lbl}>Last name *</span><div style={inp} /></div>
        </div>

        {/* DOB — always shown, always required */}
        <div style={fld}><span style={lbl}>Date of birth *</span><div style={inp} /></div>

        {/* Email + Phone — always shown */}
        <div style={fld}><span style={lbl}>Email *</span><div style={inp} /></div>
        <div style={fld}>
          <span style={lbl}>Phone *</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ ...inp, width: 72, flexShrink: 0 }} />
            <div style={{ ...inp, flex: 1 }} />
          </div>
        </div>

        {f('artist_id').enabled && (
          <div style={fld}><span style={lbl}>Artist preference</span><div style={inp} /></div>
        )}

        {/* Placement chips */}
        {f('body_location').enabled && (
          <div style={fld}>
            <span style={lbl}>Placement{f('body_location').required ? ' *' : ''}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {ALL_PLACEMENTS.map((p, i) => (
                <span key={p} style={{
                  padding: '0.25rem 0.6rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 500,
                  background: i === 0 ? hexToRgbaStr(accent, 0.12) : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${i === 0 ? accent : 'rgba(255,255,255,0.1)'}`,
                  color: i === 0 ? accent : 'rgba(255,255,255,0.5)',
                }}>{p}</span>
              ))}
            </div>
          </div>
        )}

        {f('design_details').enabled && (
          <div style={fld}><span style={lbl}>Design description{f('design_details').required ? ' *' : ''}</span><div style={{ ...inp, height: 72 }} /></div>
        )}

        {f('skin_tone').enabled && (
          <div style={fld}><span style={lbl}>Skin tone{f('skin_tone').required ? ' *' : ''}</span><div style={inp} /></div>
        )}

        {f('size').enabled && (
          <div style={fld}>
            <span style={lbl}>Size{f('size').required ? ' *' : ''}</span>
            <div style={{ display: 'flex', gap: 5 }}>
              <div style={{ ...inp, flex: 1 }} />
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                {['cm', 'in'].map(u => (
                  <div key={u} style={{ padding: '0 0.6rem', display: 'flex', alignItems: 'center', fontSize: '0.7rem', fontWeight: 600, color: u === 'cm' ? '#fff' : 'rgba(255,255,255,0.35)', background: u === 'cm' ? 'rgba(255,255,255,0.13)' : 'transparent' }}>{u}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {f('retouch').enabled && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.3rem 0' }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />
            <span style={{ ...lbl, margin: 0 }}>This is a touch-up / retouch</span>
          </div>
        )}

        {/* Colour — always shown, hardcoded in actual form */}
        <div style={fld}>
          <span style={lbl}>Colour</span>
          <div style={{ display: 'flex', gap: 5 }}>
            {['Black', 'Grey', 'Color'].map((opt, i) => (
              <div key={opt} style={{ flex: 1, padding: '0.35rem 0', borderRadius: 7, fontSize: '0.72rem', fontWeight: i === 0 ? 600 : 500, textAlign: 'center', border: `1px solid ${i === 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)'}`, background: i === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)', color: i === 0 ? '#fff' : 'rgba(255,255,255,0.45)' }}>{opt}</div>
            ))}
          </div>
        </div>

        {f('notes').enabled && (
          <div style={fld}><span style={lbl}>Additional notes</span><div style={{ ...inp, height: 52 }} /></div>
        )}

        {f('allergies').enabled && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.3rem 0' }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />
            <span style={{ ...lbl, margin: 0 }}>I have allergies or sensitivities{f('allergies').required ? '' : ' (optional)'}</span>
          </div>
        )}

        {/* Photo upload */}
        {f('image_paths').enabled && (
          <div style={fld}>
            <span style={lbl}>Reference photos{f('image_paths').required ? ' *' : ' (optional, up to 5)'}</span>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '0.5rem 0.85rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', alignSelf: 'flex-start' }}>
              + Add photos
            </div>
          </div>
        )}

        {/* Button */}
        <div style={{ padding: '0.75rem', background: accent, borderRadius: 9, fontSize: '0.85rem', fontWeight: 700, color: light ? '#0e0e0e' : '#ffffff', textAlign: 'center' }}>
          Request booking
        </div>

        {/* Consent form */}
        {consentTemplate && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>{consentTemplate.name}</span>
            {(consentTemplate.fields ?? []).map((f, i) => {
              if (f.type === 'heading') return <p key={i} style={{ fontSize: '0.82rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)', margin: 0 }}>{f.label}</p>;
              if (f.type === 'paragraph') return <p key={i} style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.5 }}>{f.label}</p>;
              if (f.type === 'checkbox') return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <div style={{ width: 13, height: 13, borderRadius: 3, border: '1px solid rgba(255,255,255,0.2)', marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>{f.label}</span>
                </div>
              );
              if (f.type === 'yesno') return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>{f.label}</span>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {['Yes', 'No'].map(o => <div key={o} style={{ padding: '0.3rem 0.9rem', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>{o}</div>)}
                  </div>
                </div>
              );
              return <div key={i} style={{ ...fld }}><span style={lbl}>{f.label}</span><div style={{ ...inp, height: 52 }} /></div>;
            })}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <div style={{ width: 13, height: 13, borderRadius: 3, border: '1px solid rgba(255,255,255,0.2)', marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>I have read and agreed to the above *</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


export function ConsentFormPreview({ name, fields, requiresSig, requiresGuardian }) {
  const inp = { height: 36, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 };
  const lbl = { fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 3, display: 'block' };
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-faint)', borderRadius: 12, padding: '1.25rem' }}>
      <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 0.85rem' }}>Preview</p>
      <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {name ? (
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', margin: 0 }}>{name}</h3>
        ) : (
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'rgba(255,255,255,0.2)', margin: 0, fontStyle: 'italic' }}>Form name</h3>
        )}

        {fields.length === 0 && (
          <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)', margin: 0, fontStyle: 'italic' }}>Add fields to preview the form…</p>
        )}

        {fields.map(f => {
          if (f.type === 'heading') return (
            <div key={f.id} style={{ paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: '0.87rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>{f.label || <em style={{ color: 'rgba(255,255,255,0.2)' }}>Section heading</em>}</span>
            </div>
          );
          if (f.type === 'paragraph') return (
            <p key={f.id} style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, margin: 0 }}>
              {f.label || <em>Paragraph text…</em>}
            </p>
          );
          if (f.type === 'checkbox') return (
            <label key={f.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <div style={{ width: 15, height: 15, borderRadius: 3, border: '1px solid rgba(255,255,255,0.2)', marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                {f.label || <em style={{ color: 'rgba(255,255,255,0.2)' }}>Checkbox label</em>}
                {f.required && <span style={{ color: '#e86f6f', marginLeft: 3 }}>*</span>}
              </span>
            </label>
          );
          if (f.type === 'yesno') return (
            <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={lbl}>{f.label || <em>Question</em>}{f.required && ' *'}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {['Yes', 'No'].map(opt => (
                  <div key={opt} style={{ padding: '0.3rem 0.9rem', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>{opt}</div>
                ))}
              </div>
            </div>
          );
          if (f.type === 'textarea') return (
            <div key={f.id} style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={lbl}>{f.label || <em>Field</em>}{f.required && ' *'}</span>
              <div style={{ ...inp, height: 60 }} />
            </div>
          );
          return (
            <div key={f.id} style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={lbl}>{f.label || <em>Field</em>}{f.required && ' *'}</span>
              <div style={inp} />
            </div>
          );
        })}

        {/* Always-required agreement checkbox */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div style={{ width: 15, height: 15, borderRadius: 3, border: '1px solid rgba(255,255,255,0.2)', marginTop: 2, flexShrink: 0 }} />
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
            I have read and agreed to the above <span style={{ color: '#e86f6f' }}>*</span>
          </span>
        </label>

        {requiresGuardian && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: '0.67rem', fontWeight: 600, color: 'rgba(255,255,255,0.25)', display: 'block', marginBottom: 4 }}>Guardian details (minors only)</span>
            <div style={inp} />
            <div style={inp} />
          </div>
        )}

        {requiresSig && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={lbl}>Signature *</span>
            <div style={{ height: 64, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.18)' }}>Sign here</span>
            </div>
          </div>
        )}

        <div style={{ padding: '0.6rem', background: 'var(--accent-tint)', border: '1px solid var(--accent-tint-border)', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)', textAlign: 'center', marginTop: 4 }}>
          Submit
        </div>
      </div>
    </div>
  );
}

