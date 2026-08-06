import type { ButtonHTMLAttributes } from "react";

type PrimaryButtonProps =
  ButtonHTMLAttributes<HTMLButtonElement>;

export default function PrimaryButton({
  children,
  className = "",
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      {...props}
      className={`rounded-2xl bg-[#F3F0FF] px-6 py-3 font-semibold text-[#5D4DFF] transition-all duration-200 hover:bg-[#E8E3FF] hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}