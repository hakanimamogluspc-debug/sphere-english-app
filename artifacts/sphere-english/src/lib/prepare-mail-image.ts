/**
 * Görseli maile / HTML'e uygun hâle getirir (yüklemeden ÖNCE, tarayıcıda):
 *  - WebP, AVIF, BMP vb. → JPEG (saydamlık varsa PNG). Outlook WebP göstermiyor.
 *  - Genişlik MAX_WIDTH'ten büyükse küçültülür (mailler ~600px; 2x ekranlar için 1200px).
 *  - Zaten uygun olan küçük JPEG/PNG'ler ve GIF'ler (animasyon bozulmasın) olduğu gibi kalır.
 * HEIC (iPhone) Chrome'da açılamaz → anlaşılır hata verilir.
 */

export const MAIL_IMAGE_MAX_WIDTH = 1200;
const KEEP_IF_UNDER_BYTES = 900 * 1024;

export interface PreparedImage {
  file: File;
  width: number;
  height: number;
  converted: boolean;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(
        /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)
          ? `${file.name}: iPhone (HEIC) formatı tarayıcıda açılamıyor. Fotoğrafı JPEG olarak dışa aktarıp tekrar dene.`
          : `${file.name}: görsel açılamadı`,
      ));
    };
    img.src = url;
  });
}

function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const data = ctx.getImageData(0, 0, w, h).data;
  for (let i = 3; i < data.length; i += 4 * 7) if (data[i] < 250) return true;
  return false;
}

function baseName(name: string): string {
  return (name.replace(/\.[^.]+$/, "") || "gorsel").slice(0, 120);
}

export async function prepareMailImage(file: File, maxWidth = MAIL_IMAGE_MAX_WIDTH): Promise<PreparedImage> {
  const img = await loadImage(file);
  const w0 = img.naturalWidth, h0 = img.naturalHeight;
  const type = file.type === "image/jpg" ? "image/jpeg" : file.type;

  // GIF: animasyon kaybolmasın diye dokunma
  if (type === "image/gif") return { file, width: w0, height: h0, converted: false };

  // Zaten güvenli formatta, yeterince küçük ve dar → olduğu gibi
  if ((type === "image/jpeg" || type === "image/png") && w0 <= maxWidth && file.size <= KEEP_IF_UNDER_BYTES) {
    return { file, width: w0, height: h0, converted: false };
  }

  const scale = w0 > maxWidth ? maxWidth / w0 : 1;
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tarayıcı görseli işleyemedi");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);

  const asPng = type !== "image/jpeg" && hasTransparency(ctx, w, h);
  const outType = asPng ? "image/png" : "image/jpeg";
  if (!asPng) {
    // JPEG'de saydam alanlar siyah olmasın → beyaz zemin
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, outType, 0.85));
  if (!blob) throw new Error("Görsel dönüştürülemedi");
  const out = new File([blob], `${baseName(file.name)}.${asPng ? "png" : "jpg"}`, { type: outType });
  return { file: out, width: w, height: h, converted: true };
}

/** Maile yapıştırılacak <img> kodu — Outlook için width niteliği şart. */
export function mailImgTag(url: string, alt: string, width: number | null, displayWidth = 600): string {
  const w = width ? Math.min(width, displayWidth) : displayWidth;
  const safeAlt = alt.replace(/"/g, "&quot;");
  return `<img src="${url}" alt="${safeAlt}" width="${w}" style="display:block;width:100%;max-width:${w}px;height:auto;border:0;" />`;
}
