/**
 * TÜRMOB Luca e-Fatura / e-Arşiv provider.
 *
 * SOAP çağrıları elle XML string ile — node-soap yerine bu tercih edildi
 * çünkü Türkçe karakter encoding'inde daha güvenli ve namespace kontrolü açık.
 *
 * Endpoint'ler:
 *   Test: https://einvoiceserviceturmobtest.luca.com.tr/InvoiceService/ServiceContract/InvoiceService.svc
 *   Prod: https://einvoiceserviceturmob.luca.com.tr/InvoiceService/ServiceContract/InvoiceService.svc
 *
 * Auth: statik IP whitelist (HTTP header/WS-Security yok). SOAP body'de sadece
 * CompanyTaxCode taşınır. Ancak ValidateUserCompany metodu için ek olarak
 * UserPassword + UserTaxCode + CompanyTaxCode kombinasyonu gerekir.
 *
 * Env vars:
 *   LUCA_ENV                   test | prod  (default: test)
 *   LUCA_COMPANY_TAX_CODE      Sphere firma VKN (canlı: 4740935216)
 *   LUCA_COMPANY_VENDOR_NUMBER Alt bayi numarası — genelde boş
 *   LUCA_USER_TAX_CODE         Portal kullanıcı TCKN (ValidateUserCompany için)
 *   LUCA_USER_PASSWORD         Portal şifre
 *   LUCA_COMPANY_TITLE         Firma unvanı (fatura üstünde)
 *   LUCA_COMPANY_ADDRESS       Firma adresi (fatura üstünde)
 *   LUCA_COMPANY_CITY          Şehir
 *   LUCA_COMPANY_CITY_CODE     Şehir kodu (Ankara=06, İstanbul=34 vs.)
 *   LUCA_COMPANY_DISTRICT      İlçe
 *   LUCA_COMPANY_TAX_OFFICE    Vergi dairesi adı
 *   LUCA_INVOICE_PREFIX        Belge no ön eki (default: SPH)
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  InvoiceProvider,
  InvoiceEnv,
  IssueInvoiceInput,
  IssueInvoiceResult,
  InvoiceLineItem,
  InvoiceBuyer,
  CancelInvoiceInput,
  InvoiceType,
} from "./types.js";
import { decideInvoiceType } from "./types.js";

// XSLT template'lerini bir kere okuyup cache'leyelim
const __dirname = path.dirname(new URL(import.meta.url).pathname);
let _arsivXslt: string | null = null;
function getArsivXslt(): string {
  if (_arsivXslt) return _arsivXslt;
  try {
    const p = path.resolve(__dirname, "assets", "arsiv-xslt.base64.txt");
    _arsivXslt = fs.readFileSync(p, "utf8").trim();
  } catch (e: any) {
    console.warn("[luca] arsiv-xslt yok:", e?.message);
    _arsivXslt = "";
  }
  return _arsivXslt || "";
}

// ─── XML utilities ─────────────────────────────────────────────────────
function xmlEscape(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Kuruş → "1234.56" string (Luca'nın beklediği format) */
function kurus2str(kurus: number): string {
  return (kurus / 100).toFixed(2);
}

/** "SPH20260001" gibi belge no üret */
function generateExternalCode(prefix: string, sequence: number): string {
  const year = new Date().getFullYear();
  return `${prefix}${year}${String(sequence).padStart(7, "0")}`;
}

interface LucaConfig {
  env: InvoiceEnv;
  companyTaxCode: string;
  companyVendorNumber: string;
  userTaxCode: string;
  userPassword: string;
  companyTitle: string;
  companyAddress: string;
  companyCity: string;
  companyCityCode: string;
  companyDistrict: string;
  companyTaxOffice: string;
  invoicePrefix: string;
}

