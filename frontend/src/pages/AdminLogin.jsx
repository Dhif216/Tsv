import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLang } from "../contexts/LangContext";
import { TopBar } from "../components/TopBar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { formatApiError } from "../lib/api";
import { Lock, ShieldCheck } from "lucide-react";

export default function AdminLogin() {
  const { login } = useAuth();
  const { t } = useLang();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await login(email.trim(), password);
      nav("/admin");
    } catch (ex) {
      const msg = formatApiError(ex);
      setErr(msg.includes("Invalid") ? t("invalidCreds") : msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main
        className="relative min-h-[calc(100vh-65px)] flex items-center justify-center px-4 py-10"
        data-testid="login-page"
      >
        <div
          className="absolute inset-0 -z-10 bg-cover bg-center"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1740914994657-f1cdffdc418e?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600)",
          }}
        />
        <div className="absolute inset-0 -z-10 bg-black/75" />

        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-lg p-7 sm:p-9 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-md bg-primary flex items-center justify-center">
                <Lock className="w-6 h-6 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="font-[Manrope] text-2xl font-extrabold tracking-tight">
                  {t("loginTitle")}
                </h1>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-bold mt-1">
                  {t("loginSubtitle")}
                </p>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-5" data-testid="login-form">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs uppercase tracking-[0.18em] font-bold">
                  {t("email")}
                </Label>
                <Input
                  id="email"
                  type="email"
                  data-testid="email-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs uppercase tracking-[0.18em] font-bold">
                  {t("password")}
                </Label>
                <Input
                  id="password"
                  type="password"
                  data-testid="password-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-12"
                />
              </div>
              {err && (
                <div
                  data-testid="login-error"
                  className="text-sm text-destructive border border-destructive/30 bg-destructive/10 rounded-md p-2.5"
                >
                  {err}
                </div>
              )}
              <Button
                type="submit"
                data-testid="login-submit-btn"
                disabled={busy}
                className="w-full min-h-[56px] text-base font-extrabold bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {busy ? t("signingIn") : t("signIn")}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link
                to="/"
                data-testid="back-to-form"
                className="text-xs uppercase tracking-[0.18em] font-bold text-muted-foreground hover:text-foreground"
              >
                ← {t("backToForm")}
              </Link>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-white/70 text-xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Anonymous & confidential · Encrypted · Audit-friendly</span>
          </div>
        </div>
      </main>
    </div>
  );
}
