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
    // Dynamický sitemap zahrnuje projekty uložené v D1.
    const routedRequest = path === '/sitemap.xml'
      ? new Request(new URL('/api/sitemap.xml', request.url), request)
      : request;
    const response = await handleRequest(routedRequest, env, {
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

  // Hezké dynamické URL projektu obslouží jedna šablona. Metadata se vkládají
  // na edge, takže sdílení i vyhledávače dostanou titulek konkrétního projektu.
  if (/^\/projekty\/[^/]+\/?$/.test(path)) {
    const slug = decodeURIComponent(path.split('/').filter(Boolean).pop() || '');
    const contentResponse = await handleRequest(new Request(new URL('/api/content', request.url)), env);
    const content = contentResponse?.ok ? await contentResponse.json() : null;
    const allProjects = [...(content?.currentProjects || []), ...(content?.soldProjects || [])];
    const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const project = allProjects.find((item) => (item.slug || normalize(item.title)) === slug);
    const shellUrl = new URL('/projekty/', request.url);
    const shell = await context.next(new Request(shellUrl, request));
    if (!project || !shell.ok) return shell;
    const esc = (value) => String(value || '').replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
    const title = `${project.title} | D&D HOMEINVEST s.r.o.`;
    const description = String(project.descriptionLong || project.description || '').slice(0, 160);
    const canonical = new URL(path, request.url).href;
    let html = await shell.text();
    html = html.replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>`)
      .replace('</head>', `<meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}">${project.images?.[0] ? `<meta property="og:image" content="${new URL(project.images[0], request.url).href}">` : ''}</head>`);
    const headers = new Headers(shell.headers);
    headers.delete('content-length'); headers.set('content-type', 'text/html; charset=utf-8');
    return new Response(html, { status: shell.status, headers });
  }

  return context.next();
}
