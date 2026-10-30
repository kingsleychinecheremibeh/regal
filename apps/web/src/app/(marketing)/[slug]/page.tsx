import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { ContactForm } from "@/components/contact-form";
import { FaqList } from "@/components/faq-list";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SiteIcon } from "@/components/site-icon";
import { Steps } from "@/components/steps";
import { glossary, pages } from "@/lib/site-content";

const modes = {
  "sign-up": {
    title: "Create your account",
    note: "Your account is real. Everything financial inside is a simulation.",
  },
  "sign-in": {
    title: "Sign in",
    note: "Welcome back to your TurboXGlobal preview.",
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
    note: "Confirm your email address to activate your account.",
  },
  "resend-verification": {
    title: "Request a new verification link",
    note: "If your account is unverified, we will send another link when email delivery is available.",
  },
} as const;

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return [...Object.keys(pages), ...Object.keys(modes)].map((slug) => ({
    slug,
  }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const title =
    slug in modes
      ? modes[slug as keyof typeof modes].title
      : pages[slug]?.title;
  return title ? { title: `${title} · TurboXGlobal` } : {};
}

export default async function InformationPage({ params }: Params) {
  const { slug } = await params;
  if (slug in modes) {
    const mode = slug as keyof typeof modes;
    return (
      <main className="auth" id="main">
        <div className="auth-box">
          <Logo />
          <div className="card pad" style={{ padding: 28 }}>
            <Suspense fallback={<p className="mut">Loading form…</p>}>
              <AuthForm
                mode={mode}
                title={modes[mode].title}
                note={modes[mode].note}
              />
            </Suspense>
          </div>
        </div>
      </main>
    );
  }
  const page = pages[slug];
  if (!page) notFound();
  return (
    <>
      <SiteHeader />
      <main id="main">
        <div className="band">
          <div className="wrap">
            <div className="ic">
              <SiteIcon name={page.icon} />
            </div>
            <h1>{page.title}</h1>
            <p>{page.lead}</p>
            {page.cta && (
              <div className="row">
                <Link className="btn btn-p btn-lg" href="/sign-up">
                  Get Started
                </Link>
                <Link className="btn btn-w btn-lg" href="/sign-in">
                  Try it in the preview
                </Link>
              </div>
            )}
          </div>
        </div>
        <section className="s">
          <div className="wrap">
            {page.features.length > 0 && (
              <div className="grid g2">
                {page.features.map(([title, text]) => (
                  <div className="card tile" key={title}>
                    <h3>{title}</h3>
                    <p className="mut m0">{text}</p>
                  </div>
                ))}
              </div>
            )}
            {page.steps.length > 0 && (
              <>
                <h2 className="h2" style={{ marginTop: 56 }}>
                  How it works
                </h2>
                <Steps items={page.steps} />
              </>
            )}
            {page.legal && (
              <div className="prose">
                {page.legal.map(([title, text]) => (
                  <div key={title}>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                ))}
              </div>
            )}
            {slug === "learn" && (
              <>
                <h2 className="h2">Getting started</h2>
                <Steps
                  items={[
                    "Create your account and confirm your email.",
                    "Verify your profile with your ID.",
                    "Fund your account, then pick a product.",
                  ]}
                />
                <h2 className="h2" style={{ marginTop: 56 }}>
                  Glossary
                </h2>
                <div className="grid g2">
                  {glossary.map(([term, text]) => (
                    <div className="card tile" key={term}>
                      <h3>{term}</h3>
                      <p className="mut m0">{text}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
            {slug === "faq" && (
              <div className="prose">
                <FaqList />
              </div>
            )}
            {slug === "developers" && (
              <p className="mt2">
                <a
                  className="btn btn-s"
                  href="/api/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open the preview API reference ↗
                </a>
              </p>
            )}
            {page.form && (
              <div
                className="card tile"
                style={{ maxWidth: 560, marginTop: 40 }}
              >
                <h3>{page.form}</h3>
                <ContactForm topic={slug} />
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
