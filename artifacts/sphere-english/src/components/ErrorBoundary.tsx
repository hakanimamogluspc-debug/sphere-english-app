import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Genel hata yakalayıcı. Lazy-loaded chunk'ların yüklenememesi (network blip),
 * komponent içi runtime hataları gibi durumlarda app'in tamamen çökmesini
 * engeller. Kullanıcıya yumuşak bir hata mesajı + Yeniden Yükle butonu sunar.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    // Production'da sadece konsola log; istenirse Sentry'e gönderilebilir.
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary yakaladı:", error, info);
  }

  handleReload = () => {
    // Tam sayfa reload — bozuk state'i temizler.
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return <>{this.props.fallback}</>;

      const isChunkError =
        this.state.error?.name === "ChunkLoadError" ||
        /Loading chunk|Failed to fetch dynamically imported module/i.test(
          this.state.error?.message || ""
        );

      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 px-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="text-5xl mb-4">{isChunkError ? "📡" : "⚠️"}</div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">
              {isChunkError ? "Bağlantı sorunu" : "Bir şeyler ters gitti"}
            </h1>
            <p className="text-slate-600 text-sm mb-6">
              {isChunkError
                ? "Sayfa kaynakları yüklenemedi. İnternet bağlantını kontrol edip tekrar dene."
                : "Beklenmeyen bir hata oluştu. Sayfayı yenilemek genelde sorunu çözer."}
            </p>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-lg font-semibold hover:opacity-90 transition"
            >
              Sayfayı Yenile
            </button>
            {process.env.NODE_ENV !== "production" && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="text-xs text-slate-500 cursor-pointer">
                  Geliştirici detayları
                </summary>
                <pre className="text-xs text-slate-700 mt-2 bg-slate-100 p-3 rounded overflow-auto">
                  {this.state.error.stack || this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
