import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, Label, Card } from "@/components/ui/core";
import { Mail, Lock, User, AlertCircle, Phone } from "lucide-react";
import { motion } from "framer-motion";

const registerSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().optional(),
  role: z.enum(["student", "teacher"]), // Admin registration usually internal
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const { register: registerUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<"student" | "teacher">("student");
  
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: "student" }
  });

  const onSubmit = async (data: RegisterForm) => {
    try {
      setError(null);
      await registerUser({ ...data, role: selectedRole as "admin" | "teacher" | "student" });
    } catch (err: any) {
      setError(err.message || "Failed to register. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:block relative w-1/2 bg-primary">
        <img src={`${import.meta.env.BASE_URL}images/auth-bg.png`} alt="Classroom" className="absolute inset-0 w-full h-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/50 to-transparent"></div>
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <h3 className="text-3xl font-display font-bold mb-4">Start your learning journey today.</h3>
          <p className="text-lg text-white/80">Create an account and get immediate access to courses.</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24 w-full lg:w-1/2 py-12 overflow-y-auto">
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="mx-auto w-full max-w-md lg:w-96">
          <div className="mb-8">
            <Link href="/" className="flex items-center gap-3 mb-8">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold font-display text-lg">S</div>
              <span className="text-xl font-bold font-display text-foreground">Sphere English</span>
            </Link>
            <h2 className="text-3xl font-extrabold font-display text-foreground">Create account</h2>
            <p className="mt-2 text-muted-foreground">Join as a student or apply to teach.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3 text-destructive">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <div className="flex gap-4 mb-6">
              <Card 
                className={`flex-1 p-4 cursor-pointer text-center border-2 transition-all ${selectedRole === 'student' ? 'border-primary bg-primary/5' : 'border-border'}`}
                onClick={() => { setSelectedRole('student'); setValue('role', 'student'); }}
              >
                <p className="font-bold text-foreground">Student</p>
              </Card>
              <Card 
                className={`flex-1 p-4 cursor-pointer text-center border-2 transition-all ${selectedRole === 'teacher' ? 'border-primary bg-primary/5' : 'border-border'}`}
                onClick={() => { setSelectedRole('teacher'); setValue('role', 'teacher'); }}
              >
                <p className="font-bold text-foreground">Teacher</p>
              </Card>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" icon={<User size={18} />} placeholder="Jane" error={errors.firstName?.message} {...register("firstName")} />
              </div>
              <div>
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" placeholder="Doe" error={errors.lastName?.message} {...register("lastName")} />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email address</Label>
              <Input id="email" type="email" icon={<Mail size={18} />} placeholder="name@example.com" error={errors.email?.message} {...register("email")} />
            </div>

            <div>
              <Label htmlFor="phone">Phone number (optional)</Label>
              <Input id="phone" type="tel" icon={<Phone size={18} />} placeholder="+1 (555) 000-0000" error={errors.phone?.message} {...register("phone")} />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" icon={<Lock size={18} />} placeholder="••••••••" error={errors.password?.message} {...register("password")} />
            </div>

            <Button type="submit" className="w-full text-lg h-12 mt-4" isLoading={isSubmitting}>
              Create account
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-primary hover:text-accent transition-colors">Sign in here</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
