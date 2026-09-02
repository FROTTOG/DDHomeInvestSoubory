'use client';

import { useEffect, useState } from 'react';
// Sdílený JS modul s Cloudflare Functions (výchozí obsah webu)
import { DEFAULT_CONTENT, withComputedDefaults } from '../../src/default-content.js';

/**
 * Načte obsah webu z /api/content (Cloudflare Pages Function + D1).
 * Dokud data nedorazí (nebo když API není dostupné, např. v `next dev`
 * bez wrangleru), používá výchozí obsah ze src/default-content.js.
 */
export function useSiteContent() {
  const [content, setContent] = useState<any>(() => withComputedDefaults(DEFAULT_CONTENT));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const preview = new URLSearchParams(window.location.search).get('preview') === '1';
    const token = preview ? localStorage.getItem('dd_admin_session') : '';
    fetch(preview ? '/api/draft' : '/api/content', {
      cache: 'no-store',
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data === 'object' && data.siteConfig) {
          setContent(withComputedDefaults(data));
        }
      })
      .catch(() => {
        /* offline / dev bez API – zůstávají výchozí data */
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { content, loaded };
}
