'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('dd_admin_session');
    if (!token) {
      router.push('/admin/login');
    }
    // In a real application, you would verify the token with the server
    // For now, we'll just check if it exists
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0a1020] flex items-center justify-center p-4">
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
