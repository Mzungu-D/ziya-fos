import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck, ArrowRight, RotateCcw } from "lucide-react";

export default function OtpForm() {
  const location = useLocation();
  const navigate = useNavigate();

  const email = location.state?.email || "";

  const [otp, setOtp] = useState("");

  const handleVerify = () => {
    if (otp.length !== 6) {
      alert("Please enter a valid 6-digit OTP.");
      return;
    }

    // Temporary verification
    alert("OTP verified successfully!");

    // Later this will happen only after backend verification
    navigate("/dashboard");
  };

  const handleResend = () => {
    alert(`A new OTP has been sent to ${email}`);
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center px-6">

      <div
        className="
          w-full
          max-w-md
          rounded-[32px]
          border
          border-slate-700
          bg-slate-900/50
          backdrop-blur-xl
          p-10
          shadow-2xl
        "
      >

        {/* Header */}
        <div className="text-center">

          <ShieldCheck
            size={64}
            className="mx-auto text-green-400"
          />

          <h1 className="mt-6 text-4xl font-bold text-white">
            Verify Identity
          </h1>

          <p className="mt-4 text-slate-400 leading-relaxed">
            Enter the 6-digit verification code sent to:
          </p>

          <p className="mt-2 text-blue-400 font-semibold break-all">
            {email}
          </p>

        </div>

        {/* OTP Input */}
        <div className="mt-10">

          <input
            type="text"
            maxLength={6}
            value={otp}
            onChange={(e) =>
              setOtp(e.target.value.replace(/\D/g, ""))
            }
            placeholder="000000"
            className="
              w-full
              rounded-2xl
              border
              border-slate-700
              bg-slate-800
              py-5
              text-center
              text-3xl
              tracking-[12px]
              text-white
              outline-none
              placeholder:text-slate-500
              focus:border-blue-500
              focus:ring-4
              focus:ring-blue-500/20
            "
          />

        </div>

        {/* Verify Button */}
        <button
          onClick={handleVerify}
          className="
            mt-8
            w-full
            flex
            items-center
            justify-center
            gap-3
            rounded-2xl
            bg-gradient-to-r
            from-blue-600
            to-cyan-500
            py-5
            text-lg
            font-semibold
            text-white
            shadow-lg
            transition-all
            duration-300
            hover:scale-[1.02]
          "
        >
          Verify OTP
          <ArrowRight size={22} />
        </button>

        {/* Resend */}
        <button
          onClick={handleResend}
          className="
            mt-6
            flex
            w-full
            items-center
            justify-center
            gap-2
            text-slate-400
            transition
            hover:text-white
          "
        >
          <RotateCcw size={18} />
          Resend Code
        </button>

        {/* Footer */}
        <div className="mt-10 border-t border-slate-700 pt-6 text-center">

          <p className="text-slate-500 text-sm">
            Ziya Financial Operating System
          </p>

          <p className="mt-2 text-slate-600 text-sm">
            simple • ethical • future
          </p>

        </div>

      </div>

    </div>
  );
}