function loadConfig(): LucaConfig {
  const env = (process.env.LUCA_ENV === "prod" ? "prod" : "test") as InvoiceEnv;
  return {
    env,
    companyTaxCode: process.env.LUCA_COMPANY_TAX_CODE || "8810234738",
    companyVendorNumber: process.env.LUCA_COMPANY_VENDOR_NUMBER || "",
    userTaxCode: process.env.LUCA_USER_TAX_CODE || "12345678902",
    userPassword: process.env.LUCA_USER_PASSWORD || "Luca1923!",
    companyTitle: process.env.LUCA_COMPANY_TITLE || "İMMER GLOBAL EĞİTİM VE DANIŞMANLIK LTD.ŞTİ.",
    companyAddress: process.env.LUCA_COMPANY_ADDRESS || "Merkez Mahallesi",
    companyCity: process.env.LUCA_COMPANY_CITY || "İstanbul",
    companyCityCode: process.env.LUCA_COMPANY_CITY_CODE || "34",
    companyDistrict: process.env.LUCA_COMPANY_DISTRICT || "Şişli",
    companyTaxOffice: process.env.LUCA_COMPANY_TAX_OFFICE || "Şişli",
    invoicePrefix: process.env.LUCA_INVOICE_PREFIX || "SPH",
  };
}

function endpointFor(env: InvoiceEnv, svc: "InvoiceService" | "AddressBookService"): string {
  const host =
    env === "prod"
      ? "einvoiceserviceturmob.luca.com.tr"
      : "einvoiceserviceturmobtest.luca.com.tr";
  return `https://${host}/${svc}/ServiceContract/${svc}.svc`;
}

