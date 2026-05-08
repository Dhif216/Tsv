import React, { useState, useEffect } from "react";
import { useLang } from "../contexts/LangContext";
import { api, formatApiError } from "../lib/api";
import { TopBar } from "../components/TopBar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import { Link } from "react-router-dom";
import { CheckCircle2, ShieldCheck, AlertTriangle, ChevronDown, Plus, X, Shield, Activity, Wrench, Trees, Users, MoreHorizontal } from "lucide-react";
import { toast, Toaster } from "sonner";
import { InstallPrompt } from "../components/InstallPrompt";

const SHIFTS = ["morning", "evening", "night"];
const CATEGORIES = ["safety", "workload", "equipment", "environment", "organization", "other"];
const SEVERITIES = ["low", "medium", "high"];

const CAT_ICON = {
  safety: Shield,
  workload: Activity,
  equipment: Wrench,
  environment: Trees,
  organization: Users,
  other: MoreHorizontal,
};

const Pill = ({ active, onClick, children, testId, tone = "primary" }) => {
  const base =
    "min-h-[52px] px-4 py-3 rounded-md border-2 text-sm sm:text-base font-bold tracking-tight transition-all duration-200 flex-1 flex items-center justify-center text-center";
  const activeCls =
    tone === "danger"
      ? "border-destructive bg-destructive text-destructive-foreground shadow-sm"
      : tone === "warn"
      ? "border-[#FFCC00] bg-[#FFCC00] text-black shadow-sm"
      : "border-primary bg-primary text-primary-foreground shadow-sm";
  const idle =
    "border-border bg-background text-foreground hover:border-primary/60 hover:-translate-y-0.5";
  return (
    <button type="button" data-testid={testId} onClick={onClick} className={`${base} ${active ? activeCls : idle}`}>
      {children}
    </button>
  );
};

