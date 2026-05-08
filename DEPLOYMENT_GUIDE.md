# TSV Feedback App - Deployment Guide (FREE)

## Overview
- **Frontend**: Vercel (https://vercel.com) - FREE
- **Backend**: Railway.app (https://railway.app) - FREE ($5/month credit)
- **Database**: MongoDB Atlas - FREE (already configured)

---

## STEP 1: Deploy Backend to Railway.app

### 1.1 Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub (easiest)
3. Authorize Railway to access your GitHub

### 1.2 Deploy Backend
1. In Railway dashboard, click "New Project"
2. Select "Deploy from GitHub"
3. Choose the TSV repository (Dhif216/Tsv)
4. Railway auto-detects Node.js project
5. Select the `backend-node` directory as root

### 1.3 Configure Environment Variables
In Railway dashboard, go to **Variables** and add:

```
MONGODB_URI=mongodb+srv://Mouadh:20099486Dhif@tsv.wlgsqxi.mongodb.net/tsv_feedback?retryWrites=true&w=majority
ADMIN_EMAIL=dhif_mouadh@hotmail.fr
ADMIN_PASSWORD=admin123
JWT_SECRET=your-super-secret-key-change-this
PORT=3001
FRONTEND_URL=https://your-vercel-domain.vercel.app
```

### 1.4 Deploy
1. Click "Deploy"
2. Wait ~2-3 minutes for deployment
3. Railway gives you a URL like: `https://production-xyz.up.railway.app`
4. **Save this URL** - you'll need it for frontend

### 1.5 Verify Backend
Open in browser: `https://your-railway-url/api/health`
You should see: `{"status":"ok","timestamp":"..."}`

---

## STEP 2: Deploy Frontend to Vercel

### 2.1 Create Vercel Account
1. Go to https://vercel.com
2. Sign up with GitHub
3. Authorize Vercel

### 2.2 Add Backend URL to Frontend
Update [frontend/.env.local](frontend/.env.local):
```
REACT_APP_API_URL=https://your-railway-url
```

### 2.3 Deploy to Vercel
1. In Vercel dashboard, click "Add New..." → "Project"
2. Import the TSV GitHub repo
3. Configure:
   - **Framework**: Create React App
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install --legacy-peer-deps && npm run build`
   - **Output Directory**: `build`
   - **Install Command**: `npm install --legacy-peer-deps`

### 2.4 Add Environment Variables in Vercel
In Vercel project settings → Environment Variables:
```
REACT_APP_API_URL=https://your-railway-url
```

### 2.5 Deploy
1. Click "Deploy"
2. Wait for build to complete (~3-5 min)
3. Get your Vercel URL: `https://tsv-feedback.vercel.app` (or custom name)

---

## STEP 3: Update Backend FRONTEND_URL

Go back to Railway dashboard:
1. Update `FRONTEND_URL` environment variable to your Vercel URL
2. Railway auto-redeploys (~1 min)

---

## STEP 4: Verify Everything Works

### 4.1 Test Frontend
1. Open your Vercel URL in browser
2. Fill worker feedback form
3. Verify it submits successfully

### 4.2 Test Admin Dashboard
1. Go to `/admin` path
2. Login with: `dhif_mouadh@hotmail.fr` / `admin123`
3. See submitted feedback

### 4.3 Test PDF Export
1. In admin dashboard, click "Export PDF"
2. Verify download works

---

## Important URLs After Deployment

| Service | URL | Type |
|---------|-----|------|
| Frontend (Worker Form) | `https://tsv-feedback.vercel.app` | Public |
| Frontend (Admin) | `https://tsv-feedback.vercel.app/admin` | Protected |
| Backend API | `https://your-railway-url` | API |
| MongoDB | Already in cloud ✓ | Cloud |

---

## Free Tier Limits

| Service | Limit | Cost |
|---------|-------|------|
| Vercel | 100 GB bandwidth/month | Free |
| Railway | $5/month free credit | Free |
| MongoDB | 512 MB storage | Free |

*After Railway credit runs out: ~$7/month for basic tier (still cheaper than alternatives)*

---

## Troubleshooting

### Frontend shows "Cannot connect to backend"
- Check `REACT_APP_API_URL` in Vercel environment variables
- Verify Railway backend is running (check Railway dashboard)
- Check CORS configuration in backend

### PDF export fails
- MongoDB connection issue (common on free tier)
- Check MongoDB Atlas dashboard for connection issues
- May need to whitelist Railway IP in MongoDB

### Workers can't submit feedback
- Verify backend health: `your-railway-url/api/health`
- Check browser console for API errors
- Verify frontend `REACT_APP_API_URL` is correct

---

## Next Steps (Optional)

1. **Add Custom Domain**: 
   - Vercel: Settings → Domains
   - Railway: Can't use custom domain on free tier

2. **Increase Storage**:
   - MongoDB: Upgrade from free tier
   - Railway: Upgrade to paid plan

3. **Performance**:
   - Enable Railway caching
   - Optimize database queries

---

## Support

If deployment fails:
1. Check Railway logs (Dashboard → Logs)
2. Check Vercel build logs (Deployments → Click latest)
3. Check MongoDB Atlas connection (Network Access)
4. Verify all environment variables are set correctly

