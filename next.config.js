/** @type {import('next').NextConfig} */
const nextConfig = {
  // Statický export pro Cloudflare Pages (dynamiku řeší functions/_middleware.js)
  output: 'export',
  distDir: 'out',
  // Čisté URL bez .html – /admin/login se exportuje jako admin/login/index.html
  trailingSlash: true,
  images: {
    unoptimized: true, // Required for static export
  },
  reactStrictMode: true,
  // Pozn.: headers()/redirects() u statického exportu nefungují.
  // Bezpečnostní hlavičky řeší soubor public/_headers (Cloudflare Pages).
};

module.exports = nextConfig;
