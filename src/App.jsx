import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { SinglesRegistrationPage } from "./pages/SinglesRegistrationPage";
import { cn } from "./lib/utils";

const SECTIONS = [
  { id: "hero", label: "About" },
  { id: "registration", label: "Register" },
];

function Layout({ children }) {
  const { pathname } = useLocation();
  const navRef = useRef(null);
  const [activeSection, setActiveSection] = useState("hero");
  const [scrolled, setScrolled] = useState(false);

  // Use viewport positions: offsetTop is relative to a positioned parent.
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
      const activationLine = (navRef.current?.getBoundingClientRect().bottom || 72) + 24;

      let current = "hero";
      for (const { id } of SECTIONS) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= activationLine) current = id;
      }
      // A short final section may never reach the activation line.
      const pageHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      );
      if (window.scrollY > 0 && window.scrollY + window.innerHeight >= pageHeight - 2) {
        current = "registration";
      }
      setActiveSection(current);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(handleScroll);
    for (const { id } of SECTIONS) {
      const section = document.getElementById(id);
      if (section) observer?.observe(section);
    }
    if (navRef.current) observer?.observe(navRef.current);
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      observer?.disconnect();
    };
  }, [pathname]);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="singles-theme min-h-screen isolate">
      <nav
        ref={navRef}
        aria-label="Section navigation"
        className={cn(
          "no-print fixed top-0 right-0 left-0 z-50 border-b border-rose-500/45 bg-burgundy-950/90 text-blush-50 backdrop-blur-md transition-all duration-300",
          scrolled ? "py-2 shadow-[var(--shadow-medium)]" : "bg-burgundy-950/80 py-4"
        )}
      >
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
          <img
            src="/logo2.jpeg"
            alt="Gospel Pillars"
            className="h-10 w-auto object-contain rounded"
          />
          <div className="flex gap-1 sm:gap-2">
            {SECTIONS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollToSection(id)}
                aria-current={activeSection === id ? "location" : undefined}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-300 focus-visible:ring-2 focus-visible:ring-rose-400",
                  activeSection === id
                    ? "bg-rose-500 text-blush-50 shadow-sm hover:bg-rose-400 active:bg-rose-600"
                    : "text-blush-50 hover:bg-blush-50/10 hover:text-rose-200"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </nav>
      <main className="pt-16">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<SinglesRegistrationPage />} />
            <Route path="/singles" element={<SinglesRegistrationPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </HelmetProvider>
  );
}
