/**
 * PDF preview üretici.
 *
 * Tam PDF'in ilk N sayfasını ayıklayıp yeni bir PDF buffer döndürür.
 * E-kitap admin akışında "full" asset yüklendiğinde otomatik preview üretmek
 * için kullanılır — pazarlama sitesinde "Ücretsiz Önizleme" butonu için.
 *
 * Karşılaştırma: önceden ilk kitap için manuel pypdf ile kesiyorduk;
 * artık tam PDF yüklenince otomatik üretiliyor.
 */

import { PDFDocument } from "pdf-lib";

export interface PreviewResult {
  buffer: Buffer;
  pageCount: number;
  /** Tam PDF'in sayfa sayısı */
  sourcePageCount: number;
  byteSize: number;
}

/**
 * Verilen tam PDF buffer'ından ilk N sayfayı ayıklar.
 *
 * @param fullPdfBuffer  Tam PDF binary (örn. ebook_assets.data_base64 → Buffer)
 * @param maxPages       İlk kaç sayfa alınacak (default 5)
 * @returns              Preview PDF buffer + meta
 */
export async function generatePreviewPdf(
  fullPdfBuffer: Buffer,
  maxPages: number = 5,
): Promise<PreviewResult> {
  if (!fullPdfBuffer || fullPdfBuffer.length === 0) {
    throw new Error("PDF buffer boş");
  }

  const source = await PDFDocument.load(fullPdfBuffer, {
    // Encrypted veya hatalı PDF'leri tolere et
    ignoreEncryption: true,
  });
  const sourcePageCount = source.getPageCount();
  if (sourcePageCount === 0) {
    throw new Error("Kaynak PDF'de sayfa yok");
  }

  const targetPageCount = Math.min(maxPages, sourcePageCount);
  const preview = await PDFDocument.create();

  // Meta'yı kopyala
  const title = source.getTitle();
  if (title) preview.setTitle(title + " — Önizleme");
  const author = source.getAuthor();
  if (author) preview.setAuthor(author);
  preview.setCreator("Sphere English — Otomatik Önizleme");
  preview.setProducer("Sphere English");
  preview.setCreationDate(new Date());

  // İlk N sayfayı kopyala
  const indices = Array.from({ length: targetPageCount }, (_, i) => i);
  const copied = await preview.copyPages(source, indices);
  copied.forEach((p) => preview.addPage(p));

  const previewBytes = await preview.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });
  const buffer = Buffer.from(previewBytes);

  return {
    buffer,
    pageCount: targetPageCount,
    sourcePageCount,
    byteSize: buffer.length,
  };
}
