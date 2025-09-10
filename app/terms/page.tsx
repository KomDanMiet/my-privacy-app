// app/terms/page.tsx
export const runtime = "edge";

export const metadata = {
  title: "Terms of Service — Disco Druif",
  description:
    "Terms of Service for Disco Druif, the app that helps you discover companies that hold your data and send DSAR emails.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-3xl font-semibold mb-6">Terms of Service</h1>

      <p className="mb-4 text-sm text-gray-500">
        Last updated: {new Date().toISOString().slice(0, 10)}
      </p>

      <p className="mb-4">
        These Terms of Service (“Terms”) govern your access to and use of Disco
        Druif (“we”, “us”, “our”) and the services offered at{" "}
        <span className="font-mono">discodruif.com</span> (the “Service”).
        By using the Service, you agree to these Terms.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">1. The Service</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          The Service helps you discover which companies may hold your personal
          data and to compose/send Data Subject Access/Deletion Requests
          (“DSARs”) on your behalf.
        </li>
        <li>
          Optional: you may connect your Google account with the{" "}
          <code>gmail.readonly</code> scope to analyze sender metadata (e.g.
          headers/domains) to build a list of likely companies. We do not write,
          delete, or modify your email.
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-3">2. Your Responsibilities</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          You confirm you are the owner of the email address used and that you
          have the right to send DSARs.
        </li>
        <li>
          You must use the Service in compliance with applicable laws (e.g.
          GDPR/AVG). You remain responsible for the content of your requests.
        </li>
        <li>
          You will not attempt to abuse, overload, or interfere with the
          Service, nor use it for spam or harassment.
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        3. Data & Permissions
      </h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          We process limited account/form data (email and optional name), DSAR
          messages (subject/body/recipient), and delivery events. Details are in
          our <a className="underline" href="/privacy">Privacy Policy</a>.
        </li>
        <li>
          Gmail connection (optional) uses <code>gmail.readonly</code>. We read
          lightweight metadata (e.g. “From”, Return-Path, domain) to detect
          companies. We do not store message bodies or attachments. You can
          revoke access any time in your Google Account.
        </li>
        <li>
          We use third-party processors (e.g. Vercel, Supabase, Resend, Upstash)
          to operate the Service.
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-3">4. Fair Use & Limits</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          We may apply rate limits or temporarily restrict usage to protect the
          Service and recipients from abuse.
        </li>
        <li>
          We may refuse service where unlawful or where automated abuse is
          detected.
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-3">5. No Legal Advice</h2>
      <p className="mb-4">
        The Service is provided for convenience and does not constitute legal
        advice. You should consult a lawyer for legal guidance.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        6. Disclaimers & Liability
      </h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          THE SERVICE IS PROVIDED “AS IS” WITHOUT WARRANTIES OF ANY KIND. We do
          not guarantee outcomes, delivery, or responses from recipients.
        </li>
        <li>
          To the maximum extent permitted by law, we are not liable for indirect
          or consequential damages, loss of data, or loss of business arising
          from use of the Service.
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-3">7. Termination</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          You may stop using the Service at any time and revoke Gmail access in
          your Google Account.
        </li>
        <li>
          We may suspend or terminate access for misuse, security reasons, or
          non-compliance with these Terms.
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-3">8. Governing Law</h2>
      <p className="mb-4">
        These Terms are governed by the laws of the Netherlands, without regard
        to conflict-of-law rules. Disputes will be submitted to the competent
        courts in the Netherlands.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">9. Contact</h2>
      <p className="mb-4">
        Email:{" "}
        <a className="underline" href="mailto:discodruif@gmail.com">
          discodruif@gmail.com
        </a>
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">10. Changes</h2>
      <p>
        We may update these Terms; we’ll post the new version here and update
        the date above.
      </p>
    </main>
  );
}
