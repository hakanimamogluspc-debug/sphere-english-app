/**
 * E-Fatura / E-Arşiv sistemi — entegratör-agnostik contract.
 *
 * Bugün Luca kullanıyoruz. Yarın Foriba, QNB, Nilvera, Uyumsoft'a geçmek
 * istersek sadece yeni bir Provider class'ı ekleyip factory'de switch.
 * Uygulama kodu (activate hook'ları, admin panel, cron) hiç değişmez.
 */

export type InvoiceEnv = "test" | "prod";
export type InvoiceType = "einvoice" | "earchive";
export type InvoiceStatus = "pending" | "sent" | "failed" | "canceled";
export type BuyerType = "individual" | "corporate" | "foreign";
export type ScenarioType = "TEMELFATURA" | "TICARIFATURA";
export type SendingType = "KAGIT" | "ELEKTRONIK" | "NONE";
export type SourceType = "ebook" | "ebook_cart" | "subscription" | "manual";

export interface InvoiceBuyer {
  email: string;
  name: string; // Bireysel: "Ad Soyad", Kurumsal: firma unvanı
  type: BuyerType;
  taxId?: string; // TCKN (11 hane) / VKN (10 hane) — foreign için boş
  taxOffice?: string;
  companyName?: string; // Kurumsal için — name ile aynı olabilir
  /** e-Fatura mükellefi ise doldur — GetTaxPayer'dan gelir. Yoksa e-Arşiv */
  receiverInboxTag?: string;
  address?: string;
  city?: string;
  district?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
}

export interface InvoiceLineItem {
  productCode: string; // Dahili kod (örn: ebook-toplantı-1000)
  productName: string; // Fatura satırında gösterilecek
  quantity: number;
  measureUnit?: string; // NIU (adet), KGM (kg) — default NIU
  /** KDV hariç birim fiyat (kuruş cinsinden) */
  unitPriceKurus: number;
  vatRate: number; // 20, 10, 8, 0 — yüzde
  /** İskonto tutarı (kuruş) — opsiyonel */
  discountKurus?: number;
  note?: string;
}

/**
 * Fatura oluşturma isteği — Sphere iş kodu bunu üretir, provider işler.
 */
export interface IssueInvoiceInput {
  /** Kaynak referansı — hangi sipariş için */
  source: {
    type: SourceType;
    id: number;
    orderId?: string;
  };
  buyer: InvoiceBuyer;
  lineItems: InvoiceLineItem[];
  /** Belge notları — fatura üstünde görünür */
  notes?: string[];
  /** Iyzico payment ID gibi ödeme referansı — opsiyonel not */
  paymentReference?: string;
  /** Alıcıya email otomatik gönderilsin mi (e-Arşiv için) */
  sendMailAutomatically?: boolean;
}

/**
 * Fatura oluşturma sonucu.
 */
export interface IssueInvoiceResult {
  ok: boolean;
  invoiceId?: number; // DB id
  ettn?: string;
  externalInvoiceCode?: string;
  viewerUrl?: string;
  error?: string;
  rawResponse?: any;
  skipped?: boolean;
}

/**
 * Iptal isteği.
 */
export interface CancelInvoiceInput {
  invoiceId: number;
  reason: string;
}

/**
 * Provider interface — her entegratör bunu implement eder.
 */
export interface InvoiceProvider {
  /** Provider ismi — "luca", "foriba", "nilvera", vs. */
  readonly name: string;

  /** Test veya prod ortamı */
  readonly env: InvoiceEnv;

  /**
   * VKN'nin e-Fatura mükellefi olup olmadığını sorgu.
   * Mükellef ise PostBox etiketleri döner (e-Fatura'da ReceiverInboxTag için gerekli).
   */
  lookupTaxPayer(taxCode: string): Promise<{
    isRegistered: boolean;
    postboxes: string[];
    title?: string;
  } | null>;

  /**
   * Fatura kes (e-Fatura veya e-Arşiv — buyer.type ve receiverInboxTag'e göre).
   * Provider ETTN üretir/onaylar, döner.
   */
  issueInvoice(input: IssueInvoiceInput): Promise<IssueInvoiceResult>;

  /**
   * ETTN ile belge görüntüleme linki al (kısa ömürlü token'lı URL).
   */
  getViewerUrl(ettn: string, type: InvoiceType): Promise<{ url: string; expiresAt: Date } | null>;

  /**
   * İptal (sadece e-Arşiv için — e-Fatura'da tek taraflı iptal yok).
   */
  cancelInvoice(input: CancelInvoiceInput & { ettn: string }): Promise<{ ok: boolean; error?: string }>;

  /**
   * Sağlık kontrolü — credentials + endpoint çalışıyor mu?
   */
  healthCheck(): Promise<{ ok: boolean; message?: string }>;
}

/**
 * Provider seçim/karar mantığı için yardımcı.
 */
export function decideInvoiceType(buyer: InvoiceBuyer): InvoiceType {
  // Kurumsal + e-Fatura mükellefi ise → e-Fatura
  if (buyer.type === "corporate" && buyer.receiverInboxTag) {
    return "einvoice";
  }
  // Aksi durumda hep e-Arşiv (bireysel, foreign, kayıtsız kurumsal)
  return "earchive";
}
