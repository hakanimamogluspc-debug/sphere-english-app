/**
 * /.well-known/api-catalog — RFC 9727 API Catalog
 *
 * Linkset+json formatında Sphere English'in API'sini AI agent'larına ve
 * otomatik keşif araçlarına tanıtır. Her API entry için OpenAPI spec,
 * dokümantasyon ve health endpoint linkleri içerir.
 *
 * Spec:
 *   - RFC 9727: API Catalog
 *   - RFC 9264: Linkset format (application/linkset+json)
 */

export const dynamic = 'force-static';

export function GET() {
  const apiCatalog = {
    linkset: [
      {
        anchor: 'https://app.sphereenglish.com/api',
        'service-desc': [
          {
            href: 'https://app.sphereenglish.com/api/openapi.yaml',
            type: 'application/yaml',
            title: 'Sphere English API — OpenAPI 3.0 specification',
          },
        ],
        'service-doc': [
          {
            href: 'https://www.sphereenglish.com/api-docs',
            type: 'text/html',
            title: 'Sphere English API — Developer documentation',
          },
        ],
        status: [
          {
            href: 'https://app.sphereenglish.com/api/healthz',
            type: 'application/json',
            title: 'API health check endpoint',
          },
        ],
        'service-meta': [
          {
            href: 'https://www.sphereenglish.com/llms.txt',
            type: 'text/plain',
            title: 'AI-readable platform description',
          },
        ],
        terms: [
          {
            href: 'https://www.sphereenglish.com/kullanim-kosullari',
            type: 'text/html',
            title: 'Terms of service',
          },
        ],
        privacy: [
          {
            href: 'https://www.sphereenglish.com/gizlilik-politikasi',
            type: 'text/html',
            title: 'Privacy policy',
          },
        ],
      },
      {
        anchor: 'https://app.sphereenglish.com/api/widget.js',
        'service-desc': [
          {
            href: 'https://app.sphereenglish.com/api/widget.js',
            type: 'application/javascript',
            title: 'Sphere Asistan embeddable chatbot widget',
          },
        ],
        'service-doc': [
          {
            href: 'https://www.sphereenglish.com/llms.txt',
            type: 'text/plain',
            title: 'Widget integration & usage notes',
          },
        ],
      },
    ],
  };

  return new Response(JSON.stringify(apiCatalog, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/linkset+json',
      'Cache-Control': 'public, max-age=86400',
      // RFC 9727: Link header for self-reference
      Link: '<https://www.sphereenglish.com/.well-known/api-catalog>; rel="self"; type="application/linkset+json"',
    },
  });
}
