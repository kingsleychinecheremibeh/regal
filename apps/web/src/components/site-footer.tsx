import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-top">
        <div>
          <Link href="/" className="brand">
            <span className="brand-mark" aria-hidden="true">
              R
            </span>
            <span>
              REGALVEST <span className="brand-version">2.0</span>
            </span>
          </Link>
          <p>A connected financial future, designed with Africa in mind.</p>
        </div>
        <nav aria-label="Footer navigation">
          <Link href="/#solutions">Solutions</Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#roadmap">Roadmap</Link>
          <Link href="/#waitlist">Waitlist</Link>
          <Link href="/demo">Concept demo</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Regalvest 2.0</span>
        <span>
          Pre-launch concept · Financial services shown are planned and
          unavailable.
        </span>
      </div>
    </footer>
  );
}
