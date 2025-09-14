export const runtime = "edge";

export const metadata = {
  title: "Privacy Policy — Disco Druif",
  description:
    "How Disco Druif collects and uses data to help you discover which companies hold your data and to send DSAR emails.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-3xl font-semibold mb-6">Privacy Policy</h1>

      <p className="mb-4 text-sm text-gray-500">
        Effective date: {new Date().toISOString().slice(0, 10)}
      </p>

      <p className="mb-4">
        Disco Druif ("we", "us", "our") helps you discover which companies may
        hold your personal data and lets you send data subject access or
        deletion requests ("DSARs"). This policy explains what we collect, why,
        and your choices.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">Data we collect</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Account / form details:</strong> email address and (optional)
          name, to build and send your DSAR emails and to contact you about
          your requests.
        </li>
        <li>
          <strong>DSAR content:</strong> the message we generate (subject, body,
          recipients) and delivery status (e.g. sent, bounced).
        </li>
        <li>
          <strong>Gmail discovery (optional):</strong> if you connect Gmail,
          we request the read-only scope{" "}
          <code>gmail.readonly</code>. We only read lightweight metadata to
          detect sender domains (e.g. "From" / "Return-Path" headers) and never
          store or process message bodies. You can revoke access at any time in
          your Google Account.
        </li>
        <li>
          <strong>Technical logs:</strong> IP address, timestamps and basic
          event logs for security (rate-limiting, abuse prevention) and to keep
          the service running.
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-3">How we use data</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>To find privacy contacts (email or forms) for companies.</li>
        <li>To compose and send your DSAR emails on your behalf.</li>
        <li>To show delivery/bounce status and improve contact quality.</li>
        <li>To secure the service and prevent spam/abuse.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-3">Legal bases</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Consent</strong> — for optional Gmail discovery and for
          contacting you.
        </li>
        <li>
          <strong>Performance of a contract</strong> — to provide the DSAR
          service you request.
        </li>
        <li>
          <strong>Legitimate interests</strong> — to secure and improve the app.
        </li>
        <li>
          <strong>Legal obligation</strong> — to keep minimal records required
          by law.
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-3">Processors we use</h2>
      <p className="mb-4">
        We host on Vercel; store data in Supabase; send email via Resend; and
        use Upstash for rate-limiting/queueing. These providers may process data
        on our behalf in the EU/US under appropriate safeguards (e.g. SCCs).
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">Retention</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>DSAR request logs: up to 12 months (or until you ask us to delete).</li>
        <li>Gmail tokens: until you revoke access or delete your connection.</li>
        <li>Operational logs: short-lived, for security and debugging.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-3">Your rights</h2>
      <p className="mb-4">
        Under GDPR (and similar laws), you can request access, correction,
        deletion, restriction or portability of your data, and object to
        processing. You may revoke Gmail access in your Google Account at any
        time. Contact us using the details below.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">Children</h2>
      <p className="mb-4">This service is not intended for users under 16.</p>

      <h2 className="text-xl font-semibold mt-8 mb-3">Contact</h2>
      <p className="mb-4">
        Email: <a className="underline" href="mailto:discodruif@gmail.com">discodruif@gmail.com</a>
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">Changes</h2>
      <p>
        We may update this policy; we'll post the new version here and adjust
        the effective date above.
      </p>
    </main>
  );
}
