import { useEffect } from "react";
import { colors, fonts } from "./tokens";
import { CheckCircle, XCircle, Info, AlertCircle } from "lucide-react";

/**
 * Native mobil toast bileşeni.
 * Alert() yerine — 2.5 sn görünür, alt tabbar üstünde konumlanır.
 */

export type ToastType = "success" | "error" | "info" | "warning";

interface Props {
  message: string;
  type?: ToastType;
  visible: boolean;
  onClose?: () => void;
  duration?: number;
}

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertCircle,
};

const BG_COLORS = {
  success: colors.navy,
  error: colors.error,
  info: colors.navy,
  warning: colors.warn,
};

export function Toast({ message, type = "success", visible, onClose, duration = 2500 }: Props) {
  useEffect(() => {
    if (visible && onClose) {
      const t = setTimeout(onClose, duration);
      return () => clearTimeout(t);
    }
  }, [visible, duration, onClose]);

  if (!visible) return null;

  const Icon = ICONS[type];

  return (
    <div style={{
      position: "fixed",
      left: "50%",
      bottom: 96,
      transform: "translate(-50%, 0)",
      background: BG_COLORS[type],
      color: colors.white,
      padding: "14px 20px",
      borderRadius: 100,
      fontFamily: fonts.heading,
      fontWeight: 700,
      fontSize: 13,
      letterSpacing: "-0.01em",
      boxShadow: "0 8px 24px rgba(30, 58, 110, 0.24)",
      display: "flex",
      alignItems: "center",
      gap: 10,
      zIndex: 100,
      maxWidth: "calc(100vw - 40px)",
      animation: "toast-in 0.24s ease-out",
    }}>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
      <Icon size={16} strokeWidth={2.5} color={type === "success" ? colors.turq : colors.white} />
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {message}
      </span>
    </div>
  );
}

/**
 * useToast hook — toast state yönetimi.
 */
import { useState, useCallback } from "react";

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: ToastType; visible: boolean }>({
    message: "", type: "success", visible: false,
  });

  const show = useCallback((message: string, type: ToastType = "success") => {
    setToast({ message, type, visible: true });
  }, []);

  const hide = useCallback(() => {
    setToast((t) => ({ ...t, visible: false }));
  }, []);

  return { toast, show, hide };
}
