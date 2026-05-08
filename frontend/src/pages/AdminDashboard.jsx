import React, { useEffect, useMemo, useState, useCallback } from "react";
import { TopBar } from "../components/TopBar";
import { useLang } from "../contexts/LangContext";
import { api, downloadFile, formatApiError } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import {
  FileText, FileSpreadsheet, Search, X, Trash2, Check,
  AlertTriangle, MessageSquareText, Clock, FileCheck2, PhoneCall, Filter,
} from "lucide-react";
import { Toaster, toast } from "sonner";

const SHIFT_OPTS = ["morning", "evening", "night"];
const CAT_OPTS = ["safety", "workload", "equipment", "environment", "organization", "other"];
const SEV_OPTS = ["low", "medium", "high"];

const SEV_COLORS = { low: "#0033CC", medium: "#FFCC00", high: "#E60000" };
const CAT_COLORS = ["#0033CC", "#FFCC00", "#E60000", "#1A1A1A", "#3366FF", "#7C7C7C"];

const StatCard = ({ label, value, icon: Icon, accent, testId }) => (
  <div
    data-testid={testId}
    className="border border-border rounded-lg bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
  >
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs uppercase tracking-[0.18em] font-bold text-muted-foreground">{label}</span>
      <div
        className="w-9 h-9 rounded-md flex items-center justify-center"
        style={{ backgroundColor: `${accent}1A`, color: accent }}
      >
        <Icon className="w-4 h-4" strokeWidth={2.5} />
      </div>
    </div>
    <div className="font-[Manrope] text-3xl sm:text-4xl font-extrabold tracking-tight">{value}</div>
  </div>
);

const SeverityBadge = ({ severity, t }) => {
  const cls =
    severity === "high"
      ? "bg-destructive text-destructive-foreground"
      : severity === "medium"
      ? "bg-[#FFCC00] text-black"
      : "bg-secondary text-secondary-foreground";
  return (
    <Badge className={`${cls} font-bold uppercase text-[10px] tracking-widest`}>{t(severity)}</Badge>
  );
};

