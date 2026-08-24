import { handleRequest } from '../src/admin-api.js';

/**
 * Cloudflare Pages – middleware pro dynamické části webu.
 *
 * Statické soubory (celý web) se servírují přímo z build outputu.
 * Tento middleware (běží před statickými soubory) zachytí pouze cesty,
 * které vyžadují D1/R2:
 *  - /api/*                            – administrace a API (login, obsah, upload, kontakty)
 *  - /media/*                          – obrázky z R2
 *  - /_next/static/chunks/580.*.js     – dynamický chunk obsahu webu z D1
 *
 * Všechny ostatní požadavky projdou dál na statické soubory (context.next()).
 */
export async function onRequest(context) {
  try {
    const response = await handleRequest(context.request, context.env);
    if (response) {
      return response;
    }
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      },
    );
  }

  return context.next();
}
