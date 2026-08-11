/**
 * Apify API wrapper - hafif, native fetch ile.
 * Apify Node SDK kurmamak için kasıtlı olarak native fetch kullanılıyor
 * (deploy boyutunu küçük tutmak ve bağımlılık eklemekten kaçınmak için).
 *
 * Apify dokümanı: https://docs.apify.com/api/v2
 */

const APIFY_BASE = "https://api.apify.com/v2";

export interface ApifyRunInfo {
  runId: string;
  status: "READY" | "RUNNING" | "SUCCEEDED" | "FAILED" | "ABORTED" | "TIMING-OUT" | "TIMED-OUT";
  defaultDatasetId: string;
  startedAt: string;
  finishedAt?: string;
  stats?: {
    computeUnits?: number;
    durationMillis?: number;
  };
  usageUsd?: number;
}

export class ApifyClient {
  private readonly token: string;

  constructor(token?: string) {
    const t = token ?? process.env.APIFY_API_TOKEN;
    if (!t) {
      throw new Error("APIFY_API_TOKEN ortam değişkeni tanımlı değil");
    }
    this.token = t;
  }

  /**
   * Bir actor'u senkron çalıştırır ve sonuçları bekler.
   * Uzun süren scraping için timeoutSecs parametresi önemli.
   *
   * @param actorId - 'apify/linkedin-people-search' veya 'compass~google-maps-extractor'
   * @param input - actor'a verilen input JSON
   * @param timeoutSecs - max bekleme süresi (default 300sn)
   */
  async runActorSync<T = unknown>(
    actorId: string,
    input: Record<string, unknown>,
    timeoutSecs: number = 300,
  ): Promise<{ runInfo: ApifyRunInfo; items: T[] }> {
    // Actor ID'sindeki '/' karakterini '~' ile değiştir (Apify konvansiyonu)
    const safeId = actorId.replace("/", "~");

    const url = `${APIFY_BASE}/acts/${safeId}/run-sync-get-dataset-items?token=${this.token}&timeout=${timeoutSecs}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Apify actor ${actorId} hatası (${res.status}): ${errBody.slice(0, 300)}`);
    }

    // Apify run-sync-get-dataset-items endpoint'inden runId headerlarda gelmeyebilir.
    // Logging için en iyi efort — boş ise sadece dataset items'a güvenir, runId tracking
    // sadece outreach_runs tablosunda debug amaçlı kullanılır.
    const runId =
      res.headers.get("x-apify-pagination-runid") ??
      res.headers.get("x-apify-run-id") ??
      res.headers.get("x-apify-runid") ??
      "";
    const datasetId =
      res.headers.get("x-apify-pagination-datasetid") ??
      res.headers.get("x-apify-dataset-id") ??
      "";

    const items = (await res.json()) as T[];

    return {
      runInfo: {
        runId,
        status: "SUCCEEDED",
        defaultDatasetId: datasetId,
        startedAt: new Date().toISOString(),
      },
      items,
    };
  }

  /**
   * Asenkron başlat - sadece run başlatır, sonucu beklemeden döner.
   * Uzun süren işler için (>5dk) tercih edilmeli.
   */
  async startActor(
    actorId: string,
    input: Record<string, unknown>,
  ): Promise<ApifyRunInfo> {
    const safeId = actorId.replace("/", "~");
    const url = `${APIFY_BASE}/acts/${safeId}/runs?token=${this.token}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Apify start ${actorId} hatası (${res.status}): ${errBody.slice(0, 300)}`);
    }

    const body = (await res.json()) as { data: any };
    return {
      runId: body.data.id,
      status: body.data.status,
      defaultDatasetId: body.data.defaultDatasetId,
      startedAt: body.data.startedAt,
    };
  }

  /**
   * Bir run'ın son durumunu çek (polling için).
   */
  async getRun(runId: string): Promise<ApifyRunInfo> {
    const url = `${APIFY_BASE}/actor-runs/${runId}?token=${this.token}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Apify getRun hatası: ${res.status}`);
    const body = (await res.json()) as { data: any };
    return {
      runId: body.data.id,
      status: body.data.status,
      defaultDatasetId: body.data.defaultDatasetId,
      startedAt: body.data.startedAt,
      finishedAt: body.data.finishedAt,
      stats: body.data.stats,
      usageUsd: body.data.usageTotalUsd,
    };
  }

  /**
   * Bir dataset'in tüm öğelerini çek (asenkron run için).
   */
  async getDatasetItems<T = unknown>(datasetId: string, limit: number = 1000): Promise<T[]> {
    const url = `${APIFY_BASE}/datasets/${datasetId}/items?token=${this.token}&limit=${limit}&clean=true`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Apify getDataset hatası: ${res.status}`);
    return (await res.json()) as T[];
  }
}

/**
 * Tekil instance al — token kontrol et ve gerekirse error fırlat.
 */
export function getApifyClient(): ApifyClient | null {
  if (!process.env.APIFY_API_TOKEN) return null;
  return new ApifyClient();
}
