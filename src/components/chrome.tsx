import Link from 'next/link';
import { PawPrint, ArrowUpRight, MapPin, Heart } from 'lucide-react';
export function Header() {
  return (
    <header className="header">
      <div className="shell nav">
        <Link href="/" className="brand" aria-label="Dyrpris – forsiden">
          <span className="brand-icon">
            <PawPrint size={22} strokeWidth={2.2} />
          </span>
          dyrpris<span className="brand-dot">.</span>
        </Link>
        <span className="nav-region">
          <MapPin size={14} /> Nært deg. For dyret ditt.
        </span>
        <nav aria-label="Hovedmeny">
          <a href="/#sammenlign">Sammenlign priser</a>
          <a href="/#slik-fungerer-det">
            Slik fungerer det <ArrowUpRight size={14} />
          </a>
        </nav>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <div className="shell footer-inner">
        <div>
          <Link className="brand" href="/">
            <PawPrint size={23} />
            dyrpris.
          </Link>
          <p>Litt mer oversikt. Litt mindre usikkerhet.</p>
        </div>
        <div className="footer-note">
          <span>
            Laget med omtanke for firbeinte <Heart size={13} />
          </span>
          <p>
            Prisene er veiledende. Bekreft alltid med klinikken.
            <br />
            Dyrpris gir ikke veterinærmedisinske råd.
          </p>
          <Link href="/admin">Administrasjon</Link>
        </div>
      </div>
    </footer>
  );
}
