'use client';
import { useEffect } from 'react';
const marketing = (process.env.NEXT_PUBLIC_MARKETING_URL || 'https://vanta.tattoo').replace(/\/$/, '');
export default function FeaturesPage() {
  useEffect(() => {
    const path = window.location.hash === '#pricing' ? '/pricing' : '/studio';
    window.location.replace(marketing + path + window.location.search);
  }, []);
  return <main><h1>Explore Vanta Studio</h1><a href={`${marketing}/studio`}>Visit the studio</a><p><a href={`${marketing}/pricing`}>Pricing &amp; terms</a></p></main>;
}
