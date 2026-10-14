import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
export const metadata = { title: "Privacy notice — Regalvest 2.0" };
export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="info-page">
        <div className="container">
          <span className="section-kicker">PRIVACY NOTICE</span>
          <h1>Your information in this preview.</h1>
          <p className="info-lede">
            Regalvest processes account identity and activity needed for this
            investor demonstration.
          </p>
          <div className="info-grid">
            <section className="info-card">
              <h2>Information collected</h2>
              <p>
                We store your name, normalized email address, password hash,
                acceptance time, verification status, session records,
                preferences and your simulated financial activity. Waitlist
                emails and consent times are stored separately.
              </p>
            </section>
            <section className="info-card">
              <h2>How it is used</h2>
              <p>
                Account data enables sign-in, verification, password recovery
                and a personal demo. Simulated activity is stored to keep your
                dashboard consistent between visits. Waitlist email is used for
                project updates only when you consent.
              </p>
            </section>
            <section className="info-card">
              <h2>Security</h2>
              <p>
                Passwords are hashed. Sessions are held in HttpOnly cookies.
                Verification and reset tokens are stored only as hashes and
                expire. No real payment or bank credentials are collected in the
                demo.
              </p>
            </section>
            <section className="info-card">
              <h2>Retention and requests</h2>
              <p>
                A verified privacy contact channel and deletion workflow will be
                published before broader launch. Until then, avoid entering
                sensitive personal or financial information in demo fields.
              </p>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
