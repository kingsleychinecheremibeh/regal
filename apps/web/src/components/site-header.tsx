import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";

const links = [
  { href: "/#home", label: "Home" },
  { href: "/#solutions", label: "Solutions" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#roadmap", label: "Roadmap" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/#home" className="brand" aria-label="Regalvest 2.0 home">
          <span className="brand-mark" aria-hidden="true">
            R
          </span>
          <span>
            REGALVEST <span className="brand-version">2.0</span>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <Link href="/#waitlist" className="header-cta">
          Join waitlist <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
        <details className="mobile-nav">
          <summary aria-label="Open navigation">
            <Menu size={22} />
          </summary>
          <nav aria-label="Mobile navigation">
            {links.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
            <Link href="/#waitlist">Join waitlist</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
