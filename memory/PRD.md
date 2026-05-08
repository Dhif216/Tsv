# TSV Feedback App — PRD

## Original Problem Statement
Modern, mobile-friendly workplace feedback web app for a health and safety representative
(TSV / Työsuojeluvaltuutettu) in a warehouse / logistics environment. Workers submit feedback
(anonymous-friendly) about working conditions, safety, workload, equipment and work environment.
Only the TSV/admin can view submissions, filter, export, and mark items as reviewed.

## User Personas
- **Worker** (warehouse/logistics) — submits short, mobile-first feedback. May choose to stay anonymous.
- **TSV / Admin** — secure dashboard, sees aggregated stats, filters, marks reviewed, exports PDF/CSV.

## Core Requirements (static)
- Public worker form: name optional / "Stay anonymous", shift, category, severity, comment, contact_requested.
- Privacy: anonymous == truly anonymous (no IP/identifiers stored, name forced null).
- Admin dashboard: statistics cards, charts (category, severity, shift, 14-day trend), filter (shift/category/severity/date/search/unreviewed), search.
- Mark as reviewed / unreviewed, delete.
- Export to PDF (grouped summary + anonymized comments) and CSV (UTF-8 with BOM).
- FI default + EN toggle. Dark mode. Mobile-first.
- JWT-based admin auth (no public registration).

## Tech Stack
- Backend: FastAPI + Motor (MongoDB), bcrypt + PyJWT, reportlab (PDF), stdlib csv.
- Frontend: React 19, TailwindCSS, Shadcn UI, Recharts, Sonner, lucide-react.

## Implemented (2026-02 / today)
- Backend `server.py`: `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`, `/api/feedback` (POST public, GET admin), `/api/feedback/{id}/review`, `/api/feedback/{id}` DELETE, `/api/feedback/stats`, `/api/feedback/export/csv`, `/api/feedback/export/pdf`. Admin seeding for `admin@tsv.fi` and `Dhif_mouadh@hotmail.fr`.
- Frontend pages: `WorkerForm`, `AdminLogin`, `AdminDashboard` with stats, charts, filters, exports, FI/EN i18n, dark mode.
- Design follows Swiss & High-Contrast archetype (Safety Yellow + Klein Blue + Signal Red).
- 19 backend pytest tests + 8 frontend e2e flows passing (test_reports/iteration_1.json).

## Backlog (P0/P1/P2)
- **P1** Pagination for `/api/feedback` (currently capped at 500).
- **P1** `re.escape()` user search input before Mongo $regex (ReDoS hardening).
- **P1** Email notification to TSV when high-severity feedback is submitted (e.g. via Resend).
- **P2** "Recurring themes" auto-detection (LLM tag clustering on comments).
- **P2** Worker-side QR poster generator (each warehouse zone gets a unique link).
- **P2** Per-shift weekly digest PDF auto-generated and emailed to admin.
- **P2** Audit log for review/delete actions.

## Test Credentials
See `/app/memory/test_credentials.md`.
