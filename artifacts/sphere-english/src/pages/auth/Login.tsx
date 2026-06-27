import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, Label } from "@/components/ui/core";
import { Mail, Lock, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

const loginSchema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi giriniz"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalıdır"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      setError(null);
      await login(data);
    } catch (err: any) {
      setError(err.message || "Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin.");
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24 w-full lg:w-1/2 relative z-10">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mx-auto w-full max-w-md lg:w-96">
          <div className="mb-10">
            <Link href="/" className="inline-flex mb-8">
              <img
                src={`${import.meta.env.BASE_URL}images/logo-full.png`}
                alt="Sphere English"
                className="h-[90px] w-auto object-contain"
              />
            </Link>
            <h2 className="text-3xl font-extrabold font-display text-foreground">Tekrar hoş geldiniz</h2>
            <p className="mt-2 text-muted-foreground">Giriş yapmak için bilgilerinizi girin.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3 text-destructive">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}
            
            <div>
              <Label htmlFor="email">E-posta adresi</Label>
              <Input id="email" type="email" icon={<Mail size={18} />} placeholder="ad@ornek.com" error={errors.email?.message} {...register("email")} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="password">Şifre</Label>
                <Link
                  href="/sifremi-unuttum"
                  className="text-xs font-semibold text-primary hover:text-accent transition-colors"
                >
                  Şifremi unuttum?
                </Link>
              </div>
              <Input id="password" type="password" icon={<Lock size={18} />} placeholder="••••••••" error={errors.password?.message} {...register("password")} />
            </div>

            <Button type="submit" className="w-full text-lg h-12" isLoading={isSubmitting}>
              Giriş Yap
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Hesabınız yok mu?{" "}
            <Link href="/register" className="font-semibold text-primary hover:text-accent transition-colors">Ücretsiz kayıt olun</Link>
          </p>
        </motion.div>
      </div>
      
      <div className="hidden lg:block relative w-1/2 bg-primary">
        <img src={`${import.meta.env.BASE_URL}images/auth-bg.png`} alt="Sınıf" className="absolute inset-0 w-full h-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/50 to-transparent"></div>
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <h3 className="text-3xl font-display font-bold mb-4">"Yapabileceğiniz en iyi yatırım kendinize yaptığınızdır."</h3>
          <p className="text-lg text-white/80">Sphere'de İngilizce öğrenen binlerce öğrenciye katılın.</p>
        </div>
      </div>
    </div>
  );
}
