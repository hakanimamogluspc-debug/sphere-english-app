// Minimal ESLint flat config for sphere-english frontend.
//
// Hedef: Bugun 2 kez prod'u kıran bug kategorilerini yakalamak:
//   1) React Rules of Hooks ihlali (SpeakingScenes'de early return
//      sonrasında useMemo çağrılıyordu)
//   2) Tanımsız referans (TeacherProgress'te ScoreBadge silinmiş
//      ama kullanımı kalmıştı)
//
// Kullanım:
//   pnpm --filter @workspace/sphere-english run lint
//   pnpm --filter @workspace/sphere-english run lint:fix
import reactHooks from "eslint-plugin-react-hooks";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/*.d.ts",
      "**/*.generated.ts",
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        fetch: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Blob: "readonly",
        FormData: "readonly",
        Audio: "readonly",
        SpeechSynthesisUtterance: "readonly",
        Uint8Array: "readonly",
        atob: "readonly",
        btoa: "readonly",
        alert: "readonly",
        confirm: "readonly",
        prompt: "readonly",
        process: "readonly",
        HTMLElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLDivElement: "readonly",
        HTMLTextAreaElement: "readonly",
        HTMLSelectElement: "readonly",
        HTMLFormElement: "readonly",
        HTMLAnchorElement: "readonly",
        HTMLImageElement: "readonly",
        HTMLSpanElement: "readonly",
        HTMLParagraphElement: "readonly",
        HTMLHeadingElement: "readonly",
        HTMLLabelElement: "readonly",
        Element: "readonly",
        Event: "readonly",
        MouseEvent: "readonly",
        KeyboardEvent: "readonly",
        Response: "readonly",
        Request: "readonly",
        RequestInit: "readonly",
        AbortController: "readonly",
        FileReader: "readonly",
        File: "readonly",
        MediaRecorder: "readonly",
        MediaStream: "readonly",
        AudioContext: "readonly",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      // Kritik — SpeakingScenes bug'ını yakalayan kural:
      "react-hooks/rules-of-hooks": "error",

      // no-undef: TypeScript'in zaten daha iyi yaptığı iş.
      // Tanımsız referansları (TeacherProgress'teki ScoreBadge gibi)
      // tsc --noEmit yakalıyor. Burada aktif bırakmak React 17+ JSX
      // transform ve DOM globals'ı (HTMLAudioElement vb.) yüzlerce
      // false-positive üretir.
      "no-undef": "off",

      // Yararlı ama kırma değil:
      "react-hooks/exhaustive-deps": "warn",
      "no-unused-vars": "off",
      "no-case-declarations": "warn",
      "no-empty": "warn",
      "no-prototype-builtins": "warn",
    },
  },
];
