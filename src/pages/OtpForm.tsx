import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  ArrowLeft,
  ArrowRight,
  Mail,
  Phone,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

import { API_URL } from "../lib/api";
import { storeAuthenticatedSession } from "../lib/auth";

import ziyaLogo from "../assets/zayi.jpg";
import heroImage from "../assets/ziya-cinematic-hero.webp";

type OtpChannel = "EMAIL" | "PHONE";

interface OtpLocationState {
  email?: string;
  otpChannel?: OtpChannel;
  destination?: string;
  sessionType?: string;
  rememberMe?: boolean;
  password?: string;
  phoneNumber?: string;
}

interface User {
  id?: string;
  name?: string;
  email?: string;
  phoneNumber?: string | null;
  phoneVerifiedAt?: string | null;
  platformRole?: string | null;
  role?: string;
}

interface Organization {
  id?: string;
  name?: string;
  slug?: string;
  logoUrl?: string | null;
  country?: string;
  currency?: string;
}

interface VerifyResponse {
  success?: boolean;
  message?: string;
  token?: string;
  sessionType?: "PLATFORM" | "TENANT";
  verificationChannel?: OtpChannel;
  user?: User;
  organization?: Organization;
  organizations?: Organization[];
}

interface LoginResponse {
  success?: boolean;
  requiresOtp?: boolean;
  message?: string;
  code?: string;
  retryAfterSeconds?: number;
  verification?: {
    channel?: OtpChannel;
    destination?: string;
    sessionType?: string;
  };
}

const INITIAL_COOLDOWN_SECONDS = 60;

async function readJson<T>(response: Response): Promise<T> {
  const responseText = await response.text();

  if (!responseText) {
    return {} as T;
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new Error("The server returned an invalid response.");
  }
}

function getLandingPage(data: VerifyResponse): string {
  const sessionType = data.sessionType?.toUpperCase();
  const platformRole = data.user?.platformRole?.toUpperCase();

  if (
    sessionType === "PLATFORM" ||
    platformRole === "SUPER_ADMIN" ||
    platformRole === "PLATFORM_ADMIN"
  ) {
    return "/platform";
  }

  return "/dashboard";
}

