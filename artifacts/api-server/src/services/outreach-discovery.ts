/**
 * Outreach Discovery Servisi
 *
 * 4 segment için Apify actor'larını çalıştırır, sonuçları normalize eder,
 * email bazlı duplikasyon kontrolüyle outreach_leads tablosuna yazar.
 *
 * Segmentler:
 *  - b2b_hr      → İK / Eğitim müdürleri (LinkedIn)
 *  - b2b_sme     → KOBİ sahip/CEO (LinkedIn)
 *  - b2c_pro     → Senior profesyoneller (LinkedIn)
 *  - partner     → Dil okulu / eğitim kurumu (Google Maps)
 */

import {
  db,
  outreachLeadsTable,
  outreachRunsTable,
  type OutreachSegment,
  type InsertOutreachLead,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { ApifyClient, getApifyClient } from "./apify-client.js";

// ─── Tipler ───────────────────────────────────────────────────────────────
type LinkedInPersonRaw = {
  // İsim (farklı aktörler farklı alan adları kullanır)
  fullName?: string;
  firstName?: string;
  lastName?: string;
  name?: string | { first?: string; last?: string; full?: string };

  // Pozisyon
  headline?: string;
  jobTitle?: string;
  position?: string;
  title?: string;
  currentPosition?: { title?: string; company?: string; companyUrl?: string };

  // LinkedIn URL
  publicIdentifier?: string;
  profileUrl?: string;
  url?: string;
  linkedinUrl?: string;

  // Email (harvestapi 'Full + email search' modunda)
  email?: string;
  emails?: string[];
  emailAddress?: string;

  // Lokasyon
  location?: string | { name?: string; country?: string };
  geoLocationName?: string;
  locationName?: string;

  // Şirket
  companyName?: string;
  company?: string | { name?: string; industry?: string; website?: string; url?: string };
  currentCompany?: { name?: string; industry?: string; website?: string; url?: string };
  companyUrl?: string;
  companyWebsite?: string;

  // Diğer
  industry?: string;
  seniority?: string;
};

type GoogleMapsRaw = {
  title?: string;
  name?: string;
  address?: string;
  city?: string;
  phone?: string;
  phoneUnformatted?: string;
  website?: string;
  url?: string;
  emails?: string[];
  categoryName?: string;
};

// ─── Konfigürasyon ────────────────────────────────────────────────────────

/**
 * Her segment için Apify actor + arama input'u.
 *
 * NOT: Apify actor'ları zaman içinde input şemalarını değiştirebilir.
 * Eğer actor güncellenirse, bu input'lar da güncellenmeli.
 */
export const SEGMENT_CONFIGS: Record<
  OutreachSegment,
  {
    actorId: string;
    buildInput: (limit: number) => Record<string, unknown>;
    parser: "linkedin_people" | "gmaps";
    description: string;
  }
> = {
  b2b_hr: {
    actorId: "harvestapi/linkedin-profile-search",
    parser: "linkedin_people",
    description: "Türkiye'deki İK / Eğitim / L&D müdürleri",
    buildInput: (limit) => ({
      profileScraperMode: "Full + email search",
      search: "HR Manager OR İK Müdürü OR Training Manager OR L&D",
      currentJobTitles: ["HR Manager", "İK Müdürü", "Training Manager", "Learning and Development Manager", "Eğitim Müdürü"],
      locations: ["Turkey"],
      takePages: Math.max(1, Math.ceil(limit / 25)), // 25 sonuç/sayfa
      startPage: 1,
    }),
  },
  b2b_sme: {
    actorId: "harvestapi/linkedin-profile-search",
    parser: "linkedin_people",
    description: "Türkiye'deki KOBİ kurucu / CEO / Genel Müdür",
    buildInput: (limit) => ({
      profileScraperMode: "Full + email search",
      search: "Founder OR CEO OR Kurucu OR Genel Müdür",
      currentJobTitles: ["Founder", "CEO", "Co-Founder", "Genel Müdür", "Yönetici Ortak", "Managing Director"],
      locations: ["Turkey"],
      takePages: Math.max(1, Math.ceil(limit / 25)),
      startPage: 1,
    }),
  },
  b2c_pro: {
    actorId: "harvestapi/linkedin-profile-search",
    parser: "linkedin_people",
    description: "Senior bireysel profesyoneller (mühendis, yönetici, avukat, doktor)",
    buildInput: (limit) => ({
      profileScraperMode: "Full + email search",
      search: "Senior OR Lead OR Director OR Müdür",
      currentJobTitles: ["Senior Engineer", "Engineering Manager", "Director", "Senior Manager", "Müdür"],
      locations: ["Turkey"],
      takePages: Math.max(1, Math.ceil(limit / 25)),
      startPage: 1,
    }),
  },
  partner: {
    actorId: "compass/crawler-google-places",
    parser: "gmaps",
    description: "Türkiye'deki dil okulları ve özel kurslar",
    buildInput: (limit) => ({
      searchStringsArray: ["İngilizce kursu Türkiye", "dil okulu İstanbul", "İngilizce kursu Ankara", "İngilizce kursu İzmir"],
      maxCrawledPlacesPerSearch: Math.ceil(limit / 4),
      language: "tr",
      countryCode: "tr",
      scrapeContacts: true,
    }),
  },
};

// ─── Parser'lar ───────────────────────────────────────────────────────────

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

function extractDomain(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/**
 * Email değeri string veya {value: "..."} / {email: "..."} / {address: "..."} object olabilir.
 * Apify aktörlerine göre format değişir.
 */
function coerceToEmailString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const obj = v as Record<string, unknown>;
    const candidates = [obj.value, obj.email, obj.address, obj.emailAddress];
    for (const c of candidates) {
      if (typeof c === "string") return c;
    }
  }
  return undefined;
}

