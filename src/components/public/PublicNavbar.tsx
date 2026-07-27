import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import ziyaLogo from "../../assets/zayi.jpg";

export default function PublicNavbar() {
  const [open, setOpen] = useState(false);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `transition-colors duration-200 ${
      isActive ? "text-white" : "text-white/75 hover:text-white"
    }`;

  return (
    <header className="absolute inset-x-0 top-0 z-50">
      <div className="flex h-24 items-center px-6 md:px-10 lg:px-14 xl:px-16">

        {/* Far-left Ziya branding */}
        <Link
          to="/"
          className="flex shrink-0 items-center gap-3"
          aria-label="Ziya FOS"
        >
          <img
            src={ziyaLogo}
            alt="Ziya"
            className="h-11 w-11 rounded-full object-cover shadow-lg"
          />

          <span className="text-[17px] font-semibold tracking-[0.17em] text-white">
            ZIYA FOS
          </span>
        </Link>

        {/* Center navigation */}
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-10 text-[15px] font-medium lg:flex">
          <NavLink to="/products" className={navClass}>
            Products
          </NavLink>

          <NavLink to="/solutions" className={navClass}>
            Solutions
          </NavLink>

          <NavLink to="/about" className={navClass}>
            About Ziya
          </NavLink>
        </nav>

        {/* Right actions */}
        <div className="ml-auto hidden items-center gap-3 lg:flex">
          <Link
            to="/login"
            className="rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Log in
          </Link>

          <Link
            to="/open-account"
            className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-[#0a1118] shadow-lg transition hover:scale-[1.02] hover:bg-white/95"
          >
            Open account
          </Link>
        </div>

        {/* Mobile */}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="ml-auto text-white lg:hidden"
          aria-label="Toggle navigation"
        >
          {open ? <X size={27} /> : <Menu size={27} />}
        </button>
      </div>

      {open && (
        <div className="mx-5 rounded-3xl border border-white/10 bg-[#081019]/95 p-6 shadow-2xl backdrop-blur-xl lg:hidden">
          <div className="flex flex-col gap-5 font-medium text-white">
            <Link to="/products" onClick={() => setOpen(false)}>
              Products
            </Link>

            <Link to="/solutions" onClick={() => setOpen(false)}>
              Solutions
            </Link>

            <Link to="/about" onClick={() => setOpen(false)}>
              About Ziya
            </Link>

            <div className="border-t border-white/10" />

            <Link to="/login" onClick={() => setOpen(false)}>
              Log in
            </Link>

            <Link
              to="/open-account"
              onClick={() => setOpen(false)}
              className="rounded-full bg-white px-6 py-3 text-center font-semibold text-[#081019]"
            >
              Open account
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}