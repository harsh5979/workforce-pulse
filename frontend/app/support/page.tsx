import Link from 'next/link';
import { ArrowLeft, LifeBuoy } from 'lucide-react';

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col selection:bg-primary/20">
      <div className="flex-1 max-w-4xl mx-auto w-full p-6 sm:p-12">
        <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-12">
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-primary/10 rounded-none border border-primary/20 text-primary">
            <LifeBuoy className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Contact Support</h1>
            <p className="text-muted-foreground mt-1 font-mono text-sm uppercase tracking-wider">Workforce Pulse · Internal Support</p>
          </div>
        </div>

        <div className="bg-card border border-border p-8 rounded-none max-w-2xl">
          <h2 className="text-lg font-bold text-foreground mb-4">Need help with the platform?</h2>
          <ul className="space-y-4 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">ETL & Data Ingestion Issues:</strong> If your CSV uploads are failing the normalization checks, please ensure they match the required schema. Contact the Data Engineering team at <code>iomd.co@gmail.com</code> for pipeline support.
            </li>
            <li>
              <strong className="text-foreground">Access & Permissions:</strong> If you believe you should have access to a specific department's dashboard, request authorization via the internal IT Service Desk.
            </li>
            <li>
              <strong className="text-foreground">General Bugs:</strong> Please file a ticket in Jira under the <code>WORKFORCE-PULSE</code> project.
            </li>
          </ul>

          <div className="mt-8 pt-6 border-t border-border">
            <a href="mailto:iomd.co@gmail.com" className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground font-bold rounded-none hover:opacity-90 transition-opacity">
              Email IT Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
