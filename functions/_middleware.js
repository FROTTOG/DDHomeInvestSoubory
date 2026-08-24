import { handleRequest } from '../src/admin-api.js';

/**
 * Cloudflare Pages – middleware pro dynamické části webu.
 *
 * Statické soubory (Next.js export ve složce out/) se servírují přímo z build outputu.
 * Tento middleware (běží před statickými soubory) zachytí pouze cesty,
 * které vyžadují D1/R2:
 *  - /api/*   – administrace a API (login, obsah, upload, kontakty, health)
 *  - /media/* – obrázky z R2
 *
 * Všechny ostatní požadavky projdou dál na statické soubory (context.next()).
 * Obsah webu si Next.js aplikace načítá za běhu z GET /api/content.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const path = new URL(request.url).pathname;

  try {
    const response = await handleRequest(request, env, {
      // práce na pozadí (např. přeposlání kontaktního formuláře na Formspree)
      waitUntil: (promise) => {
        if (typeof context.waitUntil === 'function') context.waitUntil(promise);
      },
    });
    if (response) {
      return response;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[pages] ${request.method} ${path} selhalo:`, message);

    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message,
        hint: 'Diagnostika bindingů a tabulek: /api/health',
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      },
    );
  }

  return context.next();
}
