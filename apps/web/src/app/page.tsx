import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SiteIcon } from "@/components/site-icon";
import { FaqList } from "@/components/faq-list";
import { WaitlistForm } from "@/components/waitlist-form";
import { Steps } from "@/components/steps";
import type { IconName } from "@/lib/site-content";

function Tile({
  slug,
  icon,
  title,
  text,
}: {
  slug: string;
  icon: IconName;
  title: string;
  text: string;
}) {
  return (
    <Link className="card tile" href={`/${slug}`}>
      <div className="ic">
        <SiteIcon name={icon} />
      </div>
      <h3>{title}</h3>
      <p className="mut m0">{text}</p>
    </Link>
  );
}

function HeroVisual() {
  return (
    <div className="vis" aria-hidden="true">
      <div className="panel" style={{ left: 0, top: 10, width: "78%" }}>
        <div style={{ fontWeight: 600, color: "#586179", fontSize: 14 }}>
          Your accounts
        </div>
        <div style={{ margin: "10px 0" }}>
          {["USD", "EUR", "GBP", "Digital assets"].map((label) => (
            <span className="pill" key={label}>
              {label}
            </span>
          ))}
        </div>
        <svg
          viewBox="0 0 300 90"
          width="100%"
          height="90"
          preserveAspectRatio="none"
        >
          <path
            d="M0 70L40 58 80 64 120 40 160 48 200 24 240 30 300 8L300 90L0 90Z"
            fill="#0B1533"
            opacity=".08"
          />
          <path
            d="M0 70L40 58 80 64 120 40 160 48 200 24 240 30 300 8"
            fill="none"
            stroke="#16845B"
            strokeWidth="3"
          />
        </svg>
      </div>
      <div
        className="panel vcard"
        style={{ right: 0, top: 150, width: "62%", height: 160, padding: 20 }}
      >
        <div
          style={{
            width: 34,
            height: 24,
            borderRadius: 5,
            background: "#E8B547",
          }}
        />
        <div
          style={{
            marginTop: 46,
            fontWeight: 600,
            letterSpacing: ".14em",
            color: "#C9D1E6",
          }}
        >
          •••• •••• •••• ••••
        </div>
      </div>
      <div
        className="panel"
        style={{
          left: "6%",
          bottom: 0,
          width: "60%",
          display: "flex",
          gap: 12,
          alignItems: "center",
        }}
      >
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "#C7F000",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
          }}
        >
          ✓
        </span>
        <div>
          <b>Payment sent</b>
          <div style={{ fontSize: 13, color: "#586179" }}>
            Receipt saved to history
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="hero">
          <div className="wrap">
            <div>
              <h1>Everything You Need to Build Wealth</h1>
              <p className="lead">
                Trade digital assets, send money across borders, hold USD, EUR
                and GBP, spend with virtual cards and explore investments, all
                in one account.
              </p>
              <div className="row">
                <Link className="btn btn-p btn-lg" href="/sign-up">
                  Get Started
                </Link>
                <Link className="btn btn-w btn-lg" href="/buy-sell">
                  Explore Our Products
                </Link>
              </div>
            </div>
            <HeroVisual />
          </div>
        </section>

        <div className="pitch">
          <div className="wrap">
            <div className="grid g3">
              <p>
                One account for trading, payments, currencies and investing.
              </p>
              <p>Fees and rates shown before you confirm.</p>
              <p>Every product built around a simple, clear flow.</p>
            </div>
          </div>
        </div>

        <section className="s">
          <div className="wrap">
            <div className="sh">
              <h2>Everything you need to trade digital assets</h2>
              <p>
                Buy, sell and swap supported digital assets at clear prices,
                with every fee shown before you confirm.
              </p>
            </div>
            <div className="grid g3">
              <Tile
                slug="buy-sell"
                icon="trade"
                title="Buy & Sell"
                text="Trade supported assets with market or limit orders."
              />
              <Tile
                slug="swap"
                icon="swap"
                title="Swap Coins"
                text="Exchange one asset for another in one step."
              />
              <Tile
                slug="markets"
                icon="chart"
                title="Market Overview"
                text="Charts, watchlists and quick access to trading."
              />
            </div>
            <div className="mt2">
              <Link className="btn btn-d btn-lg" href="/sign-up">
                Start Trading
              </Link>
            </div>
          </div>
        </section>

        <section className="s alt">
          <div className="wrap">
            <div className="sh">
              <h2>Do more with your money with TurboXPay</h2>
              <p>
                Send, pay and convert from one balance. See the fee and the
                exchange rate before you confirm, and keep a receipt for
                everything.
              </p>
            </div>
            <div className="grid g3">
              <Tile
                slug="turboxpay"
                icon="pay"
                title="TurboXPay"
                text="Pay beneficiaries and keep receipts."
              />
              <Tile
                slug="bills"
                icon="pay"
                title="Bills & Utilities"
                text="Pay your bills from your balance."
              />
              <Tile
                slug="transfers"
                icon="globe"
                title="International Transfers"
                text="Send money abroad with costs shown first."
              />
              <Tile
                slug="convert"
                icon="swap"
                title="Currency Conversion"
                text="Move between USD, EUR and GBP."
              />
              <Tile
                slug="merchant"
                icon="store"
                title="Merchant Payments"
                text="Accept payments for your business."
              />
              <Tile
                slug="global-accounts"
                icon="globe"
                title="Global Accounts"
                text="Hold USD, EUR and GBP together."
              />
            </div>
          </div>
        </section>

        <section className="s">
          <div className="wrap">
            <div className="sh">
              <h2>Invest in what you believe in</h2>
              <p>
                Explore stocks, ETFs and real estate, with the details and risks
                explained before you invest.
              </p>
            </div>
            <div className="grid g3">
              <Tile
                slug="stocks-etfs"
                icon="wealth"
                title="Stocks & ETFs"
                text="Listed companies and funds."
              />
              <Tile
                slug="real-estate"
                icon="home"
                title="Real Estate"
                text="Property opportunities, explained clearly."
              />
              <Tile
                slug="portfolio"
                icon="chart"
                title="Portfolio Tracking"
                text="Everything you hold, in one view."
              />
            </div>
          </div>
        </section>

        <section className="s alt">
          <div className="wrap">
            <div className="sh">
              <h2>Getting started is as easy as 1, 2, 3</h2>
              <p>
                Whether you want to trade, pay or invest, setting up takes
                minutes.
              </p>
            </div>
            <Steps
              items={[
                "Create your account on the web.",
                "Verify your profile or your business.",
                "Fund your account and start using any product.",
              ]}
            />
          </div>
        </section>

        <section className="s dark">
          <div className="wrap">
            <div className="grid g2" style={{ alignItems: "center" }}>
              <div>
                <h2 className="h2">Shop online with a virtual card</h2>
                <p className="mut" style={{ fontSize: 19 }}>
                  Create a virtual card for online purchases. Freeze it in one
                  tap, set a spending limit and see every transaction.
                </p>
                <Link className="btn btn-p btn-lg" href="/virtual-cards">
                  Explore Virtual Cards
                </Link>
              </div>
              <div
                className="card tile"
                style={{ background: "#111B3B", borderColor: "#25315C" }}
              >
                <h3>Included with every card</h3>
                <p className="mut m0">
                  Instant creation · Freeze and unfreeze · Spending limits ·
                  Full transaction history
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="s">
          <div className="wrap">
            <div className="sh">
              <h2>Learn at your own pace</h2>
              <p>
                Guides and explanations to help you use every product with
                confidence.
              </p>
            </div>
            <div className="grid g3">
              <Tile
                slug="learn"
                icon="book"
                title="Learn"
                text="Step-by-step guides and a glossary."
              />
              <Tile
                slug="security"
                icon="shield"
                title="Security"
                text="Keep your account safe."
              />
              <Tile
                slug="blog"
                icon="book"
                title="Blog"
                text="Updates and market education."
              />
            </div>
          </div>
        </section>

        <section className="s alt">
          <div className="wrap">
            <div className="grid g2" style={{ alignItems: "center" }}>
              <div>
                <h2 className="h2">
                  Financial infrastructure built for integration
                </h2>
                <p className="mut">
                  Accept payments, hold business funds and connect your systems
                  with our API.
                </p>
                <div className="row">
                  <Link className="btn btn-d btn-lg" href="/business">
                    Explore Business
                  </Link>
                  <Link className="btn btn-s btn-lg" href="/developers">
                    Developers
                  </Link>
                </div>
              </div>
              <FaqList />
            </div>
          </div>
        </section>

        <section className="s" id="waitlist">
          <div className="wrap">
            <div className="sh">
              <h2>Be first to know when we launch</h2>
              <p>
                Join the launch list for product news. You can also create an
                account now to explore the investor preview.
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
