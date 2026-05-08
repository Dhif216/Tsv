import React from "react";
import { Sun, Moon, Languages, LogOut, ShieldCheck } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useLang } from "../contexts/LangContext";
import { useAuth } from "../contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";

export const TopBar = ({ showLogout = false }) => {
  const { theme, toggle } = useTheme();
  const { lang, setLang, t } = useLang();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header
      data-testid="top-bar"
      className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 group" data-testid="brand-link">
          <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="font-[Manrope] font-extrabold tracking-tight text-base sm:text-lg">
              {t("appName")}
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground tracking-widest uppercase">
              TSV · Työsuojelu
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <button
            data-testid="lang-toggle"
            onClick={() => setLang(lang === "fi" ? "en" : "fi")}
            className="h-10 px-3 flex items-center gap-1.5 rounded-md hover:bg-secondary transition-colors text-sm font-semibold"
            title={t("language")}
          >
            <Languages className="w-4 h-4" />
            <span>{lang.toUpperCase()}</span>
          </button>
          <button
            data-testid="theme-toggle"
            onClick={toggle}
            className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-secondary transition-colors"
            title={t("theme")}
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {showLogout && user && (
            <button
              data-testid="logout-btn"
              onClick={() => {
                logout();
                navigate("/admin/login");
              }}
              className="h-10 px-3 flex items-center gap-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors text-sm font-semibold"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t("logout")}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
