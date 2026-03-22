import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, Label, Card } from "@/components/ui/core";
import { Mail, Lock, User, AlertCircle, Phone, Hash, GraduationCap, Briefcase } from "lucide-react";
import { motion } from "framer-motion";

const registerSchema = z.object({
  firstName: z.string().min(2, "Ad zorunludur"),
  lastName: z.string().min(2, "Soyad zorunludur"),
  email: z.string().email("Geçerli bir e-posta adresi giriniz"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalıdır"),
  phone: z.string().optional(),
  companyCode: z.string().min(3, "Kurum kodu zorunludur"),
  role: z.enum(["student", "corporate"]),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const { register: registerUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<"student" | "corporate">("student");

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: "student" }
  });

  const onSubmit = async (data: RegisterForm) => {
    try {
      setError(null);
      await registerUser({ ...data, role: selectedRole as any });
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
          <p className="text-lg text-white/80">Kurumunuzdan aldığınız kod ile hemen kayıt olun.</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24 w-full lg:w-1/2 py-12 overflow-y-auto">
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="mx-auto w-full max-w-md lg:w-96">
          <div className="mb-8">
            <Link href="/" className="inline-flex mb-8">
              <img
                src={`${import.meta.env.BASE_URL}images/logo-full.png`}
                alt="Sphere English"
                className="h-14 w-auto object-contain"
              />
            </Link>
            <h2 className="text-3xl font-extrabold font-display text-foreground">Hesap oluştur</h2>
            <p className="mt-2 text-muted-foreground">Kurumunuzdan aldığınız kod ile kayıt olun.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3 text-destructive">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <div className="flex gap-4">
              <Card
                className={`flex-1 p-4 cursor-pointer text-center border-2 transition-all ${selectedRole === 'student' ? 'border-primary bg-primary/5' : 'border-border'}`}
                onClick={() => { setSelectedRole('student'); setValue('role', 'student'); }}
              >
                <GraduationCap className="h-6 w-6 mx-auto mb-1 text-primary" />
                <p className="font-bold text-foreground text-sm">Öğrenci</p>
              </Card>
              <Card
                className={`flex-1 p-4 cursor-pointer text-center border-2 transition-all ${selectedRole === 'corporate' ? 'border-primary bg-primary/5' : 'border-border'}`}
                onClick={() => { setSelectedRole('corporate'); setValue('role', 'corporate'); }}
              >
                <Briefcase className="h-6 w-6 mx-auto mb-1 text-primary" />
                <p className="font-bold text-foreground text-sm">Kurum Yetkilisi</p>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">Ad</Label>
                <Input id="firstName" icon={<User size={18} />} placeholder="Ayşe" error={errors.firstName?.message} {...register("firstName")} />
              </div>
              <div>
                <Label htmlFor="lastName">Soyad</Label>
                <Input id="lastName" placeholder="Yılmaz" error={errors.lastName?.message} {...register("lastName")} />
              </div>
            </div>

            <div>
              <Label htmlFor="email">E-posta adresi</Label>
              <Input id="email" type="email" icon={<Mail size={18} />} placeholder="ad@ornek.com" error={errors.email?.message} {...register("email")} />
            </div>

            <div>
              <Label htmlFor="companyCode">
                Kurum Kodu <span className="text-destructive">*</span>
              </Label>
              <Input
                id="companyCode"
                icon={<Hash size={18} />}
                placeholder="KUR-0001"
                error={errors.companyCode?.message}
                {...register("companyCode")}
                className="font-mono uppercase"
                onChange={(e) => {
                  e.target.value = e.target.value.toUpperCase();
                  register("companyCode").onChange(e);
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {selectedRole === 'student'
                  ? "Kurumunuzdan ya da yöneticinizden alınan KUR-XXXX formatındaki kodu giriniz."
                  : "Yönetmek istediğiniz kuruma ait KUR-XXXX kodunu giriniz."}
              </p>
            </div>

            <div>
              <Label htmlFor="phone">Telefon numarası (isteğe bağlı)</Label>
              <Input id="phone" type="tel" icon={<Phone size={18} />} placeholder="+90 (555) 000-0000" error={errors.phone?.message} {...register("phone")} />
            </div>

            <div>
              <Label htmlFor="password">Şifre</Label>
              <Input id="password" type="password" icon={<Lock size={18} />} placeholder="••••••••" error={errors.password?.message} {...register("password")} />
            </div>

            <Button type="submit" className="w-full text-lg h-12 mt-4" isLoading={isSubmitting}>
              Hesap oluştur
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Zaten hesabınız var mı?{" "}
            <Link href="/login" className="font-semibold text-primary hover:text-accent transition-colors">Buradan giriş yapın</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
