import ScanGmailClient from "@/components/ScanGmailClient";

export default function DashboardPage() {
return (
<main className="p-6 space-y-6">
<h1 className="text-2xl font-bold">Dashboard</h1>
<ScanGmailClient />
{/* Voeg hier je bestaande "Companies found" rendering toe met data uit de DB */}
</main>
);
}