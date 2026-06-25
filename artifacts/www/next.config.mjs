import { withPayload } from '@payloadcms/next/withPayload';
import { imageHosts } from './image-hosts.config.js';

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: process.env.BASE_PATH || undefined,
  assetPrefix: process.env.BASE_PATH || undefined,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  experimental: {
    optimizeCss: true,
    reactCompiler: false,
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
    // RFC 8288 — AI agent keşfi için Link header'ları
    // Tek bir Link header'ı içine comma-separated multiple relations koyuyoruz
    const agentDiscoveryLink = [
      '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
      '</.well-known/agent-skills/index.json>; rel="https://agentskills.io/rel/skill-index"; type="application/json"',
      '</llms.txt>; rel="https://llmstxt.org/rel/llms"; type="text/plain"',
      '</pricing.md>; rel="https://schema.org/PriceSpecification"; type="text/markdown"',
      '</sitemap.xml>; rel="sitemap"; type="application/xml"',
      '</gizlilik-politikasi>; rel="privacy-policy"; type="text/html"',
      '</kullanim-kosullari>; rel="terms-of-service"; type="text/html"',
      '</iletisim>; rel="contact"; type="text/html"',
      '<https://app.sphereenglish.com/api/healthz>; rel="status"; type="application/json"',
    ].join(', ');

    return [
      {
        // Public site headers (admin paneli muaf)
        source: '/((?!admin|api).*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
          // AI agent discovery (RFC 8288 + RFC 9727 §3)
          { key: 'Link', value: agentDiscoveryLink },
          // Content negotiation hint — bu kaynak markdown alternatif olarak da sunulabilir
          { key: 'Vary', value: 'Accept' },
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

export default withPayload(nextConfig, { devBundleServerPackages: false });