export default function AdminDashboard() {
  const { t, lang } = useLang();
  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [shift, setShift] = useState("all");
  const [category, setCategory] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filterParams = useMemo(() => {
    const p = {};
    if (shift !== "all") p.shift = shift;
    if (category !== "all") p.category = category;
    if (severity !== "all") p.severity = severity;
    if (onlyUnreviewed) p.reviewed = false;
    if (search.trim()) p.search = search.trim();
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo + "T23:59:59";
    return p;
  }, [shift, category, severity, onlyUnreviewed, search, dateFrom, dateTo]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, list] = await Promise.all([
        api.get("/feedback/stats"),
        api.get("/feedback", { params: filterParams }),
      ]);
      setStats(s.data);
      setItems(list.data);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, [filterParams]);

  useEffect(() => { load(); }, [load]);

  const clearFilters = () => {
    setShift("all"); setCategory("all"); setSeverity("all");
    setOnlyUnreviewed(false); setSearch(""); setDateFrom(""); setDateTo("");
  };

  const toggleReview = async (item) => {
    try {
      await api.patch(`/feedback/${item._id}/review`, null, { params: { reviewed: !item.reviewed } });
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (item) => {
    if (!window.confirm(t("deleteConfirm"))) return;
    try {
      console.log(`Deleting feedback: ${item._id}`);
      await api.delete(`/feedback/${item._id}`);
      toast.success("Deleted successfully");
      console.log(`✓ Feedback deleted`);
      load();
    } catch (e) { 
      console.error("Delete error:", e);
      toast.error(formatApiError(e)); 
    }
  };

  // Group items by sessionId - each group is one worker's complete submission
  const groupedSessions = useMemo(() => {
    const groups = {};
    items.forEach(item => {
      const sid = item.sessionId || `no-session-${item._id}`;
      if (!groups[sid]) {
        groups[sid] = {
          sessionId: item.sessionId,
          items: [],
          firstItem: item,
          submittedAt: item.createdAt,
        };
      }
      groups[sid].items.push(item);
    });
    // Sort by most recent first
    return Object.values(groups).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  }, [items]);

  const doExport = async (kind) => {
    try {
      await downloadFile(
        `/feedback/export/${kind}`,
        filterParams,
        kind === "pdf" ? "tsv_feedback.pdf" : "tsv_feedback.csv",
      );
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const catData = useMemo(() => {
    if (!stats) return [];
    return CAT_OPTS.map((k) => ({ name: t(k), value: stats.by_category?.[k] || 0, key: k }));
  }, [stats, t]);

  const sevData = useMemo(() => {
    if (!stats) return [];
    return SEV_OPTS.map((k) => ({ name: t(k), value: stats.by_severity?.[k] || 0, key: k }));
  }, [stats, t]);

  const shiftData = useMemo(() => {
    if (!stats) return [];
    return SHIFT_OPTS.map((k) => ({ name: t(k), value: stats.by_shift?.[k] || 0 }));
  }, [stats, t]);

  return (
    <div className="min-h-screen bg-background">
      <TopBar showLogout />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8" data-testid="admin-dashboard">
        <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-bold text-muted-foreground mb-2">
              {t("dashboard")}
            </div>
            <h1 className="font-[Manrope] text-3xl sm:text-5xl font-extrabold tracking-tight leading-none">
              {t("overview")}
            </h1>
          </div>
          <div className="flex gap-2">
            <Button
              data-testid="export-pdf-btn"
              onClick={() => doExport("pdf")}
              variant="outline"
              className="min-h-[48px] font-bold"
            >
              <FileText className="w-4 h-4 mr-2" />
              {t("exportPdf")}
            </Button>
            <Button
              data-testid="export-csv-btn"
              onClick={() => doExport("csv")}
              className="min-h-[48px] bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              {t("exportCsv")}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard testId="stat-total" label={t("totalReports")} value={stats?.totalFeedback ?? "—"}
                    icon={MessageSquareText} accent="#0033CC" />
          <StatCard testId="stat-workers" label="Unique Workers" value={stats?.uniqueWorkers ?? "—"}
                    icon={PhoneCall} accent="#3366FF" />
          <StatCard testId="stat-unreviewed" label={t("unreviewed")} value={stats?.reviewedFeedback ?? "—"}
                    icon={Clock} accent="#FFCC00" />
          <StatCard testId="stat-contact" label={t("contactRequests")} value={stats?.contact_requested ?? "—"}
                    icon={AlertTriangle} accent="#E60000" />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <div className="lg:col-span-2 border border-border rounded-lg bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-[Manrope] font-extrabold tracking-tight text-lg">{t("byCategory")}</h3>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={catData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {catData.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="border border-border rounded-lg bg-card p-5">
            <h3 className="font-[Manrope] font-extrabold tracking-tight text-lg mb-4">{t("bySeverity")}</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={sevData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={85} paddingAngle={3}>
                  {sevData.map((d, i) => <Cell key={i} fill={SEV_COLORS[d.key]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <div className="border border-border rounded-lg bg-card p-5">
            <h3 className="font-[Manrope] font-extrabold tracking-tight text-lg mb-4">{t("byShift")}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={shiftData} layout="vertical" margin={{ top: 5, right: 10, left: 30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="value" fill="#0033CC" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="lg:col-span-2 border border-border rounded-lg bg-card p-5">
            <h3 className="font-[Manrope] font-extrabold tracking-tight text-lg mb-4">{t("trend14")}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats?.trend ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Line type="monotone" dataKey="count" stroke="#FFCC00" strokeWidth={3} dot={{ r: 4, fill: "#0033CC" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Filters */}
        <div className="border border-border rounded-lg bg-card p-5 mb-6" data-testid="filters-panel">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4" />
            <h3 className="font-[Manrope] font-extrabold tracking-tight text-lg">{t("filters")}</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] font-bold mb-1.5 block">{t("shift")}</Label>
              <Select value={shift} onValueChange={setShift}>
                <SelectTrigger data-testid="filter-shift" className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allShifts")}</SelectItem>
                  {SHIFT_OPTS.map((s) => <SelectItem key={s} value={s}>{t(s)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] font-bold mb-1.5 block">{t("category")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="filter-category" className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allCategories")}</SelectItem>
                  {CAT_OPTS.map((c) => <SelectItem key={c} value={c}>{t(c)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] font-bold mb-1.5 block">{t("severity")}</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger data-testid="filter-severity" className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allSeverities")}</SelectItem>
                  {SEV_OPTS.map((s) => <SelectItem key={s} value={s}>{t(s)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] font-bold mb-1.5 block">{t("search")}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="filter-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-11 pl-9"
                  placeholder={t("search")}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] font-bold mb-1.5 block">{t("dateFrom")}</Label>
              <Input data-testid="filter-date-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-11" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] font-bold mb-1.5 block">{t("dateTo")}</Label>
              <Input data-testid="filter-date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-11" />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 h-11 cursor-pointer">
                <Checkbox
                  data-testid="filter-unreviewed"
                  checked={onlyUnreviewed}
                  onCheckedChange={(v) => setOnlyUnreviewed(!!v)}
                  className="w-5 h-5"
                />
                <span className="text-sm font-semibold">{t("onlyUnreviewed")}</span>
              </label>
            </div>
            <div className="flex items-end">
              <Button
                data-testid="clear-filters-btn"
                variant="outline"
                onClick={clearFilters}
                className="h-11 w-full font-bold"
              >
                <X className="w-4 h-4 mr-2" />
                {t("clearFilters")}
              </Button>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="space-y-3" data-testid="reports-list">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-[Manrope] font-extrabold tracking-tight text-xl">
              {t("reports")} <span className="text-muted-foreground font-medium">· {groupedSessions.length} workers</span>
            </h3>
          </div>
          {loading && <div className="text-center py-12 text-muted-foreground">…</div>}
          {!loading && groupedSessions.length === 0 && (
            <div className="text-center py-16 border border-dashed border-border rounded-lg text-muted-foreground">
              {t("noReports")}
            </div>
          )}
          {groupedSessions.map((group) => {
            const firstItem = group.firstItem;
            const hasHighSeverity = group.items.some(i => i.severity === "high" && !i.reviewed);
            const allReviewed = group.items.every(i => i.reviewed);
            
            return (
              <article
                key={group.sessionId || firstItem._id}
                data-testid={`worker-submission-${group.sessionId || firstItem._id}`}
                className={`border rounded-lg bg-card p-6 transition-all ${
                  allReviewed ? "border-border opacity-75" : "border-border"
                } ${hasHighSeverity ? "border-l-4 border-l-destructive" : ""}`}
              >
                {/* Header - Worker Info */}
                <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-border">
                  {firstItem.is_anonymous ? (
                    <Badge className="bg-secondary text-secondary-foreground font-semibold">
                      {t("anonymous")} {group.sessionId ? `• ${group.sessionId.substring(0, 8)}` : ""}
                    </Badge>
                  ) : (
                    <Badge className="bg-[#0033CC] text-white font-semibold">{firstItem.name}</Badge>
                  )}
                  <Badge variant="outline" className="font-semibold">{t(firstItem.shift)}</Badge>
                  {firstItem.contact_requested && (
                    <Badge className="bg-[#FFCC00] text-black font-semibold">
                      <PhoneCall className="w-3 h-3 mr-1" /> {t("contactWanted")}
                    </Badge>
                  )}
                  {allReviewed && (
                    <Badge variant="outline" className="font-semibold">
                      <FileCheck2 className="w-3 h-3 mr-1" /> {t("reviewed")}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(group.submittedAt).toLocaleString(lang === "fi" ? "fi-FI" : "en-GB")}
                  </span>
                </div>

                {/* Worker's Answers - All categories grouped */}
                <div className="space-y-4 mb-6">
                  {group.items.map((item) => (
                    <div key={item._id} className="bg-secondary/20 rounded-lg p-4 border border-border/50">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <SeverityBadge severity={item.severity} t={t} />
                          <Badge variant="outline" className="font-semibold">{t(item.category)}</Badge>
                        </div>
                      </div>
                      {item.comment && (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground mt-2">
                          {item.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant={allReviewed ? "outline" : "default"}
                    onClick={() => toggleReview(firstItem)}
                    className={!allReviewed ? "bg-primary text-primary-foreground hover:bg-primary/90 font-bold" : "font-bold"}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    {allReviewed ? t("markUnreviewed") : t("markReviewed")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (!window.confirm(`Delete all ${group.items.length} answers from this worker?`)) return;
                      Promise.all(group.items.map(item => api.delete(`/feedback/${item._id}`))).then(() => {
                        load();
                        toast.success("Worker submission deleted");
                      }).catch(e => toast.error(formatApiError(e)));
                    }}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive font-bold"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete All
                  </Button>
                </div>
              </article>
            );
          })}
        </div>

        {/* Session Detail Modal - REMOVED: All answers shown above */}
      </main>
      <Toaster richColors position="top-center" />
    </div>
  );
}
