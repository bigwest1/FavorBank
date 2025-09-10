export const metadata = {
  title: 'House Rules — FavorBank',
  description: 'Simple house rules for safe, kind exchanges.'
}

export default function HouseRulesPage() {
  return (
    <div className="mx-auto max-w-3xl py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">House Rules</h1>
        <p className="text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Be kind, be clear</h2>
        <ul className="list-disc ml-6 space-y-1">
          <li>Use plain language when posting or offering help.</li>
          <li>Show up on time, communicate early if plans change.</li>
          <li>Respect quiet hours and the norms of your circle.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Safety first</h2>
        <ul className="list-disc ml-6 space-y-1">
          <li>Follow safety checklists for heavy or risky tasks (moving, furniture, maintenance).</li>
          <li>Ask for help lifting heavy items; use proper equipment.</li>
          <li>Share your SOS location with admins if you feel unsafe.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">What’s not allowed</h2>
        <ul className="list-disc ml-6 space-y-1">
          <li>Illegal or unsafe activities, or anything requiring a license you don’t hold.</li>
          <li>Hate, harassment, or discrimination.</li>
          <li>Cash‑out or barter outside the app—FavorBank credits are not money.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Simple dispute window</h2>
        <p>
          If something goes off track, open a dispute within <strong>72 hours</strong> so moderators can help quickly.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Insurance basics</h2>
        <p>
          Optional damage protection has category limits and a hard cap (for example, up to $500).
          It is a community safety net — not a replacement for personal insurance.
        </p>
      </section>
    </div>
  );
}

