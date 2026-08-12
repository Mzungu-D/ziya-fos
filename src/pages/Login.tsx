import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  X,
} from "lucide-react";

import { API_URL } from "../lib/api";
import ziyaLogo from "../assets/zayi.jpg";
import heroImage from "../assets/ziya-cinematic-hero.webp";

type Method = "EMAIL" | "PHONE";
type Step   = "identify" | "password" | "forgot";

const fieldWrap =
  "flex h-14 items-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 transition focus-within:border-white/30";

const inputCls =
  "w-full bg-transparent text-white outline-none placeholder:text-white/25";

const primaryBtn =
  "flex h-14 w-full items-center justify-center gap-3 rounded-full bg-white font-semibold text-[#081019] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50";

export default function Login() {
  const navigate = useNavigate();

  const [step,   setStep]   = useState<Step>("identify");
  const [method, setMethod] = useState<Method>("EMAIL");

  const [email,    setEmail]    = useState("");
  const [phone,    setPhone]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const [fpEmail,   setFpEmail]   = useState("");
  const [fpLoading, setFpLoading] = useState(false);
  const [fpError,   setFpError]   = useState("");
  const [fpSent,    setFpSent]    = useState(false);

  const switchMethod = (m: Method) => { setMethod(m); setError(""); };

  /* ── Step 1: email → go to password, phone → send OTP directly ── */
  const handleIdentify = async () => {
    setError("");

    if (method === "EMAIL") {
      if (!email.trim() || !email.includes("@")) {
        setError("Enter a valid email address.");
        return;
      }
      setStep("password");
      return;
    }

    if (!phone.trim()) { setError("Enter your phone number."); return; }

    try {
      setLoading(true);
      const res  = await fetch(`${API_URL}/api/auth/phone-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Could not send verification code."); return; }

      navigate("/otp", {
        state: {
          otpChannel:  "PHONE",
          phoneNumber: phone.trim(),
          destination: data.verification?.destination || phone.trim(),
          sessionType: data.verification?.sessionType || "PHONE_LOGIN",
          rememberMe:  remember,
          email:       "",
          password:    "",
        },
      });
    } catch {
      setError("Unable to connect to Ziya FOS. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Step 2: email + password → OTP to email ── */
  const handleEmailLogin = async () => {
    if (!password) { setError("Enter your password."); return; }
    try {
      setLoading(true);
      setError("");
      const res  = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, otpChannel: "EMAIL" }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Unable to continue authentication."); return; }
      if (!data.requiresOtp) { setError("The server did not request OTP verification."); return; }

      navigate("/otp", {
        state: {
          email:       email.trim(),
          otpChannel:  "EMAIL",
          destination: data.verification?.destination || email.trim(),
          sessionType: data.verification?.sessionType || "",
          rememberMe:  remember,
          password,
          phoneNumber: "",
        },
      });
    } catch {
      setError("Unable to connect to Ziya FOS. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Forgot password ── */
  const handleForgotPassword = async () => {
    const val = fpEmail.trim();
    if (!val || !val.includes("@")) { setFpError("Enter a valid email address."); return; }
    try {
      setFpLoading(true);
      setFpError("");
      const res  = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: val }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Request failed");
      setFpSent(true);
    } catch (e) {
      setFpError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setFpLoading(false);
    }
  };

  const openForgot = () => { setFpEmail(email); setFpError(""); setFpSent(false); setStep("forgot"); };

  return (
    <div className="grid min-h-screen bg-[#081019] text-white lg:grid-cols-[1.05fr_0.95fr]">

      {/* ── Hero side ── */}
      <section className="relative hidden overflow-hidden lg:block">
        <img
          src={heroImage}
          alt=""
          fetchPriority="high"
          decoding="sync"
          loading="eager"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/20" />
        <Link to="/" className="absolute left-10 top-9 z-10 flex items-center gap-3">
          <img src={ziyaLogo} alt="Ziya" fetchPriority="high" loading="eager" className="h-11 w-11 rounded-full object-cover" />
          <span className="font-semibold tracking-[0.17em]">ZIYA FOS</span>
        </Link>
        <div className="absolute bottom-12 left-10 right-10 z-10">
          <h2 className="max-w-xl text-5xl font-medium leading-[1.02] tracking-[-0.04em]">
            Your financial workspace.<br />Securely operated.
          </h2>
          <p className="mt-5 max-w-lg leading-7 text-white/70">
            Access your organization's financial operating system, products, permissions and financial data.
          </p>
        </div>
      </section>

      {/* ── Form side ── */}
      <section className="flex min-h-screen items-center justify-center px-6 py-12 md:px-12">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="mb-10 flex items-center lg:hidden">
            <Link to="/" className="flex items-center gap-3">
              <img src={ziyaLogo} alt="Ziya" loading="eager" className="h-10 w-10 rounded-full object-cover" />
              <span className="font-semibold tracking-[0.15em]">ZIYA FOS</span>
            </Link>
          </div>

          {/* ══ FORGOT PASSWORD ══ */}
          {step === "forgot" && (
            <>
              <button
                onClick={() => { setStep("password"); setFpSent(false); setFpError(""); }}
                className="mb-8 hidden items-center gap-2 text-sm text-white/50 transition hover:text-white lg:inline-flex"
              >
                <ArrowLeft size={17} /> Back to sign in
              </button>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#e5b83b]">Account recovery</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">Reset your password.</h1>
              <p className="mt-3 text-white/50">We'll send a password reset link to your email address.</p>

              {fpSent ? (
                <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-8 text-center">
                  <CheckCircle2 size={40} className="text-emerald-400" />
                  <p className="font-semibold text-emerald-300">Check your inbox</p>
                  <p className="text-sm text-white/50">
                    We sent a reset link to <span className="font-medium text-white/80">{fpEmail}</span>.
                    Check your spam folder if you don't see it.
                  </p>
                  <button
                    onClick={() => { setStep("password"); setFpSent(false); }}
                    className="mt-2 text-sm font-medium text-[#e5b83b] underline-offset-4 hover:underline"
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (
                <div className="mt-9 space-y-5">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-white/75">Email address</span>
                    <div className={fieldWrap}>
                      <Mail size={18} className="mr-3 shrink-0 text-white/35" />
                      <input
                        type="email" value={fpEmail}
                        onChange={(e) => setFpEmail(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleForgotPassword(); }}
                        placeholder="name@company.com" autoComplete="email" autoFocus
                        className={inputCls}
                      />
                    </div>
                  </label>
                  {fpError && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{fpError}</div>}
                  <button onClick={handleForgotPassword} disabled={fpLoading} className={primaryBtn}>
                    {fpLoading ? <><Loader2 size={18} className="animate-spin" /> Sending…</> : <><ArrowRight size={18} /> Send reset link</>}
                  </button>
                  <button
                    onClick={() => { setStep("password"); setFpError(""); }}
                    className="flex w-full items-center justify-center gap-2 text-sm text-white/45 transition hover:text-white/75"
                  >
                    <X size={15} /> Cancel
                  </button>
                </div>
              )}
            </>
          )}

          {/* ══ STEP 1 — EMAIL or PHONE ══ */}
          {step === "identify" && (
            <>
              <Link to="/" className="mb-10 hidden items-center gap-2 text-sm text-white/50 transition hover:text-white lg:inline-flex">
                <ArrowLeft size={17} /> Back to Ziya
              </Link>

              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#e5b83b]">Existing organization</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">Welcome back.</h1>
              <p className="mt-3 text-white/50">Sign in to your Ziya financial workspace.</p>

              {/* Method tabs */}
              <div className="mt-8 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5">
                {(["EMAIL", "PHONE"] as Method[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMethod(m)}
                    className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition ${
                      method === m ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                    }`}
                  >
                    {m === "EMAIL" ? <><Mail size={16} /> Email</> : <><Phone size={16} /> Phone</>}
                  </button>
                ))}
              </div>

              <div className="mt-5 space-y-5">
                {method === "EMAIL" && (
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-white/75">Email address</span>
                    <div className={fieldWrap}>
                      <Mail size={18} className="mr-3 shrink-0 text-white/35" />
                      <input
                        type="email" value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(""); }}
                        onKeyDown={(e) => { if (e.key === "Enter") handleIdentify(); }}
                        placeholder="name@company.com" autoComplete="email" autoFocus
                        className={inputCls}
                      />
                    </div>
                  </label>
                )}

                {method === "PHONE" && (
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-white/75">Phone number</span>
                    <div className={fieldWrap}>
                      <Phone size={18} className="mr-3 shrink-0 text-white/35" />
                      <input
                        type="tel" value={phone}
                        onChange={(e) => { setPhone(e.target.value); setError(""); }}
                        onKeyDown={(e) => { if (e.key === "Enter") handleIdentify(); }}
                        placeholder="+254 700 000 000" autoComplete="tel" autoFocus
                        className={inputCls}
                      />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-white/35">
                      We'll send a one-time code to this number.
                    </p>
                  </label>
                )}

                {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}

                <button onClick={handleIdentify} disabled={loading} className={primaryBtn}>
                  {loading
                    ? <><Loader2 size={18} className="animate-spin" />{method === "PHONE" ? "Sending code…" : "Continuing…"}</>
                    : <>Continue <ArrowRight size={18} /></>}
                </button>
              </div>

              <p className="mt-8 text-center text-sm text-white/40">
                New to Ziya?{" "}
                <Link to="/open-account" className="font-semibold text-white transition hover:text-[#e5b83b]">
                  Open an account
                </Link>
              </p>
            </>
          )}

          {/* ══ STEP 2 — PASSWORD (email path only) ══ */}
          {step === "password" && (
            <>
              <button
                onClick={() => { setStep("identify"); setError(""); setPassword(""); }}
                className="mb-10 hidden items-center gap-2 text-sm text-white/50 transition hover:text-white lg:inline-flex"
              >
                <ArrowLeft size={17} /> Back
              </button>

              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#e5b83b]">Existing organization</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">Welcome back.</h1>

              {/* Email chip — click to go back */}
              <button
                onClick={() => { setStep("identify"); setError(""); setPassword(""); }}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/60 transition hover:border-white/20"
              >
                <Mail size={14} className="shrink-0" />
                {email}
                <X size={13} className="ml-1 text-white/35" />
              </button>

              <div className="mt-7 space-y-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-white/75">Password</span>
                  <div className={fieldWrap}>
                    <Lock size={18} className="mr-3 shrink-0 text-white/35" />
                    <input
                      type={showPass ? "text" : "password"} value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(""); }}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleEmailLogin(); }}
                      placeholder="Enter your password" autoComplete="current-password" autoFocus
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="ml-2 shrink-0 text-white/40 transition hover:text-white/75"
                      aria-label={showPass ? "Hide password" : "Show password"}
                    >
                      {showPass ? <EyeOff size={19} /> : <Eye size={19} />}
                    </button>
                  </div>
                </label>

                {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}

                <div className="flex items-center justify-between gap-4">
                  <label className="flex cursor-pointer items-center gap-3 text-sm text-white/55">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-[#e5b83b]" />
                    Remember me
                  </label>
                  <button type="button" onClick={openForgot} className="text-sm font-medium text-white/55 transition hover:text-[#e5b83b]">
                    Forgot password?
                  </button>
                </div>

                <button onClick={() => void handleEmailLogin()} disabled={loading} className={primaryBtn}>
                  {loading
                    ? <><Loader2 size={18} className="animate-spin" /> Sending verification code…</>
                    : <>Continue securely <ArrowRight size={18} /></>}
                </button>
              </div>

              <div className="mt-7 flex gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <ShieldCheck size={20} className="shrink-0 text-[#e5b83b]" />
                <p className="text-sm leading-6 text-white/45">
                  A secure verification code will be sent to your email address to confirm your identity.
                </p>
              </div>

              <p className="mt-8 text-center text-sm text-white/40">
                New to Ziya?{" "}
                <Link to="/open-account" className="font-semibold text-white transition hover:text-[#e5b83b]">
                  Open an account
                </Link>
              </p>
            </>
          )}

        </div>
      </section>
    </div>
  );
}