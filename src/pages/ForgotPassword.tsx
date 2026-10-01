import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mail,
} from "lucide-react";

import { Link, useNavigate } from "react-router-dom";

import { API_URL } from "../lib/api";
import ziyaLogo from "../assets/zayi.jpg";
import heroImage from "../assets/ziya-cinematic-hero.webp";

interface ForgotPasswordResponse {
  success?: boolean;
  message?: string;
  code?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  /* =========================================================
     RESET REQUEST COOLDOWN
  ========================================================= */

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [cooldown]);

  /* =========================================================
     SUBMIT PASSWORD RESET REQUEST
  ========================================================= */

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    /* -------------------------------------------------------
       CLIENT-SIDE VALIDATION
    ------------------------------------------------------- */

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError("Enter a valid work email address.");
      return;
    }

    if (cooldown > 0 || loading) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/auth/forgot-password`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },

          credentials: "include",

          body: JSON.stringify({
            email: normalizedEmail,
          }),
        }
      );

      let data: ForgotPasswordResponse = {};

      try {
        data =
          (await response.json()) as ForgotPasswordResponse;
      } catch {
        data = {};
      }

      /* -------------------------------------------------------
         SERVER ERROR
      ------------------------------------------------------- */

      if (!response.ok) {
        setError(
          data.message ||
            "We could not process the password reset request. Please try again."
        );

        return;
      }

      /* -------------------------------------------------------
         ENUMERATION-SAFE RESPONSE

         The backend intentionally returns the same successful
         response whether or not the email belongs to an account.
      ------------------------------------------------------- */

      setSubmitted(true);
      setCooldown(60);
    } catch (requestError) {
      console.error(
        "[FORGOT-PASSWORD] Request failed:",
        requestError
      );

      setError(
        "Unable to connect to Ziya FOS. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="grid min-h-screen bg-[#081019] text-white lg:grid-cols-[1.05fr_0.95fr]">
      {/* =====================================================
          DESKTOP BRAND PANEL
      ====================================================== */}

      <section className="relative hidden overflow-hidden lg:block">
        <img
          src={heroImage}
          alt=""
          fetchPriority="high"
          loading="eager"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />

        <div className="absolute inset-0 bg-black/30" />

        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/20" />

        {/* ---------------------------------------------------
            BRAND
        ---------------------------------------------------- */}

        <Link
          to="/"
          className="absolute left-10 top-9 z-10 flex items-center gap-3"
          aria-label="Ziya FOS home"
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

        {/* ---------------------------------------------------
            BRAND MESSAGE
        ---------------------------------------------------- */}

        <div className="absolute bottom-12 left-10 right-10 z-10">
          <h2 className="max-w-xl text-5xl font-medium leading-[1.02] tracking-[-0.04em]">
            Recover access.
            <br />
            Stay protected.
          </h2>

          <p className="mt-5 max-w-lg leading-7 text-white/70">
            Securely restore access to your Ziya financial
            workspace without exposing account information.
          </p>
        </div>
      </section>

      {/* =====================================================
          RECOVERY PANEL
      ====================================================== */}

      <section className="flex min-h-screen items-center justify-center px-6 py-12 md:px-12">
        <div className="w-full max-w-md">

          {/* =================================================
              MOBILE BRANDING
          ================================================== */}

          <div className="mb-10 flex items-center lg:hidden">
            <Link
              to="/"
              className="flex items-center gap-3"
              aria-label="Ziya FOS home"
            >
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

          {/* =================================================
              DESKTOP BACK LINK
          ================================================== */}

          <Link
            to="/login"
            className="mb-10 hidden items-center gap-2 text-sm text-white/50 transition hover:text-white lg:inline-flex"
          >
            <ArrowLeft size={17} />
            Back to sign in
          </Link>

          {/* =================================================
              SUCCESS STATE
          ================================================== */}

          {submitted ? (
            <div>
              {/* Success icon */}

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                <CheckCircle2 size={23} />
              </div>

              {/* Eyebrow */}

              <p className="mt-7 text-sm font-semibold uppercase tracking-[0.22em] text-[#e5b83b]">
                Check your inbox
              </p>

              {/* Heading */}

              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">
                Reset link requested.
              </h1>

              {/* Description */}

              <p className="mt-3 leading-7 text-white/50">
                If the email address is associated with an
                active Ziya FOS account, you will receive a
                password reset link shortly.
              </p>

              {/* Security information */}

              <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                <p className="text-sm leading-6 text-white/55">
                  For your security, Ziya does not reveal
                  whether an email address is registered.
                  Check your inbox and spam folder, and use
                  only the most recent reset link.
                </p>
              </div>

              {/* Request another link */}

              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setError("");
                  setEmail("");
                }}
                disabled={cooldown > 0}
                className="mt-7 flex h-14 w-full items-center justify-center rounded-full border border-white/10 bg-white/[0.03] font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cooldown > 0
                  ? `Request another link in ${cooldown}s`
                  : "Use another email address"}
              </button>

              {/* Return to sign in */}

              <button
                type="button"
                onClick={() => navigate("/login")}
                className="mt-5 flex w-full items-center justify-center gap-2 text-sm text-white/45 transition hover:text-white"
              >
                Return to sign in
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <>
              {/* =================================================
                  FORM HEADER
              ================================================== */}

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#e5b83b]/25 bg-[#e5b83b]/10 text-[#e5b83b]">
                <Mail size={22} />
              </div>

              <p className="mt-7 text-sm font-semibold uppercase tracking-[0.22em] text-[#e5b83b]">
                Account recovery
              </p>

              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">
                Forgot your password?
              </h1>

              <p className="mt-3 leading-7 text-white/50">
                Enter the email address associated with your
                Ziya FOS account and we&apos;ll send you a
                secure reset link.
              </p>

              {/* =================================================
                  RESET FORM
              ================================================== */}

              <form
                className="mt-9"
                onSubmit={handleSubmit}
                noValidate
              >
                {/* -------------------------------------------------
                    EMAIL
                -------------------------------------------------- */}

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-white/75">
                    Work email
                  </span>

                  <div className="flex h-14 items-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 transition focus-within:border-white/30">
                    <Mail
                      size={18}
                      className="mr-3 shrink-0 text-white/35"
                      aria-hidden="true"
                    />

                    <input
                      type="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setError("");
                      }}
                      autoComplete="email"
                      autoFocus
                      inputMode="email"
                      placeholder="name@company.com"
                      aria-label="Work email"
                      aria-invalid={Boolean(error)}
                      className="w-full bg-transparent text-white outline-none placeholder:text-white/25"
                    />
                  </div>
                </label>

                {/* -------------------------------------------------
                    ERROR
                -------------------------------------------------- */}

                {error && (
                  <div
                    role="alert"
                    aria-live="polite"
                    className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-200"
                  >
                    {error}
                  </div>
                )}

                {/* -------------------------------------------------
                    SUBMIT
                -------------------------------------------------- */}

                <button
                  type="submit"
                  disabled={
                    loading ||
                    cooldown > 0 ||
                    !email.trim()
                  }
                  className="mt-7 flex h-14 w-full items-center justify-center gap-3 rounded-full bg-white font-semibold text-[#081019] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2
                        size={18}
                        className="animate-spin"
                        aria-hidden="true"
                      />

                      Sending secure link…
                    </>
                  ) : (
                    <>
                      Send reset link
                      <ArrowRight
                        size={18}
                        aria-hidden="true"
                      />
                    </>
                  )}
                </button>
              </form>

              {/* =================================================
                  SECURITY NOTICE
              ================================================== */}

              <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <p className="text-sm leading-6 text-white/45">
                  Reset links are time-limited and can only
                  be used once. After a successful password
                  reset, existing sessions and trusted devices
                  are signed out.
                </p>
              </div>

              {/* =================================================
                  BACK TO LOGIN
              ================================================== */}

              <button
                type="button"
                onClick={() => navigate("/login")}
                className="mt-7 flex w-full items-center justify-center gap-2 text-sm text-white/40 transition hover:text-white"
              >
                <ArrowLeft
                  size={16}
                  aria-hidden="true"
                />

                Back to sign in
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}