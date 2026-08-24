import { handleRequest } from '../src/admin-api.js';

/**
 * Cloudflare Pages – middleware pro dynamické části webu.
 *
 * Statické soubory (Next.js export ve složce out/) se servírují přímo z build outputu.
 * Tento middleware (běží před statickými soubory) zachytí pouze cesty,
 * které vyžadují D1/R2:
 *  - /api/*   – administrace a API (login, obsah, upload, kontakty)
 *  - /media/* – obrázky z R2
 *
 * Všechny ostatní požadavky projdou dál na statické soubory (context.next()).
 * Obsah webu si Next.js aplikace načítá za běhu z GET /api/content.
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
