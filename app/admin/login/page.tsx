'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('dd_admin_session');
    if (token) {
      router.replace('/admin');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }), // Only sending password, not username
      });

      const data = await response.json();
      if (!response.ok || !data.token) {
        throw new Error(data.error || 'Přihlášení se nepodařilo.');
      }

      localStorage.setItem('dd_admin_session', data.token);
      setSuccess('Přihlášení proběhlo úspěšně, přesměrovávám…');
      router.replace('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Přihlášení se nepodařilo.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1020] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[rgba(14,24,43,0.88)] border border-[rgba(255,255,255,0.1)] rounded-2xl p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          {/* Brand */}
          <div className="flex flex-col items-center gap-4 mb-8 text-center">
            <div className="w-16 h-16 border border-[rgba(201,168,76,0.24)] rounded-xl flex items-center justify-center bg-[rgba(201,168,76,0.12)]">
              <span className="text-brass text-2xl font-bold tracking-wider">DD</span>
            </div>
            <div>
              <h1 className="text-white text-2xl font-bold tracking-wide">Administrace</h1>
              <p className="text-[rgba(255,255,255,0.58)] text-sm mt-1">D&D HOMEINVEST s.r.o.</p>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-6 border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.1)] text-[#fecaca] px-4 py-3 rounded-xl text-sm" role="alert">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-6 border border-[rgba(16,185,129,0.25)] bg-[rgba(16,185,129,0.1)] text-[#d1fae5] px-4 py-3 rounded-xl text-sm" role="alert">
              {success}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Only password field - username is hidden as requested */}
            <div className="space-y-2">
              <label className="text-[rgba(255,255,255,0.75)] text-sm">Heslo</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••••••"
                autoComplete="current-password"
                className="w-full px-4 py-3 bg-[rgba(8,16,32,0.85)] border border-[rgba(255,255,255,0.1)] rounded-xl text-white placeholder-[rgba(255,255,255,0.4)] focus:outline-none focus:border-[rgba(201,168,76,0.45)] focus:ring-1 focus:ring-[rgba(201,168,76,0.1)] transition-all"
                disabled={isLoading}
              />
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-brass text-navy font-bold rounded-xl hover:bg-[var(--brass-light)] active:translate-y-px transition-all duration-150 disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="animate-spin"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Přihlašuji...
                </>
              ) : (
                'Přihlásit se'
              )}
            </button>

            {/* Back link */}
            <div className="pt-2">
              <Link
                href="/"
                className="w-full flex items-center justify-center gap-2 py-3 border border-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.58)] rounded-xl hover:bg-[rgba(255,255,255,0.05)] transition-colors"
              >
                ← Zpět na web
              </Link>
            </div>
          </form>

          {/* Hint */}
          <p className="mt-6 text-center text-[rgba(255,255,255,0.4)] text-xs leading-relaxed">
            Přihlášení je ověřováno na serveru (D1) a administrace používá D1 + R2.
          </p>
        </div>
      </div>
    </div>
  );
}
