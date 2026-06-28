import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, Label, Card } from "@/components/ui/core";
import { Mail, Lock, User, AlertCircle, Phone, Hash, GraduationCap, Briefcase, Building2, UserCircle, Award } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Bireysel şema (kurum kodu yok) ────────────────────────────────────────────
const bireyselSchema = z.object({
  firstName: z.string().min(2, "Ad zorunludur"),
  lastName: z.string().min(2, "Soyad zorunludur"),
  email: z.string().email("Geçerli bir e-posta adresi giriniz"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalıdır"),
  phone: z.string().optional(),
});

// ── Kurumsal şema (kurum kodu zorunlu) ────────────────────────────────────────
const kurumsalSchema = z.object({
  firstName: z.string().min(2, "Ad zorunludur"),
  lastName: z.string().min(2, "Soyad zorunludur"),
  email: z.string().email("Geçerli bir e-posta adresi giriniz"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalıdır"),
  phone: z.string().optional(),
  companyCode: z.string().min(3, "Kurum kodu zorunludur"),
});

type BireyselForm = z.infer<typeof bireyselSchema>;
type KurumsalForm = z.infer<typeof kurumsalSchema>;

export default function Register() {
  const { register: registerUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<"bireysel" | "kurumsal" | "partner">("bireysel");
  const [kurumsalRole, setKurumsalRole] = useState<"student" | "corporate">("student");

  const bireyselForm = useForm<BireyselForm>({ resolver: zodResolver(bireyselSchema) });
  const kurumsalForm = useForm<KurumsalForm>({ resolver: zodResolver(kurumsalSchema) });
  const partnerForm = useForm<BireyselForm>({ resolver: zodResolver(bireyselSchema) });

  const isSubmitting = bireyselForm.formState.isSubmitting || kurumsalForm.formState.isSubmitting || partnerForm.formState.isSubmitting;

  const onPartnerSubmit = async (data: BireyselForm) => {
    try {
      setError(null);
      await (registerUser as any)({ ...data, role: "partner", accountType: "bireysel" });
    } catch (err: any) {
      setError(err.message || "Kayıt olunamadı. Lütfen tekrar deneyin.");
    }
  };

  const onBireyselSubmit = async (data: BireyselForm) => {
    try {
      setError(null);
      await (registerUser as any)({ ...data, role: "student", accountType: "bireysel" });
    } catch (err: any) {
      setError(err.message || "Kayıt olunamadı. Lütfen tekrar deneyin.");
    }
  };

  const onKurumsalSubmit = async (data: KurumsalForm) => {
    try {
      setError(null);
      await (registerUser as any)({ ...data, role: kurumsalRole, accountType: "kurumsal" });
    } catch (err: any) {
      setError(err.message || "Kayıt olunamadı. Lütfen tekrar deneyin.");
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:block relative w-1/2 bg-primary">
        <img src={`${import.meta.env.BASE_URL}images/auth-bg.png`} alt="Sınıf" className="absolute inset-0 w-full h-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/50 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <h3 className="text-3xl font-display font-bold mb-4">Öğrenme yolculuğunuza bugün başlayın.</h3>
          <p className="text-lg text-white/80">
            {accountType === "bireysel"
              ? "Hemen ücretsiz hesap oluşturun ve İngilizce öğrenmeye başlayın."
              : accountType === "partner"
              ? "Sphere English'i tavsiye et, satışlardan komisyon kazan."
              : "Kurumunuzdan aldığınız kod ile hemen kayıt olun."}
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24 w-full lg:w-1/2 py-12 overflow-y-auto">
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="mx-auto w-full max-w-md lg:w-96">
          <div className="mb-8">
            <Link href="/" className="inline-flex mb-8">
              <img
                src={`${import.meta.env.BASE_URL}images/logo-full.png`}
                alt="Sphere English"
                className="h-[90px] w-auto object-contain"
              />
            </Link>
            <h2 className="text-3xl font-extrabold font-display text-foreground">Hesap oluştur</h2>
            <p className="mt-2 text-muted-foreground">
              {accountType === "bireysel"
                ? "Bireysel olarak ücretsiz kaydolun."
                : accountType === "partner"
                ? "Partner Programı için ön hesap oluşturun, sonra başvuru formunu doldurun."
                : "Kurumunuzdan aldığınız kod ile kayıt olun."}
            </p>
          </div>

          {/* ── Hesap tipi seçimi ──────────────────────────────── */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            <button
              type="button"
              onClick={() => { setAccountType("bireysel"); setError(null); }}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all font-medium text-xs ${
                accountType === "bireysel"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              <UserCircle className="h-6 w-6" />
              Bireysel
            </button>
            <button
              type="button"
              onClick={() => { setAccountType("kurumsal"); setError(null); }}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all font-medium text-xs ${
                accountType === "kurumsal"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              <Building2 className="h-6 w-6" />
              Kurumsal
            </button>
            <button
              type="button"
              onClick={() => { setAccountType("partner"); setError(null); }}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all font-medium text-xs ${
                accountType === "partner"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              <Award className="h-6 w-6" />
              Partner Ol
            </button>
          </div>

          {/* ── Hata mesajı ────────────────────────────────────── */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3 text-destructive mb-4"
              >
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{error}</p>
              </motion.div>
            )}
            {/* ── PARTNER FORM ──────────────────────────────────── */}
            {accountType === "partner" && (
              <motion.form
                key="partner"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
                onSubmit={partnerForm.handleSubmit(onPartnerSubmit)}
                className="space-y-4"
              >
                <div className="p-3 bg-sapphire/5 border border-sapphire/20 rounded-lg text-xs text-slate-600">
                  <strong className="text-sapphire">Partner Programı:</strong> Önce ücretsiz hesap oluştur, sonra
                  hesabınla giriş yapıp partner başvuru formunu doldur. Onay sonrası komisyonlar başlar.
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="p-firstName">Ad</Label>
                    <Input id="p-firstName" icon={<User size={18} />} placeholder="Mehmet" error={partnerForm.formState.errors.firstName?.message} {...partnerForm.register("firstName")} />
                  </div>
                  <div>
                    <Label htmlFor="p-lastName">Soyad</Label>
                    <Input id="p-lastName" placeholder="Yılmaz" error={partnerForm.formState.errors.lastName?.message} {...partnerForm.register("lastName")} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="p-email">E-posta adresi</Label>
                  <Input id="p-email" type="email" icon={<Mail size={18} />} placeholder="ad@ornek.com" error={partnerForm.formState.errors.email?.message} {...partnerForm.register("email")} />
                </div>
                <div>
                  <Label htmlFor="p-phone">Telefon <span className="text-muted-foreground font-normal">(isteğe bağlı)</span></Label>
                  <Input id="p-phone" type="tel" icon={<Phone size={18} />} placeholder="+90 (555) 000-0000" {...partnerForm.register("phone")} />
                </div>
                <div>
                  <Label htmlFor="p-password">Şifre</Label>
                  <Input id="p-password" type="password" icon={<Lock size={18} />} placeholder="••••••••" error={partnerForm.formState.errors.password?.message} {...partnerForm.register("password")} />
                </div>
                <Button type="submit" className="w-full text-lg h-12 mt-2" isLoading={isSubmitting}>
                  Partner Hesabı Oluştur
                </Button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* ── BİREYSEL FORM ─────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {accountType === "bireysel" && (
              <motion.form
                key="bireysel"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.2 }}
                onSubmit={bireyselForm.handleSubmit(onBireyselSubmit)}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="b-firstName">Ad</Label>
                    <Input id="b-firstName" icon={<User size={18} />} placeholder="Ayşe" error={bireyselForm.formState.errors.firstName?.message} {...bireyselForm.register("firstName")} />
                  </div>
                  <div>
                    <Label htmlFor="b-lastName">Soyad</Label>
                    <Input id="b-lastName" placeholder="Yılmaz" error={bireyselForm.formState.errors.lastName?.message} {...bireyselForm.register("lastName")} />
                  </div>
                </div>

                <div>
                  <Label htmlFor="b-email">E-posta adresi</Label>
                  <Input id="b-email" type="email" icon={<Mail size={18} />} placeholder="ad@ornek.com" error={bireyselForm.formState.errors.email?.message} {...bireyselForm.register("email")} />
                </div>

                <div>
                  <Label htmlFor="b-phone">Telefon numarası <span className="text-muted-foreground font-normal">(isteğe bağlı)</span></Label>
                  <Input id="b-phone" type="tel" icon={<Phone size={18} />} placeholder="+90 (555) 000-0000" error={bireyselForm.formState.errors.phone?.message} {...bireyselForm.register("phone")} />
                </div>

                <div>
                  <Label htmlFor="b-password">Şifre</Label>
                  <Input id="b-password" type="password" icon={<Lock size={18} />} placeholder="••••••••" error={bireyselForm.formState.errors.password?.message} {...bireyselForm.register("password")} />
                </div>

                <Button type="submit" className="w-full text-lg h-12 mt-2" isLoading={isSubmitting}>
                  Hesap oluştur
                </Button>
              </motion.form>
            )}

            {/* ── KURUMSAL FORM ──────────────────────────────────── */}
            {accountType === "kurumsal" && (
              <motion.form
                key="kurumsal"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
                onSubmit={kurumsalForm.handleSubmit(onKurumsalSubmit)}
                className="space-y-4"
              >
                {/* Rol seçimi: Öğrenci / Kurum Yetkilisi */}
                <div className="flex gap-3">
                  <Card
                    className={`flex-1 p-3.5 cursor-pointer text-center border-2 transition-all ${kurumsalRole === "student" ? "border-primary bg-primary/5" : "border-border"}`}
                    onClick={() => setKurumsalRole("student")}
                  >
                    <GraduationCap className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className="font-bold text-foreground text-xs">Öğrenci</p>
                  </Card>
                  <Card
                    className={`flex-1 p-3.5 cursor-pointer text-center border-2 transition-all ${kurumsalRole === "corporate" ? "border-primary bg-primary/5" : "border-border"}`}
                    onClick={() => setKurumsalRole("corporate")}
                  >
                    <Briefcase className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className="font-bold text-foreground text-xs">Kurum Yetkilisi</p>
                  </Card>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="k-firstName">Ad</Label>
                    <Input id="k-firstName" icon={<User size={18} />} placeholder="Ayşe" error={kurumsalForm.formState.errors.firstName?.message} {...kurumsalForm.register("firstName")} />
                  </div>
                  <div>
                    <Label htmlFor="k-lastName">Soyad</Label>
                    <Input id="k-lastName" placeholder="Yılmaz" error={kurumsalForm.formState.errors.lastName?.message} {...kurumsalForm.register("lastName")} />
                  </div>
                </div>

                <div>
                  <Label htmlFor="k-email">E-posta adresi</Label>
                  <Input id="k-email" type="email" icon={<Mail size={18} />} placeholder="ad@ornek.com" error={kurumsalForm.formState.errors.email?.message} {...kurumsalForm.register("email")} />
                </div>

                <div>
                  <Label htmlFor="k-companyCode">
                    Kurum Kodu <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="k-companyCode"
                    icon={<Hash size={18} />}
                    placeholder="KUR-0001"
                    error={kurumsalForm.formState.errors.companyCode?.message}
                    {...kurumsalForm.register("companyCode")}
                    className="font-mono uppercase"
                    onChange={(e) => {
                      e.target.value = e.target.value.toUpperCase();
                      kurumsalForm.register("companyCode").onChange(e);
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {kurumsalRole === "student"
                      ? "Kurumunuzdan ya da yöneticinizden alınan KUR-XXXX formatındaki kodu giriniz."
                      : "Yönetmek istediğiniz kuruma ait KUR-XXXX kodunu giriniz."}
                  </p>
                </div>

                <div>
                  <Label htmlFor="k-phone">Telefon numarası <span className="text-muted-foreground font-normal">(isteğe bağlı)</span></Label>
                  <Input id="k-phone" type="tel" icon={<Phone size={18} />} placeholder="+90 (555) 000-0000" {...kurumsalForm.register("phone")} />
                </div>

                <div>
                  <Label htmlFor="k-password">Şifre</Label>
                  <Input id="k-password" type="password" icon={<Lock size={18} />} placeholder="••••••••" error={kurumsalForm.formState.errors.password?.message} {...kurumsalForm.register("password")} />
                </div>

                <Button type="submit" className="w-full text-lg h-12 mt-2" isLoading={isSubmitting}>
                  Hesap oluştur
                </Button>
              </motion.form>
            )}
          </AnimatePresence>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Zaten hesabınız var mı?{" "}
            <Link href="/login" className="font-semibold text-primary hover:text-accent transition-colors">Buradan giriş yapın</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
