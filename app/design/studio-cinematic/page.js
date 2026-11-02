import CinematicJourney from '@/components/studio-cinematic/CinematicJourney';

export const metadata = {
  title: 'A studio visit — Vanta cinematic preview',
  robots: { index: false, follow: false },
};

export default function CinematicPreview() {
  return <CinematicJourney />;
}
