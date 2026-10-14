import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CreditCard,
  Globe2,
  GraduationCap,
  Landmark,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WaitlistForm } from "@/components/waitlist-form";

const products = [
  {
    name: "TradeHub",
    icon: TrendingUp,
    text: "Explore simulated trading, prices and portfolio decisions.",
  },
  {
    name: "RegalPay",
    icon: Wallet,
    text: "Preview a future way to manage payments and transfers.",
  },
  {
    name: "SmartSave",
    icon: Landmark,
    text: "Set goals and test savings habits with demo funds.",
  },
  {
    name: "Wealth",
    icon: Sparkles,
    text: "Discover planned investment categories in one view.",
  },
  {
    name: "Global Accounts",
    icon: Globe2,
    text: "See a concept for managing money across currencies.",
  },
  {
    name: "Virtual Cards",
    icon: CreditCard,
    text: "Explore card controls with fictitious demo cards.",
  },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="new-hero">
          <div className="container hero-layout">
            <div>
              <span className="pill">REGALVEST 2.0 · INVESTOR PREVIEW</span>
              <h1>
                Finance without <em>the old borders.</em>
              </h1>
              <p>
                Bridging Real-World Assets, Web3, and Global Finance. Explore a
                connected financial vision built for African individuals and
                businesses.
              </p>
              <div className="hero-buttons">
                <Link className="orange-button" href="/sign-up">
                  Explore the demo <ArrowUpRight size={18} />
                </Link>
                <Link className="outline-button" href="#ecosystem">
                  Discover the ecosystem <ArrowRight size={18} />
                </Link>
              </div>
              <small>
                Financial features are simulated. No real banking, trading or
                investment service is available.
              </small>
            </div>
            <div
              className="hero-dashboard"
              aria-label="Illustrative dashboard preview"
            >
              <div className="hero-dash-bar">
                <span>REGALVEST / OVERVIEW</span>
                <span>DEMO DATA</span>
              </div>
              <div className="hero-dash-balance">
                <span>Total demo portfolio</span>
                <strong>$100,000.00</strong>
                <small>Illustrative balance</small>
              </div>
              <div className="hero-dash-chart" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="hero-dash-cards">
                <div>
                  <span>SmartSave</span>
                  <strong>Planned</strong>
                </div>
                <div>
                  <span>TradeHub</span>
                  <strong>Demo</strong>
                </div>
                <div>
                  <span>RegalPay</span>
                  <strong>Planned</strong>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="new-section" id="ecosystem">
          <div className="container">
            <div className="section-intro">
              <span className="section-kicker">ONE CONNECTED ECOSYSTEM</span>
              <h2>Many possibilities. One clear view.</h2>
              <p>
                Regalvest brings planned finance products into a single vision.
                Try selected workflows using isolated demo data.
              </p>
            </div>
            <div className="product-grid">
              {products.map((item, index) => (
                <article className="product-tile" key={item.name}>
                  <div className="product-icon">
                    <item.icon size={25} />
                  </div>
                  <span className="tile-no">0{index + 1} / PLANNED</span>
                  <h3>{item.name}</h3>
                  <p>{item.text}</p>
                  <Link href="/products">
                    Explore concept <ArrowUpRight size={16} />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="new-section dark-section">
          <div className="container split-section">
            <div>
              <span className="section-kicker">HOW IT WORKS</span>
              <h2>See the experience. Understand the vision.</h2>
              <p>
                Register with a real account, verify your email, then explore a
                personal dashboard. All financial actions use fictitious
                balances and stay within the demo.
              </p>
              <Link className="orange-button" href="/sign-up">
                Create a demo account <ArrowRight size={18} />
              </Link>
            </div>
            <div className="step-list">
              <div>
                <b>01</b>
                <span>
                  <strong>Create your profile</strong>
                  <small>Real registration and account security.</small>
                </span>
              </div>
              <div>
                <b>02</b>
                <span>
                  <strong>Open your workspace</strong>
                  <small>Your own isolated simulated data.</small>
                </span>
              </div>
              <div>
                <b>03</b>
                <span>
                  <strong>Explore the future</strong>
                  <small>Try demo trades, savings and rewards.</small>
                </span>
              </div>
            </div>
          </div>
        </section>
        <section className="new-section">
          <div className="container">
            <div className="section-intro">
              <span className="section-kicker">BEYOND PERSONAL FINANCE</span>
              <h2>Tools for growth and learning.</h2>
            </div>
            <div className="feature-grid">
              <Link href="/learn">
                <GraduationCap size={28} />
                <h3>Regalvest Academy</h3>
                <p>
                  Financial learning experiences and market education are
                  planned.
                </p>
                <span>Explore learning →</span>
              </Link>
              <Link href="/business">
                <BriefcaseBusiness size={28} />
                <h3>Business tools</h3>
                <p>
                  A future workspace for invoices, merchant services and
                  cross-border payroll.
                </p>
                <span>Explore business →</span>
              </Link>
              <Link href="/products">
                <ShieldCheck size={28} />
                <h3>VestPoints</h3>
                <p>
                  Preview a participation and rewards model with demo points.
                </p>
                <span>Explore rewards →</span>
              </Link>
            </div>
          </div>
        </section>
        <section className="new-section roadmap-section" id="roadmap">
          <div className="container">
            <span className="section-kicker">PRODUCT ROADMAP</span>
            <h2>Built in considered stages.</h2>
            <div className="roadmap-line">
              <div>
                <b>Now</b>
                <h3>Investor preview</h3>
                <p>Real identity and a simulated product workspace.</p>
              </div>
              <div>
                <b>Next</b>
                <h3>Product validation</h3>
                <p>Research, compliance and partner discussions.</p>
              </div>
              <div>
                <b>Future</b>
                <h3>Potential launches</h3>
                <p>
                  Only after required partnerships, licensing and operational
                  readiness.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="new-section waitlist-section" id="waitlist">
          <div className="container split-section">
            <div>
              <span className="section-kicker">STAY IN THE LOOP</span>
              <h2>Follow the Regalvest journey.</h2>
              <p>
                Join the pre-launch waitlist for occasional updates. Creating a
                demo account is separate from joining this list.
              </p>
            </div>
            <WaitlistForm />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
