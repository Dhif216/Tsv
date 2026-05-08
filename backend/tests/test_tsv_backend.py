"""TSV Feedback backend tests - auth, feedback CRUD, stats, exports."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://safety-pulse-71.preview.emergentagent.com").rstrip("/")
# Backend env loaded by frontend env. Read backend's REACT_APP_BACKEND_URL from frontend/.env if available
try:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
except Exception:
    pass

API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@tsv.fi"
ADMIN_PASS = "Admin123!"
ADMIN2_EMAIL = "Dhif_mouadh@hotmail.fr"
ADMIN2_PASS = "20099486"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "access_token" in data and data["user"]["role"] == "admin"
    return data["access_token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ----- Auth -----
class TestAuth:
    def test_login_admin1(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["email"] == ADMIN_EMAIL
        assert d["user"]["role"] == "admin"
        assert isinstance(d["access_token"], str)

    def test_login_admin2(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN2_EMAIL, "password": ADMIN2_PASS})
        assert r.status_code == 200
        assert r.json()["user"]["email"] == ADMIN2_EMAIL.lower()

    def test_login_bad(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_with_token(self, auth_headers):
        r = requests.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ----- Feedback CRUD -----
class TestFeedback:
    created_ids = []

    def test_create_anonymous(self):
        payload = {
            "name": "ShouldBeIgnored",
            "is_anonymous": True,
            "shift": "morning",
            "category": "safety",
            "severity": "high",
            "comment": "TEST_ Forklift near miss in aisle 3",
            "contact_requested": False,
        }
        r = requests.post(f"{API}/feedback", json=payload)
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["name"] is None
        assert d["is_anonymous"] is True
        assert d["shift"] == "morning"
        assert d["severity"] == "high"
        assert "id" in d and "created_at" in d
        assert d["reviewed"] is False
        TestFeedback.created_ids.append(d["id"])

    def test_create_named(self):
        payload = {
            "name": "Matti",
            "is_anonymous": False,
            "shift": "night",
            "category": "equipment",
            "severity": "medium",
            "comment": "TEST_ Pallet jack wheel broken",
        }
        r = requests.post(f"{API}/feedback", json=payload)
        assert r.status_code == 201
        d = r.json()
        assert d["name"] == "Matti"
        assert d["is_anonymous"] is False
        TestFeedback.created_ids.append(d["id"])

    def test_create_invalid_shift(self):
        r = requests.post(f"{API}/feedback", json={
            "is_anonymous": True, "shift": "afternoon", "category": "safety",
            "severity": "low", "comment": "TEST_ invalid shift",
        })
        assert r.status_code == 422

    def test_create_invalid_category(self):
        r = requests.post(f"{API}/feedback", json={
            "is_anonymous": True, "shift": "morning", "category": "lol",
            "severity": "low", "comment": "TEST_ bad cat",
        })
        assert r.status_code == 422

    def test_create_invalid_severity(self):
        r = requests.post(f"{API}/feedback", json={
            "is_anonymous": True, "shift": "morning", "category": "safety",
            "severity": "extreme", "comment": "TEST_ bad sev",
        })
        assert r.status_code == 422

    def test_list_requires_auth(self):
        r = requests.get(f"{API}/feedback")
        assert r.status_code == 401

    def test_list_with_filters(self, auth_headers):
        r = requests.get(f"{API}/feedback", headers=auth_headers, params={"severity": "high"})
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert all(i["severity"] == "high" for i in items)

    def test_list_search(self, auth_headers):
        r = requests.get(f"{API}/feedback", headers=auth_headers, params={"search": "TEST_"})
        assert r.status_code == 200
        assert len(r.json()) >= 2

    def test_stats(self, auth_headers):
        r = requests.get(f"{API}/feedback/stats", headers=auth_headers)
        assert r.status_code == 200
        s = r.json()
        for k in ["total", "unreviewed", "contact_requested", "high_severity",
                  "by_category", "by_shift", "by_severity", "trend"]:
            assert k in s
        assert s["total"] >= 2
        assert isinstance(s["trend"], list)

    def test_review_toggle(self, auth_headers):
        fid = TestFeedback.created_ids[0]
        r = requests.patch(f"{API}/feedback/{fid}/review", headers=auth_headers, params={"reviewed": True})
        assert r.status_code == 200
        assert r.json()["reviewed"] is True
        # toggle back
        r2 = requests.patch(f"{API}/feedback/{fid}/review", headers=auth_headers, params={"reviewed": False})
        assert r2.status_code == 200
        assert r2.json()["reviewed"] is False

    def test_review_404(self, auth_headers):
        r = requests.patch(f"{API}/feedback/nope-id/review", headers=auth_headers, params={"reviewed": True})
        assert r.status_code == 404

    def test_export_csv(self, auth_headers):
        r = requests.get(f"{API}/feedback/export/csv", headers=auth_headers)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert "attachment" in r.headers.get("content-disposition", "")
        assert b"created_at,shift,category" in r.content

    def test_export_pdf(self, auth_headers):
        r = requests.get(f"{API}/feedback/export/pdf", headers=auth_headers)
        assert r.status_code == 200
        assert "application/pdf" in r.headers.get("content-type", "")
        assert r.content[:4] == b"%PDF"

    def test_delete_and_404(self, auth_headers):
        # Delete all created
        for fid in TestFeedback.created_ids:
            r = requests.delete(f"{API}/feedback/{fid}", headers=auth_headers)
            assert r.status_code == 200
        r = requests.delete(f"{API}/feedback/nope-id", headers=auth_headers)
        assert r.status_code == 404
