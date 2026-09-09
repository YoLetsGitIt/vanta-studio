import { notFound } from 'next/navigation';
import DesignSystemPreview from './preview';

// A local development catalogue, never included as a usable production route.
export default function DesignSystemPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <DesignSystemPreview />;
}
