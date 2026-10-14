import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

const modes = {
  "sign-up": {
    title: "Create your Regalvest account",
    note: "Your identity is real. All financial features inside are simulations.",
  },
  "sign-in": {
    title: "Welcome back",
    note: "Sign in to your personal demo workspace.",
  },
  "forgot-password": {
    title: "Reset your password",
    note: "We will email a reset link if an account exists.",
  },
  "reset-password": {
    title: "Choose a new password",
    note: "The link can only be used once.",
  },
  verify: {
    title: "Verify your email",
    note: "Complete verification before signing in.",
  },
  "resend-verification": {
    title: "Request a new verification link",
    note: "If your account is unverified, we will send another link when email delivery is available.",
  },
} as const;

const pages = {
  about: {
    kicker: "ABOUT REGALVEST",
    title: "A broader financial future, designed with Africa in mind.",
    intro:
      "Regalvest 2.0 is a proposed connected platform for global financial access. This investor preview demonstrates the product direction while operational services remain in development.",
    cards: [
      [
        "Our perspective",
        "People and businesses should be able to understand and navigate financial possibilities from one coherent place.",
      ],
      [
        "Our current stage",
        "The website includes real account identity and an isolated financial simulation. Regulated products require further validation, partners and approvals.",
      ],
      [
        "Our principles",
        "Clear information, responsible design and honest communication about what is available today.",
      ],
    ],
  },
  products: {
    kicker: "THE ECOSYSTEM",
    title: "One platform vision. Distinct product paths.",
    intro:
      "Every financial capability below is planned or simulated for this investor preview.",
    cards: [
      [
        "TradeHub",
        "Demo trading, market-style views, P2P and staking concepts.",
      ],
      ["RegalPay", "Payment, airtime, utility and global transfer concepts."],
      ["SmartSave", "Interactive demo savings goals and balance transfers."],
      [
        "Wealth",
        "Planned access to stocks, ETFs, property, agriculture and commodities.",
      ],
      ["Global Accounts", "Illustrative multi-currency account interface."],
      [
        "Virtual Cards",
        "Fictitious card management controls without payment credentials.",
      ],
      ["VestPoints", "Demo participation rewards with a daily check-in."],
      ["Academy", "Financial education and learning concepts."],
    ],
  },
  learn: {
    kicker: "REGALVEST ACADEMY",
    title: "Build confidence before making decisions.",
    intro:
      "Explore the learning direction for Regalvest. These course topics are previews, and no live news or third-party feed is connected.",
    cards: [
      [
        "Understanding risk",
        "Learn how risk and uncertainty affect financial choices.",
      ],
      [
        "Cross-border basics",
        "Understand currencies, conversion and transfer concepts.",
      ],
      ["Savings habits", "Explore goals, time horizons and consistency."],
      [
        "Digital assets",
        "Get familiar with the vocabulary and tradeoffs of Web3.",
      ],
    ],
  },
  business: {
    kicker: "FOR BUSINESS",
    title: "A concept workspace for businesses going further.",
    intro:
      "The investor demo previews business tools. No live merchant collection, invoicing or payroll service is available.",
    cards: [
      ["Invoicing", "A planned flow for creating and tracking invoices."],
      ["Merchant tools", "A future view of business collections and activity."],
      ["Payroll", "Explore a possible cross-border payroll workflow."],
      ["Developer access", "Read the current demo API documentation."],
    ],
  },
  developers: {
    kicker: "FOR DEVELOPERS",
    title: "Explore the investor demo API.",
    intro:
      "The API currently supports real account identity, a waitlist and isolated simulated financial data. Financial endpoints cannot move real funds.",
    cards: [
      ["REST API", "Versioned endpoints under /api/v1."],
      ["OpenAPI", "View the API schema and examples in Swagger."],
      [
        "Demo boundary",
        "There are no live banking, payment, trading or custody integrations.",
      ],
    ],
  },
  contact: {
    kicker: "CONTACT",
    title: "Stay connected to the project.",
    intro:
      "A verified public contact channel has not been published yet. Join the waitlist for project updates; please do not send personal financial information.",
    cards: [
      [
        "Project updates",
        "The waitlist records your email and explicit consent.",
      ],
      [
        "Support",
        "Account and product support channels will be published before a wider launch.",
      ],
    ],
  },
  faq: {
    kicker: "FREQUENTLY ASKED QUESTIONS",
    title: "Understand what this preview does.",
    intro: "Answers about the current investor demonstration.",
    cards: [
      [
        "Can I move real money?",
        "No. Every financial balance and action is simulated.",
      ],
      [
        "Is my account real?",
        "Registration, email verification and sessions use real account data once email delivery is configured.",
      ],
      [
        "Are market prices live?",
        "No. All displayed market figures are fixed illustrative examples.",
      ],
      [
        "Is Regalvest licensed?",
        "This preview makes no licensing or regulated-service claim.",
      ],
      [
        "Can I reset my demo?",
        "Yes. Use Reset demo data in dashboard settings.",
      ],
    ],
  },
  terms: {
    kicker: "TERMS OF USE",
    title: "Terms for this investor preview.",
    intro:
      "By creating an account, you agree to use this site only as a product demonstration. You must be at least 18 years old.",
    cards: [
      [
        "Simulated services",
        "Demo balances, orders, cards, rewards and transactions have no monetary value and cannot be redeemed or transferred outside this site.",
      ],
      [
        "No financial advice",
        "Illustrative content is not investment, legal or tax advice.",
      ],
      [
        "Account security",
        "Keep your password private and notify the project through a verified support channel when one becomes available if you suspect misuse.",
      ],
      [
        "Availability",
        "Features may change during development. No financial product is promised by this preview.",
      ],
    ],
  },
} as const;

export function generateStaticParams() {
  return [...Object.keys(pages), ...Object.keys(modes)].map((slug) => ({
    slug,
  }));
}
export default async function InformationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug in modes) {
    const mode = slug as keyof typeof modes;
    return (
      <main className="auth-page">
        <Link href="/" className="auth-brand">
          R / REGALVEST 2.0
        </Link>
        <section className="auth-card">
          <span className="demo-label">INVESTOR DEMO</span>
          <h1>{modes[mode].title}</h1>
          <p>{modes[mode].note}</p>
          <Suspense fallback={<p>Loading form…</p>}>
            <AuthForm mode={mode} />
          </Suspense>
        </section>
      </main>
    );
  }
  if (!(slug in pages)) notFound();
  const page = pages[slug as keyof typeof pages];
  return (
    <>
      <SiteHeader />
      <main className="info-page">
        <div className="container">
          <span className="section-kicker">{page.kicker}</span>
          <h1>{page.title}</h1>
          <p className="info-lede">{page.intro}</p>
          <div className="info-grid">
            {page.cards.map(([title, copy]) => (
              <section key={title} className="info-card">
                <h2>{title}</h2>
                <p>{copy}</p>
              </section>
            ))}
          </div>
          <div className="info-cta">
            <p>See how the connected experience might work.</p>
            <Link className="orange-button" href="/sign-up">
              Explore the demo →
            </Link>
            {slug === "developers" && (
              <a
                className="outline-button"
                href="https://regalvest-api.onrender.com/api/docs"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open API docs ↗
              </a>
            )}
            {slug === "contact" && (
              <Link className="outline-button" href="/#waitlist">
                Join waitlist →
              </Link>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
