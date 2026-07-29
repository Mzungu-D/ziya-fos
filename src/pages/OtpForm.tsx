import {
  useEffect,
  useState,
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
import ziyaLogo from "../assets/zayi.jpg";
import heroImage from "../assets/ziya-cinematic-hero.webp";

type OtpChannel = "EMAIL" | "PHONE";

interface OtpLocationState {
  email?: string;
  otpChannel?: OtpChannel;
  destination?: string;
  sessionType?: string;
  rememberMe?: boolean;

  /*
   * Used only during the current browser navigation
   * so /login can be called again when resending.
   *
   * These values are NOT stored in localStorage
   * or sessionStorage.
   */
  password?: string;
  phoneNumber?: string;
}

interface VerifyResponse {
  success?: boolean;
  message?: string;
  token?: string;

  sessionType?: "PLATFORM" | "TENANT";
  verificationChannel?: OtpChannel;

  user?: {
    id?: string;
    name?: string;
    email?: string;
    phoneNumber?: string | null;
    phoneVerifiedAt?: string | null;
    platformRole?: string | null;
    role?: string;
  };

  organization?: {
    id?: string;
    name?: string;
    slug?: string;
    logoUrl?: string | null;
    country?: string;
    currency?: string;
  };

  organizations?: unknown[];
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

export default function OtpForm() {
  const navigate = useNavigate();
  const location = useLocation();

  const state =
    (location.state as OtpLocationState | null) ??
    {};

  const email =
    state.email?.trim() ?? "";

  const otpChannel: OtpChannel =
    state.otpChannel === "PHONE"
      ? "PHONE"
      : "EMAIL";

  const rememberMe =
    Boolean(state.rememberMe);

  const [destination, setDestination] =
    useState(
      state.destination ?? ""
    );

  const [otp, setOtp] =
    useState("");

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState(
      "Verification code sent successfully."
    );

  const [verifying, setVerifying] =
    useState(false);

  const [resending, setResending] =
    useState(false);

  /*
   * The first OTP was just generated on the
   * login page, so the resend countdown starts
   * immediately when this page opens.
   */
  const [
    cooldownSeconds,
    setCooldownSeconds,
  ] = useState(
    INITIAL_COOLDOWN_SECONDS
  );

  /* =====================================================
     PROTECT DIRECT ACCESS TO /otp
  ===================================================== */

  useEffect(() => {
    if (!email) {
      navigate(
        "/login",
        {
          replace: true,
        }
      );
    }
  }, [email, navigate]);

  /* =====================================================
     RESEND COUNTDOWN
  ===================================================== */

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      return;
    }

    const timer =
      window.setTimeout(() => {
        setCooldownSeconds(
          (current) =>
            Math.max(
              0,
              current - 1
            )
        );
      }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [cooldownSeconds]);

  /* =====================================================
     OTP INPUT
  ===================================================== */

  const handleOtpChange = (
    event:
      React.ChangeEvent<HTMLInputElement>
  ) => {
    const digitsOnly =
      event.target.value
        .replace(/\D/g, "")
        .slice(0, 6);

    setOtp(digitsOnly);
    setError("");
  };

  /* =====================================================
     STORE AUTHENTICATED SESSION

     No token is stored before successful OTP.
  ===================================================== */

  const storeAuthenticatedSession = (
    data: VerifyResponse
  ) => {
    if (!data.token) {
      throw new Error(
        "Authentication succeeded but no access token was returned."
      );
    }

    const storage =
      rememberMe
        ? localStorage
        : sessionStorage;

    /*
     * Prevent an old session existing in the
     * opposite browser storage.
     */
    localStorage.removeItem("token");
    localStorage.removeItem(
      "sessionType"
    );
    localStorage.removeItem("user");
    localStorage.removeItem(
      "organization"
    );
    localStorage.removeItem(
      "organizations"
    );

    sessionStorage.removeItem("token");
    sessionStorage.removeItem(
      "sessionType"
    );
    sessionStorage.removeItem("user");
    sessionStorage.removeItem(
      "organization"
    );
    sessionStorage.removeItem(
      "organizations"
    );

    storage.setItem(
      "token",
      data.token
    );

    if (data.sessionType) {
      storage.setItem(
        "sessionType",
        data.sessionType
      );
    }

    if (data.user) {
      storage.setItem(
        "user",
        JSON.stringify(
          data.user
        )
      );
    }

    if (data.organization) {
      storage.setItem(
        "organization",
        JSON.stringify(
          data.organization
        )
      );
    }

    if (data.organizations) {
      storage.setItem(
        "organizations",
        JSON.stringify(
          data.organizations
        )
      );
    }
  };

  /* =====================================================
     VERIFY OTP
  ===================================================== */

  const handleVerify = async (
    event:
      React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!/^\d{6}$/.test(otp)) {
      setError(
        "Enter the complete 6-digit verification code."
      );

      return;
    }

    try {
      setVerifying(true);
      setError("");
      setMessage("");

      const response =
        await fetch(
          `${API_URL}/api/auth/verify-otp`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              email,
              otp,
              otpChannel,
            }),
          }
        );

      const data:
        VerifyResponse =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        setError(
          data.message ||
            "Verification failed. Please try again."
        );

        return;
      }

      storeAuthenticatedSession(
        data
      );

      setOtp("");

      /*
       * Authentication is now complete.
       *
       * The backend determines whether this
       * is PLATFORM or TENANT access.
       */
      navigate(
        "/",
        {
          replace: true,
        }
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to verify the code. Please try again."
      );
    } finally {
      setVerifying(false);
    }
  };

  /* =====================================================
     RESEND OTP

     There is deliberately no separate
     /resend-otp endpoint.

     The existing /login endpoint already performs:
       password validation
       OTP creation
       OTP delivery

     Backend also enforces the 60-second cooldown.
  ===================================================== */

  const handleResend = async () => {
    /*
     * Frontend protection.
     *
     * Backend independently enforces the same
     * restriction, so this cannot be bypassed
     * simply by manipulating the UI.
     */
    if (
      cooldownSeconds > 0 ||
      resending ||
      verifying
    ) {
      return;
    }

    if (!state.password) {
      setError(
        "Your sign-in session must be restarted before another code can be requested."
      );

      return;
    }

    if (
      otpChannel === "PHONE" &&
      !state.phoneNumber
    ) {
      setError(
        "Your phone verification session has expired. Please sign in again."
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
        password:
          state.password,
        otpChannel,
      };

      if (
        otpChannel === "PHONE"
      ) {
        payload.phoneNumber =
          state.phoneNumber?.trim();
      }

      const response =
        await fetch(
          `${API_URL}/api/auth/login`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                payload
              ),
          }
        );

      const data:
        LoginResponse =
        await response.json();

      /*
       * Backend cooldown is authoritative.
       *
       * If frontend and backend timers differ
       * slightly, use the server's remaining
       * cooldown.
       */
      if (
        response.status === 429 &&
        data.code ===
          "OTP_COOLDOWN"
      ) {
        const retryAfter =
          typeof data.retryAfterSeconds ===
            "number"
            ? Math.max(
                1,
                Math.ceil(
                  data.retryAfterSeconds
                )
              )
            : 60;

        setCooldownSeconds(
          retryAfter
        );

        setError(
          data.message ||
            `Please wait ${retryAfter} seconds before requesting another code.`
        );

        return;
      }

      if (!response.ok) {
        setError(
          data.message ||
            "Unable to send another verification code."
        );

        return;
      }

      if (
        !data.success ||
        !data.requiresOtp
      ) {
        setError(
          "The server did not create a new verification challenge."
        );

        return;
      }

      if (
        data.verification
          ?.destination
      ) {
        setDestination(
          data.verification
            .destination
        );
      }

      setOtp("");

      /*
       * A new OTP has just been issued.
       * Restart the visible cooldown.
       */
      setCooldownSeconds(
        INITIAL_COOLDOWN_SECONDS
      );

      setMessage(
        otpChannel === "PHONE"
          ? "A new verification code was sent to your phone."
          : "A new verification code was sent to your email."
      );
    } catch (err) {
      console.error(err);

      setError(
        "Unable to send another code. Please try again."
      );
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return null;
  }

  const isPhone =
    otpChannel === "PHONE";

  const resendDisabled =
    cooldownSeconds > 0 ||
    resending ||
    verifying;

  /* =====================================================
     UI
  ===================================================== */

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
            Secure access.
            <br />
            Verified every time.
          </h2>

          <p className="mt-5 max-w-lg leading-7 text-white/70">
            Two-step verification protects access to your organization's financial workspace.
          </p>

        </div>

      </section>

      {/* OTP side */}

      <section className="flex min-h-screen items-center justify-center px-6 py-12 md:px-12">

        <div className="w-full max-w-md">

          {/* Mobile logo */}

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

          {/* Back */}

          <button
            type="button"
            onClick={() =>
              navigate(
                "/login",
                {
                  replace: true,
                }
              )
            }
            className="mb-10 hidden items-center gap-2 text-sm text-white/50 transition hover:text-white lg:inline-flex"
          >
            <ArrowLeft size={17} />
            Back to sign in
          </button>

          {/* Channel icon */}

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#e5b83b]/25 bg-[#e5b83b]/10 text-[#e5b83b]">

            {isPhone ? (
              <Phone size={22} />
            ) : (
              <Mail size={22} />
            )}

          </div>

          <p className="mt-7 text-sm font-semibold uppercase tracking-[0.22em] text-[#e5b83b]">
            Two-step verification
          </p>

          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">
            Check your{" "}
            {isPhone
              ? "phone"
              : "email"}
            .
          </h1>

          <p className="mt-3 leading-7 text-white/50">
            Enter the 6-digit verification code sent to
          </p>

          <p className="mt-1 font-semibold text-white/80">
            {destination ||
              (
                isPhone
                  ? "your registered phone number"
                  : email
              )}
          </p>

          {/* OTP form */}

          <form
            className="mt-9"
            onSubmit={
              handleVerify
            }
          >

            <label className="block">

              <span className="mb-2 block text-sm font-medium text-white/75">
                Verification code
              </span>

              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={
                  handleOtpChange
                }
                autoFocus
                placeholder="000000"
                className="h-16 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-center text-2xl font-semibold tracking-[0.45em] text-white outline-none transition placeholder:text-white/15 focus:border-white/30"
              />

            </label>

            {/* Success/info message */}

            {message && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm leading-6 text-white/50">
                {message}
              </div>
            )}

            {/* Error */}

            {error && (
              <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-200">
                {error}
              </div>
            )}

            {/* Verify */}

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
                : "Verify and continue"}

              {!verifying && (
                <ArrowRight
                  size={18}
                />
              )}

            </button>

          </form>

          {/* Resend */}

          <button
            type="button"
            disabled={
              resendDisabled
            }
            onClick={() =>
              void handleResend()
            }
            className="mt-5 flex w-full items-center justify-center gap-2 text-sm font-medium text-white/55 transition hover:text-white disabled:cursor-not-allowed disabled:text-white/25"
          >

            <RotateCcw
              size={16}
            />

            {resending
              ? "Sending another code..."
              : cooldownSeconds > 0
                ? `Send another code in ${cooldownSeconds}s`
                : "Didn't receive it? Send another code"}

          </button>

          {/* Security information */}

          <div className="mt-8 flex gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">

            <ShieldCheck
              size={20}
              className="shrink-0 text-[#e5b83b]"
            />

            <p className="text-sm leading-6 text-white/45">
              Verification codes expire after 10 minutes.
              For your security, a new code can only be
              requested after the resend countdown ends.
              Never share your verification code with
              anyone.
            </p>

          </div>

          {/* Change method */}

          <button
            type="button"
            onClick={() =>
              navigate(
                "/login",
                {
                  replace: true,
                }
              )
            }
            className="mt-7 flex w-full items-center justify-center gap-2 text-sm text-white/40 transition hover:text-white"
          >
            <ArrowLeft
              size={16}
            />
            Use another verification method
          </button>

        </div>

      </section>

    </div>
  );
}