import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import heroImage from "../assets/ziya-fos-hero.png";
import { API_URL } from "../lib/api";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      alert("Please enter both email and password.");
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.message);
        setLoading(false);
        return;
      }
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      navigate("/otp", { state: { email: data.user.email, otp: data.otp } });
    } catch (error) {
      console.error(error);
      alert("Unable to connect to server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020B24] flex">
      <div className="hidden lg:flex lg:w-[58%] items-center justify-center p-8">
        <img src={heroImage} alt="Ziya FOS" className="w-full max-w-[1100px] object-contain" />
      </div>
      <div className="w-full lg:w-[42%] flex items-center justify-center p-8">
        <div className="w-full max-w-[520px]">
          <h1 className="text-6xl font-bold text-white mb-4">Access Ziya FOS</h1>
          <p className="text-slate-400 text-2xl mb-12">Secure access to your Financial Operating System.</p>
          <div className="mb-6">
            <label className="block text-white text-lg font-semibold mb-3">Email Address</label>
            <div className="flex items-center h-16 rounded-2xl bg-slate-800 border border-slate-700 px-5">
              <Mail className="text-slate-400 mr-3" size={20} />
              <input type="email" placeholder="Enter your email address" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1 bg-transparent text-white outline-none" />
            </div>
          </div>
          <div className="mb-6">
            <label className="block text-white text-lg font-semibold mb-3">Password</label>
            <div className="flex items-center h-16 rounded-2xl bg-slate-800 border border-slate-700 px-5">
              <Lock className="text-slate-400 mr-3" size={20} />
              <input type={showPassword ? "text" : "password"} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} className="flex-1 bg-transparent text-white outline-none" />
              <button type="button" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff className="text-slate-400" size={20} /> : <Eye className="text-slate-400" size={20} />}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between mb-10">
            <label className="flex items-center gap-3 text-slate-300">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
              Remember Me
            </label>
            <button type="button" className="text-cyan-400 hover:text-cyan-300">Forgot Password?</button>
          </div>
          <button onClick={handleLogin} disabled={loading} className="w-full h-16 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-xl font-semibold hover:opacity-90 transition disabled:opacity-50">
            {loading ? "Signing In..." : "Sign In"}
          </button>
          <div className="my-10 flex items-center">
            <div className="flex-1 border-t border-slate-700"></div>
            <span className="px-4 text-slate-500 text-sm">Secure Authentication</span>
            <div className="flex-1 border-t border-slate-700"></div>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <h3 className="text-white font-semibold mb-2">Security Notice</h3>
            <p className="text-slate-400 text-sm leading-6">After successful login, a One-Time Password (OTP) will be required to complete authentication before accessing Ziya Financial Operating System.</p>
          </div>
          <div className="mt-16 text-center">
            <p className="text-blue-400 font-semibold">Version 1.0.0</p>
            <p className="mt-4 text-slate-500 text-sm">© 2026 Ziya Financial Operating System</p>
            <p className="mt-2 text-slate-600 text-sm">simple • ethical • future</p>
          </div>
        </div>
      </div>
    </div>
  );
}