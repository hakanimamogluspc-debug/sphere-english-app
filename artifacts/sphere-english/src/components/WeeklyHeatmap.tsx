import { useEffect, useState } from "react";
import { API } from "@/lib/api-url";

type DayData = {
  date: string;
  sessions: number;
  totalMinutes: number;
  totalSeconds: number;
};

const DAYS_TR = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

function getIntensity(minutes: number): string {
  if (minutes === 0) return "bg-muted hover:bg-muted/80";
  if (minutes < 10) return "bg-primary/20 hover:bg-primary/30";
  if (minutes < 30) return "bg-primary/50 hover:bg-primary/60";
  if (minutes < 60) return "bg-primary/80 hover:bg-primary/90";
  return "bg-primary hover:bg-primary/90";
}

export default function WeeklyHeatmap() {
  const [data, setData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ day: DayData; x: number; y: number } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("sphere_token");
    fetch(`${API}/api/reports/weekly-activity`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(d => { setData(Array.isArray(d) ? d : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="h-16 animate-pulse bg-muted rounded-xl" />;
  }

  const totalMinutes = data.reduce((s, d) => s + d.totalMinutes, 0);
  const activeDays = data.filter(d => d.sessions > 0).length;

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2 justify-between">
        <div className="flex gap-1.5 flex-1">
          {data.map((day, i) => {
            const d = new Date(day.date + "T00:00:00");
            const dayLabel = DAYS_TR[d.getDay()];
            const isToday = day.date === new Date().toISOString().split("T")[0];

            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full rounded-lg cursor-pointer transition-colors relative ${getIntensity(day.totalMinutes)}`}
                  style={{ height: 40 }}
                  onMouseEnter={(e) => {
                    const rect = (e.target as HTMLElement).getBoundingClientRect();
                    setTooltip({ day, x: rect.left + rect.width / 2, y: rect.top });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {day.sessions > 0 && (
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-primary-foreground">
                      {day.sessions}
                    </span>
                  )}
                </div>
                <span className={`text-xs ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>
                  {dayLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Açıklama */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Bu hafta: <strong className="text-foreground">{activeDays} aktif gün</strong></span>
        <span>Toplam: <strong className="text-foreground">{totalMinutes >= 60
          ? `${Math.floor(totalMinutes / 60)}s ${totalMinutes % 60}dk`
          : `${totalMinutes} dakika`}</strong></span>
        <div className="flex items-center gap-1">
          <span>Az</span>
          <div className="flex gap-0.5">
            {["bg-muted", "bg-primary/20", "bg-primary/50", "bg-primary/80", "bg-primary"].map((c, i) => (
              <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
            ))}
          </div>
          <span>Çok</span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-xs pointer-events-none"
          style={{ left: tooltip.x - 60, top: tooltip.y - 70 }}
        >
          <p className="font-semibold text-foreground">
            {new Date(tooltip.day.date + "T00:00:00").toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <p className="text-muted-foreground">{tooltip.day.sessions} oturum</p>
          <p className="text-primary font-medium">
            {tooltip.day.totalMinutes >= 60
              ? `${Math.floor(tooltip.day.totalMinutes / 60)}s ${tooltip.day.totalMinutes % 60}dk`
              : `${tooltip.day.totalMinutes} dakika`}
          </p>
        </div>
      )}
    </div>
  );
}
