import type { Metadata } from 'next';
import { Header, Footer } from '@/components/chrome';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'Dyrpris – finn oversikt over veterinærpriser', template: '%s | Dyrpris' },
  description:
    'Sammenlign publiserte veterinærpriser i Modum, Ringerike, Øvre Eiker, Nedre Eiker og Drammen. Se hva som er inkludert og når prisen ble kontrollert.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb">
      <body>
        <a href="#main" className="skip-link">
          Hopp til innhold
        </a>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
