import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

export default function TermsPage() {
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
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Terms of Service</h1>
            <p className="text-muted-foreground mt-1 font-mono text-sm uppercase tracking-wider">Workforce Pulse · Internal Documentation</p>
          </div>
        </div>

        <div className="prose prose-slate dark:prose-invert prose-headings:font-extrabold prose-h2:text-2xl max-w-none text-muted-foreground">
          <h2>Acceptable Use</h2>
          <p>
            Access to the Workforce Pulse dashboard is restricted to authorized departmental leads and executive sponsors. 
            Data retrieved from this system is strictly confidential and must not be exported or distributed outside of the organization's secure perimeter.
          </p>
          <h2>System Misuse</h2>
          <p>
            Attempting to bypass role-based access controls or manipulate the CSV data ingestion pipelines will result in immediate revocation of access and potential disciplinary action.
          </p>
          <h2>AI Copilot Usage</h2>
          <p>
            The integrated AI Copilot utilizes a locally hosted or enterprise-secured LLM endpoint. Queries are monitored for compliance. Do not input unredacted PII or sensitive corporate secrets into the chat interface if using a public API fallback.
          </p>
        </div>
      </div>
    </div>
  );
}
