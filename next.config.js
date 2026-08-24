/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // For static export to deploy on Cloudflare Pages
  distDir: 'out',
  images: {
    unoptimized: true, // Required for static export
  },
  // Enable React Strict Mode
  reactStrictMode: true,
  // Headers for security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  // Redirects for clean URLs
  async redirects() {
    return [
      {
        source: '/admin/login/index.html',
        destination: '/admin/login',
        permanent: true,
      },
      {
        source: '/admin/index.html',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/builder/index.html',
        destination: '/builder',
        permanent: true,
      },
      {
        source: '/obchodni-podminky/index.html',
        destination: '/obchodni-podminky',
        permanent: true,
      },
      {
        source: '/pravni-informace/index.html',
        destination: '/pravni-informace',
        permanent: true,
      },
      {
        source: '/404/index.html',
        destination: '/404',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
