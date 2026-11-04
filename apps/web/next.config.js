/** @type {import('next').NextConfig} */
// Клиент всегда ходит на относительный /api. В проде это проксирует Caddy (см. deploy/Caddyfile).
// Если задан API_PROXY_TARGET (локальная разработка без Caddy) — проксируем /api сами.
const target = process.env.API_PROXY_TARGET;

module.exports = {
  reactStrictMode: true,
  // /admin → раздел с окном входа (серверный 307; app/admin/page.tsx — запасной вариант).
  async redirects() {
    return [{ source: '/admin', destination: '/admin/stores', permanent: false }];
  },
  async rewrites() {
    if (!target) return [];
    return [{ source: '/api/:path*', destination: `${target}/api/:path*` }];
  },
};
