import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
}

export default function EmptyState({
  title,
  description,
  icon,
}: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 bg-[#0B1220] py-16 text-center">
      {icon && (
        <div className="mb-4 flex justify-center text-amber-400">
          {icon}
        </div>
      )}

      <h2 className="text-xl font-semibold text-white">
        {title}
      </h2>

      <p className="mx-auto mt-3 max-w-md text-slate-400">
        {description}
      </p>
    </div>
  );
}