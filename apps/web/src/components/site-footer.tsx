import Link from "next/link";
import { Logo } from "@/components/logo";

const columns: [string, [string, string][]][] = [
  [
    "Company",
    [
      ["about", "About"],
      ["blog", "Blog"],
      ["careers", "Careers"],
    ],
  ],
  [
    "Explore",
    [
      ["learn", "Learn"],
      ["business", "Business"],
      ["developers", "Developers"],
      ["security", "Security"],
    ],
  ],
  [
    "Support",
    [
      ["help", "Help Center"],
      ["contact", "Contact Support"],
      ["faq", "FAQ"],
    ],
  ],
  [
    "Legal",
    [
      ["terms", "Terms of Use"],
      ["privacy", "Privacy Notice"],
    ],
  ],
];

const DISCLAIMER =
  "TurboXGlobal is a financial technology company, not a bank. Instant swaps, crypto card services, and other financial products and services are provided through our network of licensed and regulated third-party partners.";

export function SiteFooter() {
  return (
    <footer className="f">
      <div className="wrap">
        <div className="fg">
          <div className="f-brand">
            <Logo />
            <p>Trade. Pay. Hold. Invest. One platform for global money.</p>
            <Link className="btn btn-p btn-sm f-cta" href="/sign-up">
              Get started
            </Link>
          </div>
          {columns.map(([title, links]) => (
            <nav key={title} aria-label={title}>
              <h4>{title}</h4>
              {links.map(([slug, label]) => (
                <Link key={slug + label} href={`/${slug}`}>
                  {label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <div className="f-bottom">
          <span>
            © {new Date().getFullYear()} TurboXGlobal. All rights reserved.
          </span>
          <div className="f-legal">
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/contact">Contact</Link>
          </div>
        </div>
        <p className="f-note">{DISCLAIMER}</p>
      </div>
    </footer>
  );
}
