import { useGetCertificates } from "@workspace/api-client-react";
import { Card, CardContent, Badge, Button } from "@/components/ui/core";
import { Award, Download, ExternalLink, Calendar, QrCode } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

function getLevelColor(level: string) {
  const colors: Record<string, string> = {
    A1: "from-blue-500 to-blue-600",
    A2: "from-cyan-500 to-cyan-600",
    B1: "from-green-500 to-green-600",
    B2: "from-yellow-500 to-yellow-600",
    C1: "from-orange-500 to-orange-600",
    C2: "from-red-500 to-red-600",
  };
  return colors[level] || "from-primary to-primary/80";
}

export default function Certificates() {
  const { user } = useAuth();
  const { data: certs, isLoading } = useGetCertificates();

  const handleVerify = (qrCode: string) => {
    const verifyUrl = `${window.location.origin}/verify/${qrCode}`;
    window.open(verifyUrl, "_blank");
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-display">My Certificates</h1>
        <p className="text-muted-foreground mt-1">View and share your English proficiency certificates.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map(i => <Card key={i} className="h-64 animate-pulse bg-secondary/50" />)}
        </div>
      ) : certs && certs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {certs.map(cert => {
            const level = cert.level || "";
            return (
              <Card key={cert.id} className="overflow-hidden shadow-lg">
                {/* Certificate Header */}
                <div className={`bg-gradient-to-r ${getLevelColor(level)} p-8 text-center text-white relative overflow-hidden`}>
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-4 left-4 w-16 h-16 border-2 border-white rounded-full" />
                    <div className="absolute bottom-4 right-4 w-24 h-24 border-2 border-white rounded-full" />
                    <div className="absolute top-2 right-8 w-8 h-8 border border-white rotate-45" />
                  </div>
                  <div className="relative">
                    <Award className="h-12 w-12 mx-auto mb-3 opacity-90" />
                    <p className="text-sm uppercase tracking-widest font-medium opacity-80 mb-1">Certificate of</p>
                    <h3 className="text-2xl font-bold font-display">English Proficiency</h3>
                    <div className="mt-3 inline-flex items-center bg-white/20 backdrop-blur px-4 py-1.5 rounded-full">
                      <span className="text-xl font-bold">{level}</span>
                      <span className="ml-2 text-sm opacity-80">Level</span>
                    </div>
                  </div>
                </div>

                {/* Certificate Body */}
                <CardContent className="p-6">
                  <div className="text-center mb-4">
                    <p className="text-sm text-muted-foreground mb-1">Awarded to</p>
                    <p className="text-xl font-bold font-display">{user?.firstName} {user?.lastName}</p>
                  </div>

                  {cert.courseTitle && (
                    <div className="text-center mb-4 bg-secondary/50 rounded-lg p-3">
                      <p className="text-sm text-muted-foreground">for completing</p>
                      <p className="font-semibold text-foreground">{cert.courseTitle}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-6">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} />
                      <span>{cert.issuedAt ? new Date(cert.issuedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"}</span>
                    </div>
                    {cert.qrCode && (
                      <div className="flex items-center gap-1.5 text-primary cursor-pointer hover:underline" onClick={() => handleVerify(cert.qrCode!)}>
                        <QrCode size={14} />
                        <span>Verify</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" size="sm" className="flex-1 flex items-center gap-2" onClick={() => window.print()}>
                      <Download size={15} /> Download PDF
                    </Button>
                    {cert.qrCode && (
                      <Button size="sm" className="flex-1 flex items-center gap-2" onClick={() => handleVerify(cert.qrCode!)}>
                        <ExternalLink size={15} /> Share
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-20 text-center">
            <Award className="h-20 w-20 mx-auto text-muted-foreground/30 mb-6" />
            <h3 className="text-2xl font-bold mb-2">No Certificates Yet</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mb-6">
              Complete a course to earn your English proficiency certificate. They'll appear here once issued.
            </p>
            <div className="flex flex-col gap-3 items-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">1</div>
                Enroll in a course
              </div>
              <div className="h-4 w-0.5 bg-border" />
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">2</div>
                Complete all lessons
              </div>
              <div className="h-4 w-0.5 bg-border" />
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">3</div>
                Get your certificate!
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
