import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Privacy notice — Regalvest 2.0" };

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="container interior-page">
        <span className="section-kicker">PRIVACY NOTICE</span>
        <h1>Your interest, handled with care.</h1>
        <p>
          Regalvest 2.0 currently collects only the email address you submit and
          the time you consent to pre-launch updates. We use this information to
          manage the waitlist and send occasional updates about the project.
        </p>
        <p>
          Joining the waitlist does not create a financial account. We do not
          collect identity documents, payment details, or financial information
          through this site. We do not sell waitlist email addresses.
        </p>
        <p>
          You can withdraw consent or request removal using the unsubscribe
          option in any future email. A direct privacy contact channel will be
          published before updates are sent.
        </p>
        <p>
          This notice describes the current proof of concept and will be updated
          before broader product launch.
        </p>
        <Link href="/#waitlist" className="text-link">
          Back to waitlist →
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
