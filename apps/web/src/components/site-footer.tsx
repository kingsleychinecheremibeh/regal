import Link from "next/link";
import { Logo } from "@/components/logo";

const columns: [string, [string, string][]][] = [
  [
    "Company",
    [
      ["about", "About"],
      ["blog", "Blog"],
      ["careers", "Careers"],
      ["faq", "FAQ"],
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
    "Legal",
    [
      ["terms", "Terms of Use"],
      ["privacy", "Privacy Notice"],
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
];

export function SiteFooter() {
  return (
    <footer className="f">
      <div className="wrap">
        <div className="fg">
          <div>
            <Logo />
            <p style={{ marginTop: 14 }}>
              Trade. Pay. Hold. Invest. One platform for global money.
            </p>
          </div>
          {columns.map(([title, links]) => (
            <div key={title}>
              <h4>{title}</h4>
              {links.map(([slug, label]) => (
                <Link key={slug + label} href={`/${slug}`}>
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <p style={{ marginTop: 34, fontSize: 14 }}>
          © {new Date().getFullYear()} TurboXGlobal. TurboXGlobal is a financial
          technology company, not a bank. Instant swap, crypto-card and other
          relevant services will be powered by licensed partners at launch.
          Balances shown before launch are not real funds.
        </p>
      </div>
    </footer>
  );
}
