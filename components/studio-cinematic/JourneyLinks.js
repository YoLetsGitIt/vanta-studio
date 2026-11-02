'use client';
import { createContext, useContext } from 'react';
const defaults = { home: '/', studio: '/', artists: '/', signup: '/signup', signin: '/signin', pricing: '/features#pricing', terms: 'https://vanta.tattoo/terms' };
const Context = createContext(defaults);
export function JourneyLinksProvider({ value, children }) {
  return <Context.Provider value={value || defaults}>{children}</Context.Provider>;
}
export const useJourneyLinks = () => useContext(Context);
