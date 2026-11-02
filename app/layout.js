import './globals.css';
import './mobile.css';
import { getThemeInitScript } from '@/lib/theme';
import { Space_Grotesk } from 'next/font/google';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
});

export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', interactiveWidget: 'resizes-content' };

export const metadata = {
  title: 'Vanta Studio',
  description: 'Studio management platform for Vanta artists.',
  icons: { icon: '/favicon.ico', apple: '/app/apple-touch-icon.png' },
  // Installable from the browser (Add to Home Screen). On iPhone this is required
  // for new-booking notifications.
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Vanta Studio', statusBarStyle: 'black' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={spaceGrotesk.variable}>
        <script dangerouslySetInnerHTML={{ __html: getThemeInitScript() }} />
        {children}
      </body>
    </html>
  );
}
