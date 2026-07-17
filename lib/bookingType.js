// Central mapping from booking source → booking type.
// All UI that shows "Studio" vs "Personal" must derive type through here.
export const SOURCE_TO_TYPE = {
  studio:   'studio',
  app:      'personal',
  personal: 'personal',
  import:   'personal',
};

export const TYPE_STYLE = {
  studio:   { bg: 'rgba(245,158,58,0.12)',  border: '#f59e3a', tag: 'Studio',   tagColor: '#f59e3a', dot: '#f59e3a' },
  personal: { bg: 'rgba(167,139,250,0.12)', border: '#a78bfa', tag: 'Personal', tagColor: '#a78bfa', dot: '#a78bfa' },
};

export function getBookingType(source) {
  return SOURCE_TO_TYPE[source] ?? 'personal';
}

export function getBookingStyle(source) {
  return TYPE_STYLE[getBookingType(source)];
}