// One category card — expandable, with severity + comment
const CategoryCard = ({ catKey, answer, setAnswer, t }) => {
  const Icon = CAT_ICON[catKey];
  const opened = !!answer;
  const toggle = () => {
    if (opened) setAnswer(null);
    else setAnswer({ severity: "", comment: "" });
  };

  return (
    <section
      data-testid={`cat-card-${catKey}`}
      className={`border rounded-lg bg-card transition-all ${
        opened ? "border-primary/60 shadow-sm" : "border-border"
      }`}
    >
      <button
        type="button"
        data-testid={`cat-toggle-${catKey}`}
        onClick={toggle}
        className="w-full flex items-center gap-3 p-4 sm:p-5 text-left hover:bg-secondary/30 transition-colors rounded-lg"
      >
        <div
          className={`w-11 h-11 rounded-md flex items-center justify-center shrink-0 ${
            opened ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
          }`}
        >
          <Icon className="w-5 h-5" strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-[Manrope] font-extrabold text-base sm:text-lg tracking-tight">
            {t(catKey)}
          </div>
          {opened && (
            <div className="text-xs text-muted-foreground mt-0.5 uppercase tracking-[0.18em] font-bold">
              {t("answered")}
            </div>
          )}
        </div>
        <div
          className={`shrink-0 w-9 h-9 rounded-md border-2 flex items-center justify-center transition-all ${
            opened
              ? "border-destructive/40 text-destructive bg-destructive/10"
              : "border-primary text-foreground bg-primary/10"
          }`}
        >
          {opened ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" strokeWidth={3} />}
        </div>
      </button>

      {opened && (
        <div className="px-4 sm:px-5 pb-5 pt-1 space-y-5 border-t border-border">
          <div>
            <Label className="text-xs uppercase tracking-[0.18em] font-bold mb-3 block mt-4">
              {t("severity")}
            </Label>
            <div className="flex gap-2">
              {SEVERITIES.map((s) => (
                <Pill
                  key={s}
                  active={answer.severity === s}
                  onClick={() => setAnswer({ ...answer, severity: s })}
                  testId={`cat-${catKey}-sev-${s}`}
                  tone={s === "high" ? "danger" : s === "medium" ? "warn" : "primary"}
                >
                  {t(s)}
                </Pill>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-[0.18em] font-bold mb-3 block">
              {t("comment")}
            </Label>
            <Textarea
              data-testid={`cat-${catKey}-comment`}
              value={answer.comment}
              onChange={(e) => setAnswer({ ...answer, comment: e.target.value })}
              placeholder={t("commentPlaceholder")}
              rows={4}
              className="text-base resize-none"
              maxLength={4000}
            />
            <div className="text-xs text-muted-foreground mt-1.5 text-right">
              {answer.comment.length}/4000
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default function WorkerForm() {
  const { t } = useLang();
  const [name, setName] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [shift, setShift] = useState("");
  // answers: { [categoryKey]: { severity, comment } | null }
  const [answers, setAnswers] = useState({});
  const [contact, setContact] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(0); // count of submissions

  // Wake up backend on page load
  useEffect(() => {
    const wakeupBackend = async () => {
      try {
        await api.get("/health");
        console.log("✓ Backend is awake");
      } catch (err) {
        console.log("Backend wake-up in progress...");
      }
    };
    wakeupBackend();
  }, []);

  const setCategoryAnswer = (catKey, val) =>
    setAnswers((prev) => {
      const next = { ...prev };
      if (val === null) delete next[catKey];
      else next[catKey] = val;
      return next;
    });

  const reset = () => {
    setName(""); setAnonymous(true); setShift("");
    setAnswers({}); setContact(false); setDone(0);
  };

  const validAnswers = Object.entries(answers).filter(
    ([, a]) => a && a.severity, // Comment is now optional
  );

  const submit = async (e) => {
    e.preventDefault();
    if (!shift) {
      toast.error(t("shift"), { description: "Valitse vuoro / Pick a shift" });
      return;
    }
    if (validAnswers.length === 0) {
      toast.error(t("minOneCategory"));
      return;
    }
    setSubmitting(true);
    try {
      const cleanName = anonymous ? null : (name.trim() || null);
      const sessionId = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await Promise.all(
        validAnswers.map(([catKey, a]) =>
          api.post("/feedback", {
            sessionId,
            name: cleanName,
            is_anonymous: anonymous,
            shift,
            category: catKey,
            severity: a.severity,
            comment: (a.comment || "").trim(), // Handle undefined/null comment
            contact_requested: contact,
          }),
        ),
      );
      // Show success page FIRST, don't reset yet
      setDone(validAnswers.length);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (done > 0) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-20" data-testid="success-screen">
          <div className="border border-border rounded-lg p-8 sm:p-12 bg-card text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-primary" strokeWidth={2.5} />
            </div>
            <h1 className="font-[Manrope] text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
              {t("successTitle")}
            </h1>
            <p className="text-muted-foreground mb-2 leading-relaxed">{t("successBody")}</p>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary mb-8">
              {done} {t("submittedCount")}
            </p>
            <Button
              onClick={reset}
              data-testid="send-another-btn"
              className="min-h-[56px] px-8 bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
            >
              {t("sendAnother")}
            </Button>
          </div>
        </main>
        <Toaster richColors position="top-center" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30 mb-4">
            <ShieldCheck className="w-3.5 h-3.5 text-primary-foreground/80" />
            <span className="text-xs font-bold tracking-[0.18em] uppercase">{t("appTagline")}</span>
          </div>
          <h1 className="font-[Manrope] text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.05] mb-3">
            {t("formTitle")}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            {t("formSubtitle")}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-8" data-testid="feedback-form">
          {/* Anonymous */}
          <section className="border border-border rounded-lg bg-card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <Label htmlFor="anon" className="text-base font-bold cursor-pointer flex-1">
                {t("stayAnonymous")}
              </Label>
              <Checkbox
                id="anon"
                data-testid="anonymous-checkbox"
                checked={anonymous}
                onCheckedChange={(v) => setAnonymous(!!v)}
                className="w-6 h-6"
              />
            </div>
            {anonymous ? (
              <div className="text-sm text-muted-foreground bg-secondary/40 border border-border rounded-md p-3">
                {t("anonymousNote")}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs uppercase tracking-[0.18em] font-bold">
                  {t("nameOptional")}
                </Label>
                <Input
                  id="name"
                  data-testid="name-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("namePlaceholder")}
                  className="h-12 text-base"
                />
              </div>
            )}
          </section>

          {/* Shift */}
          <section data-testid="shift-section">
            <Label className="text-xs uppercase tracking-[0.18em] font-bold mb-3 block">{t("shift")}</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              {SHIFTS.map((s) => (
                <Pill key={s} active={shift === s} onClick={() => setShift(s)} testId={`shift-${s}`}>
                  {t(s)}
                </Pill>
              ))}
            </div>
          </section>

          {/* Categories — multi answer */}
          <section data-testid="categories-section">
            <div className="flex items-baseline justify-between mb-1">
              <Label className="text-xs uppercase tracking-[0.18em] font-bold">{t("category")}</Label>
              <span className="text-xs text-muted-foreground font-semibold">
                {validAnswers.length}/{CATEGORIES.length}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{t("categoriesIntro")}</p>
            <div className="space-y-3">
              {CATEGORIES.map((c) => (
                <CategoryCard
                  key={c}
                  catKey={c}
                  answer={answers[c]}
                  setAnswer={(v) => setCategoryAnswer(c, v)}
                  t={t}
                />
              ))}
            </div>
          </section>

          {/* Contact */}
          <section className="border border-border rounded-lg bg-card p-5">
            <div className="flex items-center gap-3">
              <Checkbox
                id="contact"
                data-testid="contact-checkbox"
                checked={contact}
                onCheckedChange={(v) => setContact(!!v)}
                className="w-6 h-6"
              />
              <Label htmlFor="contact" className="text-sm sm:text-base font-medium cursor-pointer flex-1">
                {t("contactRequested")}
              </Label>
            </div>
            {contact && anonymous && (
              <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-100/40 dark:bg-amber-950/30 border border-amber-300/50 rounded-md p-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {t("stayAnonymous")} — anonyymeihin lähetyksiin ei voida ottaa yhteyttä.
                </span>
              </div>
            )}
          </section>

          <Button
            type="submit"
            data-testid="submit-feedback-btn"
            disabled={submitting || validAnswers.length === 0 || !shift}
            className="w-full min-h-[60px] text-base sm:text-lg font-extrabold tracking-tight bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting
              ? t("submitting")
              : `${t("submit")}${validAnswers.length > 0 ? ` (${validAnswers.length})` : ""}`}
          </Button>

          <div className="text-center pt-4">
            <Link
              to="/admin/login"
              data-testid="admin-login-link"
              className="text-xs uppercase tracking-[0.18em] font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("adminLogin")} →
            </Link>
          </div>
        </form>
      </main>
      <InstallPrompt />
      <Toaster richColors position="top-center" />
    </div>
  );
}
