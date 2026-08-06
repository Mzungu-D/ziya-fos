import {
  ArrowUpRight,
  BadgeDollarSign,
} from "lucide-react";

interface InfoBannerProps {
  title: string;
  description: string;
}

export default function InfoBanner({
  title,
  description,
}: InfoBannerProps) {
  return (
    <section className="rounded-2xl border border-[#ECECF3] bg-white shadow-sm">

      <div className="flex items-center justify-between p-6">

        <div className="flex items-start gap-5">

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F3F0FF]">

            <BadgeDollarSign
              size={28}
              className="text-[#6D5DF6]"
            />

          </div>

          <div>

            <h2 className="text-xl font-semibold text-[#20243A]">
              {title}
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-7 text-[#666B84]">
              {description}
            </p>

          </div>

        </div>

        <button className="flex items-center gap-2 rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-5 py-3 text-sm font-semibold text-[#20243A] transition hover:border-[#6D5DF6] hover:bg-white">

          View Report

          <ArrowUpRight size={17} />

        </button>

      </div>

    </section>
  );
}