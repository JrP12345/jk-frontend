"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Button,
  useToast,
  ModeSwitcher,
  AnantaLogo,
  cn
} from "@/components/ui";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Validation states
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Shake feedback on failed login
  const [isShaking, setIsShaking] = useState(false);

  // Forgot password flow states
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetEmailError, setResetEmailError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [isResetSent, setIsResetSent] = useState(false);

  const router = useRouter();
  const { login } = useAuthStore();
  const { toast } = useToast();

  // Validate email on blur or input
  const validateEmail = (val: string, isReset = false) => {
    const errorStateSetter = isReset ? setResetEmailError : setEmailError;
    if (!val) {
      errorStateSetter("Email address is required");
      return false;
    }
    if (!EMAIL_REGEX.test(val)) {
      errorStateSetter("Please enter a valid email address");
      return false;
    }
    errorStateSetter("");
    return true;
  };

  // Validate password
  const validatePassword = (val: string) => {
    if (!val) {
      setPasswordError("Password is required");
      return false;
    }
    if (val.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return false;
    }
    setPasswordError("");
    return true;
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 450);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const isEmailValid = validateEmail(email);
    const isPassValid = validatePassword(password);

    if (!isEmailValid || !isPassValid) {
      triggerShake();
      return;
    }

    setLoading(true);

    try {
      const res = await api.post("/auth/login", { email, password });
      login(res.data.data.user);
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
        variant: "success",
        duration: 3000,
      });
      router.push("/dashboard");
    } catch (err: any) {
      triggerShake();
      toast({
        title: "Login Failed",
        description: err.response?.data?.message || "Invalid credentials. Please try again.",
        variant: "error",
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEmailValid = validateEmail(resetEmail, true);
    if (!isEmailValid) return;

    setResetLoading(true);
    try {
      // Simulate API call for password reset
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setIsResetSent(true);
      toast({
        title: "Recovery Link Sent",
        description: `Reset password instructions have been sent to ${resetEmail}.`,
        variant: "success",
        duration: 4000,
      });
    } catch (err) {
      toast({
        title: "Request Failed",
        description: "Unable to process recovery request. Please try again later.",
        variant: "error",
        duration: 5000,
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-alt relative overflow-hidden">
      {/* Decorative background blobs - soft shifting gradient glow */}
      <div className="absolute top-[-15%] left-[-15%] w-[50%] h-[50%] bg-primary-500/15 rounded-full blur-[140px] pointer-events-none animate-pulse duration-[8s]" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[50%] h-[50%] bg-blue-500/15 rounded-full blur-[140px] pointer-events-none animate-pulse duration-[6s] delay-1000" />
      
      <div className="absolute top-6 right-6 z-20">
        <ModeSwitcher />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-up">
        {/* Brand Header */}
        <div className="text-center mb-8 flex flex-col items-center justify-center">
          <AnantaLogo size="xl" />
          <p className="text-text-secondary text-sm mt-2">Sign in to manage clinical operations</p>
        </div>

        {/* Auth Card Container */}
        <Card 
          hover 
          className={cn(
            "shadow-xl shadow-black/5 border-border/50 backdrop-blur-md bg-surface/90 transition-transform duration-300", 
            isShaking && "animate-shake"
          )}
        >
          {!isForgotPassword ? (
            /* Login Form */
            <form onSubmit={handleLogin} noValidate>
              <CardHeader>
                <CardTitle>Welcome Back</CardTitle>
                <CardDescription>Enter your credential details to access your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  placeholder="admin@hospital.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) validateEmail(e.target.value);
                  }}
                  onBlur={() => validateEmail(email)}
                  error={emailError}
                  required
                  autoComplete="email"
                />
                <Input
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) validatePassword(e.target.value);
                  }}
                  onBlur={() => validatePassword(password)}
                  error={passwordError}
                  required
                  autoComplete="current-password"
                  iconRight={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-text-muted hover:text-text rounded-md hover:bg-surface-hover/50 transition-all active:scale-75 cursor-pointer"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  }
                />
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setIsResetSent(false);
                      setResetEmail("");
                      setResetEmailError("");
                    }}
                    className="text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline transition-all cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-4">
                <Button type="submit" fullWidth loading={loading} size="lg">
                  Sign In
                </Button>
              </CardFooter>
            </form>
          ) : (
            /* Forgot Password Form */
            <form onSubmit={handleResetPassword} noValidate>
              <CardHeader>
                <CardTitle>Recover Password</CardTitle>
                <CardDescription>
                  {!isResetSent
                    ? "Enter your email address and we'll send you instructions to reset your password."
                    : "Instructions have been successfully dispatched."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isResetSent ? (
                  <Input
                    label="Email"
                    type="email"
                    placeholder="admin@hospital.com"
                    value={resetEmail}
                    onChange={(e) => {
                      setResetEmail(e.target.value);
                      if (resetEmailError) validateEmail(e.target.value, true);
                    }}
                    onBlur={() => validateEmail(resetEmail, true)}
                    error={resetEmailError}
                    required
                    autoComplete="email"
                  />
                ) : (
                  <div className="p-4 rounded-xl bg-success-500/10 border border-success-500/20 text-success-700 dark:text-success-300 text-xs leading-relaxed flex gap-2.5 animate-scale-in">
                    <svg className="h-5 w-5 text-success-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a10 10 0 11-20 0 10 10 0 0120 0z" />
                    </svg>
                    <div>
                      An email containing reset instructions has been sent to <span className="font-semibold">{resetEmail}</span>. Please verify your inbox and spam folder.
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex-col gap-3">
                {!isResetSent && (
                  <Button type="submit" fullWidth loading={resetLoading} size="lg">
                    Send Recovery Link
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="text-xs font-semibold text-text-secondary hover:text-text p-1.5 transition-colors cursor-pointer"
                >
                  &larr; Back to login
                </button>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}

