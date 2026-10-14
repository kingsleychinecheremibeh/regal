import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";
const links = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/products", label: "Products" },
  { href: "/learn", label: "Learn" },
  { href: "/business", label: "Business" },
  { href: "/developers", label: "Developers" },
];
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="Regalvest 2.0 home">
          <span className="brand-mark">R</span>
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
        <div className="header-actions">
          <Link href="/sign-in">Sign in</Link>
          <Link href="/sign-up" className="header-cta">
            Explore demo <ArrowUpRight size={16} />
          </Link>
        </div>
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
            <Link href="/sign-in">Sign in</Link>
            <Link href="/sign-up">Explore demo</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
