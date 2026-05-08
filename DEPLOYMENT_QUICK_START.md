# TSV Feedback App - Deploy in 10 Minutes (FREE)

## FREE Services
✅ **Vercel** (Frontend) - Free tier includes unlimited deployments
✅ **Railway.app** (Backend) - $5/month free credit + pay-as-you-go  
✅ **MongoDB Atlas** (Database) - Already running, free tier

---

## QUICK START

### Step 1: Backend → Railway.app (5 min)

1. Go to **https://railway.app**
2. Sign up with GitHub
3. Click **"New Project"** → **"Deploy from GitHub"**
4. Select your **Dhif216/Tsv** repo
5. When asked, use directory: **`backend-node`**
6. Click **"Deploy"** and wait

**Environment Variables** (set in Railway dashboard):
```
MONGODB_URI=mongodb+srv://Mouadh:20099486Dhif@tsv.wlgsqxi.mongodb.net/tsv_feedback?retryWrites=true&w=majority
ADMIN_EMAIL=dhif_mouadh@hotmail.fr
ADMIN_PASSWORD=admin123
JWT_SECRET=tsv-secret-key
FRONTEND_URL=https://will-add-this-later.vercel.app
```

⏰ Wait for green checkmark (2-3 min)
📋 Copy your Railway URL (looks like: `https://production-xyz.up.railway.app`)

---

### Step 2: Frontend → Vercel (3 min)

1. Go to **https://vercel.com**
2. Sign up with GitHub
3. Click **"Add New"** → **"Project"**
4. Select your **Dhif216/Tsv** repo
5. Set **Root Directory**: `frontend`
6. Set **Build Command**: `npm install --legacy-peer-deps && npm run build`
7. Add **Environment Variable**:
   - Key: `REACT_APP_API_URL`
   - Value: `https://your-railway-url` (paste from Step 1)
8. Click **"Deploy"** and wait

⏰ Wait for deployment complete (~3-5 min)
📋 Copy your Vercel URL (looks like: `https://tsv-feedback.vercel.app`)

---

### Step 3: Update Backend (1 min)

1. Go back to **Railway dashboard**
2. Go to **Variables**
3. Update `FRONTEND_URL` = your Vercel URL from Step 2
4. Railway auto-redeploys

---

### Step 4: Test! (1 min)

1. Open your **Vercel URL** in browser
2. Submit worker feedback
3. Go to `/admin` and login with: `dhif_mouadh@hotmail.fr` / `admin123`
4. See feedback and try PDF export

---

## ✅ You're Live!

### Share these links with your workers:
- **Worker Form**: https://tsv-feedback.vercel.app
- **Admin Dashboard**: https://tsv-feedback.vercel.app/admin

### Your URLs:
- Frontend: `https://tsv-feedback.vercel.app` (or custom name)
- Backend: `https://production-xyz.up.railway.app` (auto-generated)
- Database: MongoDB Atlas (already in cloud)

---

## Cost Breakdown
| Service | Cost | Reason |
|---------|------|--------|
| Vercel | FREE | $20/month credit, we use <1% |
| Railway | ~$0 | $5/month credit = free tier |
| MongoDB | FREE | 512 MB free tier |
| **TOTAL** | **FREE** | 🎉 |

---

## If Something Goes Wrong

### Deploy failed?
1. Check Railway/Vercel logs
2. Verify GitHub repo is correct
3. Make sure `.env` variables are accurate

### "Cannot connect to backend"?
1. Check Vercel environment variable `REACT_APP_API_URL`
2. Verify Railway URL is correct
3. Test Railway health: `{railway-url}/api/health`

### Forgot your URLs?
- **Railway**: Dashboard → your project → Deployments
- **Vercel**: Dashboard → your project → Deployments

---

## That's it! 🚀

Your TSV Feedback App is now live online!
Workers can use it immediately without running local servers.

Questions? Check `DEPLOYMENT_GUIDE.md` for detailed instructions.
