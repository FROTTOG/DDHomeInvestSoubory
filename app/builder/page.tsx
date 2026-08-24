'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /builder je historická adresa administrace – přesměrujeme na /admin.
 */
export default function BuilderPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin');
  }, [router]);

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
          className="text-[#c9a84c] animate-spin mx-auto mb-4"
          aria-hidden="true"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <p className="text-white/40 text-sm">Přesměrování do administrace…</p>
      </div>
    </div>
  );
}
