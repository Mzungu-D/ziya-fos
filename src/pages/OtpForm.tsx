import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
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

type OtpChannel = "email" | "phone";

export default function OtpForm() {
  const location = useLocation();
  const navigate = useNavigate();

  const email = location.state?.email || "";
  const phone = location.state?.phone || "";
  const devOtp = location.state?.otp || null;
  const challengeId = location.state?.challengeId || null;
  const rememberMe = Boolean(location.state?.rememberMe);

  const [channel, setChannel] = useState<OtpChannel>("email");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const phoneAvailable = Boolean(phone);

  const maskEmail = (value: string) => {
    const [name, domain] = value.split("@");

    if (!name || !domain) return value;

    const visible = name.slice(0, Math.min(2, name.length));

    return `${visible}${"*".repeat(
      Math.max(name.length - visible.length, 2)
    )}@${domain}`;
  };

  const maskPhone = (value: string) => {
    if (!value) return "";

    if (value.length <= 4) return value;

    return `${"*".repeat(Math.max(value.length - 4, 4))}${value.slice(-4)}`;
  };

  const handleVerify = async () => {
    if (otp.length !== 6) {
      alert("Enter the 6-digit verification code.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/api/auth/verify-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            phone: channel === "phone" ? phone : undefined,
            otp,
            channel,
            challengeId,
            rememberMe,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Invalid verification code.");
        return;
      }

      if (data.token) {
        localStorage.setItem("token", data.token);
      }

      if (data.user) {
        localStorage.setItem(
          "user",
          JSON.stringify(data.user)
        );
      }

      /*
        Multi-tenancy:

        Backend can return organizations/memberships.

        - 1 organization -> continue directly
        - multiple organizations -> organization switcher
        - organizationId in token/session determines tenant context

        Until the workspace switcher screen is added, the existing
        dashboard remains the destination.
      */

      if (data.organization) {
        localStorage.setItem(
          "organization",
          JSON.stringify(data.organization)
        );
      }

      if (data.organizations) {
        localStorage.setItem(
          "organizations",
          JSON.stringify(data.organizations)
        );
      }

      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      alert("Unable to verify the code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      setResending(true);

      const response = await fetch(
        `${API_URL}/api/auth/resend-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            phone: channel === "phone" ? phone : undefined,
            channel,
            challengeId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Unable to resend code.");
        return;
      }

      alert(
        channel === "email"
          ? "A new verification code has been sent to your email."
          : "A new verification code has been sent to your registered phone."
      );
    } catch (error) {
      console.error(error);
      alert("Unable to resend the verification code.");
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#081019] px-6 text-white">
        <div className="text-center">
          <p className="text-white/60">
            Your login session is missing.
          </p>

          <button
            onClick={() => navigate("/login")}
            className="mt-5 rounded-full bg-white px-6 py-3 font-semibold text-[#081019]"
          >
            Return to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#081019] px-6 py-10 text-white">
      <div className="mx-auto max-w-md">

        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/login")}
            className="text-white/50 transition hover:text-white"
          >
            <ArrowLeft size={22} />
          </button>

          <div className="flex items-center gap-3">
            <img
              src={ziyaLogo}
              alt="Ziya"
              className="h-9 w-9 rounded-full object-cover"
            />

            <span className="text-sm font-semibold tracking-[0.15em]">
              ZIYA FOS
            </span>
          </div>
        </div>

        <div className="mt-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
            <ShieldCheck
              size={27}
              className="text-[#e5b83b]"
            />
          </div>

          <h1 className="mt-7 text-4xl font-semibold tracking-[-0.04em]">
            Verify your identity.
          </h1>

          <p className="mt-4 leading-7 text-white/50">
            Choose where you want to receive your secure 6-digit
            verification code.
          </p>

          <div className="mt-8 grid gap-3">
            <button
              type="button"
              onClick={() => setChannel("email")}
              className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${
                channel === "email"
                  ? "border-[#e5b83b] bg-[#e5b83b]/10"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <Mail
                size={21}
                className={
                  channel === "email"
                    ? "text-[#e5b83b]"
                    : "text-white/40"
                }
              />

              <div>
                <p className="font-semibold">Email</p>
                <p className="mt-1 text-sm text-white/45">
                  {maskEmail(email)}
                </p>
              </div>
            </button>

            <button
              type="button"
              disabled={!phoneAvailable}
              onClick={() => {
                if (phoneAvailable) setChannel("phone");
              }}
              className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${
                channel === "phone"
                  ? "border-[#e5b83b] bg-[#e5b83b]/10"
                  : "border-white/10 bg-white/[0.03]"
              } ${
                !phoneAvailable
                  ? "cursor-not-allowed opacity-40"
                  : ""
              }`}
            >
              <Phone
                size={21}
                className={
                  channel === "phone"
                    ? "text-[#e5b83b]"
                    : "text-white/40"
                }
              />

              <div>
                <p className="font-semibold">
                  Registered phone
                </p>

                <p className="mt-1 text-sm text-white/45">
                  {phoneAvailable
                    ? maskPhone(phone)
                    : "No registered phone available"}
                </p>
              </div>
            </button>
          </div>

          {devOtp && (
            <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
                Development OTP
              </p>

              <p className="mt-2 text-3xl font-bold tracking-[0.35em] text-amber-200">
                {devOtp}
              </p>
            </div>
          )}

          <div className="mt-7">
            <label className="mb-2 block text-sm font-medium text-white/70">
              Verification code
            </label>

            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(event) =>
                setOtp(
                  event.target.value.replace(/\D/g, "")
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleVerify();
                }
              }}
              placeholder="000000"
              className="h-16 w-full rounded-2xl border border-white/10 bg-white/[0.04] text-center text-2xl font-semibold tracking-[0.4em] text-white outline-none placeholder:text-white/15 focus:border-white/30"
            />
          </div>

          <button
            type="button"
            onClick={handleVerify}
            disabled={loading}
            className="mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-full bg-white font-semibold text-[#081019] transition hover:bg-white/90 disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify & continue"}

            {!loading && <ArrowRight size={18} />}
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="mt-5 flex w-full items-center justify-center gap-2 text-sm text-white/50 transition hover:text-white disabled:opacity-50"
          >
            <RotateCcw size={16} />

            {resending ? "Sending..." : "Resend code"}
          </button>
        </div>
      </div>
    </div>
  );
}