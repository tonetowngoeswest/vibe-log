import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  trailingSlash: true,
  poweredByHeader: false,
  logging: { incomingRequests: { ignore: [/\/auth\/(callback|confirm)/] }, serverFunctions: false },
  async headers() {
    return [
      { source: '/:path*', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
      ] },
      ...['/editor/:path*', '/admin/:path*', '/api/:path*', '/account/:path*', '/reset-password/:path*', '/auth/:path*'].map(source => ({ source, headers: [
        { key: 'Cache-Control', value: 'private, no-store' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
      ] })),
    ];
  },
};
export default nextConfig;
