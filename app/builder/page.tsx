'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BuilderPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('dd_admin_session');
    if (!token) {
      router.push('/admin/login');
    } else {
      // Verify token (in a real app, this would be an API call)
      setIsLoading(false);
    }
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a1020] flex items-center justify-center">
        <div className="text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-loader-circle text-[#c9a84c] animate-spin mx-auto mb-4"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <p className="text-white/40 text-sm">Kontrola přihlášení...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1020]">
      <main className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="font-heading text-4xl font-bold text-white mb-4">Builder Panel</h1>
          <p className="text-white/60">Administrační rozhraní pro správu obsahu</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-[rgba(14,24,43,0.88)] border border-[rgba(255,255,255,0.1)] rounded-xl p-6 hover:border-brass/30 transition-colors">
            <h2 className="text-white font-semibold mb-2">Projekty</h2>
            <p className="text-white/40 text-sm mb-4">Správa projektů a nemovitostí</p>
            <button className="text-brass text-sm hover:text-brass-light transition-colors">Zobrazit →</button>
          </div>

          <div className="bg-[rgba(14,24,43,0.88)] border border-[rgba(255,255,255,0.1)] rounded-xl p-6 hover:border-brass/30 transition-colors">
            <h2 className="text-white font-semibold mb-2">Uživatelé</h2>
            <p className="text-white/40 text-sm mb-4">Správa uživatelů a práv</p>
            <button className="text-brass text-sm hover:text-brass-light transition-colors">Zobrazit →</button>
          </div>

          <div className="bg-[rgba(14,24,43,0.88)] border border-[rgba(255,255,255,0.1)] rounded-xl p-6 hover:border-brass/30 transition-colors">
            <h2 className="text-white font-semibold mb-2">Nastavení</h2>
            <p className="text-white/40 text-sm mb-4">Nastavení webových stránek</p>
            <button className="text-brass text-sm hover:text-brass-light transition-colors">Zobrazit →</button>
          </div>
        </div>
      </main>
    </div>
  );
}
