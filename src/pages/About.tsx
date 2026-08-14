import {
  ArrowRight,
  BrainCircuit,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

export default function About() {
  return (
    <div className="min-h-screen bg-[#f8fafc] px-6 pb-24 pt-36 text-[#20243A] md:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-5xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#e5b83b]">
            About Ziya
          </p>

          <h1 className="mt-5 text-5xl font-medium leading-[1.02] tracking-[-0.045em] text-[#20243A] md:text-7xl">
            Building simpler financial infrastructure for modern businesses.
          </h1>

          <p className="mt-8 max-w-3xl text-xl leading-9 text-slate-600">
            Ziya FOS is a financial operating system bringing accounting,
            financial operations, business workflows, automation and
            intelligence into one connected environment.
          </p>
        </div>

        <div className="mt-20 grid gap-6 lg:grid-cols-3">
          <section className="rounded-[30px] border border-slate-200 bg-white p-8 shadow-sm">
            <Sparkles
              className="text-[#e5b83b]"
              size={27}
            />

            <h2 className="mt-7 text-2xl font-semibold text-[#20243A]">
              Simple
            </h2>

            <p className="mt-4 leading-7 text-slate-600">
              Bring financial operations together so teams spend less time
              navigating disconnected tools and more time understanding the
              business.
            </p>
          </section>

          <section className="rounded-[30px] border border-slate-200 bg-white p-8 shadow-sm">
            <ShieldCheck
              className="text-[#e5b83b]"
              size={27}
            />

            <h2 className="mt-7 text-2xl font-semibold text-[#20243A]">
              Ethical
            </h2>

            <p className="mt-4 leading-7 text-slate-600">
              Accountability, tenant isolation, controlled permissions,
              approvals and auditability form part of the platform's financial
              architecture.
            </p>
          </section>

          <section className="rounded-[30px] border border-slate-200 bg-white p-8 shadow-sm">
            <BrainCircuit
              className="text-[#e5b83b]"
              size={27}
            />

            <h2 className="mt-7 text-2xl font-semibold text-[#20243A]">
              Future
            </h2>

            <p className="mt-4 leading-7 text-slate-600">
              Financial intelligence and automation help organizations move
              beyond recording what happened toward understanding what may
              happen next.
            </p>
          </section>
        </div>

        <div className="mt-20 border-t border-slate-200 pt-14">
          <p className="text-sm tracking-[0.25em] text-[#e5b83b]">
            SIMPLE • ETHICAL • FUTURE
          </p>

          <h2 className="mt-6 max-w-3xl text-4xl font-medium tracking-[-0.035em] text-[#20243A] md:text-5xl">
            Finance should become easier to operate as businesses become more
            sophisticated.
          </h2>

          <Link
            to="/products"
            className="mt-9 inline-flex items-center gap-3 rounded-full bg-[#20243A] px-7 py-4 font-semibold text-white transition hover:bg-[#15182a]"
          >
            Explore Ziya FOS
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}