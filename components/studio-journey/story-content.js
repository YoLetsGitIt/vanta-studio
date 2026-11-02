export const MOMENTS = [
  { label: 'Made for your studio', title: 'Your bookings.\nYour form.', text: 'Fully customisable, from colours to questions. Share your form anywhere your clients find you.' },
  { label: 'One connected appointment', title: 'From first enquiry\nto booked in.', text: 'Enquiries, estimates, availability and deposits. All connected.' },
  { label: 'The details, taken care of', title: 'Your consent.\nKept together.', text: 'Fully customisable consent forms. Send a link to sign, then keep the completed form with the client’s record.' },
];
// Browser captures of the existing app, with local sample API responses.
// Recreate with scripts/capture-journey-screens.cjs. No recreated product controls.
export const SCREENS = {
  form: { file:'booking-form', alt:'Vanta Studio’s public booking form with client details', label:'Your form, wherever clients find you.' },
  'form-personal': { file:'booking-form-details', alt:'The actual booking form’s placement, design and size fields', label:'Your questions. Your required details.' },
  enquiry: { file:'enquiry', alt:'Mia’s pending enquiry in the Studio booking details panel', label:'The enquiry arrives with the details attached.', text:'The client sends their idea, placement and reference photos straight to the artist.' },
  estimate: { file:'estimate', alt:'Studio’s Send selection link dialog showing artist, duration and quote', label:'The artist sends an estimate and selection link.', text:'The artist reviews the enquiry, estimates the price and duration, then asks the client to suggest times.' },
  availability: { file:'availability', alt:'The Studio booking details panel showing client availability awaiting confirmation', label:'Client availability, ready for the artist.', text:'The client suggests times from the artist’s availability. The artist makes the final selection.' },
  selection: { file:'selection', alt:'The selected appointment in Studio, awaiting a deposit', label:'A time selected. A deposit requested.', text:'The artist selects a time from the client’s suggestions, then requests the deposit.' },
  confirmed: { file:'confirmed', alt:'The real confirmed booking panel showing the paid deposit', label:'Deposit paid. Booking confirmed.', text:'The client pays the deposit, and the appointment is confirmed.' },
  consent: { file:'consent', alt:'Mia’s Studio client record with the Send link action for consent', label:'Send consent directly from the client record.' },
  'consent-signed': { file:'consent-signed', alt:'Mia’s client record showing consent is complete', label:'Signed consent, kept with the client.' },
};