function pickEmail(emails: unknown, fallback?: unknown): string | undefined {
  const arr = Array.isArray(emails) ? emails : [];
  const fallbackStr = coerceToEmailString(fallback);

  const stringEmails = arr
    .map((e) => coerceToEmailString(e))
    .filter((e): e is string => !!e);
  if (fallbackStr) stringEmails.push(fallbackStr);

  // Generic mailbox'ları tercih etme — kişisel olanları öne al
  const sorted = stringEmails
    .map((e) => e.trim().toLowerCase())
    .filter((e) => EMAIL_REGEX.test(e))
    .sort((a, b) => {
      const aGeneric = /^(info|contact|hello|support|admin|sales|hr|kariyer)@/.test(a) ? 1 : 0;
      const bGeneric = /^(info|contact|hello|support|admin|sales|hr|kariyer)@/.test(b) ? 1 : 0;
      return aGeneric - bGeneric;
    });
  return sorted[0];
}

function inferSeniority(title: string | undefined): string | undefined {
  if (!title) return undefined;
  const t = title.toLowerCase();
  if (/(ceo|cto|cfo|coo|founder|kurucu|genel m[uü]d[uü]r|chief)/i.test(t)) return "c-level";
  if (/(director|director|vp|head of|y[oö]netici)/i.test(t)) return "senior";
  if (/(senior|lead|m[uü]d[uü]r|principal)/i.test(t)) return "senior";
  if (/(junior|intern|stajyer)/i.test(t)) return "junior";
  return "mid";
}

