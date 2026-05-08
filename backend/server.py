from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import io
import csv
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict, EmailStr

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

# ---------------------------------------------------------------------------
# DB setup
# ---------------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
ACCESS_TOKEN_TTL_MIN = 60 * 24  # 24h

app = FastAPI(title="TSV Feedback API")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s :: %(message)s")
logger = logging.getLogger("tsv")


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_TTL_MIN),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    token = None
    if creds and creds.scheme.lower() == "bearer":
        token = creds.credentials
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
ShiftLit = Literal["morning", "evening", "night"]
CategoryLit = Literal["safety", "workload", "equipment", "environment", "organization", "other"]
SeverityLit = Literal["low", "medium", "high"]


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: EmailStr
    name: str
    role: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class FeedbackIn(BaseModel):
    name: Optional[str] = Field(default=None, max_length=80)
    is_anonymous: bool = True
    shift: ShiftLit
    category: CategoryLit
    severity: SeverityLit
    comment: str = Field(min_length=3, max_length=4000)
    contact_requested: bool = False


class FeedbackOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: Optional[str] = None
    is_anonymous: bool
    shift: ShiftLit
    category: CategoryLit
    severity: SeverityLit
    comment: str
    contact_requested: bool
    reviewed: bool
    created_at: str


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------
@api.post("/auth/login", response_model=TokenOut)
async def login(body: LoginIn):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"])
    return TokenOut(
        access_token=token,
        user=UserOut(id=user["id"], email=user["email"], name=user["name"], role=user["role"]),
    )


@api.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(**user)


@api.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    return {"ok": True}


