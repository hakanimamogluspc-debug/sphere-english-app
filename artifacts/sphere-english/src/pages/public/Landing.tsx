import { Link } from "wouter";
import { Button } from "@/components/ui/core";
import { motion } from "framer-motion";
import { Globe, BookOpen, Video, Award, ArrowRight } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 glass border-b-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold font-display text-2xl shadow-lg">
              S
            </div>
            <span className="text-2xl font-bold font-display text-foreground tracking-tight">Sphere English</span>
          </div>
          <div className="hidden md:flex gap-8 items-center font-medium text-foreground/80">
            <a href="#features" className="hover:text-accent transition-colors">Özellikler</a>
            <a href="#levels" className="hover:text-accent transition-colors">Seviyeler</a>
            <a href="#pricing" className="hover:text-accent transition-colors">Fiyatlar</a>
          </div>
          <div className="flex gap-4">
            <Link href="/login" className="px-5 py-2.5 text-sm font-bold text-primary hover:text-accent transition-colors">Giriş Yap</Link>
            <Link href="/register" className="px-5 py-2.5 text-sm font-bold bg-accent text-white rounded-xl shadow-lg shadow-accent/30 hover:shadow-xl hover:shadow-accent/40 hover:-translate-y-0.5 transition-all">Kayıt Ol</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={`${import.meta.env.BASE_URL}images/hero-bg.png`} alt="Arka plan" className="w-full h-full object-cover object-center opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-b from-primary/80 via-primary/60 to-background"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="max-w-3xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-extrabold font-display text-white tracking-tight mb-8 leading-tight">
              İngilizceyi <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-blue-300">Özgüvenle</span> Öğren
            </h1>
            <p className="text-xl text-blue-100 mb-10 leading-relaxed">
              Sphere English, dünya standartlarında öğretmenler, interaktif modüller ve canlı derslerle doğrudan ekranınıza geliyor. A1'den C2'ye yolculuğunuza bugün başlayın.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto bg-accent text-white hover:bg-accent/90 border-0 text-lg h-14 px-8 shadow-xl shadow-accent/25 group">
                  Seviye Testini Başlat <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="/courses">
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-white/20 text-white hover:bg-white/10 glass text-lg h-14 px-8">
                  Kurslara Göz At
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent"></div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-display mb-4 text-foreground">Neden Sphere?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Akıcı İngilizceye ulaşmak için ihtiyacınız olan her şey tek bir platformda.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Video, title: "Canlı Dersler", desc: "Anadili İngilizce olan öğretmenlerle birebir veya grup derslerine katılın, kristal netliğinde HD video ile." },
              { icon: BookOpen, title: "Yapılandırılmış Yol", desc: "A1 başlangıç seviyesinden C2 ustalık seviyesine kadar CEFR uyumlu müfredatımızı takip edin." },
              { icon: Award, title: "Oyunlaştırılmış Öğrenme", desc: "Puan kazanın, serinizi canlı tutun ve ilerledikçe rozetler açın." },
            ].map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="bg-card border border-border p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 group">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-accent/10 group-hover:scale-110 transition-all">
                  <f.icon className="h-7 w-7 text-primary group-hover:text-accent transition-colors" />
                </div>
                <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                <p className="text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
