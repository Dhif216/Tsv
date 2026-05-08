# TODO: Quick Deployment Checklist

## Backend Deployment (Railway.app)
- [ ] Create Railway.app account at https://railway.app
- [ ] Connect your GitHub account
- [ ] Create new project from GitHub repo (Dhif216/Tsv)
- [ ] Select `backend-node` as root directory
- [ ] Add environment variables:
  - [ ] MONGODB_URI (copy from .env)
  - [ ] ADMIN_EMAIL
  - [ ] ADMIN_PASSWORD
  - [ ] JWT_SECRET
  - [ ] FRONTEND_URL (will add after Vercel deployment)
- [ ] Deploy and wait for success
- [ ] **SAVE RAILWAY URL** - looks like: https://production-xyz.up.railway.app
- [ ] Test: Open `{railway-url}/api/health` in browser

## Frontend Deployment (Vercel)
- [ ] Create Vercel account at https://vercel.com
- [ ] Connect your GitHub account
- [ ] Import project from GitHub (Dhif216/Tsv)
- [ ] Set root directory to `frontend`
- [ ] Add build command: `npm install --legacy-peer-deps && npm run build`
- [ ] Add environment variable: `REACT_APP_API_URL=https://your-railway-url`
- [ ] Deploy and wait for success
- [ ] **SAVE VERCEL URL** - looks like: https://tsv-feedback.vercel.app

## Post-Deployment
- [ ] Go back to Railway backend
- [ ] Update `FRONTEND_URL` environment variable with Vercel URL
- [ ] Railway auto-redeploys (~1 min)
- [ ] Test worker form at Vercel URL
- [ ] Test admin dashboard at `/admin` path
- [ ] Test PDF export

## Final Verification
- [ ] Worker can submit feedback via Vercel URL ✓
- [ ] Admin can login and see feedback ✓
- [ ] PDF export works ✓
- [ ] CSV export works ✓

---

## Your Production URLs (after deployment)
- **Frontend**: https://tsv-feedback.vercel.app
- **Backend API**: https://production-xyz.up.railway.app
- **Admin Dashboard**: https://tsv-feedback.vercel.app/admin
- **Credentials**: dhif_mouadh@hotmail.fr / admin123

---

## Deployed Successfully! 🚀
Real workers can now access your app online!
