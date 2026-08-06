interface InfoBannerProps {
  title: string;
  description: string;
  buttonText?: string;
}

export default function InfoBanner({
  title,
  description,
  buttonText = "View Report",
}: InfoBannerProps) {
  return (
    <section className="rounded-3xl border border-[#ECECF3] bg-white p-8 shadow-sm">

      <div className="flex items-start justify-between gap-8">

        <div className="flex gap-6">

          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-[#F3F0FF] text-5xl">
            📈
          </div>

          <div>

            <h2 className="text-3xl font-bold text-[#20243A]">
              {title}
            </h2>

            <p className="mt-4 max-w-5xl text-lg leading-9 text-slate-600">
              {description}
            </p>

          </div>

        </div>

        <button className="rounded-2xl bg-[#F3F0FF] px-6 py-3 font-semibold text-[#5D4DFF] transition hover:bg-[#ECE8FF]">
          {buttonText}
        </button>

      </div>

    </section>
  );
}