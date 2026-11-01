/** @type {import('next').NextConfig} */
// Клиент всегда ходит на относительный /api. В проде это проксирует Caddy (см. deploy/Caddyfile).
// Если задан API_PROXY_TARGET (локальная разработка без Caddy) — проксируем /api сами.
const target = process.env.API_PROXY_TARGET;

module.exports = {
  reactStrictMode: true,
  async rewrites() {
    if (!target) return [];
    return [{ source: '/api/:path*', destination: `${target}/api/:path*` }];
  },
};
