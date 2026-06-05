import type { Metadata, Viewport } from 'next';
import { Nabla, Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

// Same four families as can-yildiz.com, exposed as the same CSS variables so the
// copied tokens.css (--font-display/body/mono, --font-nabla) resolve identically.
const nabla = Nabla({ subsets: ['latin'], display: 'swap', variable: '--font-nabla' });
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap', variable: '--font-space-grotesk',
});
const inter = Inter({
  subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap', variable: '--font-inter',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'], weight: ['400', '500', '700'], display: 'swap', variable: '--font-jetbrains-mono',
});

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export const metadata: Metadata = {
  title: 'Content Studio',
  description: 'Local content cockpit — thumbnails, outputs, skill runs.',
  robots: { index: false, follow: false },
};

const NAV = [
  { href: '/thumbnail', label: 'Thumbnails' },
  { href: '/studios', label: 'Studios' },
  { href: '/outputs', label: 'Outputs' },
  { href: '/runner', label: 'Runner' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontVars = [nabla.variable, spaceGrotesk.variable, inter.variable, jetbrainsMono.variable].join(' ');
  return (
    <html lang="en" className={fontVars}>
      <body>
        <div className="app">
          <aside className="app__nav">
            <Link href="/" className="app__brand">
              <span className="app__brand-star" aria-hidden="true" />
              Content<span className="app__brand-thin">Studio</span>
            </Link>
            <nav className="app__links">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href}>{n.label}</Link>
              ))}
            </nav>
            <span className="app__foot">local · 127.0.0.1</span>
          </aside>
          <main className="app__main">{children}</main>
        </div>
      </body>
    </html>
  );
}
