import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Mikrofon kayıt hook'u — Capacitor + Web ortak.
 * Kullanım:
 *   const rec = useMicRecorder();
 *   await rec.start();
 *   const blob = await rec.stop();
 *   // blob.type = "audio/webm" veya "audio/mp4"
 *
 * Otomatik olarak level (0-1) döndürür — canlı dalga çizimi için.
 * Hata durumları: permission-denied, no-device, unsupported, aborted.
 */

export type MicErrorCode =
  | "permission-denied"
  | "no-device"
  | "unsupported"
  | "aborted"
  | "unknown";

export interface MicError {
  code: MicErrorCode;
  message: string;
}

export interface MicRecorder {
  start: () => Promise<void>;
  stop: () => Promise<Blob | null>;
  cancel: () => void;
  recording: boolean;
  level: number;         // 0-1 canlı ses seviyesi
  duration: number;      // saniye
  error: MicError | null;
  supported: boolean;
}

function detectMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const opts = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const t of opts) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

export function useMicRecorder(): MicRecorder {
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<MicError | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationTimerRef = useRef<number | null>(null);

  const supported = typeof navigator !== "undefined"
    && !!navigator.mediaDevices?.getUserMedia
    && typeof MediaRecorder !== "undefined";

  const cleanup = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (durationTimerRef.current) { clearInterval(durationTimerRef.current); durationTimerRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    analyserRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
    setLevel(0);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    setDuration(0);
    chunksRef.current = [];

    if (!supported) {
      setError({ code: "unsupported", message: "Bu cihaz mikrofon kaydını desteklemiyor." });
      throw new Error("unsupported");
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Level analiz için AudioContext kur
      try {
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AC) {
          const ctx: AudioContext = new AC();
          audioCtxRef.current = ctx;
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          src.connect(analyser);
          analyserRef.current = analyser;

          const buf = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) sum += buf[i];
            const avg = sum / buf.length / 255; // 0-1
            setLevel(avg);
            rafRef.current = requestAnimationFrame(tick);
          };
          tick();
        }
      } catch { /* analiz olmasa da devam et */ }

      const mime = detectMime();
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(200); // her 200ms'de chunk
      startTimeRef.current = Date.now();
      setRecording(true);

      durationTimerRef.current = window.setInterval(() => {
        setDuration((Date.now() - startTimeRef.current) / 1000);
      }, 100);
    } catch (e: any) {
      cleanup();
      let code: MicErrorCode = "unknown";
      if (e?.name === "NotAllowedError" || e?.name === "SecurityError") code = "permission-denied";
      else if (e?.name === "NotFoundError") code = "no-device";
      else if (e?.name === "AbortError") code = "aborted";
      const msg = code === "permission-denied"
        ? "Mikrofon izni verilmedi. Ayarlar'dan izin verip tekrar dener misin?"
        : code === "no-device"
          ? "Mikrofon bulunamadı."
          : "Mikrofon başlatılamadı.";
      setError({ code, message: msg });
      throw e;
    }
  }, [supported, cleanup]);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") {
      cleanup();
      setRecording(false);
      return null;
    }
    return new Promise((resolve) => {
      rec.onstop = () => {
        const mime = rec.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        cleanup();
        setRecording(false);
        resolve(blob);
      };
      try { rec.stop(); } catch { resolve(null); cleanup(); setRecording(false); }
    });
  }, [cleanup]);

  const cancel = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.onstop = null;
      try { rec.stop(); } catch { /* ignore */ }
    }
    chunksRef.current = [];
    cleanup();
    setRecording(false);
    setDuration(0);
  }, [cleanup]);

  return { start, stop, cancel, recording, level, duration, error, supported };
}
