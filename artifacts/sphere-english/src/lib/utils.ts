import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";
  try {
    return format(parseISO(dateString), "MMM d, yyyy");
  } catch (e) {
    return dateString;
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";
  try {
    return format(parseISO(dateString), "MMM d, yyyy 'at' h:mm a");
  } catch (e) {
    return dateString;
  }
}

/** Öğretmen görünümü için öğrenci adını kısaltır: "Hakan İnce" → "Hakan İ." */
export function abbrevName(firstName?: string | null, lastName?: string | null): string {
  const first = firstName?.trim() || "";
  const last = lastName?.trim() || "";
  if (!first && !last) return "?";
  if (!last) return first;
  return `${first} ${last[0].toUpperCase()}.`;
}

export function getLevelColor(level: string | null | undefined): string {
  switch (level) {
    case "A1": return "bg-slate-100 text-slate-700 border-slate-200";
    case "A2": return "bg-green-100 text-green-700 border-green-200";
    case "B1": return "bg-blue-100 text-blue-700 border-blue-200";
    case "B2": return "bg-purple-100 text-purple-700 border-purple-200";
    case "C1": return "bg-orange-100 text-orange-700 border-orange-200";
    case "C2": return "bg-red-100 text-red-700 border-red-200";
    default: return "bg-primary/10 text-primary border-primary/20";
  }
}
