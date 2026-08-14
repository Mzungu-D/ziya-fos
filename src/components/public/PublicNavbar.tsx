import { useState } from "react";
import {
  Link,
  NavLink,
  useLocation,
} from "react-router-dom";
import { Menu, X } from "lucide-react";
import ziyaLogo from "../../assets/zayi.jpg";

export default function PublicNavbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  /*
   * These public pages use the light visual theme.
   * Keep the existing dark-page navbar styling everywhere else.
   */
  const lightRoutes = [
    "/products",
    "/solutions",
    "/about",
    "/open-account",
  ];

  const isLightPage = lightRoutes.includes(
    location.pathname
  );

  const navClass = ({
    isActive,
  }: {
    isActive: boolean;
  }) =>
    `transition-colors duration-200 ${
      isActive
        ? "text-[#20243A]"
        : isLightPage
          ? "text-slate-600 hover:text-[#20243A]"
          : "text-white/75 hover:text-white"
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

          <span
            className={`text-[17px] font-semibold tracking-[0.17em] ${
              isLightPage
                ? "text-[#20243A]"
                : "text-[#20243A]"
            }`}
          >
            ZIYA FOS
          </span>
        </Link>

        {/* Center navigation */}
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-10 text-[15px] font-medium lg:flex">
          <NavLink
            to="/products"
            className={navClass}
          >
            Products
          </NavLink>

          <NavLink
            to="/solutions"
            className={navClass}
          >
            Solutions
          </NavLink>

          <NavLink
            to="/about"
            className={navClass}
          >
            About Ziya
          </NavLink>
        </nav>

        {/* Right actions */}
        <div className="ml-auto hidden items-center gap-3 lg:flex">
          <Link
            to="/login"
            className={`rounded-full px-6 py-3 text-sm font-semibold transition ${
              isLightPage
                ? "text-[#20243A] hover:bg-slate-100"
                : "text-[#20243A] hover:bg-white/10"
            }`}
          >
            Log in
          </Link>

          <Link
            to="/open-account"
            className={`rounded-full px-7 py-3 text-sm font-semibold shadow-lg transition hover:scale-[1.02] ${
              isLightPage
                ? "bg-[#20243A] text-white hover:bg-[#15182a]"
                : "bg-white text-[#0a1118] hover:bg-white/95"
            }`}
          >
            Open account
          </Link>
        </div>

        {/* Mobile */}
        <button
          type="button"
          onClick={() =>
            setOpen((value) => !value)
          }
          className={`ml-auto transition-colors lg:hidden ${
            isLightPage
              ? "text-[#20243A]"
              : "text-[#20243A]"
          }`}
          aria-label="Toggle navigation"
          aria-expanded={open}
        >
          {open ? (
            <X size={27} />
          ) : (
            <Menu size={27} />
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className={`mx-5 rounded-3xl border p-6 shadow-2xl backdrop-blur-xl lg:hidden ${
            isLightPage
              ? "border-slate-200 bg-white/95"
              : "border-white/10 bg-[#081019]/95"
          }`}
        >
          <div
            className={`flex flex-col gap-5 font-medium ${
              isLightPage
                ? "text-[#20243A]"
                : "text-[#20243A]"
            }`}
          >
            <Link
              to="/products"
              onClick={() => setOpen(false)}
              className={
                isLightPage
                  ? "text-slate-600 transition hover:text-[#20243A]"
                  : "text-[#20243A]"
              }
            >
              Products
            </Link>

            <Link
              to="/solutions"
              onClick={() => setOpen(false)}
              className={
                isLightPage
                  ? "text-slate-600 transition hover:text-[#20243A]"
                  : "text-[#20243A]"
              }
            >
              Solutions
            </Link>

            <Link
              to="/about"
              onClick={() => setOpen(false)}
              className={
                isLightPage
                  ? "text-slate-600 transition hover:text-[#20243A]"
                  : "text-[#20243A]"
              }
            >
              About Ziya
            </Link>

            <div
              className={
                isLightPage
                  ? "border-t border-slate-200"
                  : "border-t border-white/10"
              }
            />

            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className={
                isLightPage
                  ? "text-slate-600 transition hover:text-[#20243A]"
                  : "text-[#20243A]"
              }
            >
              Log in
            </Link>

            <Link
              to="/open-account"
              onClick={() => setOpen(false)}
              className={`rounded-full px-6 py-3 text-center font-semibold ${
                isLightPage
                  ? "bg-[#20243A] text-white"
                  : "bg-white text-[#081019]"
              }`}
            >
              Open account
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}