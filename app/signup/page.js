import StudioAuth from '@/components/StudioAuth';

export const metadata = { title: 'Start your free trial — Vanta Studio' };

export default function SignUpPage() {
  return <StudioAuth initialTab="signup" />;
}