function parseLinkedInPerson(raw: LinkedInPersonRaw, segment: OutreachSegment): InsertOutreachLead | null {
  const email = pickEmail(raw.emails, raw.email ?? raw.emailAddress);
  if (!email) return null; // email yoksa atla — değerli değil

  // İsim: birkaç olası format
  let firstName = raw.firstName;
  let lastName = raw.lastName;
  let fullName: string | undefined = raw.fullName;
  if (typeof raw.name === "string") {
    fullName = fullName ?? raw.name;
  } else if (raw.name && typeof raw.name === "object") {
    firstName = firstName ?? raw.name.first;
    lastName = lastName ?? raw.name.last;
    fullName = fullName ?? raw.name.full;
  }
  if (!fullName && (firstName || lastName)) {
    fullName = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  }

  // Pozisyon
  const jobTitle =
    raw.headline ??
    raw.jobTitle ??
    raw.position ??
    raw.title ??
    raw.currentPosition?.title;

  // LinkedIn URL
  const linkedinUrl =
    raw.linkedinUrl ??
    raw.profileUrl ??
    raw.url ??
    (raw.publicIdentifier ? `https://linkedin.com/in/${raw.publicIdentifier}` : undefined);

  // Şirket
  let company: string | undefined;
  let companyWebsite: string | undefined;
  let industry: string | undefined = raw.industry;
  if (typeof raw.company === "string") {
    company = raw.company;
  } else if (raw.company && typeof raw.company === "object") {
    company = raw.company.name;
    companyWebsite = raw.company.website ?? raw.company.url;
    industry = industry ?? raw.company.industry;
  }
  company = company ?? raw.companyName ?? raw.currentCompany?.name ?? raw.currentPosition?.company;
  companyWebsite =
    companyWebsite ??
    raw.companyWebsite ??
    raw.currentCompany?.website ??
    raw.currentCompany?.url ??
    raw.companyUrl ??
    raw.currentPosition?.companyUrl;
  industry = industry ?? raw.currentCompany?.industry;
  const companyDomain = extractDomain(companyWebsite);

  // Lokasyon
  let location: string | undefined;
  if (typeof raw.location === "string") {
    location = raw.location;
  } else if (raw.location && typeof raw.location === "object") {
    location = raw.location.name ?? raw.location.country;
  }
  location = location ?? raw.locationName ?? raw.geoLocationName;

  return {
    email,
    firstName,
    lastName,
    fullName: fullName || undefined,
    linkedinUrl,
    jobTitle,
    seniority: inferSeniority(jobTitle),
    location,
    company,
    companyDomain,
    companyWebsite,
    industry,
    segment,
    source: "apify_linkedin_people",
    sourceUrl: linkedinUrl,
    rawData: raw as any,
  };
}

function parseGoogleMaps(raw: GoogleMapsRaw, segment: OutreachSegment): InsertOutreachLead | null {
  const email = pickEmail(raw.emails);
  if (!email) return null;

  const company = raw.title ?? raw.name;

  return {
    email,
    fullName: undefined,
    company,
    companyDomain: extractDomain(raw.website),
    companyWebsite: raw.website,
    companyPhone: raw.phone ?? raw.phoneUnformatted,
    location: raw.address ?? raw.city,
    industry: raw.categoryName ?? "Eğitim",
    segment,
    source: "apify_gmaps",
    sourceUrl: raw.url,
    rawData: raw as any,
  };
}

// ─── Ana keşif fonksiyonları ─────────────────────────────────────────────

export interface DiscoverySegmentResult {
  segment: OutreachSegment;
  runId: number;
  itemsScraped: number;
  leadsAdded: number;
  leadsUpdated: number;
  leadsSkipped: number;
  errorMessage?: string;
}

/**
 * Tek bir segment için keşif çalıştır.
 */
