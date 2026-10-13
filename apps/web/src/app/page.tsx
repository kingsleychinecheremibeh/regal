import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CircleDollarSign,
  Compass,
  Globe2,
  Layers3,
  LockKeyhole,
  MoveUpRight,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Waypoints,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WaitlistForm } from "@/components/waitlist-form";

const solutions = [
  {
    no: "01",
    icon: Globe2,
    name: "Borderless banking",
    description:
      "The vision for money that moves with you, across currencies and borders.",
    items: [
      "Multi-currency accounts",
      "International transfers",
      "Virtual & physical cards",
    ],
    className: "solution-card banking",
  },
  {
    no: "02",
    icon: CircleDollarSign,
    name: "Wealth & investments",
    description:
      "One place to discover a broader world of potential opportunities.",
    items: [
      "Stocks & ETFs",
      "Real estate & commodities",
      "Agriculture investments",
    ],
    className: "solution-card wealth",
  },
  {
    no: "03",
    icon: Waypoints,
    name: "Crypto & Web3",
    description: "Thoughtful access to emerging digital asset possibilities.",
    items: ["Cryptocurrency access", "Digital wallets", "Tokenized assets"],
    className: "solution-card crypto",
  },
  {
    no: "04",
    icon: BriefcaseBusiness,
    name: "Business tools",
    description:
      "A connected toolkit for businesses with ambitions beyond borders.",
    items: [
      "Invoicing & collection",
      "Merchant services",
      "Cross-border payroll",
    ],
    className: "solution-card business",
  },
  {
    no: "05",
    icon: Sparkles,
    name: "Community & rewards",
    description: "A future ecosystem built around participation and progress.",
    items: [
      "Rewards ecosystem",
      "Community participation",
      "Future governance",
    ],
    className: "solution-card community",
  },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="home">
        <section className="hero-section">
          <div className="hero-glow" aria-hidden="true" />
          <div className="container hero-grid">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="eyebrow-line" />A NEW VISION FOR FINANCE
              </div>
              <h1>
                One platform.
                <br />
                <em>Borderless</em>
                <br />
                possibilities.
              </h1>
              <p className="hero-lede">
                Imagine a single place connecting African individuals and
                businesses to global financial opportunities. That is the future
                we are building toward.
              </p>
              <div className="hero-actions">
                <Button asChild size="large">
                  <Link href="#solutions">
                    Explore Regalvest <ArrowUpRight size={18} />
                  </Link>
                </Button>
                <Button asChild size="large" variant="outline">
                  <Link href="#waitlist">
                    Join the waitlist <ArrowRight size={18} />
                  </Link>
                </Button>
              </div>
              <div className="hero-note">
                <span className="pulse-dot" />
                Pre-launch vision · Join us on the journey
              </div>
            </div>
            <div
              className="hero-visual"
              aria-label="Illustration of a future Regalvest financial dashboard; no live account data"
            >
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="visual-float float-top">
                <Globe2 size={18} />
                <span>One connected world</span>
              </div>
              <div className="dashboard-shell">
                <div className="dashboard-top">
                  <div className="dash-logo">
                    <span className="dash-logo-mark">R</span>
                    <span>REGALVEST</span>
                  </div>
                  <span className="dash-tag">CONCEPT PREVIEW</span>
                </div>
                <div className="dash-body">
                  <div className="dash-greeting">
                    Your financial world, connected
                  </div>
                  <div className="dash-title">
                    A clearer view of what&apos;s possible.
                  </div>
                  <div className="dash-chart" aria-hidden="true">
                    <div className="chart-grid" />
                    <svg viewBox="0 0 400 120" preserveAspectRatio="none">
                      <defs>
                        <linearGradient
                          id="line-fill"
                          x1="0"
                          x2="0"
                          y1="0"
                          y2="1"
                        >
                          <stop
                            offset="0"
                            stopColor="#71b7ad"
                            stopOpacity=".28"
                          />
                          <stop
                            offset="1"
                            stopColor="#71b7ad"
                            stopOpacity="0"
                          />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0 105 C38 98 42 69 84 78 S132 95 166 58 S213 86 250 43 S315 59 350 24 S385 37 400 12 L400 120 L0 120Z"
                        fill="url(#line-fill)"
                      />
                      <path
                        d="M0 105 C38 98 42 69 84 78 S132 95 166 58 S213 86 250 43 S315 59 350 24 S385 37 400 12"
                        fill="none"
                        stroke="#82c6bb"
                        strokeWidth="3"
                      />
                    </svg>
                  </div>
                  <div className="dash-tabs">
                    <span>
                      <WalletCards size={16} /> Banking
                    </span>
                    <span>
                      <Layers3 size={16} /> Wealth
                    </span>
                    <span>
                      <Waypoints size={16} /> Digital
                    </span>
                  </div>
                </div>
              </div>
              <div className="visual-float float-bottom">
                <div className="float-icon">
                  <Compass size={20} />
                </div>
                <div>
                  <strong>More possibilities</strong>
                  <span>One connected vision</span>
                </div>
                <ArrowUpRight size={17} />
              </div>
            </div>
          </div>
          <div className="container hero-bottom">
            <span>BUILT FOR WHAT&apos;S NEXT</span>
            <div>
              <span>Explore the vision</span>
              <ArrowDownRight size={18} />
            </div>
          </div>
        </section>

        <section className="vision-strip">
          <div className="container vision-strip-inner">
            <div className="vision-intro">
              <span className="section-kicker">THE BIGGER PICTURE</span>
              <h2>
                One ecosystem.
                <br />
                <em>More ways forward.</em>
              </h2>
            </div>
            <p>
              Financial life does not happen in silos. Our vision brings
              everyday banking, opportunity, business, and community into one
              considered experience.
            </p>
          </div>
        </section>

        <section id="solutions" className="solutions-section">
          <div className="container">
            <div className="section-heading">
              <div>
                <span className="section-kicker">EXPLORE THE ECOSYSTEM</span>
                <h2>
                  Designed to connect
                  <br />
                  <em>every possibility.</em>
                </h2>
              </div>
              <p>
                Five planned pillars, one ambitious platform. These capabilities
                are part of the product vision and are not available yet.
              </p>
            </div>
            <div className="solutions-grid">
              {solutions.map((solution) => (
                <article className={solution.className} key={solution.no}>
                  <div className="solution-top">
                    <span className="solution-number">{solution.no} / 05</span>
                    <span className="status-pill">PLANNED</span>
                  </div>
                  <div className="solution-icon">
                    <solution.icon size={25} strokeWidth={1.5} />
                  </div>
                  <h3>{solution.name}</h3>
                  <p>{solution.description}</p>
                  <ul>
                    {solution.items.map((item) => (
                      <li key={item}>
                        <span />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="solution-bottom">
                    <span>Explore the vision</span>
                    <MoveUpRight size={18} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="how-section">
          <div className="container how-grid">
            <div className="how-copy">
              <span className="section-kicker">THE INTENDED EXPERIENCE</span>
              <h2>
                Simple by design.
                <br />
                <em>Powerful in reach.</em>
              </h2>
              <p>
                This is the future product journey we are working toward. The
                platform is currently in pre-launch development.
              </p>
              <div className="how-callout">
                <ShieldCheck size={21} />
                <span>
                  Built with clarity, trust, and accessibility in mind.
                </span>
              </div>
            </div>
            <div className="steps">
              {[
                {
                  n: "01",
                  title: "Create your financial profile",
                  text: "A future starting point tailored to your goals and needs.",
                },
                {
                  n: "02",
                  title: "Explore connected opportunities",
                  text: "Discover planned financial tools and opportunities in one place.",
                },
                {
                  n: "03",
                  title: "Manage from one platform",
                  text: "An intended unified view across your financial activities.",
                },
              ].map((step) => (
                <div className="step" key={step.n}>
                  <span className="step-number">{step.n}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                  <ArrowUpRight size={19} />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="statement-section">
          <div className="container statement-inner">
            <div className="statement-icon">
              <LockKeyhole size={25} />
            </div>
            <span>OUR NORTH STAR</span>
            <p>
              Financial possibility should move <em>as freely as ambition.</em>
            </p>
            <div className="statement-rule" />
          </div>
        </section>

        <section id="roadmap" className="roadmap-section">
          <div className="container">
            <div className="section-heading">
              <div>
                <span className="section-kicker">THE JOURNEY AHEAD</span>
                <h2>
                  Building with
                  <br />
                  <em>intention.</em>
                </h2>
              </div>
              <p>
                A phased roadmap from platform foundation to a wider financial
                ecosystem. Timelines depend on development, partnerships, and
                applicable requirements.
              </p>
            </div>
            <div className="roadmap-grid">
              <article className="roadmap-card active">
                <div className="roadmap-top">
                  <span>PHASE 01</span>
                  <span className="roadmap-dot" />
                </div>
                <h3>Platform foundation</h3>
                <p>
                  Establish the brand, core experience, API foundations, and a
                  community of early supporters.
                </p>
                <span className="roadmap-status">CURRENT FOCUS</span>
              </article>
              <article className="roadmap-card">
                <div className="roadmap-top">
                  <span>PHASE 02</span>
                  <span className="roadmap-dot" />
                </div>
                <h3>Financial integrations</h3>
                <p>
                  Explore regulated partners and the infrastructure needed to
                  bring banking and business capabilities to life.
                </p>
                <span className="roadmap-status">PLANNED</span>
              </article>
              <article className="roadmap-card">
                <div className="roadmap-top">
                  <span>PHASE 03</span>
                  <span className="roadmap-dot" />
                </div>
                <h3>Expanded ecosystem</h3>
                <p>
                  Explore broader investment offerings, digital assets, and
                  community experiences as the platform matures.
                </p>
                <span className="roadmap-status">FUTURE VISION</span>
              </article>
            </div>
          </div>
        </section>

        <section id="waitlist" className="waitlist-section">
          <div className="container waitlist-panel">
            <div className="waitlist-art" aria-hidden="true">
              <div className="waitlist-ring ring-a" />
              <div className="waitlist-ring ring-b" />
              <div className="waitlist-ring ring-c" />
              <div className="waitlist-center">R</div>
            </div>
            <div className="waitlist-content">
              <span className="section-kicker">
                BE PART OF WHAT&apos;S NEXT
              </span>
              <h2>
                The future is worth
                <br />
                <em>building together.</em>
              </h2>
              <p>
                Join the pre-launch waitlist for occasional product updates. No
                account or financial service is available today.
              </p>
              <WaitlistForm />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
