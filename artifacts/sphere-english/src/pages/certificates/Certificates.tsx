import { useGetCertificates } from "@workspace/api-client-react";
import { Card, CardContent, Badge, Button } from "@/components/ui/core";
import { Award, Download, ExternalLink, Calendar, QrCode } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const levelLabel: Record<string, string> = {
  A1: "A1 - Başlangıç",
  A2: "A2 - Temel",
  B1: "B1 - Orta Altı",
  B2: "B2 - Orta",
  C1: "C1 - İleri",
  C2: "C2 - Ustalık",
};

export default function Certificates() {
  const { data: certificates, isLoading } = useGetCertificates();
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-display">Sertifikalarım</h1>
        <p className="text-muted-foreground mt-1">Tamamladığınız kursların sertifikaları burada görünür.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map(i => <Card key={i} className="h-64 animate-pulse bg-secondary/50" />)}
        </div>
      ) : certificates?.length === 0 ? (
        <Card>
          <CardContent className="py-20 text-center">
            <Award className="h-20 w-20 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-bold mb-2">Henüz sertifikanız yok</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">Bir kursu tamamladığınızda sertifikanız otomatik olarak oluşturulur ve burada gösterilir.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {certificates?.map(cert => (
            <Card key={cert.id} className="overflow-hidden border-2 border-border hover:border-primary/30 transition-colors group">
              {/* Sertifika Görünümü */}
              <div className="bg-gradient-to-br from-primary via-primary/90 to-accent p-8 text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-4 left-4 w-32 h-32 rounded-full border-4 border-white" />
                  <div className="absolute bottom-4 right-4 w-48 h-48 rounded-full border-4 border-white" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <Award className="h-8 w-8 text-yellow-300" />
                    <span className="text-sm font-semibold text-white/80 uppercase tracking-wider">Başarı Belgesi</span>
                  </div>
                  <p className="text-white/80 text-sm mb-1">Bu sertifika şuna aittir:</p>
                  <h2 className="text-2xl font-bold font-display mb-3">{user?.firstName} {user?.lastName}</h2>
                  <p className="text-white/80 text-sm mb-1">Kursu başarıyla tamamladığı için:</p>
                  <h3 className="text-xl font-semibold mb-3">{cert.courseName}</h3>
                  {cert.level && (
                    <Badge className="bg-white/20 text-white border-white/30">
                      {levelLabel[cert.level] || cert.level}
                    </Badge>
                  )}
                </div>
              </div>

              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar size={16} />
                    <span>Verilme Tarihi: {new Date(cert.issuedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                  {cert.qrCode && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <QrCode size={14} />
                      <span className="font-mono">{cert.qrCode.slice(0, 10)}...</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" size="sm" className="flex-1 gap-2">
                    <Download size={16} /> İndir
                  </Button>
                  {cert.qrCode && (
                    <a href={`${import.meta.env.BASE_URL}certificates/verify/${cert.qrCode}`} target="_blank" rel="noreferrer" className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-2">
                        <ExternalLink size={16} /> Doğrula
                      </Button>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