export async function discoverSegment(
  segment: OutreachSegment,
  options: { limit?: number; client?: ApifyClient } = {},
): Promise<DiscoverySegmentResult> {
  const limit = options.limit ?? 50;
  const config = SEGMENT_CONFIGS[segment];

  // Run kaydı oluştur
  const [run] = await db
    .insert(outreachRunsTable)
    .values({
      jobType: "discovery",
      segment,
      status: "running",
      apifyActorId: config.actorId,
    })
    .returning();

  const client = options.client ?? getApifyClient();
  if (!client) {
    await db
      .update(outreachRunsTable)
      .set({
        status: "failed",
        errorMessage: "APIFY_API_TOKEN tanımlı değil",
        completedAt: new Date(),
      })
      .where(eq(outreachRunsTable.id, run.id));
    return {
      segment,
      runId: run.id,
      itemsScraped: 0,
      leadsAdded: 0,
      leadsUpdated: 0,
      leadsSkipped: 0,
      errorMessage: "APIFY_API_TOKEN tanımlı değil",
    };
  }

  try {
    const input = config.buildInput(limit);
    const { runInfo, items } = await client.runActorSync<LinkedInPersonRaw | GoogleMapsRaw>(
      config.actorId,
      input,
      600, // 10dk timeout
    );

    let added = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of items) {
      let parsed: InsertOutreachLead | null = null;
      if (config.parser === "linkedin_people") {
        parsed = parseLinkedInPerson(item as LinkedInPersonRaw, segment);
      } else if (config.parser === "gmaps") {
        parsed = parseGoogleMaps(item as GoogleMapsRaw, segment);
      }

      if (!parsed) {
        skipped++;
        continue;
      }

      parsed.sourceRunId = runInfo.runId;

      // Email bazlı UPSERT — duplikasyon kontrolü
      const result = await db
        .insert(outreachLeadsTable)
        .values(parsed)
        .onConflictDoUpdate({
          target: outreachLeadsTable.email,
          set: {
            lastSeenAt: new Date(),
            updatedAt: new Date(),
            // Eksik alanları güncelle (mevcut değer NULL ise)
            firstName: sql`COALESCE(${outreachLeadsTable.firstName}, EXCLUDED.first_name)`,
            lastName: sql`COALESCE(${outreachLeadsTable.lastName}, EXCLUDED.last_name)`,
            fullName: sql`COALESCE(${outreachLeadsTable.fullName}, EXCLUDED.full_name)`,
            linkedinUrl: sql`COALESCE(${outreachLeadsTable.linkedinUrl}, EXCLUDED.linkedin_url)`,
            jobTitle: sql`COALESCE(${outreachLeadsTable.jobTitle}, EXCLUDED.job_title)`,
            company: sql`COALESCE(${outreachLeadsTable.company}, EXCLUDED.company)`,
            companyDomain: sql`COALESCE(${outreachLeadsTable.companyDomain}, EXCLUDED.company_domain)`,
            companyWebsite: sql`COALESCE(${outreachLeadsTable.companyWebsite}, EXCLUDED.company_website)`,
            companyPhone: sql`COALESCE(${outreachLeadsTable.companyPhone}, EXCLUDED.company_phone)`,
            industry: sql`COALESCE(${outreachLeadsTable.industry}, EXCLUDED.industry)`,
            location: sql`COALESCE(${outreachLeadsTable.location}, EXCLUDED.location)`,
          },
        })
        .returning({ id: outreachLeadsTable.id, discoveredAt: outreachLeadsTable.discoveredAt });

      // Yeni mi yoksa güncellenmiş mi? discoveredAt'i kontrol ediyoruz
      // (UPSERT'in döndürdüğü kaydın discoveredAt'i ilk eklendiği zamandır)
      if (result[0]) {
        const ageMs = Date.now() - new Date(result[0].discoveredAt).getTime();
        if (ageMs < 5000) added++; // 5sn içinde eklendi = yeni
        else updated++;
      }
    }

    await db
      .update(outreachRunsTable)
      .set({
        status: "success",
        itemsScraped: items.length,
        leadsAdded: added,
        leadsUpdated: updated,
        leadsSkipped: skipped,
        apifyRunId: runInfo.runId,
        costUsd: runInfo.usageUsd?.toString(),
        completedAt: new Date(),
      })
      .where(eq(outreachRunsTable.id, run.id));

    return {
      segment,
      runId: run.id,
      itemsScraped: items.length,
      leadsAdded: added,
      leadsUpdated: updated,
      leadsSkipped: skipped,
    };
  } catch (err: any) {
    const errorMessage = err?.message ?? String(err);
    await db
      .update(outreachRunsTable)
      .set({
        status: "failed",
        errorMessage,
        completedAt: new Date(),
      })
      .where(eq(outreachRunsTable.id, run.id));

    return {
      segment,
      runId: run.id,
      itemsScraped: 0,
      leadsAdded: 0,
      leadsUpdated: 0,
      leadsSkipped: 0,
      errorMessage,
    };
  }
}

/**
 * Tüm 4 segmenti paralel çalıştır.
 */
export async function discoverAllSegments(
  options: { limitPerSegment?: number } = {},
): Promise<DiscoverySegmentResult[]> {
  const segments: OutreachSegment[] = ["b2b_hr", "b2b_sme", "b2c_pro", "partner"];
  const limit = options.limitPerSegment ?? 50;

  // Paralel çalıştır — Apify zaten arka planda çalışıyor
  const results = await Promise.all(segments.map((s) => discoverSegment(s, { limit })));
  return results;
}