async function soapCall(opts: {
  env: InvoiceEnv;
  service: "InvoiceService" | "AddressBookService";
  method: string;
  body: string;
  timeoutMs?: number;
}): Promise<{ ok: boolean; xml?: string; status?: number; error?: string }> {
  const url = endpointFor(opts.env, opts.service);
  const soapAction = `http://tempuri.org/I${opts.service}/${opts.method}`;

  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/" xmlns:ein="http://schemas.datacontract.org/2004/07/EInvoice.Service.Model" xmlns:arr="http://schemas.microsoft.com/2003/10/Serialization/Arrays">
  <soapenv:Header/>
  <soapenv:Body>
${opts.body}
  </soapenv:Body>
</soapenv:Envelope>`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30000);

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": `"${soapAction}"`,
      },
      body: envelope,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await r.text();
    if (!r.ok) {
      console.error(`[luca] SOAP ${opts.method} HTTP ${r.status}:`, text.slice(0, 500));
      return { ok: false, status: r.status, error: text.slice(0, 500) };
    }
    return { ok: true, xml: text, status: r.status };
  } catch (e: any) {
    clearTimeout(timer);
    console.error(`[luca] SOAP ${opts.method} HATA:`, e?.message);
    return { ok: false, error: e?.message };
  }
}

/** SOAP fault veya iş hatası tespit */
function parseSoapError(xml: string): string | null {
  // <soap:Fault> veya <s:Fault>
  const faultMatch = xml.match(/<(?:s:|soap:)?Fault[\s\S]*?<(?:faultstring|Reason\/Text)[^>]*>([\s\S]*?)<\/(?:faultstring|Reason)/i);
  if (faultMatch) return faultMatch[1].trim();

  // Response içinde ErrorMessage veya Message
  const errMatch = xml.match(/<(?:ein:|eın:|a:)?(?:Error|ErrorMessage|Message)[^>]*>([^<]+)<\/(?:ein:|eın:|a:)?(?:Error|ErrorMessage|Message)>/);
  if (errMatch && errMatch[1] && errMatch[1].toLowerCase() !== "success") {
    // "Success" gibi kelime "OK" mesajı olabilir — ignore
    if (!/success|başarılı/i.test(errMatch[1])) return errMatch[1].trim();
  }
  return null;
}

/** Response XML'inden değer çek — namespace agnostic */
function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:[a-z0-9]+:)?${tag}[^>]*>([^<]+)<\\/(?:[a-z0-9]+:)?${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

// ─── LucaProvider class ────────────────────────────────────────────────

export class LucaProvider implements InvoiceProvider {
  readonly name = "luca";
  readonly env: InvoiceEnv;
  private cfg: LucaConfig;

  constructor() {
    this.cfg = loadConfig();
    this.env = this.cfg.env;
  }

  async lookupTaxPayer(taxCode: string): Promise<{
    isRegistered: boolean;
    postboxes: string[];
    title?: string;
  } | null> {
    if (!/^\d{10,11}$/.test(taxCode)) return null;

    const body = `
    <tem:GetTaxPayer>
      <tem:request>
        <ein:TaxPayerTaxCode>${xmlEscape(taxCode)}</ein:TaxPayerTaxCode>
      </tem:request>
    </tem:GetTaxPayer>`;

    const res = await soapCall({
      env: this.env,
      service: "AddressBookService",
      method: "GetTaxPayer",
      body,
      timeoutMs: 15000,
    });

    if (!res.ok || !res.xml) return null;
    const err = parseSoapError(res.xml);
    if (err) {
      console.warn("[luca] GetTaxPayer hata:", err);
      return { isRegistered: false, postboxes: [] };
    }

    // urn:mail:xxxxx@luca.com.tr gibi etiketleri topla
    const postboxes = Array.from(res.xml.matchAll(/urn:mail:[^<\s"]+/g)).map((m) => m[0]);
    const title = extractTag(res.xml, "Title") ?? extractTag(res.xml, "TaxPayerTitle") ?? undefined;

    return {
      isRegistered: postboxes.length > 0,
      postboxes,
      title,
    };
  }

  async issueInvoice(input: IssueInvoiceInput): Promise<IssueInvoiceResult> {
    const invoiceType = decideInvoiceType(input.buyer);
    const externalCode = generateExternalCode(this.cfg.invoicePrefix, Date.now() % 10000000);
    const ettn = randomUUID();
    const today = new Date().toISOString().slice(0, 10);

    // Toplam hesap
    let totalLineExtension = 0;
    let totalDiscount = 0;
    let totalVat = 0;
    for (const it of input.lineItems) {
      const grossKurus = it.unitPriceKurus * it.quantity;
      const discountKurus = it.discountKurus ?? 0;
      const lineExt = grossKurus - discountKurus;
      const vat = Math.round((lineExt * it.vatRate) / 100);
      totalLineExtension += lineExt;
      totalDiscount += discountKurus;
      totalVat += vat;
    }
    const totalPayable = totalLineExtension + totalVat;

    if (invoiceType === "einvoice") {
      return await this.sendEInvoice({
        input,
        externalCode,
        ettn,
        today,
        totalLineExtension,
        totalDiscount,
        totalVat,
        totalPayable,
      });
    }
    return await this.sendEArchiveInvoice({
      input,
      externalCode,
      ettn,
      today,
      totalLineExtension,
      totalDiscount,
      totalVat,
      totalPayable,
    });
  }

  private async sendEArchiveInvoice(args: {
    input: IssueInvoiceInput;
    externalCode: string;
    ettn: string;
    today: string;
    totalLineExtension: number;
    totalDiscount: number;
    totalVat: number;
    totalPayable: number;
  }): Promise<IssueInvoiceResult> {
    const { input, externalCode, today, totalLineExtension, totalDiscount, totalVat, totalPayable } = args;

    const linesXml = input.lineItems
      .map((it) => this.buildArchiveDetailXml(it))
      .join("\n");

    const notesXml = (input.notes || [])
      .map((n) => `                <arr:string>${xmlEscape(n)}</arr:string>`)
      .join("\n");

    const paymentNote = input.paymentReference
      ? `                <arr:string>Ödeme Ref: ${xmlEscape(input.paymentReference)}</arr:string>`
      : "";

    const buyer = input.buyer;
    const receiverTaxCode = buyer.taxId ?? "11111111111"; // yabancı için dummy
    const receiverName = buyer.type === "corporate" ? (buyer.companyName || buyer.name) : buyer.name;

    const body = `
    <tem:SendArchiveInvoice>
      <tem:request>
        <ein:ArchiveInvoices>
          <ein:ArchiveInvoice>
            <ein:CompanyBranchAddress>
              <ein:BoulevardAveneuStreetName>${xmlEscape(this.cfg.companyAddress)}</ein:BoulevardAveneuStreetName>
              <ein:CityCode>${xmlEscape(this.cfg.companyCityCode)}</ein:CityCode>
              <ein:CityName>${xmlEscape(this.cfg.companyCity)}</ein:CityName>
              <ein:EMail>info@sphereenglish.com</ein:EMail>
            </ein:CompanyBranchAddress>
            <ein:CrossRate>0</ein:CrossRate>
            <ein:CurrencyCode>TRY</ein:CurrencyCode>
            <ein:ExternalArchiveInvoiceCode>${xmlEscape(externalCode)}</ein:ExternalArchiveInvoiceCode>
            <ein:InvoiceDate>${today}</ein:InvoiceDate>
            <ein:InvoiceDetails>
${linesXml}
            </ein:InvoiceDetails>
            <ein:InvoiceType>SATIS</ein:InvoiceType>
            <ein:IsArchived>false</ein:IsArchived>
            <ein:Notes>
${notesXml}
${paymentNote}
                <arr:string>İnternet üzerinden satılmıştır.</arr:string>
            </ein:Notes>
            <ein:OrderDate>${today}</ein:OrderDate>
            <ein:OrderNumber>${xmlEscape(input.source.orderId || String(input.source.id))}</ein:OrderNumber>
            <ein:Receiver>
              <ein:Address>
                <ein:BoulevardAveneuStreetName>${xmlEscape(buyer.address ?? "")}</ein:BoulevardAveneuStreetName>
                <ein:CityCode>0</ein:CityCode>
                <ein:CityName>${xmlEscape(buyer.city ?? "")}</ein:CityName>
                <ein:TownName>${xmlEscape(buyer.district ?? "")}</ein:TownName>
                <ein:EMail>${xmlEscape(buyer.email)}</ein:EMail>
              </ein:Address>
              <ein:ReceiverName>${xmlEscape(receiverName)}</ein:ReceiverName>
              <ein:ReceiverTaxCode>${xmlEscape(receiverTaxCode)}</ein:ReceiverTaxCode>
              <ein:SendingType>KAGIT</ein:SendingType>
            </ein:Receiver>
            <ein:ReceiverBranchAddress>
              <ein:CityCode>0</ein:CityCode>
              <ein:CityName>${xmlEscape(buyer.city ?? "")}</ein:CityName>
              <ein:EMail>${xmlEscape(buyer.email)}</ein:EMail>
            </ein:ReceiverBranchAddress>
            <ein:SendMailAutomatically>${input.sendMailAutomatically !== false ? "true" : "false"}</ein:SendMailAutomatically>
            <ein:TotalDiscountAmount>${kurus2str(totalDiscount)}</ein:TotalDiscountAmount>
            <ein:TotalLineExtensionAmount>${kurus2str(totalLineExtension)}</ein:TotalLineExtensionAmount>
            <ein:TotalPayableAmount>${kurus2str(totalPayable)}</ein:TotalPayableAmount>
            <ein:TotalTaxInclusiveAmount>${kurus2str(totalPayable)}</ein:TotalTaxInclusiveAmount>
            <ein:TotalVATAmount>${kurus2str(totalVat)}</ein:TotalVATAmount>
            <ein:XsltTemplate>${getArsivXslt()}</ein:XsltTemplate>
          </ein:ArchiveInvoice>
        </ein:ArchiveInvoices>
        <ein:CompanyTaxCode>${xmlEscape(this.cfg.companyTaxCode)}</ein:CompanyTaxCode>
      </tem:request>
    </tem:SendArchiveInvoice>`;

    const res = await soapCall({
      env: this.env,
      service: "InvoiceService",
      method: "SendArchiveInvoice",
      body,
      timeoutMs: 45000,
    });

    if (!res.ok || !res.xml) {
      return { ok: false, error: res.error ?? "SOAP başarısız" };
    }
    const err = parseSoapError(res.xml);
    if (err) {
      return { ok: false, error: err, rawResponse: res.xml.slice(0, 2000) };
    }

    // Response ETTN'i döndürebilir — yoksa bizimkini kullan
    const responseEttn = extractTag(res.xml, "ETTN") || extractTag(res.xml, "Ettn") || args.ettn;

    return {
      ok: true,
      ettn: responseEttn,
      externalInvoiceCode: externalCode,
      rawResponse: res.xml.slice(0, 5000),
    };
  }

  private async sendEInvoice(args: {
    input: IssueInvoiceInput;
    externalCode: string;
    ettn: string;
    today: string;
    totalLineExtension: number;
    totalDiscount: number;
    totalVat: number;
    totalPayable: number;
  }): Promise<IssueInvoiceResult> {
    const { input, externalCode, today, totalLineExtension, totalDiscount, totalVat, totalPayable } = args;
    const buyer = input.buyer;

    if (!buyer.receiverInboxTag) {
      return { ok: false, error: "e-Fatura için ReceiverInboxTag gerekli (GetTaxPayer'dan alınmalı)" };
    }

    const linesXml = input.lineItems
      .map((it) => this.buildInvoiceDetailXml(it))
      .join("\n");

    const notesXml = (input.notes || [])
      .map((n) => `                <arr:string>${xmlEscape(n)}</arr:string>`)
      .join("\n");

    const body = `
    <tem:SendInvoice>
      <tem:request>
        <ein:CompanyTaxCode>${xmlEscape(this.cfg.companyTaxCode)}</ein:CompanyTaxCode>
        <ein:Invoices>
          <ein:Invoice>
            <ein:CurrencyCode>TRY</ein:CurrencyCode>
            <ein:CompanyBranchAddress>
              <ein:BoulevardAveneuStreetName>${xmlEscape(this.cfg.companyAddress)}</ein:BoulevardAveneuStreetName>
              <ein:CityCode>0</ein:CityCode>
              <ein:CityName>${xmlEscape(this.cfg.companyCity)}</ein:CityName>
              <ein:TaxOfficeCode>0</ein:TaxOfficeCode>
              <ein:TaxOfficeName>${xmlEscape(this.cfg.companyTaxOffice)}</ein:TaxOfficeName>
              <ein:TownCode>0</ein:TownCode>
              <ein:TownName>${xmlEscape(this.cfg.companyDistrict)}</ein:TownName>
            </ein:CompanyBranchAddress>
            <ein:ExternalInvoiceCode>${xmlEscape(externalCode)}</ein:ExternalInvoiceCode>
            <ein:InvoiceDate>${today}</ein:InvoiceDate>
            <ein:InvoiceDetails>
${linesXml}
            </ein:InvoiceDetails>
            <ein:InvoiceType>SATIS</ein:InvoiceType>
            <ein:Notes>
${notesXml}
            </ein:Notes>
            <ein:OrderDate>${today}</ein:OrderDate>
            <ein:OrderNumber>${xmlEscape(input.source.orderId || String(input.source.id))}</ein:OrderNumber>
            <ein:Receiver>
              <ein:ReceiverName>${xmlEscape(buyer.companyName || buyer.name)}</ein:ReceiverName>
              <ein:ReceiverTaxCode>${xmlEscape(buyer.taxId || "")}</ein:ReceiverTaxCode>
              <ein:RecipientType>NONE</ein:RecipientType>
              <ein:SendingType>NONE</ein:SendingType>
            </ein:Receiver>
            <ein:ReceiverBranchAddress>
              <ein:BoulevardAveneuStreetName>${xmlEscape(buyer.address ?? "")}</ein:BoulevardAveneuStreetName>
              <ein:CityCode>0</ein:CityCode>
              <ein:CityName>${xmlEscape(buyer.city ?? "")}</ein:CityName>
              <ein:TaxOfficeCode>0</ein:TaxOfficeCode>
              <ein:TaxOfficeName>${xmlEscape(buyer.taxOffice ?? "")}</ein:TaxOfficeName>
              <ein:TownCode>0</ein:TownCode>
              <ein:TownName>${xmlEscape(buyer.district ?? "")}</ein:TownName>
            </ein:ReceiverBranchAddress>
            <ein:ReceiverInboxTag>${xmlEscape(buyer.receiverInboxTag)}</ein:ReceiverInboxTag>
            <ein:ScenarioType>TEMELFATURA</ein:ScenarioType>
            <ein:TotalDiscountAmount>${kurus2str(totalDiscount)}</ein:TotalDiscountAmount>
            <ein:TotalLineExtensionAmount>${kurus2str(totalLineExtension)}</ein:TotalLineExtensionAmount>
            <ein:TotalPayableAmount>${kurus2str(totalPayable)}</ein:TotalPayableAmount>
            <ein:TotalTaxInclusiveAmount>${kurus2str(totalLineExtension)}</ein:TotalTaxInclusiveAmount>
            <ein:TotalVATAmount>${kurus2str(totalVat)}</ein:TotalVATAmount>
          </ein:Invoice>
        </ein:Invoices>
      </tem:request>
    </tem:SendInvoice>`;

    const res = await soapCall({
      env: this.env,
      service: "InvoiceService",
      method: "SendInvoice",
      body,
      timeoutMs: 45000,
    });

    if (!res.ok || !res.xml) {
      return { ok: false, error: res.error ?? "SOAP başarısız" };
    }
    const err = parseSoapError(res.xml);
    if (err) {
      return { ok: false, error: err, rawResponse: res.xml.slice(0, 2000) };
    }
    const responseEttn = extractTag(res.xml, "ETTN") || extractTag(res.xml, "Ettn") || args.ettn;

    return {
      ok: true,
      ettn: responseEttn,
      externalInvoiceCode: externalCode,
      rawResponse: res.xml.slice(0, 5000),
    };
  }

  private buildArchiveDetailXml(it: InvoiceLineItem): string {
    const grossKurus = it.unitPriceKurus * it.quantity;
    const discountKurus = it.discountKurus ?? 0;
    const lineExt = grossKurus - discountKurus;
    const vat = Math.round((lineExt * it.vatRate) / 100);
    const discountRate = grossKurus > 0 ? (discountKurus / grossKurus) * 100 : 0;

    return `              <ein:ArchiveInvoiceDetail>
                <ein:CurrencyCode>TRY</ein:CurrencyCode>
                <ein:DiscountAmount>${kurus2str(discountKurus)}</ein:DiscountAmount>
                <ein:DiscountRate>${discountRate.toFixed(2)}</ein:DiscountRate>
                <ein:LineExtensionAmount>${kurus2str(lineExt)}</ein:LineExtensionAmount>
                <ein:Note>${xmlEscape(it.note ?? "")}</ein:Note>
                <ein:Product>
                  <ein:ExternalProductCode>${xmlEscape(it.productCode)}</ein:ExternalProductCode>
                  <ein:MeasureUnit>${it.measureUnit ?? "NIU"}</ein:MeasureUnit>
                  <ein:ProductCode>${xmlEscape(it.productCode.slice(0, 20))}</ein:ProductCode>
                  <ein:ProductName>${xmlEscape(it.productName)}</ein:ProductName>
                  <ein:UnitPrice>${kurus2str(it.unitPriceKurus)}</ein:UnitPrice>
                </ein:Product>
                <ein:Quantity>${it.quantity}</ein:Quantity>
                <ein:VATAmount>${kurus2str(vat)}</ein:VATAmount>
                <ein:VATRate>${it.vatRate.toFixed(2)}</ein:VATRate>
              </ein:ArchiveInvoiceDetail>`;
  }

  private buildInvoiceDetailXml(it: InvoiceLineItem): string {
    const grossKurus = it.unitPriceKurus * it.quantity;
    const discountKurus = it.discountKurus ?? 0;
    const lineExt = grossKurus - discountKurus;
    const vat = Math.round((lineExt * it.vatRate) / 100);
    const discountRate = grossKurus > 0 ? (discountKurus / grossKurus) * 100 : 0;

    return `              <ein:InvoiceDetail>
                <ein:CurrencyCode>TRY</ein:CurrencyCode>
                <ein:DiscountRate>${discountRate.toFixed(10)}</ein:DiscountRate>
                <ein:DiscountAmount>${kurus2str(discountKurus)}</ein:DiscountAmount>
                <ein:LineExtensionAmount>${kurus2str(lineExt)}</ein:LineExtensionAmount>
                <ein:Note>${xmlEscape(it.note ?? "")}</ein:Note>
                <ein:Product>
                  <ein:ExternalProductCode>${xmlEscape(it.productCode)}</ein:ExternalProductCode>
                  <ein:MeasureUnit>${it.measureUnit ?? "NIU"}</ein:MeasureUnit>
                  <ein:ProductName>${xmlEscape(it.productName)}</ein:ProductName>
                  <ein:ProductCode>${xmlEscape(it.productCode.slice(0, 20))}</ein:ProductCode>
                  <ein:ReceiverProductCode>${xmlEscape(it.productCode.slice(0, 20))}</ein:ReceiverProductCode>
                  <ein:UnitPrice>${kurus2str(it.unitPriceKurus)}</ein:UnitPrice>
                </ein:Product>
                <ein:Quantity>${it.quantity}</ein:Quantity>
                <ein:SpecialBasisAmount>0</ein:SpecialBasisAmount>
                <ein:SpecialBasisPercent>0</ein:SpecialBasisPercent>
                <ein:SpecialBasisTaxAmount>0</ein:SpecialBasisTaxAmount>
                <ein:VATAmount>${kurus2str(vat)}</ein:VATAmount>
                <ein:VATRate>${it.vatRate.toFixed(2)}</ein:VATRate>
              </ein:InvoiceDetail>`;
  }

  async getViewerUrl(ettn: string, type: InvoiceType): Promise<{ url: string; expiresAt: Date } | null> {
    const docType = type === "einvoice" ? "EInvoice" : "EArchiveInvoice";
    const body = `
    <tem:GetDocumentViewerLink>
      <tem:request>
        <ein:CompanyTaxCode>${xmlEscape(this.cfg.companyTaxCode)}</ein:CompanyTaxCode>
        <ein:Ettn>${xmlEscape(ettn)}</ein:Ettn>
        <ein:InvoiceDirection>Outgoing</ein:InvoiceDirection>
        <ein:InvoiceDocumentType>${docType}</ein:InvoiceDocumentType>
      </tem:request>
    </tem:GetDocumentViewerLink>`;

    const res = await soapCall({
      env: this.env,
      service: "InvoiceService",
      method: "GetDocumentViewerLink",
      body,
      timeoutMs: 15000,
    });

    if (!res.ok || !res.xml) return null;
    const url =
      extractTag(res.xml, "ViewerLink") ||
      extractTag(res.xml, "DocumentViewerLink") ||
      extractTag(res.xml, "Url");
    if (!url) return null;

    // Link genelde 24 saat geçerli
    return {
      url,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  async cancelInvoice(
    input: CancelInvoiceInput & { ettn: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const body = `
    <tem:CancelArchiveInvoice>
      <tem:request>
        <ein:ArchiveInvoiceList>
          <ein:ArchiveInvoiceCancellation>
            <ein:CancellationReason>${xmlEscape(input.reason)}</ein:CancellationReason>
            <ein:ETTN>${xmlEscape(input.ettn)}</ein:ETTN>
          </ein:ArchiveInvoiceCancellation>
        </ein:ArchiveInvoiceList>
        <ein:CompanyTaxCode>${xmlEscape(this.cfg.companyTaxCode)}</ein:CompanyTaxCode>
        <ein:CompanyVendorNumber>${xmlEscape(this.cfg.companyVendorNumber)}</ein:CompanyVendorNumber>
      </tem:request>
    </tem:CancelArchiveInvoice>`;

    const res = await soapCall({
      env: this.env,
      service: "InvoiceService",
      method: "CancelArchiveInvoice",
      body,
      timeoutMs: 15000,
    });

    if (!res.ok || !res.xml) return { ok: false, error: res.error };
    const err = parseSoapError(res.xml);
    if (err) return { ok: false, error: err };
    return { ok: true };
  }

  async healthCheck(): Promise<{ ok: boolean; message?: string }> {
    // ValidateUserCompany ile credentials + endpoint testi
    const body = `
    <tem:ValidateUserCompany>
      <tem:request>
        <ein:CompanyTaxCode>${xmlEscape(this.cfg.companyTaxCode)}</ein:CompanyTaxCode>
        <ein:CompanyVendorNumber>${xmlEscape(this.cfg.companyVendorNumber)}</ein:CompanyVendorNumber>
        <ein:UserPassword>${xmlEscape(this.cfg.userPassword)}</ein:UserPassword>
        <ein:UserTaxCode>${xmlEscape(this.cfg.userTaxCode)}</ein:UserTaxCode>
      </tem:request>
    </tem:ValidateUserCompany>`;

    const res = await soapCall({
      env: this.env,
      service: "InvoiceService",
      method: "ValidateUserCompany",
      body,
      timeoutMs: 15000,
    });

    if (!res.ok || !res.xml) {
      return { ok: false, message: res.error ?? "SOAP başarısız" };
    }
    const err = parseSoapError(res.xml);
    if (err) return { ok: false, message: err };
    return { ok: true, message: "Luca bağlantısı ve credentials başarılı" };
  }
}
