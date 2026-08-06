interface StatusBadgeProps {
  status: "Active" | "Inactive" | "Trial" | "Suspended";
}

export default function StatusBadge({
  status,
}: StatusBadgeProps) {
  const styles = {
    Active:
      "bg-green-100 text-green-700",

    Trial:
      "bg-blue-100 text-blue-700",

    Suspended:
      "bg-red-100 text-red-700",

    Inactive:
      "bg-slate-100 text-slate-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {status}
    </span>
  );
}