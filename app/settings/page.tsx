export const runtime = "edge";

import SettingsClient from "./settings-client";

export const metadata = {
  title: "Settings — Disco Druif",
  description: "Manage your connections and privacy settings.",
};

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-3xl font-semibold mb-6">Settings</h1>
      <p className="mb-6">
        Manage your connections and privacy options. You can disconnect Gmail
        and remove the app’s access at any time.
      </p>
      <SettingsClient />
    </main>
  );
}