# ---------------------------------------------------------------------------
# Feedback endpoints
# ---------------------------------------------------------------------------
@api.post("/feedback", response_model=FeedbackOut, status_code=201)
async def create_feedback(body: FeedbackIn):
    name = None
    if not body.is_anonymous and body.name and body.name.strip():
        name = body.name.strip()
    doc = {
        "id": str(uuid.uuid4()),
        "name": name,
        "is_anonymous": body.is_anonymous or name is None,
        "shift": body.shift,
        "category": body.category,
        "severity": body.severity,
        "comment": body.comment.strip(),
        "contact_requested": bool(body.contact_requested),
        "reviewed": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.feedback.insert_one(doc)
    doc.pop("_id", None)
    return FeedbackOut(**doc)


def _build_feedback_query(
    shift: Optional[str],
    category: Optional[str],
    severity: Optional[str],
    reviewed: Optional[bool],
    date_from: Optional[str],
    date_to: Optional[str],
    search: Optional[str],
) -> dict:
    q: dict = {}
    if shift:
        q["shift"] = shift
    if category:
        q["category"] = category
    if severity:
        q["severity"] = severity
    if reviewed is not None:
        q["reviewed"] = reviewed
    if date_from or date_to:
        q["created_at"] = {}
        if date_from:
            q["created_at"]["$gte"] = date_from
        if date_to:
            q["created_at"]["$lte"] = date_to
    if search:
        q["comment"] = {"$regex": search, "$options": "i"}
    return q


@api.get("/feedback", response_model=List[FeedbackOut])
async def list_feedback(
    shift: Optional[ShiftLit] = None,
    category: Optional[CategoryLit] = None,
    severity: Optional[SeverityLit] = None,
    reviewed: Optional[bool] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(500, le=2000),
    user: dict = Depends(get_current_user),
):
    q = _build_feedback_query(shift, category, severity, reviewed, date_from, date_to, search)
    cur = db.feedback.find(q, {"_id": 0}).sort("created_at", -1).limit(limit)
    return [FeedbackOut(**d) async for d in cur]


@api.patch("/feedback/{fid}/review", response_model=FeedbackOut)
async def toggle_review(fid: str, reviewed: bool = True, user: dict = Depends(get_current_user)):
    res = await db.feedback.find_one_and_update(
        {"id": fid},
        {"$set": {"reviewed": reviewed}},
        return_document=True,
        projection={"_id": 0},
    )
    if not res:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return FeedbackOut(**res)


@api.delete("/feedback/{fid}")
async def delete_feedback(fid: str, user: dict = Depends(get_current_user)):
    res = await db.feedback.delete_one({"id": fid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return {"ok": True}


@api.get("/feedback/stats")
async def stats(user: dict = Depends(get_current_user)):
    total = await db.feedback.count_documents({})
    unreviewed = await db.feedback.count_documents({"reviewed": False})
    contact = await db.feedback.count_documents({"contact_requested": True})
    high = await db.feedback.count_documents({"severity": "high"})

    pipeline_cat = [{"$group": {"_id": "$category", "count": {"$sum": 1}}}]
    pipeline_shift = [{"$group": {"_id": "$shift", "count": {"$sum": 1}}}]
    pipeline_sev = [{"$group": {"_id": "$severity", "count": {"$sum": 1}}}]

    by_category = {d["_id"]: d["count"] async for d in db.feedback.aggregate(pipeline_cat)}
    by_shift = {d["_id"]: d["count"] async for d in db.feedback.aggregate(pipeline_shift)}
    by_severity = {d["_id"]: d["count"] async for d in db.feedback.aggregate(pipeline_sev)}

    # last 14 days trend
    cutoff = (datetime.now(timezone.utc) - timedelta(days=13)).date().isoformat()
    trend_pipeline = [
        {"$match": {"created_at": {"$gte": cutoff}}},
        {"$project": {"day": {"$substr": ["$created_at", 0, 10]}}},
        {"$group": {"_id": "$day", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    trend = [{"date": d["_id"], "count": d["count"]} async for d in db.feedback.aggregate(trend_pipeline)]

    return {
        "total": total,
        "unreviewed": unreviewed,
        "contact_requested": contact,
        "high_severity": high,
        "by_category": by_category,
        "by_shift": by_shift,
        "by_severity": by_severity,
        "trend": trend,
    }


# ---------------------------------------------------------------------------
# Exports
# ---------------------------------------------------------------------------
@api.get("/feedback/export/csv")
async def export_csv(
    shift: Optional[ShiftLit] = None,
    category: Optional[CategoryLit] = None,
    severity: Optional[SeverityLit] = None,
    reviewed: Optional[bool] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    q = _build_feedback_query(shift, category, severity, reviewed, date_from, date_to, search)
    cur = db.feedback.find(q, {"_id": 0}).sort("created_at", -1)
    rows = [d async for d in cur]

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["created_at", "shift", "category", "severity", "name", "is_anonymous",
                     "contact_requested", "reviewed", "comment"])
    for r in rows:
        writer.writerow([
            r.get("created_at", ""), r.get("shift", ""), r.get("category", ""),
            r.get("severity", ""), r.get("name") or "", r.get("is_anonymous", True),
            r.get("contact_requested", False), r.get("reviewed", False),
            (r.get("comment") or "").replace("\n", " "),
        ])
    data = buf.getvalue().encode("utf-8-sig")
    fname = f"tsv_feedback_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.csv"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@api.get("/feedback/export/pdf")
async def export_pdf(
    shift: Optional[ShiftLit] = None,
    category: Optional[CategoryLit] = None,
    severity: Optional[SeverityLit] = None,
    reviewed: Optional[bool] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    q = _build_feedback_query(shift, category, severity, reviewed, date_from, date_to, search)
    cur = db.feedback.find(q, {"_id": 0}).sort("created_at", -1)
    rows = [d async for d in cur]

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm,
                            topMargin=2 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    h_style = ParagraphStyle("h", parent=styles["Title"], textColor=colors.HexColor("#1A1A1A"),
                             fontSize=22, spaceAfter=8)
    sub_style = ParagraphStyle("sub", parent=styles["Normal"], textColor=colors.HexColor("#555"),
                               fontSize=10, spaceAfter=14)
    section_style = ParagraphStyle("sec", parent=styles["Heading2"], fontSize=14,
                                   textColor=colors.HexColor("#0033CC"), spaceBefore=12, spaceAfter=6)
    body_style = ParagraphStyle("body", parent=styles["Normal"], fontSize=10, leading=14)

    story = []
    story.append(Paragraph("TSV Feedback Report", h_style))
    drange = "All time"
    if date_from or date_to:
        drange = f"{date_from or '—'}  →  {date_to or '—'}"
    story.append(Paragraph(
        f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} &nbsp;|&nbsp; "
        f"Date range: {drange} &nbsp;|&nbsp; Reports: <b>{len(rows)}</b>",
        sub_style,
    ))

    # Category counts
    cat_counts: dict = {}
    sev_counts: dict = {}
    shift_counts: dict = {}
    for r in rows:
        cat_counts[r["category"]] = cat_counts.get(r["category"], 0) + 1
        sev_counts[r["severity"]] = sev_counts.get(r["severity"], 0) + 1
        shift_counts[r["shift"]] = shift_counts.get(r["shift"], 0) + 1

    def _table(title: str, mapping: dict):
        story.append(Paragraph(title, section_style))
        if not mapping:
            story.append(Paragraph("No data.", body_style))
            return
        data = [["Group", "Count"]] + [[k.title(), str(v)] for k, v in sorted(mapping.items(), key=lambda x: -x[1])]
        t = Table(data, colWidths=[10 * cm, 4 * cm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#FFCC00")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1A1A1A")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CCCCCC")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F5F5")]),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("PADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(t)

    _table("Reports by Category", cat_counts)
    _table("Reports by Severity", sev_counts)
    _table("Reports by Shift", shift_counts)

    story.append(PageBreak())
    story.append(Paragraph("Comments (anonymized)", section_style))
    if not rows:
        story.append(Paragraph("No feedback in the selected range.", body_style))
    else:
        for r in rows:
            who = r.get("name") if r.get("name") and not r.get("is_anonymous") else "Anonymous"
            meta = f"<b>{r['created_at'][:16].replace('T',' ')}</b> &nbsp;·&nbsp; {r['shift'].title()} &nbsp;·&nbsp; {r['category'].title()} &nbsp;·&nbsp; <font color='#E60000'>{r['severity'].upper()}</font> &nbsp;·&nbsp; {who}"
            story.append(Paragraph(meta, body_style))
            comment = (r.get("comment") or "").replace("\n", "<br/>")
            story.append(Paragraph(comment, body_style))
            story.append(Spacer(1, 8))

    doc.build(story)
    buf.seek(0)
    fname = f"tsv_feedback_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# ---------------------------------------------------------------------------
# Startup: indexes + admin seeding
# ---------------------------------------------------------------------------
async def seed_admin(email: str, password: str, name: str = "TSV Admin"):
    if not email or not password:
        return
    email = email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": email,
            "name": name,
            "role": "admin",
            "password_hash": hash_password(password),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Seeded admin: %s", email)
    elif not verify_password(password, existing["password_hash"]):
        await db.users.update_one(
            {"email": email},
            {"$set": {"password_hash": hash_password(password)}},
        )
        logger.info("Updated admin password: %s", email)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.feedback.create_index("id", unique=True)
    await db.feedback.create_index("created_at")
    await db.feedback.create_index("category")
    await db.feedback.create_index("severity")
    await db.feedback.create_index("shift")
    await seed_admin(
        os.environ.get("ADMIN_EMAIL", ""),
        os.environ.get("ADMIN_PASSWORD", ""),
        "TSV Admin",
    )
    await seed_admin(
        os.environ.get("ADMIN_EMAIL_2", ""),
        os.environ.get("ADMIN_PASSWORD_2", ""),
        "TSV Admin",
    )


@app.on_event("shutdown")
async def shutdown():
    client.close()


@api.get("/")
async def root():
    return {"service": "TSV Feedback API", "status": "ok"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
