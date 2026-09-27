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
    parser: "linkedin_people" | "gmaps" | "instagram" | "youtube";
    description: string;
  }
> = {
  b2b_hr: {
    actorId: "harvestapi/linkedin-profile-search",
    parser: "linkedin_people",
    description: "Türkiye'deki İK / Eğitim / L&D müdürleri",
    buildInput: (limit) => ({
      profileScraperMode: "Full + email search",
      searchQuery: "İK Müdürü",
      locations: ["Türkiye"],
      maxItems: limit,
    }),
  },
  b2b_sme: {
    actorId: "harvestapi/linkedin-profile-search",
    parser: "linkedin_people",
    description: "Türkiye'deki KOBİ kurucu / CEO / Genel Müdür",
    buildInput: (limit) => ({
      profileScraperMode: "Full + email search",
      searchQuery: "CEO Founder",
      locations: ["Türkiye"],
      maxItems: limit,
    }),
  },
  b2c_pro: {
    actorId: "harvestapi/linkedin-profile-search",
    parser: "linkedin_people",
    description: "Senior bireysel profesyoneller (mühendis, yönetici, avukat, doktor)",
    buildInput: (limit) => ({
      profileScraperMode: "Full + email search",
      searchQuery: "Senior Manager",
      locations: ["Türkiye"],
      maxItems: limit,
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

// ─── Instagram Parser ───────────────────────────────────────────────────
// apify/instagram-profile-scraper output format
function parseInstagram(raw: any, segment: OutreachSegment): InsertOutreachLead | null {
  // Bio'dan e-posta çıkar
  const bio: string = raw.biography || raw.bio || "";
  const bioEmail = bio.match(EMAIL_REGEX)?.[0];
  const email = pickEmail(raw.emails, raw.businessEmail || raw.email || bioEmail);
  if (!email) return null;

  const username = raw.username || raw.userName;
  const followers = raw.followersCount ?? raw.followers ?? raw.followerCount;
  const fullName = raw.fullName || raw.full_name || username;

  return {
    email,
    fullName: fullName || undefined,
    linkedinUrl: undefined,
    jobTitle: raw.businessCategoryName || "Instagram Creator",
    company: `@${username}`,
    companyWebsite: raw.externalUrl || raw.website,
    companyDomain: extractDomain(raw.externalUrl || raw.website),
    location: raw.city || raw.businessAddressJson?.city,
    industry: raw.businessCategoryName,
    segment,
    source: "apify_instagram",
    sourceUrl: `https://instagram.com/${username}`,
    rawData: { ...raw, platform: "instagram", followers, username, bio } as any,
    notes: `${followers ? `${followers.toLocaleString("tr-TR")} takipçi · ` : ""}${bio.slice(0, 200)}`,
  };
}

// ─── YouTube Parser ─────────────────────────────────────────────────────
// streamers/youtube-scraper channel result format
function parseYouTube(raw: any, segment: OutreachSegment): InsertOutreachLead | null {
  const desc: string = raw.channelDescription || raw.description || "";
  const descEmail = desc.match(EMAIL_REGEX)?.[0];
  const email = pickEmail(raw.emails, raw.email || descEmail);
  if (!email) return null;

  const handle = raw.channelName || raw.channelHandle || raw.author;
  const subs = raw.numberOfSubscribers ?? raw.subscribers ?? raw.subscriberCount;
  const channelUrl = raw.channelUrl || raw.url || (handle ? `https://youtube.com/${handle}` : undefined);

  return {
    email,
    fullName: handle || undefined,
    linkedinUrl: undefined,
    jobTitle: "YouTuber",
    company: handle,
    companyWebsite: channelUrl,
    location: raw.country,
    industry: "İçerik Üretimi",
    segment,
    source: "apify_youtube",
    sourceUrl: channelUrl,
    rawData: { ...raw, platform: "youtube", subscribers: subs, handle, description: desc } as any,
    notes: `${subs ? `${subs.toLocaleString("tr-TR")} abone · ` : ""}${desc.slice(0, 200)}`,
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
      } else if (config.parser === "instagram") {
        parsed = parseInstagram(item, segment);
      } else if (config.parser === "youtube") {
        parsed = parseYouTube(item, segment);
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

/**
 * ═══════════════════════════════════════════════════════════════════════
 * HAZIR LEAD PRESET'LERİ — Sphere English müşteri profiline göre
 * ═══════════════════════════════════════════════════════════════════════
 * Admin panelden tek tıkla tetiklenir. Segment'ler geniş; preset'ler dar.
 */
export interface LeadPreset {
  id: string;
  label: string;
  description: string;
  segment: OutreachSegment;
  icon: string;
  buildInput: (limit: number) => Record<string, unknown>;
  actorId?: string;
  parser?: "linkedin_people" | "gmaps" | "instagram" | "youtube";
}

const li = (searchQuery: string, jobTitles?: string[]) => (limit: number) => ({
  profileScraperMode: "Full + email search",
  searchQuery,
  ...(jobTitles ? { currentJobTitles: jobTitles } : {}),
  locations: ["Türkiye"],
  maxItems: limit,
});

export const LEAD_PRESETS: LeadPreset[] = [
  // ─── B2B HR (İK / Eğitim / L&D karar vericileri) ─────────────────
  {
    id: "hr_manager_tr",
    label: "İK Müdürleri (Türkiye)",
    description: "Klasik İK müdürü — orta ve büyük kurumsal firma",
    segment: "b2b_hr",
    icon: "👥",
    buildInput: li("İK Müdürü", ["İK Müdürü", "HR Manager", "İnsan Kaynakları Müdürü"]),
  },
  {
    id: "learning_development_tr",
    label: "L&D / Eğitim ve Gelişim Müdürleri",
    description: "En hedefli — kurumsal eğitim bütçesinden sorumlu",
    segment: "b2b_hr",
    icon: "🎓",
    buildInput: li("Learning Development Eğitim Müdürü", [
      "Learning and Development Manager",
      "Training Manager",
      "Eğitim ve Gelişim Müdürü",
      "L&D Manager",
    ]),
  },
  {
    id: "talent_management_tr",
    label: "Yetenek Yönetimi Direktörleri",
    description: "İK direktör seviyesi — büyük bütçe kararı verebilir",
    segment: "b2b_hr",
    icon: "🏆",
    buildInput: li("Talent Yetenek Yönetimi", [
      "Talent Management Director",
      "Talent Acquisition Manager",
      "Yetenek Yönetimi Direktörü",
      "Head of People",
      "Chief People Officer",
    ]),
  },
  {
    id: "internal_comms_tr",
    label: "Kurumsal İletişim Müdürleri",
    description: "Uluslararası iletişim eğitimi doğrudan ilgi alanı",
    segment: "b2b_hr",
    icon: "📢",
    buildInput: li("Kurumsal İletişim Corporate Communications", [
      "Corporate Communications Manager",
      "Internal Communications Manager",
      "Kurumsal İletişim Müdürü",
    ]),
  },

  // ─── B2B SME (KOBİ karar vericileri — İngilizce ihtiyacı yüksek sektörler) ───
  {
    id: "sme_tech_ceo",
    label: "Yazılım / Teknoloji Şirket CEO'ları",
    description: "Yurtdışı müşteri var — ekip İngilizcesi kritik",
    segment: "b2b_sme",
    icon: "💻",
    buildInput: li("CEO Software Technology Startup Turkey", [
      "CEO",
      "Founder",
      "Co-Founder",
      "CTO",
      "Managing Director",
    ]),
  },
  {
    id: "sme_export_manager",
    label: "İhracat / Dış Ticaret Müdürleri",
    description: "İngilizce iş konuşması günlük iş — %90 ihtiyaç",
    segment: "b2b_sme",
    icon: "🌍",
    buildInput: li("İhracat Dış Ticaret Export Manager", [
      "Export Manager",
      "Export Sales Manager",
      "İhracat Müdürü",
      "Dış Ticaret Müdürü",
      "International Sales Manager",
    ]),
  },
  {
    id: "sme_tourism",
    label: "Turizm Sektörü Sahipleri",
    description: "Otel, tur operatörü — çalışan İngilizcesi doğrudan gelir",
    segment: "b2b_sme",
    icon: "🏨",
    buildInput: li("Hotel Tourism Manager Turkey", [
      "General Manager",
      "Hotel Manager",
      "Tourism Manager",
      "Otel Genel Müdürü",
    ]),
  },
  {
    id: "sme_consulting",
    label: "Danışmanlık / Ajans Sahipleri",
    description: "Uluslararası müşteri portföyü yüksek",
    segment: "b2b_sme",
    icon: "💼",
    buildInput: li("Consulting Danışmanlık Founder Turkey", [
      "Founder",
      "Managing Partner",
      "CEO Consulting",
      "Danışmanlık Şirket Sahibi",
    ]),
  },
  {
    id: "sme_logistics",
    label: "Lojistik / Nakliye Firma Sahipleri",
    description: "Uluslararası nakliye = sürekli İngilizce yazışma",
    segment: "b2b_sme",
    icon: "🚢",
    buildInput: li("Logistics Lojistik Nakliye Turkey", [
      "Logistics Manager",
      "Supply Chain Manager",
      "Lojistik Müdürü",
      "Operations Director",
    ]),
  },

  // ─── B2C Profesyoneller (bireysel abonelik satışı) ─────────────────
  {
    id: "b2c_software_engineers",
    label: "Yazılım Geliştiriciler (Senior/Lead)",
    description: "Remote iş — İngilizce = maaş artışı motivasyonu",
    segment: "b2c_pro",
    icon: "👨‍💻",
    buildInput: li("Senior Software Engineer Turkey Remote", [
      "Senior Software Engineer",
      "Lead Engineer",
      "Staff Engineer",
      "Yazılım Geliştirici",
    ]),
  },
  {
    id: "b2c_engineers_intl",
    label: "Uluslararası Proje Mühendisleri",
    description: "Global mühendislik firmalarında çalışan TR uyruklular",
    segment: "b2c_pro",
    icon: "⚙️",
    buildInput: li("Project Engineer International Turkey", [
      "Project Engineer",
      "Senior Engineer",
      "Proje Mühendisi",
      "Kıdemli Mühendis",
    ]),
  },
  {
    id: "b2c_lawyers_intl",
    label: "Uluslararası Hukuk Avukatları",
    description: "İngilizce yüksek seviye = zorunluluk",
    segment: "b2c_pro",
    icon: "⚖️",
    buildInput: li("International Law Avukat Turkey", [
      "International Lawyer",
      "Corporate Lawyer",
      "Uluslararası Hukuk Uzmanı",
    ]),
  },

  // ─── Affiliate / İnfluencer (LinkedIn içerik üreticileri) ─────────
  // Not: Bu preset'ler LinkedIn arama üzerinden çalışır. Instagram/YouTube
  // için ayrı actor'lar gerekir; ileride eklenebilir.
  {
    id: "affiliate_career_coach",
    label: "Kariyer Koçları",
    description: "Sphere'i kendi takipçilerine önerebilir — en yüksek dönüşüm",
    segment: "partner",
    icon: "🧭",
    buildInput: li("Kariyer Koçu Career Coach LinkedIn Top Voice", [
      "Career Coach",
      "Kariyer Koçu",
      "Career Consultant",
      "Executive Coach",
      "Life Coach",
    ]),
  },
  {
    id: "affiliate_english_teacher",
    label: "İngilizce Eğitmenleri (Bağımsız)",
    description: "Kendi öğrenci havuzunu Sphere'e yönlendirebilir",
    segment: "partner",
    icon: "📝",
    buildInput: li("İngilizce Eğitmeni English Teacher Content Creator", [
      "English Teacher",
      "İngilizce Eğitmeni",
      "IELTS Instructor",
      "TOEFL Coach",
      "English Trainer",
    ]),
  },
  {
    id: "affiliate_abroad_content",
    label: "Yurtdışı Kariyer İçerik Üreticileri",
    description: "\"Yurtdışında çalışmak\" içeriği üreten profiller",
    segment: "partner",
    icon: "✈️",
    buildInput: li("Yurtdışı Kariyer Content Creator Immigration Coach", [
      "Content Creator",
      "İçerik Üreticisi",
      "Immigration Consultant",
      "Study Abroad Consultant",
    ]),
  },
  {
    id: "affiliate_linkedin_creator",
    label: "LinkedIn Top Voice / İK İçerik Üreticileri",
    description: "LinkedIn'de yüksek takipçili İK / kariyer içeriği üretenler",
    segment: "partner",
    icon: "⭐",
    buildInput: li("LinkedIn Top Voice HR Career Turkey Content Creator", [
      "LinkedIn Top Voice",
      "Content Creator",
      "Thought Leader",
      "İçerik Üreticisi",
    ]),
  },
  {
    id: "affiliate_edu_influencer",
    label: "Eğitim / Kişisel Gelişim İnfluencerleri",
    description: "Eğitim tavsiyeleri veren orta ölçekli takipçili profiller",
    segment: "partner",
    icon: "🎯",
    buildInput: li("Kişisel Gelişim Eğitim Danışmanı Personal Development", [
      "Personal Development Coach",
      "Kişisel Gelişim Uzmanı",
      "Eğitim Danışmanı",
      "Motivational Speaker",
    ]),
  },
  {
    id: "affiliate_youtuber_podcast",
    label: "YouTuber / Podcaster (LinkedIn'den)",
    description: "LinkedIn'de kariyer/eğitim podcast sahipleri",
    segment: "partner",
    icon: "🎙️",
    buildInput: li("YouTuber Podcaster Content Creator Turkey Education Career", [
      "YouTuber",
      "Podcaster",
      "Podcast Host",
      "Video Content Creator",
    ]),
  },

  // ─── Instagram Affiliate ──────────────────────────────────────────
  {
    id: "affiliate_instagram_english",
    label: "Instagram: İngilizce Öğrenme İçerikçileri",
    description: "İngilizce öğreten Instagram hesapları (bio'da email varsa)",
    segment: "partner",
    icon: "📸",
    actorId: "apify/instagram-search-scraper",
    parser: "instagram",
    buildInput: (limit) => ({
      search: "ingilizceöğren",
      searchType: "hashtag",
      searchLimit: 3,
      resultsLimit: limit,
      addParentData: true,
    }),
  },
  {
    id: "affiliate_instagram_career",
    label: "Instagram: Kariyer Koçları",
    description: "#kariyerkocu, #kariyerdanışmanı hashtag'leri",
    segment: "partner",
    icon: "🎬",
    actorId: "apify/instagram-search-scraper",
    parser: "instagram",
    buildInput: (limit) => ({
      search: "kariyerkocu",
      searchType: "hashtag",
      searchLimit: 3,
      resultsLimit: limit,
      addParentData: true,
    }),
  },
  {
    id: "affiliate_instagram_abroad",
    label: "Instagram: Yurtdışı Yaşam/Eğitim",
    description: "#yurtdışıyaşam, #erasmus, #masterabroad içerik üreticileri",
    segment: "partner",
    icon: "🌎",
    actorId: "apify/instagram-search-scraper",
    parser: "instagram",
    buildInput: (limit) => ({
      search: "yurtdışıeğitim",
      searchType: "hashtag",
      searchLimit: 3,
      resultsLimit: limit,
      addParentData: true,
    }),
  },

  // ─── YouTube Affiliate ────────────────────────────────────────────
  {
    id: "affiliate_youtube_english",
    label: "YouTube: İngilizce Öğrenme Kanalları",
    description: "Türkiye'de İngilizce öğreten YouTube kanalları",
    segment: "partner",
    icon: "📺",
    actorId: "streamers/youtube-scraper",
    parser: "youtube",
    buildInput: (limit) => ({
      searchQueries: ["İngilizce öğren Türkçe", "İngilizce dersi", "English learning Turkish"],
      maxResults: limit,
      maxResultsShorts: 0,
      maxResultStreams: 0,
    }),
  },
  {
    id: "affiliate_youtube_career",
    label: "YouTube: Kariyer & Motivasyon Kanalları",
    description: "Kariyer koçluğu / motivasyon YouTube kanalları",
    segment: "partner",
    icon: "🎥",
    actorId: "streamers/youtube-scraper",
    parser: "youtube",
    buildInput: (limit) => ({
      searchQueries: ["kariyer koçluğu", "kişisel gelişim Türkçe", "yurtdışında çalışmak"],
      maxResults: limit,
      maxResultsShorts: 0,
      maxResultStreams: 0,
    }),
  },
];

/**
 * Preset'e göre lead keşfi — LEAD_PRESETS'i kullanır.
 */
export async function discoverByPreset(
  presetId: string,
  options: { limit?: number; client?: ApifyClient } = {},
): Promise<DiscoverySegmentResult & { presetId: string }> {
  const preset = LEAD_PRESETS.find((p) => p.id === presetId);
  if (!preset) throw new Error(`Preset bulunamadı: ${presetId}`);

  const limit = options.limit ?? 50;
  const actorId = preset.actorId ?? SEGMENT_CONFIGS[preset.segment].actorId;
  const parser = preset.parser ?? SEGMENT_CONFIGS[preset.segment].parser;

  // Geçici bir config oluşturup discoverSegment'i taklit et — kod tekrarı yerine
  // SEGMENT_CONFIGS'e mutabık override et.
  const originalConfig = SEGMENT_CONFIGS[preset.segment];
  SEGMENT_CONFIGS[preset.segment] = {
    actorId,
    parser,
    description: preset.description,
    buildInput: preset.buildInput,
  };
  try {
    const result = await discoverSegment(preset.segment, options);
    return { ...result, presetId };
  } finally {
    // Config'i eski haline getir
    SEGMENT_CONFIGS[preset.segment] = originalConfig;
  }
}
