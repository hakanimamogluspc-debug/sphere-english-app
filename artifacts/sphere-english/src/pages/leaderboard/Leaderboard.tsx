import { useGetLeaderboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/core";
import { useAuth } from "@/hooks/use-auth";
import { Trophy, Crown, Medal, Flame } from "lucide-react";

const podiumColors = [
  "bg-gradient-to-b from-yellow-400 to-yellow-300 text-yellow-900",
  "bg-gradient-to-b from-slate-400 to-slate-300 text-slate-800",
  "bg-gradient-to-b from-amber-600 to-amber-500 text-amber-100",
];

const podiumIcons = [
  <Crown className="h-6 w-6 text-yellow-500" />,
  <Medal className="h-6 w-6 text-slate-400" />,
  <Medal className="h-6 w-6 text-amber-600" />,
];

const podiumHeights = ["h-32", "h-24", "h-20"];

export default function Leaderboard() {
  const { data: leaderboard, isLoading } = useGetLeaderboard();
  const { user } = useAuth();

  const top3 = leaderboard?.slice(0, 3) || [];
  const rest = leaderboard?.slice(3) || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-display">Sıralama Tablosu</h1>
        <p className="text-muted-foreground mt-1">Toplulukta en çok puan kazanan öğrenciler.</p>
      </div>

      {isLoading ? (
        <div className="text-center p-12 animate-pulse text-muted-foreground">Sıralama yükleniyor...</div>
      ) : (
        <>
          {/* Podyum */}
          {top3.length >= 3 && (
            <Card className="overflow-hidden">
              <CardContent className="p-8">
                <div className="flex items-end justify-center gap-4 mb-8">
                  {[top3[1], top3[0], top3[2]].map((entry, podiumPos) => {
                    const actualRank = podiumPos === 0 ? 1 : podiumPos === 1 ? 0 : 2;
                    return (
                      <div key={entry?.userId} className="flex flex-col items-center flex-1 max-w-[160px]">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mb-2 shadow-lg ${actualRank === 0 ? 'bg-yellow-100 text-yellow-800 ring-4 ring-yellow-400' : 'bg-secondary'}`}>
                          {entry?.firstName?.[0]}{entry?.lastName?.[0]}
                        </div>
                        <div className="mb-1">{podiumIcons[actualRank]}</div>
                        <p className="font-bold text-sm text-center">{entry?.firstName} {entry?.lastName}</p>
                        <p className="text-xs text-muted-foreground">{entry?.totalPoints?.toLocaleString('tr-TR')} puan</p>
                        <div className={`w-full mt-3 rounded-t-xl flex items-end justify-center pb-2 ${podiumColors[actualRank]} ${podiumHeights[actualRank]}`}>
                          <span className="font-black text-2xl opacity-60">#{actualRank + 1}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tam Liste */}
          <Card>
            <CardHeader>
              <CardTitle>Tam Sıralama</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {leaderboard?.map((entry, index) => {
                  const isCurrentUser = entry.userId === user?.id;
                  return (
                    <div key={entry.userId} className={`flex items-center gap-4 px-6 py-4 transition-colors ${isCurrentUser ? 'bg-primary/5 border-l-4 border-primary' : 'hover:bg-secondary/30'}`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-slate-100 text-slate-600' :
                        index === 2 ? 'bg-amber-100 text-amber-700' :
                        'bg-secondary text-muted-foreground'
                      }`}>
                        {index === 0 ? <Trophy className="h-5 w-5 text-yellow-500" /> : `#${index + 1}`}
                      </div>

                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0">
                        {entry.firstName?.[0]}{entry.lastName?.[0]}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {entry.firstName} {entry.lastName}
                          {isCurrentUser && <span className="ml-2 text-xs text-primary font-medium">(Siz)</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{entry.currentLevel || 'A1'} Seviyesi</p>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="flex items-center gap-1 text-orange-500">
                          <Flame className="h-4 w-4" />
                          <span className="text-sm font-medium">{entry.streak || 0}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-foreground">{entry.totalPoints?.toLocaleString('tr-TR')}</p>
                          <p className="text-xs text-muted-foreground">puan</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
