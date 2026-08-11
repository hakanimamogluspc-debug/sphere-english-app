import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUpdateUser } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui/core";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Trophy, Flame, BookOpen, Award } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const levelLabel: Record<string, string> = {
  admin: "Yönetici",
  teacher: "Öğretmen",
  student: "Öğrenci",
};

export default function Profile() {
  const { user } = useAuth();
  const updateMutation = useUpdateUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    phone: user?.phone || "",
    bio: user?.bio || "",
  });

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({ id: user!.id, data: form });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Profil güncellendi!", description: "Bilgileriniz başarıyla kaydedildi." });
    } catch {
      toast({ title: "Hata", description: "Profil güncellenemedi.", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-display">Profilim</h1>
        <p className="text-muted-foreground mt-1">Hesap bilgilerinizi ve tercihlerinizi yönetin.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sol: Profil Kartı */}
        <Card className="lg:col-span-1 flex flex-col items-center text-center p-8">
          <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-3xl font-bold font-display shadow-lg mb-4">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <h2 className="text-xl font-bold">{user?.firstName} {user?.lastName}</h2>
          <p className="text-muted-foreground text-sm mb-3">{user?.email}</p>
          <Badge className="mb-6">{levelLabel[user?.role || ''] || user?.role}</Badge>

          {user?.role === 'student' && (
            <div className="w-full space-y-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2"><Trophy className="h-4 w-4 text-yellow-500" /> Toplam Puan</span>
                <span className="font-bold">{user?.totalPoints || 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2"><Flame className="h-4 w-4 text-orange-500" /> Günlük Seri</span>
                <span className="font-bold">{user?.streak || 0} gün</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2"><BookOpen className="h-4 w-4 text-accent" /> Seviye</span>
                <span className="font-bold">{user?.currentLevel || 'A1'}</span>
              </div>
            </div>
          )}
        </Card>

        {/* Sağ: Düzenleme Formu */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Kişisel Bilgiler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Ad</Label>
                  <Input
                    value={form.firstName}
                    onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Soyad</Label>
                  <Input
                    value={form.lastName}
                    onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>E-posta</Label>
                <Input value={user?.email || ''} disabled className="mt-1 opacity-60" />
              </div>
              <div>
                <Label>Telefon</Label>
                <Input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+90 (555) 000-0000"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Hakkımda</Label>
                <textarea
                  value={form.bio}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                  placeholder="Kendiniz hakkında kısa bir bilgi..."
                  className="mt-1 w-full px-4 py-3 border-2 border-border rounded-xl focus:outline-none focus:border-primary bg-background text-foreground resize-none h-24 text-sm"
                />
              </div>
              <Button onClick={handleSave} isLoading={updateMutation.isPending} className="w-full">
                Değişiklikleri Kaydet
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Güvenlik</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Mevcut Şifre</Label>
                <Input type="password" placeholder="••••••••" className="mt-1" />
              </div>
              <div>
                <Label>Yeni Şifre</Label>
                <Input type="password" placeholder="••••••••" className="mt-1" />
              </div>
              <div>
                <Label>Yeni Şifre (Tekrar)</Label>
                <Input type="password" placeholder="••••••••" className="mt-1" />
              </div>
              <Button variant="outline" className="w-full">Şifreyi Güncelle</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
