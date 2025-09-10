export const metadata = {
  title: 'Terms of Use — FavorBank',
  description: 'Plain‑language terms for using FavorBank.'
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Terms of Use</h1>
        <p className="text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">What FavorBank is</h2>
        <p>
          FavorBank is a community time–exchange utility. Members offer and request help in
          circles they belong to. Credits are a coordination tool to keep things balanced —
          they are <strong>not money</strong> and <strong>not redeemable for cash</strong>.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Your account</h2>
        <p>
          Please keep your account secure, use your real contact information, and be respectful.
          If something feels off, contact a circle moderator.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Credits & payments</h2>
        <ul className="list-disc ml-6 space-y-1">
          <li>Credits are for coordination only and cannot be withdrawn or converted to cash.</li>
          <li>You may purchase credit packs to support reliability; purchases are non‑refundable except as required by law.</li>
          <li>Platform and context fees (e.g., urgent, cross‑circle) are disclosed before you confirm.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Prohibited uses</h2>
        <p>FavorBank cannot be used for illegal, unsafe, or inappropriate activities. Examples include:</p>
        <ul className="list-disc ml-6 space-y-1">
          <li>Medical procedures, childcare without a guardian&rsquo;s consent, or anything requiring a license you don&rsquo;t hold.</li>
          <li>Weapons, illicit substances, or dangerous equipment without proper training.</li>
          <li>Discrimination, harassment, or hateful content.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Disputes</h2>
        <p>
          If something goes wrong, open a dispute within <strong>72 hours</strong> of the scheduled time.
          Circle moderators may review and make a final call. FavorBank Plus users may get one small
          auto‑resolution per month (under the posted threshold), as described in the app.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Insurance limits</h2>
        <p>
          Optional damage protection, when offered and purchased, has explicit limits (e.g., up to $500)
          and category restrictions. It does not replace homeowner or renter policies.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Liability</h2>
        <p>
          Use common sense and follow safety checklists for heavy tasks. FavorBank is provided “as is”.
          To the fullest extent permitted by law, we are not liable for indirect or incidental damages.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Changes</h2>
        <p>
          We may update these Terms to improve clarity. Material changes will be announced in‑app.
        </p>
      </section>
    </div>
  );
}

