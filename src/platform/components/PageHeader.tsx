import { ChevronRight } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle: string;
}

export default function PageHeader({
  title,
  subtitle,
}: PageHeaderProps) {
  return (
    <section className="flex items-center justify-between">

      <div>

        {/* Breadcrumb */}

        <div className="mb-2 flex items-center gap-2 text-sm text-[#9AA3B2]">

          <span>Platform</span>

          <ChevronRight size={14} />

          <span className="font-medium text-[#666B84]">
            {title}
          </span>

        </div>

        {/* Title */}

        <h1 className="text-[32px] font-bold tracking-tight text-[#20243A]">
          {title}
        </h1>

        {/* Subtitle */}

        <p className="mt-2 max-w-3xl text-[15px] leading-7 text-[#666B84]">
          {subtitle}
        </p>

      </div>

      {/* Right Side */}

      <div className="hidden items-center gap-3 lg:flex">

        <div className="rounded-xl border border-[#ECECF3] bg-white px-4 py-3 shadow-sm">

          <p className="text-xs uppercase tracking-wider text-[#9AA3B2]">
            Environment
          </p>

          <p className="mt-1 font-semibold text-[#20243A]">
            Production
          </p>

        </div>

      </div>

    </section>
  );
}