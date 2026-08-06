interface PageHeaderProps {
  title: string;
  subtitle: string;
}

export default function PageHeader({
  title,
  subtitle,
}: PageHeaderProps) {
  return (
    <section>

      <h1 className="text-5xl font-bold tracking-tight text-[#20243A]">
        {title}
      </h1>

      <p className="mt-3 text-xl text-slate-500">
        {subtitle}
      </p>

    </section>
  );
}