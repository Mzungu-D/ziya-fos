interface DataCardProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export default function DataCard({
  title,
  children,
  action,
}: DataCardProps) {
  return (
    <section className="rounded-3xl border border-[#ECECF3] bg-white shadow-sm">

      <div className="flex items-center justify-between border-b border-[#ECECF3] px-8 py-6">

        <h2 className="text-2xl font-semibold text-[#20243A]">
          {title}
        </h2>

        {action}

      </div>

      <div className="p-8">
        {children}
      </div>

    </section>
  );
}