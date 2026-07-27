import { ArrowRight, BrainCircuit, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export default function About() {
  return (
    <div className="min-h-screen bg-[#081019] px-6 pb-24 pt-36 md:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-5xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#e5b83b]">
            About Ziya
          </p>

          <h1 className="mt-5 text-5xl font-medium leading-[1.02] tracking-[-0.045em] md:text-7xl">
            Building simpler financial infrastructure for modern businesses.
          </h1>

          <p className="mt-8 max-w-3xl text-xl leading-9 text-white/60">
            Ziya FOS is a financial operating system bringing accounting,
            financial operations, business workflows, automation and
            intelligence into one connected environment.
          </p>
        </div>

        <div className="mt-20 grid gap-6 lg:grid-cols-3">
          <section className="rounded-[30px] border border-white/10 bg-white/[0.035] p-8">
            <Sparkles className="text-[#e5b83b]" size={27} />

            <h2 className="mt-7 text-2xl font-semibold">Simple</h2>

            <p className="mt-4 leading-7 text-white/55">
              Bring financial operations together so teams spend less time
              navigating disconnected tools and more time understanding the
              business.
            </p>
          </section>

          <section className="rounded-[30px] border border-white/10 bg-white/[0.035] p-8">
            <ShieldCheck className="text-[#e5b83b]" size={27} />

            <h2 className="mt-7 text-2xl font-semibold">Ethical</h2>

            <p className="mt-4 leading-7 text-white/55">
              Accountability, tenant isolation, controlled permissions,
              approvals and auditability form part of the platform's
              financial architecture.
            </p>
          </section>

          <section className="rounded-[30px] border border-white/10 bg-white/[0.035] p-8">
            <BrainCircuit className="text-[#e5b83b]" size={27} />

            <h2 className="mt-7 text-2xl font-semibold">Future</h2>

            <p className="mt-4 leading-7 text-white/55">
              Financial intelligence and automation help organizations move
              beyond recording what happened toward understanding what may
              happen next.
            </p>
          </section>
        </div>

        <div className="mt-20 border-t border-white/10 pt-14">
          <p className="text-sm tracking-[0.25em] text-[#e5b83b]">
            SIMPLE • ETHICAL • FUTURE
          </p>

          <h2 className="mt-6 max-w-3xl text-4xl font-medium tracking-[-0.035em] md:text-5xl">
            Finance should become easier to operate as businesses become more
            sophisticated.
          </h2>

          <Link
            to="/products"
            className="mt-9 inline-flex items-center gap-3 rounded-full bg-white px-7 py-4 font-semibold text-[#081019]"
          >
            Explore Ziya FOS
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}