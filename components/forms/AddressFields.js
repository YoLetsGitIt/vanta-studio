'use client';

// A standard address form: street, apartment or unit, suburb, state, postcode and
// country. Used on the booking and walk-in forms and on the client's page; it's saved
// as these parts (with a one-line version beside them). Australian states are a list.
import { useId } from 'react';

export const EMPTY_ADDRESS = { line1: '', line2: '', suburb: '', state: '', postcode: '', country: 'Australia' };
const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

export const addressFrom = parts => ({ ...EMPTY_ADDRESS, ...(parts ?? {}) });
const filled = a => ['line1', 'line2', 'suburb', 'state', 'postcode'].some(k => String(a?.[k] ?? '').trim());
// Nothing entered (the country alone doesn't count).
export const addressEmpty = a => !filled(a);
// What's missing from a started (or required) address, as a sentence, or ''.
export function addressProblem(a, required = false) {
  if (!required && addressEmpty(a)) return '';
  const missing = [['line1', 'street address'], ['suburb', 'suburb'], ['postcode', 'postcode']].filter(([k]) => !String(a?.[k] ?? '').trim()).map(([, name]) => name);
  return missing.length ? `Add the ${missing.join(', ').replace(/, ([^,]*)$/, ' and $1')}.` : '';
}
// The parts as sent to the server: trimmed, and {} when nothing was entered.
export const addressPayload = a => addressEmpty(a) ? {} : Object.fromEntries(Object.entries(addressFrom(a)).map(([k, v]) => [k, String(v).trim()]));

// The address as lines, the way it's written on an envelope.
export function addressLines(parts) {
  const a = addressFrom(parts);
  const t = v => String(v ?? '').trim();
  return [
    [t(a.line2), t(a.line1)].filter(Boolean).join(', '),
    [t(a.suburb), t(a.state), t(a.postcode)].filter(Boolean).join(' '),
    t(a.country),
  ].filter(Boolean);
}
// One line, as the server saves beside the parts: "Unit 2, 8 Lygon St, Carlton VIC 3053, Australia".
export const formatAddress = parts => (addressEmpty(parts) ? '' : addressLines(parts).join(', '));

// classes: { field, label } to match a page that styles fields with CSS classes.
export default function AddressFields({ value, onChange, required = false, inputStyle, labelStyle, fieldStyle, classes = {}, legend = 'Address', legendExtra = null, autoComplete = true }) {
  const id = useId();
  const a = addressFrom(value);
  const set = key => event => onChange({ ...a, [key]: event.target.value });
  const ac = token => (autoComplete ? token : 'off');
  const field = fieldStyle ?? (classes.field ? undefined : { display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 0 });
  const label = labelStyle ?? (classes.label ? undefined : { fontSize: '0.85rem', fontWeight: 600 });
  const australia = a.country.trim().toLowerCase() === 'australia';
  const star = required ? <span aria-hidden="true"> *</span> : null;
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      <legend className={classes.label} style={{ ...label, padding: 0, marginBottom: '0.35rem' }}>{legend}{legendExtra}</legend>
      <label className={classes.field} style={field} htmlFor={`${id}-line1`}><span className={classes.label} style={label}>Street address{star}</span>
        <input id={`${id}-line1`} style={inputStyle} value={a.line1} onChange={set('line1')} required={required} maxLength={120} autoComplete={ac('address-line1')} placeholder="8 Lygon St" /></label>
      <label className={classes.field} style={field} htmlFor={`${id}-line2`}><span className={classes.label} style={label}>Apartment, unit or suite <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span></span>
        <input id={`${id}-line2`} style={inputStyle} value={a.line2} onChange={set('line2')} maxLength={120} autoComplete={ac('address-line2')} placeholder="Unit 2" /></label>
      <label className={classes.field} style={field} htmlFor={`${id}-suburb`}><span className={classes.label} style={label}>Suburb or city{star}</span>
        <input id={`${id}-suburb`} style={inputStyle} value={a.suburb} onChange={set('suburb')} required={required} maxLength={80} autoComplete={ac('address-level2')} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '0.65rem' }}>
        <label className={classes.field} style={field} htmlFor={`${id}-state`}><span className={classes.label} style={label}>State</span>
          {australia ? (
            <select id={`${id}-state`} style={inputStyle} value={a.state} onChange={set('state')} autoComplete={ac('address-level1')}>
              <option value="">Choose…</option>
              {AU_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <input id={`${id}-state`} style={inputStyle} value={a.state} onChange={set('state')} maxLength={60} autoComplete={ac('address-level1')} />
          )}</label>
        <label className={classes.field} style={field} htmlFor={`${id}-postcode`}><span className={classes.label} style={label}>Postcode{star}</span>
          <input id={`${id}-postcode`} style={inputStyle} value={a.postcode} onChange={set('postcode')} required={required} maxLength={20} inputMode={australia ? 'numeric' : 'text'} autoComplete={ac('postal-code')} /></label>
      </div>
      <label className={classes.field} style={field} htmlFor={`${id}-country`}><span className={classes.label} style={label}>Country</span>
        <input id={`${id}-country`} style={inputStyle} value={a.country} onChange={set('country')} maxLength={60} autoComplete={ac('country-name')} /></label>
    </fieldset>
  );
}
