import { useState } from "react";
import { useNavigate } from "react-router-dom";
import heroImage from "../assets/ziya-fos-hero.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  const handleContinue = () => {
    if (!email) {
      alert("Please enter your email address");
      return;
    }

    alert(`OTP will be sent to ${email}`);

    navigate("/otp", {
      state: { email },
    });
  };

  return (
    <div className="min-h-screen bg-[#020B24] flex">
      {/* Left Side */}
      <div className="hidden lg:flex lg:w-[58%] items-center justify-center p-8">
        <img
          src={heroImage}
          alt="Ziya FOS"
          className="w-full max-w-[1100px] object-contain"
        />
      </div>

      {/* Right Side */}
      <div className="w-full lg:w-[42%] flex items-center justify-center p-8">
        <div className="w-full max-w-[520px]">
          <h1 className="text-6xl font-bold text-white mb-4">
            Access Ziya FOS
          </h1>

          <p className="text-slate-400 text-2xl mb-16">
            Secure access to your Financial Operating System.
          </p>

          <div className="mb-6">
            <label className="block text-white text-xl font-semibold mb-4">
              Email Address
            </label>

            <input
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-20 rounded-3xl bg-slate-800 border border-slate-700 px-8 text-xl text-white outline-none focus:border-cyan-400"
            />
          </div>

          <button
            onClick={handleContinue}
            className="w-full h-20 rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-2xl font-semibold hover:opacity-90 transition"
          >
            Continue →
          </button>

          <div className="mt-16 text-center">
            <p className="text-blue-400 font-semibold">Version 1.0.0</p>

            <p className="mt-4 text-slate-500 text-sm">
              © 2026 Ziya Financial Operating System
            </p>

            <p className="mt-2 text-slate-600 text-sm">
              simple • ethical • future
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}