export default function OtpForm() {
  const navigate = useNavigate();
  const location = useLocation();

  const state =
    (location.state as OtpLocationState | null) ?? {};

  const email = state.email?.trim() ?? "";

  const otpChannel: OtpChannel =
    state.otpChannel === "PHONE"
      ? "PHONE"
      : "EMAIL";

  const rememberMe = Boolean(state.rememberMe);

  const [destination, setDestination] = useState(
    state.destination ?? ""
  );

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState(
    "Verification code sent successfully."
  );

  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const [cooldownSeconds, setCooldownSeconds] = useState(
    INITIAL_COOLDOWN_SECONDS
  );

  useEffect(() => {
    if (!email) {
      navigate("/login", { replace: true });
    }
  }, [email, navigate]);

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCooldownSeconds((current) =>
        Math.max(current - 1, 0)
      );
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [cooldownSeconds]);

  function handleOtpChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const value = event.target.value
      .replace(/\D/g, "")
      .slice(0, 6);

    setOtp(value);
    setError("");
  }

  async function handleVerify(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!/^\d{6}$/.test(otp)) {
      setError(
        "Enter the complete 6-digit verification code."
      );
      return;
    }

    if (verifying || resending) {
      return;
    }

    try {
      setVerifying(true);
      setError("");
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/auth/verify-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            otp,
            otpChannel,
            rememberMe,
          }),
        }
      );

      const data = await readJson<VerifyResponse>(response);

      if (!response.ok || data.success === false) {
        setError(
          data.message || "Verification failed. Please try again."
        );
        return;
      }

      if (!data.token) {
        setError(
          "Verification succeeded, but the server did not return an access session."
        );
        return;
      }

      storeAuthenticatedSession({ ...data, token: data.token }, rememberMe);

      setOtp("");

      navigate(getLandingPage(data), {
        replace: true,
      });
    } catch (err) {
      console.error("OTP verification error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to verify the code. Please try again."
      );
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    if (
      cooldownSeconds > 0 ||
      resending ||
      verifying
    ) {
      return;
    }

    if (!state.password) {
      setError(
        "Your sign-in session has expired. Please sign in again."
      );
      return;
    }

    if (
      otpChannel === "PHONE" &&
      !state.phoneNumber?.trim()
    ) {
      setError(
        "Your phone number is missing. Please sign in again."
      );
      return;
    }

    try {
      setResending(true);
      setError("");
      setMessage("");

      const payload: {
        email: string;
        password: string;
        otpChannel: OtpChannel;
        phoneNumber?: string;
      } = {
        email,
        password: state.password,
        otpChannel,
      };

      if (otpChannel === "PHONE") {
        // This avoids the TypeScript "possibly undefined" error.
        payload.phoneNumber =
          state.phoneNumber?.trim() ?? "";
      }

      const response = await fetch(
        `${API_URL}/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await readJson<LoginResponse>(response);

      if (
        response.status === 429 &&
        data.code === "OTP_COOLDOWN"
      ) {
        const retryAfter =
          typeof data.retryAfterSeconds === "number"
            ? Math.max(
                1,
                Math.ceil(data.retryAfterSeconds)
              )
            : INITIAL_COOLDOWN_SECONDS;

        setCooldownSeconds(retryAfter);

        setError(
          data.message ||
            `Please wait ${retryAfter} seconds before requesting another verification code.`
        );

        return;
      }

      if (
        !response.ok ||
        data.success === false ||
        !data.requiresOtp
      ) {
        setError(
          data.message ||
            "Unable to send another verification code."
        );
        return;
      }

      if (data.verification?.destination) {
        setDestination(data.verification.destination);
      }

      setOtp("");
      setCooldownSeconds(INITIAL_COOLDOWN_SECONDS);

      setMessage(
        otpChannel === "PHONE"
          ? "A new verification code has been sent to your phone."
          : "A new verification code has been sent to your email."
      );
    } catch (err) {
      console.error("OTP resend error:", err);

      setError(
        "Unable to send another verification code."
      );
    } finally {
      setResending(false);
    }
  }

  if (!email) {
    return null;
  }

  const isPhone = otpChannel === "PHONE";

  const resendDisabled =
    cooldownSeconds > 0 ||
    verifying ||
    resending;

  return (
    <div className="grid min-h-screen bg-[#081019] text-white lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden lg:block">
        <img
          src={heroImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />

        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

        <Link
          to="/"
          className="absolute left-10 top-9 z-10 flex items-center gap-3"
        >
          <img
            src={ziyaLogo}
            alt="Ziya"
            className="h-11 w-11 rounded-full object-cover"
          />

          <span className="font-semibold tracking-[0.18em]">
            ZIYA FOS
          </span>
        </Link>

        <div className="absolute bottom-12 left-10 right-10 z-10">
          <h2 className="max-w-xl text-5xl font-medium leading-[1.02] tracking-[-0.04em]">
            Secure access.
            <br />
            Verified every time.
          </h2>

          <p className="mt-5 max-w-lg leading-7 text-white/70">
            Every login is protected using secure two-factor
            authentication to safeguard your organization&apos;s
            financial information.
          </p>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-6 py-12 md:px-12">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center justify-between lg:hidden">
            <Link
              to="/"
              className="flex items-center gap-3"
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

          <button
            type="button"
            onClick={() =>
              navigate("/login", { replace: true })
            }
            className="mb-10 hidden items-center gap-2 text-sm text-white/50 transition hover:text-white lg:inline-flex"
          >
            <ArrowLeft size={17} />
            Back to Sign In
          </button>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#e5b83b]/30 bg-[#e5b83b]/10 text-[#e5b83b]">
            {isPhone ? (
              <Phone size={22} />
            ) : (
              <Mail size={22} />
            )}
          </div>

          <p className="mt-7 text-sm font-semibold uppercase tracking-[0.22em] text-[#e5b83b]">
            Two-Step Verification
          </p>

          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">
            Check your {isPhone ? "phone" : "email"}.
          </h1>

          <p className="mt-3 leading-7 text-white/50">
            Enter the 6-digit verification code sent to:
          </p>

          <p className="mt-1 font-semibold text-white/80">
            {destination ||
              (isPhone
                ? "your registered phone number"
                : email)}
          </p>

          <form
            className="mt-9"
            onSubmit={handleVerify}
          >
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-white/75">
                Verification Code
              </span>

              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                value={otp}
                onChange={handleOtpChange}
                placeholder="000000"
                className="h-16 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-center text-2xl font-semibold tracking-[0.45em] text-white outline-none transition placeholder:text-white/15 focus:border-white/30"
              />
            </label>

            {message && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white/60">
                {message}
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={
                verifying ||
                resending ||
                otp.length !== 6
              }
              className="mt-7 flex h-14 w-full items-center justify-center gap-3 rounded-full bg-white font-semibold text-[#081019] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {verifying
                ? "Verifying..."
                : "Verify and Continue"}

              {!verifying && (
                <ArrowRight size={18} />
              )}
            </button>
          </form>

          <button
            type="button"
            disabled={resendDisabled}
            onClick={() => void handleResend()}
            className="mt-5 flex w-full items-center justify-center gap-2 text-sm font-medium text-white/55 transition hover:text-white disabled:cursor-not-allowed disabled:text-white/25"
          >
            <RotateCcw size={16} />

            {resending
              ? "Sending another code..."
              : resendDisabled
                ? `Send another code in ${cooldownSeconds}s`
                : "Didn't receive it? Send another code"}
          </button>

          <div className="mt-8 flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <ShieldCheck
              size={20}
              className="mt-0.5 shrink-0 text-[#e5b83b]"
            />

            <p className="text-sm leading-6 text-white/45">
              Verification codes expire after 10 minutes.
              For your protection, another code can only
              be requested once the countdown has ended.
              Never share your verification code with
              anyone.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              navigate("/login", { replace: true })
            }
            className="mt-7 flex w-full items-center justify-center gap-2 text-sm text-white/40 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Use another verification method
          </button>
        </div>
      </section>
    </div>
  );
}
