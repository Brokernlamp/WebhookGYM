# Deployment Guide - Persistent Backend for WhatsApp

## Why You Need a Persistent Backend

WhatsApp with Baileys requires:
- ✅ **Persistent connection** - Must stay alive 24/7
- ✅ **Long-running process** - No timeout limits
- ✅ **File storage** - Auth files must persist between restarts
- ❌ **NOT compatible with serverless** (Netlify Functions, AWS Lambda, etc.)

## Recommended: Render.com (Free Tier)

Render.com offers a **free tier** with persistent web services perfect for WhatsApp.

### Step 1: Prepare for Deployment

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

### Step 2: Deploy to Render

1. **Sign up**: Go to [render.com](https://render.com) and sign up (GitHub login works)

2. **Create New Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select your repository

3. **Configure Service**:
   - **Name**: `gym-admin-backend` (or your choice)
   - **Region**: Choose closest to you
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: Leave empty (root of repo)
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Plan**: `Free` (for testing) or `Starter $7/mo` (recommended for production)

4. **Add Environment Variables**:
   Click "Advanced" → "Add Environment Variable" and add:
   ```
   NODE_ENV=production
   PORT=10000
   TURSO_DATABASE_URL=your_turso_url_here
   TURSO_AUTH_TOKEN=your_turso_token_here
   ```
   
   Optional (for Google Sheets):
   ```
   GOOGLE_SHEET_ID=your_sheet_id
   GOOGLE_SERVICE_ACCOUNT={"type":"service_account",...}
   GOOGLE_SHEET_NAME=Members
   ```

5. **Add Persistent Disk** (IMPORTANT for WhatsApp):
   - In service settings, go to "Disks"
   - Click "Create Disk"
   - **Name**: `whatsapp-auth`
   - **Mount Path**: `/opt/render/project/src/auth_info_baileys`
   - **Size**: 1 GB (free tier allows this)
   - This stores WhatsApp auth files permanently

6. **Deploy**:
   - Click "Create Web Service"
   - Wait for build to complete (~3-5 minutes)
   - Your service will be live at: `https://gym-admin-backend.onrender.com`

### Step 3: Configure Frontend (Netlify)

Update your Netlify frontend to point to Render backend:

1. **Add Environment Variable in Netlify**:
   ```
   VITE_API_URL=https://gym-admin-backend.onrender.com
   ```

2. **Update API calls** (if needed) to use `VITE_API_URL`

### Step 4: Test WhatsApp

1. Go to your deployed site: `https://your-site.netlify.app/whatsapp`
2. Click "Generate QR Code"
3. Scan with WhatsApp - connection should work!
4. Auth files will be saved in Render's persistent disk

---

## Alternative: Railway.app

Railway is another good option with a simpler setup.

### Steps:

1. **Sign up**: [railway.app](https://railway.app)
2. **New Project** → "Deploy from GitHub repo"
3. **Select your repo**
4. **Add Environment Variables** (same as Render above)
5. **Deploy** - Railway auto-detects Node.js apps

Railway provides persistent storage automatically.

---

## Alternative: Self-Hosted (VPS)

For more control, you can deploy on a VPS:

### Options:
- **DigitalOcean** - $6/mo droplet
- **Linode** - $5/mo
- **Hetzner** - €4.51/mo (EU)
- **AWS EC2** - Pay as you go

### Setup:
```bash
# SSH into your VPS
ssh user@your-server-ip

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone your repo
git clone your-repo-url
cd GymAdminDashboard

# Install dependencies
npm install

# Build
npm run build

# Setup environment variables
nano .env
# Add your env vars

# Install PM2 (process manager)
sudo npm install -g pm2

# Start with PM2 (auto-restarts on crash)
pm2 start npm --name "gym-admin" -- start
pm2 save
pm2 startup  # Auto-start on server reboot
```

---

## Recommended Setup for Production

**Best Combination:**
- ✅ **Frontend**: Netlify (free, fast CDN)
- ✅ **Backend**: Render.com Starter plan ($7/mo) or Railway ($5/mo)
- ✅ **Database**: Turso (already using - free tier)

**Total Cost**: ~$5-7/month for reliable WhatsApp automation

---

## Troubleshooting

### WhatsApp Connection Drops
- ✅ Use persistent disk (Render) or volume (Railway)
- ✅ Check server logs for errors
- ✅ Ensure no timeouts in deployment settings

### Build Fails
- ✅ Check Node.js version (needs 20.x)
- ✅ Verify all environment variables are set
- ✅ Check build logs for specific errors

### QR Code Not Appearing
- ✅ Check backend logs: `render.com` → Your service → "Logs"
- ✅ Verify WhatsApp module loads correctly
- ✅ Check disk mount path is correct

---

## Need Help?

- Render Docs: https://render.com/docs
- Railway Docs: https://docs.railway.app
- Check deployment logs in your platform's dashboard

