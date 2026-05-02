/* One-time seed endpoint. Protected by SEED_TOKEN env var.
 * Trigger: curl -X POST http://localhost:3000/api/_seed -H "x-seed-token: $SEED_TOKEN"
 * Idempotent — safe to run multiple times.
 */
import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { SOLUTIONS, HOMEPAGE } from '@/payload/seed-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const token = req.headers.get('x-seed-token');
  const expected = process.env.SEED_TOKEN
    || (process.env.NODE_ENV !== 'production' ? 'dev-seed-only' : null);
  if (!expected) {
    return NextResponse.json(
      { error: 'SEED_TOKEN env var must be set in production.' },
      { status: 503 }
    );
  }
  if (token !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const payload = await getPayload({ config });
  const log: string[] = [];

  // Solutions
  let inserted = 0;
  let skipped = 0;
  for (const sol of SOLUTIONS) {
    const existing = await payload.find({
      collection: 'solutions',
      where: { slug: { equals: sol.slug } },
      limit: 1,
    });
    if (existing.docs.length > 0) {
      skipped++;
      continue;
    }
    await payload.create({
      collection: 'solutions',
      data: {
        title: sol.title,
        slug: sol.slug,
        category: sol.category as any,
        description: sol.description,
        body: sol.body.map((paragraph) => ({ paragraph })),
        highlights: sol.highlights.map((item) => ({ item })),
        ctaText: sol.ctaText,
      },
    });
    inserted++;
  }
  log.push(`Solutions — eklenen: ${inserted}, atlanan: ${skipped}`);

  // HomePage global
  await payload.updateGlobal({ slug: 'home-page', data: HOMEPAGE as any });
  log.push('HomePage — güncellendi');

  return NextResponse.json({ ok: true, log });
}
