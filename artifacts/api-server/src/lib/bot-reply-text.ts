/**
 * Bot cevabı yarıda kesildiyse (model token sınırına takıldıysa) metni temizle:
 * son tamamlanmamış cümleyi — özellikle yarım kalmış bir linki — at.
 * Yarım link müşteriye bozuk adres olarak gidiyordu.
 */

export function finalizeBotReply(text: string, finishReason: string | null | undefined): string {
  let t = (text ?? "").trim();
  if (finishReason !== "length" || !t) return t;

  // Son satır / son parça bir URL ise ve yarım kalmış olabilirse, o parçayı at
  t = t.replace(/\s*\S*https?:\/\/\S*$/i, "").trim();

  // Son tam cümlede kes (. ! ? … ya da emoji/kapanış parantezinden sonra)
  const m = t.match(/^[\s\S]*[.!?…)](?=\s|$)/);
  if (m && m[0].length >= t.length * 0.4) t = m[0].trim();
  return t;
}
