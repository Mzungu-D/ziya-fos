import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";

import { API_URL } from "../lib/api";
import ziyaLogo from "../assets/zayi.jpg";
import heroImage from "../assets/ziya-cinematic-hero.webp";

type OtpChannel = "EMAIL" | "PHONE";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpChannel, setOtpChannel] =
    useState<OtpChannel>("EMAIL");

  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      setError("Enter your email address and password.");
      return;
    }

    if (
      otpChannel === "PHONE" &&
      !phoneNumber.trim()
    ) {
      setError(
        "Enter the phone number where you want to receive the verification code."
      );
      return;
    }

    try {
      setLoading(true);
      setError("");

      const payload: {
        email: string;
        password: string;
        otpChannel: OtpChannel;
        phoneNumber?: string;
      } = {
        email: normalizedEmail,
        password,
        otpChannel,
      };

      if (otpChannel === "PHONE") {
        payload.phoneNumber = phoneNumber.trim();
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

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message ||
            "Unable to continue authentication."
        );
        return;
      }

      if (!data.requiresOtp) {
        setError(
          "The server did not request OTP verification."
        );
        return;
      }

      navigate("/otp", {
        state: {
          email: normalizedEmail,
          otpChannel,
          destination:
            data.verification?.destination || "",
          sessionType:
            data.verification?.sessionType || "",
          rememberMe,

          // Used only if the user requests another code.
          // Password is intentionally not persisted in storage.
          password,
          phoneNumber:
            otpChannel === "PHONE"
              ? phoneNumber.trim()
              : "",
        },
      });
    } catch (err) {
      console.error(err);

      setError(
        "Unable to connect to Ziya FOS. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-[#081019] text-[#20243A] lg:grid-cols-[1.05fr_0.95fr]">
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
            Access your organization's financial operating
            system, products, permissions and financial data.
          </p>
        </div>
      </section>

      {/* Login */}
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

          <Link
            to="/"
            className="mb-10 hidden items-center gap-2 text-sm text-white/50 transition hover:text-[#20243A] lg:inline-flex"
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
            {/* Email */}
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-white/75">
                Email address
              </span>

              <div className="flex h-14 items-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 focus-within:border-white/30">
                <Mail
                  size={18}
                  className="mr-3 text-white/35"
                />

                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="name@company.com"
                  autoComplete="email"
                  className="w-full bg-transparent text-[#20243A] outline-none placeholder:text-white/25"
                />
              </div>
            </label>

            {/* Password */}
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-white/75">
                Password
              </span>

              <div className="flex h-14 items-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 focus-within:border-white/30">
                <Lock
                  size={18}
                  className="mr-3 text-white/35"
                />

                <input
                  type={
                    showPassword ? "text" : "password"
                  }
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      otpChannel === "EMAIL"
                    ) {
                      void handleLogin();
                    }
                  }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full bg-transparent text-[#20243A] outline-none placeholder:text-white/25"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((value) => !value)
                  }
                  className="text-white/40 transition hover:text-[#20243A]"
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
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

            {/* OTP channel */}
            <div>
              <span className="mb-3 block text-sm font-medium text-white/75">
                Verification method
              </span>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setOtpChannel("EMAIL");
                    setError("");
                  }}
                  className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-4 text-sm font-medium transition ${
                    otpChannel === "EMAIL"
                      ? "border-[#e5b83b] bg-[#e5b83b]/10 text-[#20243A]"
                      : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/20"
                  }`}
                >
                  <Mail size={18} />
                  Email
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOtpChannel("PHONE");
                    setError("");
                  }}
                  className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-4 text-sm font-medium transition ${
                    otpChannel === "PHONE"
                      ? "border-[#e5b83b] bg-[#e5b83b]/10 text-[#20243A]"
                      : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/20"
                  }`}
                >
                  <Phone size={18} />
                  Phone
                </button>
              </div>
            </div>

            {/* Dynamic phone */}
            {otpChannel === "PHONE" && (
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-white/75">
                  Phone number
                </span>

                <div className="flex h-14 items-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 focus-within:border-white/30">
                  <Phone
                    size={18}
                    className="mr-3 text-white/35"
                  />

                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(event) =>
                      setPhoneNumber(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void handleLogin();
                      }
                    }}
                    placeholder="e.g. 07XXXXXXXX"
                    autoComplete="tel"
                    className="w-full bg-transparent text-[#20243A] outline-none placeholder:text-white/25"
                  />
                </div>

                <p className="mt-2 text-xs leading-5 text-white/35">
                  The number is verified by OTP before it
                  becomes associated with your account.
                </p>
              </label>
            )}
          </div>

          {error && (
            <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

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
              className="text-sm font-medium text-white/70 transition hover:text-[#20243A]"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleLogin()}
            disabled={loading}
            className="mt-8 flex h-14 w-full items-center justify-center gap-3 rounded-full bg-white font-semibold text-[#081019] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Sending verification code..."
              : "Continue securely"}

            {!loading && <ArrowRight size={18} />}
          </button>

          <div className="mt-7 flex gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <ShieldCheck
              size={20}
              className="shrink-0 text-[#e5b83b]"
            />

            <p className="text-sm leading-6 text-white/45">
              Two-step verification protects access to your
              financial workspace. Choose email or phone to
              receive your secure verification code.
            </p>
          </div>

          <p className="mt-8 text-center text-sm text-white/40">
            New to Ziya?{" "}
            <Link
              to="/open-account"
              className="font-semibold text-[#20243A]"
            >
              Open an account
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}