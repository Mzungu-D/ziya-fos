interface PrimaryButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  type?: "button" | "submit";
}

export default function PrimaryButton({
  children,
  onClick,
  variant = "primary",
  type = "button",
}: PrimaryButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200";

  const styles = {
    primary:
      "bg-[#6D5DF6] text-white hover:bg-[#5A4BE8] shadow-sm",

    secondary:
      "border border-[#ECECF3] bg-white text-[#20243A] hover:bg-[#F8F9FC]",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      className={`${base} ${styles[variant]}`}
    >
      {children}
    </button>
  );
}