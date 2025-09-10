export const metadata = {
  title: 'Privacy Policy — FavorBank',
  description: 'Plain‑language privacy policy for FavorBank.'
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">What we collect</h2>
        <p>
          We collect basic account info (name, email), session logs, and content you share in your circles.
          For location features (check‑in, SOS), we use your device location only with your consent.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">How we use it</h2>
        <ul className="list-disc ml-6 space-y-1">
          <li>Operate FavorBank, show relevant favors, and prevent abuse.</li>
          <li>Send essential notifications and optional digests (you control preferences).</li>
          <li>Improve reliability (fraud detection, safety nudges).</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">What we don’t do</h2>
        <ul className="list-disc ml-6 space-y-1">
          <li>We do not sell your personal information.</li>
          <li>We avoid collecting more data than needed to run the service.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Location & SOS</h2>
        <p>
          If you tap SOS, we share your live coordinates with circle admins to help coordinate support.
          We do not track your location continuously — only when you explicitly use location features.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Data retention</h2>
        <p>
          We retain records needed for safety, accounting, and regulatory purposes.
          You can request deletion of your account; some records may persist as required by law.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Your choices</h2>
        <ul className="list-disc ml-6 space-y-1">
          <li>Manage notifications per circle in Settings.</li>
          <li>Limit location access in your device settings.</li>
          <li>Contact support to correct or export your data.</li>
        </ul>
      </section>
    </div>
  );
}

