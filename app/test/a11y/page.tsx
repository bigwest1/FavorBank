"use client";

import { useEffect, useState } from 'react';

export default function A11yTestPage() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.2/axe.min.js';
    s.async = true;
    s.onload = () => {
      // @ts-ignore
      if (window.axe) {
        // @ts-ignore
        window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }).then((res: any) => {
          setResult(res);
        }).catch((e: any) => setError(e?.message || 'axe.run failed'));
      } else {
        setError('axe-core not available');
      }
    };
    s.onerror = () => setError('Failed to load axe-core (network)');
    document.body.appendChild(s);
    return () => { document.body.removeChild(s); };
  }, []);

  return (
    <div className="container mx-auto py-6 space-y-4">
      <h1 className="text-2xl font-semibold">Accessibility Audit (axe-core)</h1>
      {!result && !error && <p>Loading axe-core and running audit…</p>}
      {error && (
        <div className="text-sm text-red-700">
          {error}. You can also use the axe browser extension to audit the current page.
        </div>
      )}
      {result && (
        <div className="space-y-2 text-sm">
          <div>Violations: <strong>{result.violations.length}</strong></div>
          <ul className="list-disc ml-5">
            {result.violations.map((v: any) => (
              <li key={v.id}>
                <span className="font-medium">{v.id}</span>: {v.description} ({v.impact})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

