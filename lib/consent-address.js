// A consent form asks for the client's address with an "address" field, placed and
// marked required like its other questions. Studio consent forms are only shown on the
// web (Studio and vanta.tattoo), never in the apps, so the field type is safe here.
//
// Forms saved before the field existed have a setting instead (ask_address: "optional"
// or "required"). They're shown with an address field at the end, under the id the
// server already keeps that address under ('__address__'), so saving the form turns the
// setting into the field and older signed forms still label it.
import { addressEmpty, addressPayload, formatAddress } from '@/components/forms/AddressFields';

export const ADDRESS_FIELD_TYPE = 'address';
export const LEGACY_ADDRESS_ID = '__address__';
const PARTS_KEY = '__address_parts__';

export const addressFieldOf = template => (template?.fields ?? []).find(f => f.type === ADDRESS_FIELD_TYPE) ?? null;

// The form's fields, with the older setting shown as an address field at the end.
export function consentFieldsOf(template) {
  const fields = template?.fields ?? [];
  if (!template?.ask_address || fields.some(f => f.type === ADDRESS_FIELD_TYPE)) return fields;
  return [...fields, { id: LEGACY_ADDRESS_ID, type: ADDRESS_FIELD_TYPE, label: 'Address', required: template.ask_address === 'required' }];
}

// The template as the client's form shows it.
export const withAddressField = template => (template ? { ...template, fields: consentFieldsOf(template) } : template);

// The answers for an address: the one line under the field (what the client sees on
// the signed form) and the parts beside it. Nothing when nothing was entered.
export function addressAnswers(field, address) {
  if (!field || addressEmpty(address)) return {};
  return { [field.id]: formatAddress(address), [PARTS_KEY]: JSON.stringify(addressPayload(address)) };
}
