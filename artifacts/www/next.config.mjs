import { imageHosts } from './image-hosts.config.js';

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  experimental: {
    optimizeCss: true,
  },
  distDir: process.env.DIST_DIR || '.next',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: imageHosts,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://app.sphereenglish.com https://www.google-analytics.com https://region1.google-analytics.com",
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self' https://app.sphereenglish.com",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        // sphereenglish.com → www.sphereenglish.com (SEO canonical redirect)
        source: '/:path*',
        has: [{ type: 'host', value: 'sphereenglish.com' }],
        destination: 'https://www.sphereenglish.com/:path*',
        permanent: true,
      },
      {
        source: '/',
        destination: '/home',
        permanent: false,
      },
    ];
  },
};
// Note: @dhiwise/component-tagger webpack plugin removed — caused 270ms TBT in production

export default nextConfig;
