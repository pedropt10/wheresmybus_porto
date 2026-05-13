// frontend/src/App.tsx
import React, { useEffect, useState } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { MapPage } from "./pages/MapPage";
// import { StatsPage } from "./pages/StatsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { TimetablesPage } from "./pages/TimetablesPage";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";

function Navigation({ isDark, setIsDark }: { isDark: boolean; setIsDark: (v: boolean) => void }) {
  const { t, lang, setLanguage } = useLanguage();

  return (
    <div style={styles.nav}>
      <div style={styles.brand}>{t('appname')}</div>
      <div style={styles.links}>
        <Link style={styles.link} to="/">{t('pagetitle_map')}</Link>
        <Link style={styles.link} to="/timetables">{t('pagetitle_timetables')}</Link>
        <Link style={styles.link} to="/history">{t('pagetitle_history')}</Link>
        {/* <Link style={styles.link} to="/stats">{t('pagetitle_stats')}</Link> */}
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
              {/* Language Toggle Button */}
        <span style={{ marginRight: 15 }}><button 
          onClick={() => setLanguage(lang === 'en' ? 'pt' : 'en')}
          style={styles.toggleBtn}
        >
          {lang === 'en' ? 'PT' : 'EN'}
        </button></span>

        {/* Theme Toggle Button */}
        <button 
          onClick={() => setIsDark(!isDark)}
          style={styles.toggleBtn}
        >
          {isDark ? "☀️" : "🌙"}
        </button>
      </div>
    </div>
  );
}

export function App() {
  const [isDark, setIsDark] = useState(() => 
    localStorage.getItem("theme") === "dark"
  );

  useEffect(() => {
    const theme = isDark ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [isDark]);

  return (
    // 2. Wrap everything in LanguageProvider
    <LanguageProvider>
      <BrowserRouter>
        <Navigation isDark={isDark} setIsDark={setIsDark} />

        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/timetables" element={<TimetablesPage />} />
          <Route path="/history" element={<HistoryPage />} />
          {/* <Route path="/stats" element={<StatsPage />} /> */}
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "10px 12px",
    borderBottom: "1px solid var(--border-color)",
    background: "var(--bg-nav)",
    // borderBottom: "1px solid #eee",
    // background: "white",
    position: "sticky",
    top: 0,
    zIndex: 1100,
    color: "var(--text-main)"
  },
  brand: { fontWeight: 700 },
  links: { display: "flex", gap: 10, alignItems: "center" },
  link: { textDecoration: "none", color: "var(--link-color)" },
  // link: { textDecoration: "none", color: "#0b5" }
  toggleBtn: {
    background: "none",
    border: "1px solid var(--border-color)",
    borderRadius: "4px",
    cursor: "pointer",
    padding: "4px 8px",
    color: "var(--text-secondary)",
    fontSize: "14px"
  }
};