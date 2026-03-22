import { useGetLeaderboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/core";
import { useAuth } from "@/hooks/use-auth";
import { Trophy, Crown, Medal, Flame } from "lucide-react";

function getRankIcon(rank: number) {
  if (rank === 1) return <Crown className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
  return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{rank}</span>;
}

function getRankBg(rank: number) {
  if (rank === 1) return "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200";
  if (rank === 2) return "bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200";
  if (rank === 3) return "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200";
  return "border-border";
}

function getLevelBg(level: string) {
  const colors: Record<string, string> = {
    A1: "bg-blue-100 text-blue-800",
    A2: "bg-cyan-100 text-cyan-800",
    B1: "bg-green-100 text-green-800",
    B2: "bg-yellow-100 text-yellow-800",
    C1: "bg-orange-100 text-orange-800",
    C2: "bg-red-100 text-red-800",
  };
  return colors[level] || "bg-gray-100 text-gray-700";
}

function Avatar({ name, rank }: { name: string; rank: number }) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const colors = [
    "from-blue-500 to-blue-600", "from-purple-500 to-purple-600", "from-green-500 to-green-600",
    "from-orange-500 to-orange-600", "from-pink-500 to-pink-600", "from-teal-500 to-teal-600",
  ];
  return (
    <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${colors[rank % colors.length]} flex items-center justify-center text-white font-bold text-sm`}>
      {initials}
    </div>
  );
}

export default function Leaderboard() {
  const { user } = useAuth();
  const { data: leaders, isLoading } = useGetLeaderboard();

  const top3 = leaders?.slice(0, 3) || [];
  const rest = leaders?.slice(3) || [];
  const myRank = leaders?.findIndex(l => l.userId === user?.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-display">Leaderboard</h1>
        <p className="text-muted-foreground mt-1">See how you rank among all Sphere English learners.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => <Card key={i} className="h-20 animate-pulse bg-secondary/50" />)}
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          {top3.length >= 3 && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              {/* 2nd Place */}
              <Card className={`flex flex-col items-center p-6 border-2 ${getRankBg(2)} mt-8`}>
                <Medal className="h-8 w-8 text-gray-400 mb-2" />
                <Avatar name={`${top3[1]?.firstName} ${top3[1]?.lastName}`} rank={2} />
                <p className="mt-2 font-bold text-sm text-center">{top3[1]?.firstName} {top3[1]?.lastName}</p>
                <p className="text-2xl font-bold font-display text-primary mt-1">{top3[1]?.totalPoints}</p>
                <p className="text-xs text-muted-foreground">points</p>
              </Card>

              {/* 1st Place */}
              <Card className={`flex flex-col items-center p-6 border-2 ${getRankBg(1)} shadow-lg shadow-yellow-200/40 -mt-4`}>
                <Crown className="h-8 w-8 text-yellow-500 mb-2" />
                <Avatar name={`${top3[0]?.firstName} ${top3[0]?.lastName}`} rank={1} />
                <p className="mt-2 font-bold text-sm text-center">{top3[0]?.firstName} {top3[0]?.lastName}</p>
                <p className="text-3xl font-bold font-display text-yellow-600 mt-1">{top3[0]?.totalPoints}</p>
                <p className="text-xs text-muted-foreground">points</p>
                {top3[0]?.currentLevel && (
                  <Badge className={`mt-2 text-xs ${getLevelBg(top3[0].currentLevel)}`}>{top3[0].currentLevel}</Badge>
                )}
              </Card>

              {/* 3rd Place */}
              <Card className={`flex flex-col items-center p-6 border-2 ${getRankBg(3)} mt-12`}>
                <Medal className="h-8 w-8 text-amber-600 mb-2" />
                <Avatar name={`${top3[2]?.firstName} ${top3[2]?.lastName}`} rank={3} />
                <p className="mt-2 font-bold text-sm text-center">{top3[2]?.firstName} {top3[2]?.lastName}</p>
                <p className="text-2xl font-bold font-display text-primary mt-1">{top3[2]?.totalPoints}</p>
                <p className="text-xs text-muted-foreground">points</p>
              </Card>
            </div>
          )}

          {/* Your Rank Banner */}
          {myRank !== undefined && myRank >= 0 && (
            <Card className="border-2 border-accent bg-accent/5">
              <CardContent className="p-4 flex items-center gap-4">
                <Trophy className="h-6 w-6 text-accent shrink-0" />
                <p className="font-semibold text-foreground">
                  You are ranked <span className="text-accent">#{myRank + 1}</span> with <span className="text-accent">{user?.totalPoints || 0} points</span>. Keep learning to climb higher!
                </p>
              </CardContent>
            </Card>
          )}

          {/* Full Leaderboard Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" /> Full Rankings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {leaders?.map((leader, i) => {
                  const isMe = leader.userId === user?.id;
                  return (
                    <div
                      key={leader.userId}
                      className={`flex items-center gap-4 px-6 py-4 transition-colors ${isMe ? "bg-accent/5 border-l-4 border-l-accent" : "hover:bg-secondary/30"}`}
                    >
                      <div className="w-8 flex items-center justify-center shrink-0">
                        {getRankIcon(i + 1)}
                      </div>
                      <Avatar name={`${leader.firstName} ${leader.lastName}`} rank={i} />
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold truncate ${isMe ? "text-accent" : "text-foreground"}`}>
                          {leader.firstName} {leader.lastName}
                          {isMe && <span className="ml-2 text-xs font-normal text-accent/80">(You)</span>}
                        </p>
                        {leader.currentLevel && (
                          <Badge className={`text-xs mt-0.5 ${getLevelBg(leader.currentLevel)}`}>{leader.currentLevel}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {leader.streak > 0 && (
                          <div className="flex items-center gap-1 text-orange-500 text-sm font-medium">
                            <Flame size={15} /> {leader.streak}
                          </div>
                        )}
                        <div className="text-right">
                          <p className="font-bold text-lg font-display text-foreground">{leader.totalPoints}</p>
                          <p className="text-xs text-muted-foreground">pts</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(!leaders || leaders.length === 0) && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No data yet. Be the first on the leaderboard!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
