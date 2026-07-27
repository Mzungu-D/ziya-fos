import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";

import { API_URL } from "../lib/api";
import ziyaLogo from "../assets/zayi.jpg";
import heroImage from "../assets/ziya-cinematic-hero.webp";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      alert("Enter your email address and password.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          rememberMe,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Unable to sign in.");
        return;
      }

      /*
        Do not treat the user as fully authenticated before OTP.

        If the existing backend still returns a token here, we intentionally
        do not store it as the final authenticated session.
      */

      navigate("/otp", {
        state: {
          email: data.user?.email || email.trim(),
          phone: data.user?.phone || data.phone || "",
          otp: data.otp || null,
          challengeId: data.challengeId || null,
          rememberMe,
        },
      });
    } catch (error) {
      console.error(error);
      alert("Unable to connect to Ziya FOS.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-[#081019] text-white lg:grid-cols-[1.05fr_0.95fr]">

      {/* Visual side */}
      <section className="relative hidden overflow-hidden lg:block">
        <img
          src={heroImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />

        <div className="absolute inset-0 bg-black/30" />

        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/20" />

        <Link
          to="/"
          className="absolute left-10 top-9 z-10 flex items-center gap-3"
        >
          <img
            src={ziyaLogo}
            alt="Ziya"
            className="h-11 w-11 rounded-full object-cover"
          />

          <span className="font-semibold tracking-[0.17em]">
            ZIYA FOS
          </span>
        </Link>

        <div className="absolute bottom-12 left-10 right-10 z-10">
          <h2 className="max-w-xl text-5xl font-medium leading-[1.02] tracking-[-0.04em]">
            Your financial workspace.
            <br />
            Securely operated.
          </h2>

          <p className="mt-5 max-w-lg leading-7 text-white/70">
            Access your organization's financial operating system, products,
            permissions and financial data.
          </p>
        </div>
      </section>

      {/* Login */}
      <section className="flex min-h-screen items-center justify-center px-6 py-12 md:px-12">
        <div className="w-full max-w-md">

          <div className="mb-10 flex items-center justify-between lg:hidden">
            <Link to="/" className="flex items-center gap-3">
              <img
                src={ziyaLogo}
                alt="Ziya"
                className="h-10 w-10 rounded-full object-cover"
              />

              <span className="font-semibold tracking-[0.15em]">
                ZIYA FOS
              </span>
            </Link>
          </div>

          <Link
            to="/"
            className="mb-10 hidden items-center gap-2 text-sm text-white/50 transition hover:text-white lg:inline-flex"
          >
            <ArrowLeft size={17} />
            Back to Ziya
          </Link>

          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#e5b83b]">
            Existing organization
          </p>

          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">
            Welcome back.
          </h1>

          <p className="mt-3 text-white/50">
            Sign in to your Ziya financial workspace.
          </p>

          <div className="mt-9 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-white/75">
                Email address
              </span>

              <div className="flex h-14 items-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 focus-within:border-white/30">
                <Mail size={18} className="mr-3 text-white/35" />

                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleLogin();
                    }
                  }}
                  placeholder="name@company.com"
                  autoComplete="email"
                  className="w-full bg-transparent text-white outline-none placeholder:text-white/25"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-white/75">
                Password
              </span>

              <div className="flex h-14 items-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 focus-within:border-white/30">
                <Lock size={18} className="mr-3 text-white/35" />

                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleLogin();
                    }
                  }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full bg-transparent text-white outline-none placeholder:text-white/25"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="text-white/40 transition hover:text-white"
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={19} />
                  ) : (
                    <Eye size={19} />
                  )}
                </button>
              </div>
            </label>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <label className="flex items-center gap-3 text-sm text-white/55">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) =>
                  setRememberMe(event.target.checked)
                }
                className="h-4 w-4"
              />
              Remember me
            </label>

            <button
              type="button"
              className="text-sm font-medium text-white/70 transition hover:text-white"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="mt-8 flex h-14 w-full items-center justify-center gap-3 rounded-full bg-white font-semibold text-[#081019] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Continue securely"}

            {!loading && <ArrowRight size={18} />}
          </button>

          <div className="mt-7 flex gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <ShieldCheck
              size={20}
              className="shrink-0 text-[#e5b83b]"
            />

            <p className="text-sm leading-6 text-white/45">
              A verification code will be required before access is granted.
              You can verify using your email or registered phone number.
            </p>
          </div>

          <p className="mt-8 text-center text-sm text-white/40">
            New to Ziya?{" "}
            <Link
              to="/open-account"
              className="font-semibold text-white"
            >
              Open an account
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
