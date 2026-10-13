import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  ChartNoAxesCombined,
  CircleDollarSign,
  Globe2,
  Info,
  Layers3,
  WalletCards,
} from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Investor concept demo — Regalvest 2.0" };

const activity = [
  {
    name: "Illustrative transfer",
    detail: "Future banking concept",
    value: "− $240.00",
    icon: Globe2,
  },
  {
    name: "Sample investment",
    detail: "Future wealth concept",
    value: "+ $120.00",
    icon: ChartNoAxesCombined,
  },
  {
    name: "Example reward",
    detail: "Future community concept",
    value: "+ 45 pts",
    icon: CircleDollarSign,
  },
];

export default function DemoPage() {
  return (
    <>
      <SiteHeader />
      <main className="demo-page">
        <div className="container">
          <div className="demo-intro">
            <Link href="/" className="demo-back">
              <ArrowLeft size={15} /> Back to Regalvest
            </Link>
            <span className="demo-tag">INVESTOR CONCEPT PREVIEW</span>
            <h1>
              A glimpse of a more
              <br />
              <em>connected future.</em>
            </h1>
            <p>
              This non-interactive dashboard illustrates a possible product
              experience. All amounts, activity, and allocations below are{" "}
              <strong>DEMO DATA</strong>. No account or financial service is
              live.
            </p>
          </div>
          <div className="demo-banner">
            <Info size={19} />
            <span>
              DEMO DATA ONLY — illustrative interface. No real balances,
              transactions, wallets, or investments.
            </span>
          </div>
          <div className="demo-grid">
            <section className="demo-main-card">
              <div className="demo-card-top">
                <div>
                  <span className="demo-label">ILLUSTRATIVE OVERVIEW</span>
                  <h2>Your world, in one view</h2>
                </div>
                <span className="demo-data-tag">DEMO DATA</span>
              </div>
              <div className="demo-metrics">
                <div>
                  <span>Sample portfolio value</span>
                  <strong>$18,420.00</strong>
                  <small>Illustrative USD value</small>
                </div>
                <div>
                  <span>Example monthly change</span>
                  <strong>+ 4.8%</strong>
                  <small>Illustrative performance</small>
                </div>
              </div>
              <div
                className="demo-bars"
                aria-label="Illustrative allocation chart: banking 42%, investments 38%, digital assets 20%"
              >
                <div style={{ height: "42%" }} />
                <div style={{ height: "57%" }} />
                <div style={{ height: "50%" }} />
                <div style={{ height: "66%" }} />
                <div style={{ height: "58%" }} />
                <div style={{ height: "73%" }} />
                <div style={{ height: "68%" }} />
                <div style={{ height: "85%" }} />
                <div style={{ height: "78%" }} />
                <div style={{ height: "100%" }} />
                <div style={{ height: "92%" }} />
                <div style={{ height: "108%" }} />
              </div>
              <div className="demo-chart-label">
                <span>CONCEPT PERFORMANCE</span>
                <span>NOT REAL MARKET DATA</span>
              </div>
            </section>
            <section className="demo-side-card">
              <div className="demo-card-top">
                <div>
                  <span className="demo-label">FUTURE CAPABILITY</span>
                  <h2>Currency view</h2>
                </div>
                <WalletCards size={21} />
              </div>
              <div className="currency-row">
                <span className="currency-icon">$</span>
                <span>
                  US Dollar<small>Sample balance</small>
                </span>
                <strong>$8,250.00</strong>
              </div>
              <div className="currency-row">
                <span className="currency-icon">£</span>
                <span>
                  British Pound<small>Sample balance</small>
                </span>
                <strong>£3,180.00</strong>
              </div>
              <div className="currency-row">
                <span className="currency-icon">₦</span>
                <span>
                  Nigerian Naira<small>Sample balance</small>
                </span>
                <strong>₦2,450,000</strong>
              </div>
              <div className="demo-side-foot">DEMO DATA · No wallet exists</div>
            </section>
            <section className="demo-side-card allocation">
              <div className="demo-card-top">
                <div>
                  <span className="demo-label">ILLUSTRATIVE MIX</span>
                  <h2>Allocation concept</h2>
                </div>
                <Layers3 size={21} />
              </div>
              <div className="allocation-visual">
                <div className="allocation-ring">
                  <span>
                    DEMO
                    <br />
                    DATA
                  </span>
                </div>
                <ul>
                  <li>
                    <span className="legend-dot bank" /> Banking concept{" "}
                    <b>42%</b>
                  </li>
                  <li>
                    <span className="legend-dot invest" /> Wealth concept{" "}
                    <b>38%</b>
                  </li>
                  <li>
                    <span className="legend-dot digital" /> Digital concept{" "}
                    <b>20%</b>
                  </li>
                </ul>
              </div>
            </section>
            <section className="demo-main-card activity">
              <div className="demo-card-top">
                <div>
                  <span className="demo-label">EXAMPLE ONLY</span>
                  <h2>What an activity feed could look like</h2>
                </div>
                <Banknote size={21} />
              </div>
              {activity.map((item) => (
                <div className="activity-row" key={item.name}>
                  <div className="activity-icon">
                    <item.icon size={17} />
                  </div>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.detail}</span>
                  </div>
                  <b>{item.value}</b>
                </div>
              ))}
              <div className="demo-side-foot">
                DEMO DATA · No transactions have occurred
              </div>
            </section>
          </div>
          <div className="demo-next">
            <div>
              <span className="section-kicker">WHAT COMES NEXT</span>
              <h2>From concept to capability.</h2>
              <p>
                Read the roadmap to see how the platform vision could develop.
                These features depend on future product work, integrations, and
                applicable requirements.
              </p>
            </div>
            <Link href="/#roadmap">
              View the roadmap <ArrowUpRight size={17} />
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
