'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Lock, Mail, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const login = useAuthStore((state) => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await login({ email, password });
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err) || 'Failed to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col selection:bg-primary/20">
      
      {/* Split Screen Container */}
      <div className="flex-1 flex flex-col lg:flex-row">
        
        {/* Left Side: Login Form */}
        <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-20 xl:px-24">
          <div className="mx-auto w-full max-w-sm lg:w-96">
            
            {/* Logo Header */}
            <div className="mb-10">
              <div className="w-12 h-12 bg-primary flex items-center justify-center mb-4 rounded-none">
                <img src="/workforce.svg" alt="Workforce Pulse Logo" className="w-8 h-8 object-contain invert brightness-0" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Sign In
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                Access your Workforce Pulse dashboard
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                
                {/* Email Input */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 bg-background border border-border text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground rounded-none transition-colors"
                      placeholder="name@company.com"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 bg-background border border-border text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground rounded-none transition-colors"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 flex items-start gap-2 rounded-none">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive font-medium">
                    {error}
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary text-primary-foreground font-semibold text-sm py-3 px-4 hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Company Intro (Hidden on mobile) */}
        <div className="hidden lg:flex flex-1 bg-foreground items-center justify-center relative overflow-hidden p-12">
          
          {/* Subtle Grid Background Pattern (Inherits from text color context) */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:24px_24px]" />
          
          <div className="max-w-md relative z-10">
            <h2 className="text-4xl font-extrabold text-background tracking-tight leading-tight mb-6">
              Drive operational excellence with real-time workforce intelligence.
            </h2>
            <p className="text-background/70 text-lg leading-relaxed mb-8">
              Workforce Pulse provides deep insights into employee productivity, automation opportunities, and resource allocation. Join thousands of teams optimizing their workflows today.
            </p>
            <div className="flex items-center gap-4 text-sm text-secondary font-medium border-l-2 border-secondary pl-4">
              &quot;The most critical operational tool we use.&quot; 
              <br/>&mdash; Operations Director
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full py-6 px-4 border-t border-border bg-card">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground font-medium">
            &copy; {new Date().getFullYear()} Workforce Pulse, Inc. All rights reserved.
          </p>
          <div className="flex gap-6 text-xs text-muted-foreground font-medium">
            <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-foreground transition-colors">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
