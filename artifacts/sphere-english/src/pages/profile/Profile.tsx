import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUpdateUser } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui/core";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { User, Mail, Phone, Camera, Save, Trophy, Flame, BookOpen } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const LEVEL_NAMES: Record<string, string> = {
  A1: "Beginner", A2: "Elementary", B1: "Intermediate",
  B2: "Upper-Intermediate", C1: "Advanced", C2: "Proficient"
};

function getLevelProgress(level: string, points: number) {
  const idx = LEVELS.indexOf(level);
  const perLevel = 500;
  return ((points % perLevel) / perLevel) * 100;
}

export default function Profile() {
  const { user } = useAuth();
  const updateMutation = useUpdateUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      phone: user?.phone || "",
    }
  });

  const onSave = async (data: any) => {
    if (!user) return;
    try {
      await updateMutation.mutateAsync({ id: user.id, data });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Profile updated!", description: "Your changes have been saved." });
      setEditing(false);
    } catch {
      toast({ title: "Error", description: "Could not update profile.", variant: "destructive" });
    }
  };

  if (!user) return null;

  const level = user.currentLevel || "A1";
  const levelProgress = getLevelProgress(level, user.totalPoints || 0);
  const nextLevel = LEVELS[LEVELS.indexOf(level) + 1];

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold font-display">My Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account and view your achievements.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="relative inline-block mb-4">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-3xl font-bold mx-auto">
                  {user.firstName?.[0]}{user.lastName?.[0]}
                </div>
                <button className="absolute bottom-0 right-0 h-8 w-8 bg-white border-2 border-border rounded-full flex items-center justify-center shadow-sm hover:bg-secondary transition-colors">
                  <Camera size={14} className="text-foreground" />
                </button>
              </div>
              <h2 className="text-xl font-bold font-display">{user.firstName} {user.lastName}</h2>
              <p className="text-muted-foreground text-sm capitalize">{user.role}</p>
              <div className="mt-3">
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  {level} · {LEVEL_NAMES[level]}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Trophy className="h-4 w-4 text-yellow-500" /> Total Points
                </div>
                <span className="font-bold">{user.totalPoints || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Flame className="h-4 w-4 text-orange-500" /> Day Streak
                </div>
                <span className="font-bold">{user.streak || 0} days</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <BookOpen className="h-4 w-4 text-accent" /> Current Level
                </div>
                <span className="font-bold">{level}</span>
              </div>
              {nextLevel && (
                <div className="pt-2 border-t border-border">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>{level}</span>
                    <span>→ {nextLevel}</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all"
                      style={{ width: `${levelProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-center text-muted-foreground mt-1.5">
                    {500 - ((user.totalPoints || 0) % 500)} pts to {nextLevel}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Edit Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Personal Information</CardTitle>
              {!editing && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit Profile</Button>
              )}
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSave)} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>First Name</Label>
                    <Input
                      {...register("firstName")}
                      disabled={!editing}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <Input
                      {...register("lastName")}
                      disabled={!editing}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label>Email Address</Label>
                  <div className="mt-1 flex items-center gap-2 px-3 py-2.5 bg-secondary/50 border border-border rounded-lg">
                    <Mail size={16} className="text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{user.email}</span>
                    <Badge className="ml-auto text-xs bg-green-100 text-green-800">Verified</Badge>
                  </div>
                </div>
                <div>
                  <Label>Phone Number</Label>
                  <Input
                    {...register("phone")}
                    disabled={!editing}
                    placeholder="+1 (555) 000-0000"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Account Type</Label>
                  <div className="mt-1 flex items-center gap-2 px-3 py-2.5 bg-secondary/50 border border-border rounded-lg">
                    <User size={16} className="text-muted-foreground" />
                    <span className="text-sm capitalize">{user.role}</span>
                  </div>
                </div>

                {editing && (
                  <div className="flex gap-3 pt-2">
                    <Button type="submit" disabled={updateMutation.isPending} className="flex items-center gap-2">
                      <Save size={16} /> {updateMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => { setEditing(false); reset(); }}>
                      Cancel
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Security */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Security</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Password</p>
                  <p className="text-sm text-muted-foreground">Last changed: Never</p>
                </div>
                <Button variant="outline" size="sm">Change Password</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
