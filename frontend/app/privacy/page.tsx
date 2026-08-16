import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col selection:bg-primary/20">
      <div className="flex-1 max-w-4xl mx-auto w-full p-6 sm:p-12">
        <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-12">
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-primary/10 rounded-none border border-primary/20 text-primary">
            <img src="/workforce.svg" alt="Workforce Pulse Logo" className="w-8 h-8 object-contain dark:invert dark:brightness-0" />
          </div>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Privacy Policy</h1>
            <p className="text-muted-foreground mt-1 font-mono text-sm uppercase tracking-wider">Workforce Pulse · Internal Documentation</p>
          </div>
        </div>

        <div className="prose prose-slate dark:prose-invert prose-headings:font-extrabold prose-h2:text-2xl max-w-none text-muted-foreground">
          <h2>Data Collection & Telemetry</h2>
          <p>
            Workforce Pulse operates on an opt-in basis for activity logging. Data collected via the internal extensions or CSV uploads remains strictly within the organization's firewall. 
            No data is transmitted to third-party vendors without explicit cryptographic hashing and sanitization.
          </p>
          <h2>Data Anonymization</h2>
          <p>
            User activity is automatically mapped to Employee IDs (e.g. E001) rather than Personal Identifiable Information (PII) during the ETL ingestion process. 
            Leadership views are aggregated by Department and Category to prevent micro-surveillance.
          </p>
          <h2>Retention</h2>
          <p>
            Raw CSV logs are retained for a rolling 90-day window, after which they are condensed into weekly aggregate metrics and the raw row-level telemetry is securely expunged.
          </p>
        </div>
      </div>
    </div>
  );
}
