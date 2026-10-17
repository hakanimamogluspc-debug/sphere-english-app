import { Fragment, type ReactNode } from "react";

/**
 * Yardım merkezi için küçük, güvenli Markdown renderer.
 * Desteklenen: #/##/### başlık, paragraf, **kalın**, *italik*, `kod`, [link](url),
 * - / 1. listeler (iç içe değil), > alıntı, --- ayraç. HTML asla ham basılmaz.
 */
function renderInline(text: string, key = 0): ReactNode {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={`${key}-${i++}`}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={`${key}-${i++}`} className="px-1 py-0.5 rounded bg-slate-100 text-[0.9em]">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("*")) out.push(<em key={`${key}-${i++}`}>{tok.slice(1, -1)}</em>);
    else {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)!;
      const href = lm[2];
      const external = /^https?:\/\//.test(href) && !href.includes("sphereenglish.com");
      out.push(
        <a key={`${key}-${i++}`} href={href} className="text-sky-700 underline underline-offset-2" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {lm[1]}
        </a>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length === 1 ? out[0] : out;
}

export default function Markdown({ source, className = "" }: { source: string; className?: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;

  const flushList = (ordered: boolean) => {
    const items: string[] = [];
    const re = ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-*]\s+(.*)$/;
    while (i < lines.length) {
      const m = re.exec(lines[i]);
      if (!m) {
        // 3+ boşlukla girintili devam satırı → önceki maddeye ekle
        if (items.length && /^\s{3,}\S/.test(lines[i])) { items[items.length - 1] += " " + lines[i].trim(); i++; continue; }
        break;
      }
      items.push(m[1]);
      i++;
    }
    const Tag = ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={k++} className={`${ordered ? "list-decimal" : "list-disc"} pl-5 space-y-1.5 my-3`}>
        {items.map((it, idx) => <li key={idx}>{renderInline(it, k * 100 + idx)}</li>)}
      </Tag>,
    );
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = h[1].length;
      const cls = lvl === 1 ? "text-2xl font-bold mt-6 mb-3" : lvl === 2 ? "text-xl font-bold mt-6 mb-2" : "text-base font-semibold mt-4 mb-1.5";
      const H = (`h${lvl + 1}`) as "h2" | "h3" | "h4";
      blocks.push(<H key={k++} className={cls}>{renderInline(h[2], k)}</H>);
      i++; continue;
    }
    if (/^\s*[-*]\s+/.test(line)) { flushList(false); continue; }
    if (/^\s*\d+\.\s+/.test(line)) { flushList(true); continue; }
    if (/^---+$/.test(line.trim())) { blocks.push(<hr key={k++} className="my-5 border-slate-200" />); i++; continue; }
    if (line.startsWith(">")) {
      const q: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) { q.push(lines[i].replace(/^>\s?/, "")); i++; }
      blocks.push(
        <blockquote key={k++} className="my-3 border-l-4 border-sky-300 bg-sky-50/60 px-4 py-2.5 rounded-r-lg text-slate-700">
          {q.map((ql, idx) => <Fragment key={idx}>{renderInline(ql, k * 100 + idx)}{idx < q.length - 1 ? <br /> : null}</Fragment>)}
        </blockquote>,
      );
      continue;
    }
    // paragraf: boş satıra kadar
    const p: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3})\s|^\s*[-*]\s|^\s*\d+\.\s|^>|^---+$/.test(lines[i])) { p.push(lines[i].trim()); i++; }
    blocks.push(<p key={k++} className="my-3 leading-relaxed">{renderInline(p.join(" "), k)}</p>);
  }

  return <div className={`text-[15px] text-slate-800 ${className}`}>{blocks}</div>;
}
