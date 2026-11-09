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

// One consent form as clients see it at the end of a booking or walk-in form.
function ConsentBlock({ template, inp, lbl, fld, showName = true }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {showName && <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>{template.name}</span>}
      {(template.fields ?? []).map((f, i) => {
        if (f.type === 'heading') return <p key={i} style={{ fontSize: '0.82rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)', margin: 0 }}>{f.label}</p>;
        if (f.type === 'paragraph') return <p key={i} style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.5 }}>{f.label}</p>;
        if (f.type === 'checkbox') return (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <div style={{ width: 13, height: 13, borderRadius: 3, border: '1px solid rgba(255,255,255,0.2)', marginTop: 2, flexShrink: 0 }} />
            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>{f.label}</span>
          </div>
        );
        if (f.type === 'photo_id') return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>{f.label || 'Photo ID'}</span>
            <div style={{ padding: '0.5rem', borderRadius: 7, border: '1px dashed rgba(255,255,255,0.25)', fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>Take or choose a photo of your ID</div>
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
  );
}

export function WidgetPreview({ bg, accent, studioName, logoUrl, fields, consentTemplate }) {
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
          {logoUrl && <img src={logoUrl} alt="" style={{ maxHeight: 44, maxWidth: 160, objectFit: 'contain', alignSelf: 'flex-start', marginBottom: 6 }} />}
          <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>Studio booking</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>{studioName}</span>
        </div>

        {/* First + Last — always shown */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
          <div style={fld}><span style={lbl}>First name *</span><div style={inp} /></div>
          <div style={fld}><span style={lbl}>Last name *</span><div style={inp} /></div>
        </div>

        {/* DOB — always shown, always required; day / month / year dropdowns */}
        <div style={fld}>
          <span style={lbl}>Date of birth *</span>
          <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.1fr 1fr', gap: 6 }}>
            {['Day', 'Month', 'Year'].map(p => <div key={p} style={{ ...inp, display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>{p}</div>)}
          </div>
        </div>

        {/* Email + Phone — always shown */}
        <div style={fld}><span style={lbl}>Email *</span><div style={inp} /></div>
        <div style={fld}>
          <span style={lbl}>Phone *</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ ...inp, width: 72, flexShrink: 0 }} />
            <div style={{ ...inp, flex: 1 }} />
          </div>
        </div>

        {/* Address — only when the studio asks for it */}
        {fields?.address?.enabled && (
          <AddressPreview fld={fld} lbl={lbl} inp={inp} required={fields.address.required} />
        )}

        {f('artist_id').enabled && (
          <div style={fld}><span style={lbl}>Artist preference</span><div style={inp} /></div>
        )}

        <div style={fld}><span style={lbl}>Appointment type *</span><div style={{ ...inp, display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: '0.75rem', color: '#fff' }}>Tattoo / Piercing</div></div>

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
            {['Black & grey', 'Colour'].map((opt, i) => (
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

        {fields?.availability_windows?.enabled && (
          <div style={fld}>
            <span style={lbl}>Earliest date you can come in (optional)</span>
            <div style={{ ...inp, marginBottom: '0.5rem' }} />
            <span style={lbl}>Your availability{fields.availability_windows.required ? ' *' : ' (optional)'}</span>
            <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)' }}>Press and drag down a day to mark the times that work.</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
                <div key={d} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 600, textAlign: 'center', color: 'rgba(255,255,255,0.45)' }}>{d}</span>
                  <div style={{ position: 'relative', height: 64, borderRadius: 3, background: 'rgba(255,255,255,0.06)' }}>
                    {(i === 1 || i === 5) && <div style={{ position: 'absolute', left: 2, right: 2, top: i === 1 ? 10 : 6, height: i === 1 ? 30 : 20, borderRadius: 3, background: 'rgba(255,255,255,0.85)' }} />}
                  </div>
                </div>
              ))}
            </div>
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
        {consentTemplate && <ConsentBlock template={consentTemplate} inp={inp} lbl={lbl} fld={fld} />}
      </div>
    </div>
  );
}



// The walk-in form as clients see it: the details every walk-in gives, the extra
// fields the studio turned on, then all of the studio's consent forms. Small
// captions mark each group so studios can see what comes from where.
export function WalkInPreview({ bg, accent, studioName, logoUrl, fields, consentTemplates }) {
  const light = isLightColor(accent);
  const inp = { height: 38, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 };
  const lbl = { fontSize: '0.65rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 4, display: 'block' };
  const fld = { display: 'flex', flexDirection: 'column' };
  const on = key => fields?.[key]?.enabled;
  const req = key => (fields?.[key]?.required ? ' *' : '');
  const group = text => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
      <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: hexToRgbaStr(accent, 0.85), whiteSpace: 'nowrap' }}>{text}</span>
      <span style={{ flex: 1, borderTop: `1px dashed ${hexToRgbaStr(accent, 0.35)}` }} />
    </div>
  );
  const extras = ['body_location', 'design_details', 'skin_tone', 'notes', 'allergies', 'address'].filter(on);
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-faint)', borderRadius: 12, padding: '1.25rem' }}>
      <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 0.85rem' }}>Example walk-in form</p>
      <div style={{ background: bg, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: '0.9rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {logoUrl && <img src={logoUrl} alt="" style={{ maxHeight: 44, maxWidth: 160, objectFit: 'contain', alignSelf: 'flex-start', marginBottom: 6 }} />}
          <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>Walk-in</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>{studioName}</span>
        </div>

        {group('Always asked')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
          <div style={fld}><span style={lbl}>First name *</span><div style={inp} /></div>
          <div style={fld}><span style={lbl}>Last name *</span><div style={inp} /></div>
        </div>
        <div style={fld}>
          <span style={lbl}>Date of birth *</span>
          <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.1fr 1fr', gap: 6 }}>
            {['Day', 'Month', 'Year'].map(p => <div key={p} style={{ ...inp, display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>{p}</div>)}
          </div>
        </div>
        <div style={fld}><span style={lbl}>Email *</span><div style={inp} /></div>
        <div style={fld}>
          <span style={lbl}>Phone *</span>
          <div style={{ display: 'flex', gap: 6 }}><div style={{ ...inp, width: 72, flexShrink: 0 }} /><div style={{ ...inp, flex: 1 }} /></div>
        </div>
        <div style={fld}>
          <span style={lbl}>Artist *</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {['Artist one', 'Artist two'].map((name, i) => (
              <div key={name} style={{ ...inp, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', border: `1px solid ${i === 0 ? accent : 'rgba(255,255,255,0.1)'}`, background: i === 0 ? hexToRgbaStr(accent, 0.12) : 'rgba(255,255,255,0.05)' }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#fff' }}>{name}</span>
              </div>
            ))}
          </div>
        </div>

        {group('Your extra fields')}
        {extras.length === 0 && <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>None turned on. Switch fields on to ask for more.</p>}
        {on('body_location') && (
          <div style={fld}>
            <span style={lbl}>Placement{req('body_location')}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {ALL_PLACEMENTS.slice(0, 8).map((p, i) => (
                <span key={p} style={{ padding: '0.25rem 0.6rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 500, background: i === 0 ? hexToRgbaStr(accent, 0.12) : 'rgba(255,255,255,0.05)', border: `1px solid ${i === 0 ? accent : 'rgba(255,255,255,0.1)'}`, color: i === 0 ? accent : 'rgba(255,255,255,0.5)' }}>{p}</span>
              ))}
              <span style={{ padding: '0.25rem 0.4rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)' }}>…</span>
            </div>
          </div>
        )}
        {on('design_details') && <div style={fld}><span style={lbl}>Design description{req('design_details')}</span><div style={{ ...inp, height: 64 }} /></div>}
        {on('skin_tone') && <div style={fld}><span style={lbl}>Skin tone{req('skin_tone')}</span><div style={inp} /></div>}
        {on('notes') && <div style={fld}><span style={lbl}>Additional notes{req('notes')}</span><div style={{ ...inp, height: 52 }} /></div>}
        {on('address') && <AddressPreview fld={fld} lbl={lbl} inp={inp} required={Boolean(req('address'))} />}
        {on('allergies') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.2rem 0' }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />
            <span style={{ ...lbl, margin: 0 }}>I have allergies or sensitivities{fields?.allergies?.required ? '' : ' (optional)'}</span>
          </div>
        )}

        {group('Consent forms')}
        {consentTemplates?.length
          ? consentTemplates.map(t => <ConsentBlock key={t.id} template={t} inp={inp} lbl={lbl} fld={fld} showName={false} />)
          : <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>No consent forms yet. Any you create in Consent forms appear here.</p>}

        <div style={{ padding: '0.75rem', background: accent, borderRadius: 9, fontSize: '0.85rem', fontWeight: 700, color: light ? '#0e0e0e' : '#ffffff', textAlign: 'center' }}>Book me in</div>
      </div>
    </div>
  );
}

// bg / accent: the consent form's own colours (Settings → Consent form); the defaults
// match the client page's standard look.
export const CONSENT_DEFAULT_BG = '#1a2026';
export const CONSENT_DEFAULT_ACCENT = '#f5ecd9';
export function ConsentFormPreview({ name, fields, requiresSig, requiresGuardian, bg = CONSENT_DEFAULT_BG, accent = CONSENT_DEFAULT_ACCENT, studioName }) {
  const accentText = isLightColor(accent) ? '#11151b' : '#ffffff';
  const inp = { height: 36, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 };
  const lbl = { fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 3, display: 'block' };
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-faint)', borderRadius: 12, padding: '1.25rem' }}>
      <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 0.85rem' }}>Preview</p>
      <div style={{ background: bg, border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', transition: 'background-color 0.2s ease' }}>
        {studioName && <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: accent }}>{studioName}</span>}
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
          if (f.type === 'photo_id') return (
            <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={lbl}>{f.label || <em>Photo ID</em>}{f.required && ' *'}</span>
              <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>A clear photo of your driver’s licence, passport or other photo ID. Only the studio can see it.</span>
              <div style={{ padding: '0.6rem', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.25)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', textAlign: 'center' }}>Take or choose a photo of your ID</div>
            </div>
          );
          if (f.type === 'yesno') return (
            <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={lbl}>{f.label || <em>Question</em>}{f.required && ' *'}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {['Yes', 'No'].map(opt => (
                  <div key={opt} style={{ padding: '0.3rem 0.9rem', borderRadius: 6, background: opt === 'Yes' ? hexAlpha(accent, 0.14) : 'rgba(255,255,255,0.04)', border: `1px solid ${opt === 'Yes' ? hexAlpha(accent, 0.45) : 'rgba(255,255,255,0.1)'}`, fontSize: '0.75rem', color: opt === 'Yes' ? accent : 'rgba(255,255,255,0.4)' }}>{opt}</div>
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

        <div style={{ padding: '0.6rem', background: accent, borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, color: accentText, textAlign: 'center', marginTop: 4, transition: 'background-color 0.2s ease, color 0.2s ease' }}>
          Submit
        </div>
      </div>
    </div>
  );
}


// #rrggbb at the given opacity.
function hexAlpha(hex, alpha) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return `rgba(245,236,217,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// The address as the client fills it in: street, unit, suburb, state + postcode, country.
function AddressPreview({ fld, lbl, inp, required }) {
  const star = required ? ' *' : '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={fld}><span style={lbl}>Street address{star}</span><div style={inp} /></div>
      <div style={fld}><span style={lbl}>Apartment, unit or suite</span><div style={inp} /></div>
      <div style={fld}><span style={lbl}>Suburb or city{star}</span><div style={inp} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div style={fld}><span style={lbl}>State</span><div style={inp} /></div>
        <div style={fld}><span style={lbl}>Postcode{star}</span><div style={inp} /></div>
      </div>
      <div style={fld}><span style={lbl}>Country</span><div style={inp} /></div>
    </div>
  );
}
