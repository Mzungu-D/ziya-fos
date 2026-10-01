import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
} from "lucide-react";

import { API_URL } from "../lib/api";
import ziyaLogo from "../assets/zayi.jpg";
import heroImage from "../assets/ziya-cinematic-hero.webp";

const fieldWrap =
  "flex h-14 items-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 transition focus-within:border-white/30";

const inputCls =
  "w-full bg-transparent text-white outline-none placeholder:text-white/25";

function meetsProductionPasswordPolicy(value: string): boolean {
  if (value.length < 12) return false;

  const categories = [
    /[a-z]/.test(value),
    /[A-Z]/.test(value),
    /[0-9]/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ].filter(Boolean).length;

  return categories >= 3;
}

export default function ResetPassword() {
  const navigate     = useNavigate();
  const [params]     = useSearchParams();
  const token        = params.get("token") ?? "";

  const [password,    setPassword]    = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [done,        setDone]        = useState(false);

  const strength = (() => {
    if (password.length === 0) return 0;
    let score = 0;
    if (password.length >= 12)              score++;
    if (password.length >= 16)              score++;
    if (/[A-Z]/.test(password))            score++;
    if (/[0-9]/.test(password))            score++;
    if (/[^A-Za-z0-9]/.test(password))     score++;
    return score;
  })();

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong", "Very strong"][strength];
  const strengthColor = ["", "#EF4444", "#F59E0B", "#3B82F6", "#10B981", "#10B981"][strength];

  const handleReset = async () => {
    if (!token) { setError("Invalid reset link. Please request a new one."); return; }
    if (!meetsProductionPasswordPolicy(password)) {
      setError(
        "Use at least 12 characters and include at least three of: uppercase, lowercase, number, and special character."
      );
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true); setError("");
      const res  = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to reset password. The link may have expired."); return; }
      setDone(true);
    } catch {
      setError("Unable to connect to Ziya FOS. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#081019] px-6 text-white">
        <div className="max-w-md text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#e5b83b]">Invalid link</p>
          <h1 className="mt-4 text-3xl font-semibold">Reset link missing.</h1>
          <p className="mt-3 text-white/50">Please request a new password reset from the sign-in page.</p>
          <Link to="/login" className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-[#081019] transition hover:bg-white/90">
            <ArrowLeft size={17} /> Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen bg-[#081019] text-white lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden lg:block">
        <img src={heroImage} alt="" fetchPriority="high" decoding="sync" loading="eager" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/20" />
        <Link to="/" className="absolute left-10 top-9 z-10 flex items-center gap-3">
          <img src={ziyaLogo} alt="Ziya" fetchPriority="high" loading="eager" className="h-11 w-11 rounded-full object-cover" />
          <span className="font-semibold tracking-[0.17em]">ZIYA FOS</span>
        </Link>
        <div className="absolute bottom-12 left-10 right-10 z-10">
          <h2 className="max-w-xl text-5xl font-medium leading-[1.02] tracking-[-0.04em]">Your financial workspace.<br />Securely operated.</h2>
          <p className="mt-5 max-w-lg leading-7 text-white/70">Access your organization's financial operating system, products, permissions and financial data.</p>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-6 py-12 md:px-12">
        <div className="w-full max-w-md">

          <div className="mb-10 flex items-center lg:hidden">
            <Link to="/" className="flex items-center gap-3">
              <img src={ziyaLogo} alt="Ziya" loading="eager" className="h-10 w-10 rounded-full object-cover" />
              <span className="font-semibold tracking-[0.15em]">ZIYA FOS</span>
            </Link>
          </div>

          {done ? (
            <div className="flex flex-col items-center gap-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-10 text-center">
              <CheckCircle2 size={48} className="text-emerald-400" />
              <div>
                <p className="text-xl font-semibold text-emerald-300">Password updated!</p>
                <p className="mt-2 text-sm text-white/50">Your password has been reset. You can now sign in with your new password.</p>
              </div>
              <button onClick={() => navigate("/login")} className="mt-2 flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-[#081019] transition hover:bg-white/90">
                Sign in <ArrowRight size={17} />
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" className="mb-10 hidden items-center gap-2 text-sm text-white/50 transition hover:text-white lg:inline-flex">
                <ArrowLeft size={17} /> Back to sign in
              </Link>

              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#e5b83b]">Account recovery</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">Choose a new password.</h1>
              <p className="mt-3 text-white/50">Use a strong password you have not used elsewhere.</p>

              <div className="mt-9 space-y-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-white/75">New password</span>
                  <div className={fieldWrap}>
                    <Lock size={18} className="mr-3 shrink-0 text-white/35" />
                    <input type={showPass ? "text" : "password"} value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} onKeyDown={(e) => { if (e.key === "Enter") void handleReset(); }} placeholder="At least 12 characters" autoComplete="new-password" autoFocus className={inputCls} />
                    <button type="button" onClick={() => setShowPass((v) => !v)} className="ml-2 shrink-0 text-white/40 transition hover:text-white/75">
                      {showPass ? <EyeOff size={19} /> : <Eye size={19} />}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map((s) => (
                          <div key={s} className="h-1 flex-1 rounded-full transition-all" style={{ backgroundColor: s <= strength ? strengthColor : "rgba(255,255,255,0.1)" }} />
                        ))}
                      </div>
                      <p className="text-xs" style={{ color: strengthColor }}>{strengthLabel}</p>
                    </div>
                  )}

                  <p className="mt-2 text-xs leading-5 text-white/35">
                    At least 12 characters with at least three character
                    types: uppercase, lowercase, number, or symbol.
                  </p>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-white/75">Confirm password</span>
                  <div className={`${fieldWrap} ${confirm && confirm !== password ? "border-red-400/40" : ""}`}>
                    <Lock size={18} className="mr-3 shrink-0 text-white/35" />
                    <input type={showConfirm ? "text" : "password"} value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(""); }} onKeyDown={(e) => { if (e.key === "Enter") void handleReset(); }} placeholder="Repeat your password" autoComplete="new-password" className={inputCls} />
                    <button type="button" onClick={() => setShowConfirm((v) => !v)} className="ml-2 shrink-0 text-white/40 transition hover:text-white/75">
                      {showConfirm ? <EyeOff size={19} /> : <Eye size={19} />}
                    </button>
                  </div>
                  {confirm && confirm !== password && <p className="mt-1.5 text-xs text-red-400">Passwords do not match.</p>}
                </label>

                {error && (
                  <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                    {error}
                    {error.toLowerCase().includes("expired") && (
                      <> <Link to="/login" className="underline hover:text-white">Request a new link</Link>.</>
                    )}
                  </div>
                )}

                <button onClick={() => void handleReset()} disabled={loading || password !== confirm || !meetsProductionPasswordPolicy(password)} className="flex h-14 w-full items-center justify-center gap-3 rounded-full bg-white font-semibold text-[#081019] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50">
                  {loading ? <><Loader2 size={18} className="animate-spin" /> Resetting…</> : <>Reset password <ArrowRight size={18} /></>}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}