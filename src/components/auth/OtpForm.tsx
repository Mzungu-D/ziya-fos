import { ArrowRight } from "lucide-react";

interface OtpFormProps {
  email: string;
  otp: string;
  error: string;
  onOtpChange: (value: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
}

export default function OtpForm({
  email,
  otp,
  error,
  onOtpChange,
  onSubmit,
  onBack,
}: OtpFormProps) {
  return (
    <form className="mt-12" onSubmit={onSubmit}>

      <h2 className="text-2xl font-bold text-[#20243A]">
        Verify Your Email
      </h2>

      <p className="mt-3 text-[#666B84]">
        We sent a verification code to
      </p>

      <p className="mt-1 font-semibold text-[#6D5DF6]">
        {email}
      </p>

      <input
        type="text"
        maxLength={6}
        value={otp}
        onChange={(e) => onOtpChange(e.target.value)}
        placeholder="Enter 6-digit code"
        className="mt-8 w-full rounded-2xl border border-[#ECECF3] bg-[#F8F9FC] px-5 py-4 text-center text-2xl tracking-[0.5em] text-[#20243A] outline-none focus:border-[#6D5DF6]"
      />

      {error && (
        <p className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 py-4 text-lg font-semibold text-[#20243A]"
      >
        Verify
        <ArrowRight size={20} />
      </button>

      <button
        type="button"
        onClick={onBack}
        className="mt-4 w-full text-[#666B84] hover:text-[#20243A]"
      >
        ← Back
      </button>

    </form>
  );
}