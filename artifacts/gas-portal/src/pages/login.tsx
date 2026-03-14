import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Droplet, Lock, User } from "lucide-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [error, setError] = React.useState("");

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" }
  });

  React.useEffect(() => {
    if (isAuthenticated) setLocation("/");
  }, [isAuthenticated, setLocation]);

  const onSubmit = async (data: LoginForm) => {
    try {
      setError("");
      await login({ data });
    } catch (err: any) {
      setError(err?.message || "Invalid credentials. Please try again.");
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Left side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-24 z-10 relative">
        <motion.div 
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <div className="flex items-center gap-3 mb-12">
            <div className="bg-primary/10 p-3 rounded-2xl text-primary">
              <Droplet className="w-10 h-10" />
            </div>
            <div>
              <h1 className="font-display font-bold text-3xl tracking-tight">GasPortal</h1>
              <p className="text-sm text-muted-foreground font-medium">Enterprise Delivery Management</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border/50">
            <h2 className="text-2xl font-display font-bold mb-2">Welcome back</h2>
            <p className="text-muted-foreground mb-8">Sign in to manage gas deliveries and schedules.</p>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {error && (
                <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-xl font-medium border border-destructive/20">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Username</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input 
                    {...form.register("username")} 
                    className="pl-12" 
                    placeholder="Enter your username" 
                  />
                </div>
                {form.formState.errors.username && (
                  <p className="text-destructive text-sm mt-1">{form.formState.errors.username.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input 
                    type="password"
                    {...form.register("password")} 
                    className="pl-12" 
                    placeholder="••••••••" 
                  />
                </div>
                {form.formState.errors.password && (
                  <p className="text-destructive text-sm mt-1">{form.formState.errors.password.message}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-lg mt-4" 
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </div>
        </motion.div>
      </div>

      {/* Right side - Image */}
      <div className="hidden lg:block lg:w-1/2 relative bg-slate-900 overflow-hidden">
        <img 
          src={`${import.meta.env.BASE_URL}images/login-bg.png`}
          alt="Abstract decorative background"
          className="absolute inset-0 w-full h-full object-cover opacity-80 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
        <div className="absolute bottom-24 left-16 right-16">
          <h2 className="text-4xl font-display font-bold text-white mb-4">Streamline Your Operations</h2>
          <p className="text-lg text-slate-300">Efficiently track consumers, manage delivery schedules, and automate eligibility periods all from one unified dashboard.</p>
        </div>
      </div>
    </div>
  );
}
