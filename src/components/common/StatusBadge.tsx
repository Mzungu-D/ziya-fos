interface StatusBadgeProps {
  status:
    | "ACTIVE"
    | "PENDING"
    | "SUSPENDED"
    | "INACTIVE"
    | "APPROVED"
    | "REJECTED"
    | "HEALTHY"
    | "FAILED";
}

export default function StatusBadge({
  status,
}: StatusBadgeProps) {
  const styles: Record<string, string> = {
    ACTIVE:
      "bg-green-500/15 text-green-400 border-green-500/20",

    APPROVED:
      "bg-green-500/15 text-green-400 border-green-500/20",

    HEALTHY:
      "bg-green-500/15 text-green-400 border-green-500/20",

    PENDING:
      "bg-amber-500/15 text-amber-400 border-amber-500/20",

    SUSPENDED:
      "bg-red-500/15 text-red-400 border-red-500/20",

    FAILED:
      "bg-red-500/15 text-red-400 border-red-500/20",

    REJECTED:
      "bg-red-500/15 text-red-400 border-red-500/20",

    INACTIVE:
      "bg-slate-500/15 text-[#666B84] border-slate-500/20",
  };

  return (
    <span
      className={`
        inline-flex
        items-center
        rounded-full
        border
        px-3
        py-1
        text-xs
        font-semibold
        tracking-wide
        uppercase
        ${styles[status]}
      `}
    >
      {status}
    </span>
  );
}