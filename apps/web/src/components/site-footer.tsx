import Link from "next/link";
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-top">
        <div>
          <Link href="/" className="brand">
            <span className="brand-mark">R</span>
            <span>
              REGALVEST <span className="brand-version">2.0</span>
            </span>
          </Link>
          <p>Bridging Real-World Assets, Web3, and Global Finance.</p>
        </div>
        <nav aria-label="Footer navigation">
          {[
            "about",
            "products",
            "learn",
            "business",
            "developers",
            "contact",
            "faq",
            "privacy",
            "terms",
          ].map((slug) => (
            <Link href={`/${slug}`} key={slug}>
              {slug[0].toUpperCase() + slug.slice(1)}
            </Link>
          ))}
        </nav>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Regalvest 2.0</span>
        <span>
          Investor preview · Financial features are simulated or planned.
        </span>
      </div>
    </footer>
  );
}
