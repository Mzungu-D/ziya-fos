import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import heroImage from "../assets/ziya-cinematic-hero.png";

export default function Home() {
  useEffect(() => {
    const preload = new Image();
    preload.src = heroImage;
  }, []);

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#18242b]">

      {/* Cinematic Ziya background */}
      <img
        src={heroImage}
        alt=""
        fetchPriority="high"
        loading="eager"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Controlled cinematic overlays */}
      <div className="absolute inset-0 bg-black/20" />

      <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/10 to-black/20" />

      <div className="absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-black/55 to-transparent" />

      {/* Main content */}
      <div className="relative z-10 flex min-h-screen items-center px-6 pt-24 md:px-10 lg:px-14 xl:px-16">
        <div className="max-w-[780px]">

          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.28em] text-white/70 md:text-sm">
            Financial infrastructure for modern businesses
          </p>

          <h1 className="text-5xl font-medium leading-[0.97] tracking-[-0.05em] text-white sm:text-6xl md:text-7xl lg:text-[86px]">
            Finance,
            <br />
            intelligently operated.
          </h1>

          <p className="mt-7 max-w-[590px] text-lg leading-8 text-white/85 md:text-xl">
            One financial operating system for modern businesses.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">

            {/* Multi-tenant entry */}
            <Link
              to="/open-account"
              className="inline-flex items-center gap-3 rounded-full bg-white px-7 py-4 font-semibold text-[#081019] shadow-xl transition duration-200 hover:scale-[1.02]"
            >
              Open account
              <ArrowRight size={18} />
            </Link>

            {/* Existing organization */}
            <Link
              to="/login"
              className="rounded-full border border-white/50 bg-black/10 px-8 py-4 font-semibold text-white backdrop-blur-md transition hover:bg-white/10"
            >
              Log in
            </Link>
          </div>

          <p className="mt-10 text-xs font-medium tracking-[0.24em] text-white/55">
            SIMPLE • ETHICAL • FUTURE
          </p>
        </div>
      </div>
    </section>
  );
}