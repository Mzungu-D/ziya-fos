import { Mail, ArrowRight } from "lucide-react";

interface EmailFormProps {
  email: string;
  error: string;
  onEmailChange: (value: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export default function EmailForm({
  email,
  error,
  onEmailChange,
  onSubmit,
}: EmailFormProps) {
  return (
    <form className="mt-12" onSubmit={onSubmit}>

      <label
        htmlFor="email"
        className="mb-2 block font-medium text-slate-300"
      >
        Email Address
      </label>

      <div className="flex items-center rounded-2xl border border-slate-700 bg-slate-800 px-5 py-4 transition-all duration-300 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/20">

        <Mail
          size={22}
          className="text-slate-500"
        />

        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="Enter your email address"
          className="ml-3 flex-1 bg-transparent text-lg text-white outline-none placeholder:text-slate-500"
        />

      </div>

      {error && (
        <p className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="mt-3 flex justify-end">

        <button
          type="button"
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          Forgot Password?
        </button>

      </div>

      <button
        type="submit"
        className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 py-4 text-lg font-semibold text-white shadow-lg transition-all duration-300 hover:scale-[1.02]"
      >
        Continue
        <ArrowRight size={20} />
      </button>

    </form>
  );
}