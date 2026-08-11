interface StatusBadgeProps {
  status:
    | "Active"
    | "Inactive"
    | "Trial"
    | "Suspended"
    | "ACTIVE"
    | "PENDING"
    | "SUSPENDED"
    | "REJECTED";
}

const styles: Record<string, string> = {
  Active:   "bg-green-100 text-green-700 border border-green-200",
  ACTIVE:   "bg-green-100 text-green-700 border border-green-200",

  Trial:    "bg-amber-100 text-amber-700 border border-amber-200",
  PENDING:  "bg-amber-100 text-amber-700 border border-amber-200",

  Suspended: "bg-red-100 text-red-700 border border-red-200",
  SUSPENDED: "bg-red-100 text-red-700 border border-red-200",

  REJECTED: "bg-rose-100 text-rose-700 border border-rose-200",

  Inactive: "bg-slate-100 text-slate-700 border border-slate-200",
};

const labels: Record<string, string> = {
  Active:   "Active",
  ACTIVE:   "Active",

  Trial:    "Pending",
  PENDING:  "Pending",

  Suspended: "Suspended",
  SUSPENDED: "Suspended",

  REJECTED: "Rejected",

  Inactive: "Inactive",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        styles[status] ?? styles.Inactive
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}