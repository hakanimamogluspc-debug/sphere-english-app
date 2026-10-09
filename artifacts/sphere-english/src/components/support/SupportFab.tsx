import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { MessageSquarePlus, X, Bug, Lightbulb, HelpCircle, Loader2, CheckCircle2 } from "lucide-react";

/**
 * SupportFab — floating "Bize bildir" butonu.
 *
 * Her sayfanın sağ-alt köşesinde durur. Tıklanınca modal açılır:
 *   - Tür: bug / feature / question / other
 *   - Başlık + açıklama
 *   - POST /support/tickets
 *
 * Mobile + desktop uyumlu, dark/light mode CSS token'ları ile.
 */

const KINDS = [
  { value: "bug" as const,     label: "Hata",   icon: Bug,         color: "text-red-600 bg-red-50 border-red-200" },
  { value: "feature" as const, label: "Öneri",  icon: Lightbulb,   color: "text-amber-600 bg-amber-50 border-amber-200" },
  { value: "question" as const,label: "Soru",   icon: HelpCircle,  color: "text-blue-600 bg-blue-50 border-blue-200" },
];

type Kind = typeof KINDS[number]["value"];

export default function SupportFab() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("bug");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Login olmamış kullanıcıya gösterme
  if (!user) return null;

  const reset = () => {
    setKind("bug");
    setTitle("");
    setBody("");
    setError(null);
    setSuccess(false);
    setSubmitting(false);
  };

  const close = () => {
    setOpen(false);
    setTimeout(reset, 300);
  };

  const submit = async () => {
    if (!title.trim() || !body.trim()) {
      setError("Lütfen başlık ve açıklama girin");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const token = localStorage.getItem("sphere_token");
      const metadata = {
        url: window.location.href,
        userAgent: navigator.userAgent.slice(0, 500),
        platform: window.innerWidth < 768 ? "mobile" : "desktop",
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        locale: navigator.language,
      };
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ kind, title: title.trim(), body: body.trim(), metadata }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Gönderim başarısız" }));
        throw new Error(data.error || "Gönderim başarısız");
      }
      setSuccess(true);
      setTimeout(close, 1800);
    } catch (e: any) {
      setError(e?.message || "Bir hata oluştu");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Bize bildir"
        title="Bize bildir"
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
      >
        <MessageSquarePlus className="h-5 w-5" />
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={close}
        >
          <div
            className="w-full sm:max-w-md bg-background border-t sm:border sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-lg">Bize bildir</h3>
              <button
                type="button"
                onClick={close}
                className="h-8 w-8 rounded-full hover:bg-secondary flex items-center justify-center"
                aria-label="Kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {success ? (
              <div className="p-10 text-center">
                <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-3" />
                <p className="font-semibold text-lg">Teşekkürler!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Bildirimin bize ulaştı, en kısa sürede inceleyeceğiz.
                </p>
              </div>
            ) : (
              <>
                <div className="p-4 space-y-4 overflow-y-auto">
                  {/* Kind selector */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                      Konu
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {KINDS.map((k) => {
                        const Icon = k.icon;
                        const active = kind === k.value;
                        return (
                          <button
                            key={k.value}
                            type="button"
                            onClick={() => setKind(k.value)}
                            className={`p-3 rounded-xl border-2 transition-colors ${
                              active ? k.color : "border-border hover:border-primary/30"
                            }`}
                          >
                            <Icon className={`h-5 w-5 mx-auto mb-1 ${active ? "" : "text-muted-foreground"}`} />
                            <div className={`text-xs font-medium ${active ? "" : "text-muted-foreground"}`}>
                              {k.label}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <label htmlFor="support-title" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                      Başlık
                    </label>
                    <input
                      id="support-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Kısa bir özet..."
                      maxLength={200}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {/* Body */}
                  <div>
                    <label htmlFor="support-body" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                      Açıklama
                    </label>
                    <textarea
                      id="support-body"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder={
                        kind === "bug"
                          ? "Ne olduğunu, nerede ve nasıl olduğunu olabildiğince ayrıntılı anlat..."
                          : kind === "feature"
                          ? "Ne eklenmesini istersin? Nasıl yardımı olurdu?"
                          : "Sorunu yaz..."
                      }
                      rows={5}
                      maxLength={10000}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                    <p className="text-xs text-muted-foreground mt-1">{body.length} / 10000</p>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t flex gap-2">
                  <button
                    type="button"
                    onClick={close}
                    className="flex-1 py-2 px-4 rounded-lg border border-border hover:bg-secondary transition-colors text-sm font-medium"
                  >
                    İptal
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting || !title.trim() || !body.trim()}
                    className="flex-1 py-2 px-4 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Gönderiliyor…
                      </>
                    ) : (
                      "Gönder"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
