# 🚀 Carolina Order Portal - Complete Deployment Guide

## ✨ What You're Getting

A **complete, working authenticated dashboard** that:
- ✅ Login page (username/password)
- ✅ Dashboard with statistics
- ✅ Lists estimates from Carolina DB
- ✅ Lists work orders from Carolina DB  
- ✅ Auto-refresh every 5 minutes
- ✅ Mobile responsive
- ✅ Secure JWT authentication
- ✅ Dual database connections (Portal + Carolina)

---

## 📦 **What's Included**

```
carolina-order-portal/
├── backend/
│   ├── server.js                 ← Express API
│   ├── package.json              ← Backend deps
│   └── database/
│       └── setup.sql             ← User table setup
├── frontend/
│   ├── src/
│   │   ├── App.js                ← Main app with routing
│   │   ├── pages/
│   │   │   ├── Login.js          ← Login page
│   │   │   ├── Dashboard.js      ← Dashboard
│   │   │   ├── Login.css
│   │   │   └── Dashboard.css
│   │   └── index.js
│   ├── public/
│   │   └── index.html
│   └── package.json
├── docs/
│   └── DEPLOYMENT.md             ← This file
├── package.json                  ← Root config
├── Procfile                      ← Heroku config
├── .env.example                  ← Environment vars
├── .gitignore
└── README.md
```

---

## ⚡ **QUICK DEPLOY (20 Minutes)**

### **Step 1: Setup Users Database (5 min)**

1. Go to Heroku Dashboard → Run console → `bash`
2. Connect to Portal database:

```bash
psql postgres://u9n6f8574fvslb:pbbaea1aa6a3784c7d21c2d12060ca9f6b2a71139b57f9d8f0ba78b7d91f6d88a@c18qegamsgjut6.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/ddck8ad5ui945n
```

3. Run setup script:

```sql
-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create admin user (username: admin, password: admin123)
INSERT INTO users (username, email, password_hash, company_name, role)
VALUES (
  'admin',
  'admin@portal.com',
  '$2a$10$YQiiz/L.MK8qJJe5pGz1COvVzF8ZN8qJJK5y6Xn8aL.zPzJz.LqFu',
  'Nowell',
  'admin'
)
ON CONFLICT (username) DO NOTHING;

-- Verify
SELECT username, email, company_name, role FROM users;
```

Should show:
```
 username | email            | company_name | role
----------+------------------+--------------+-------
 admin    | admin@portal.com | Nowell       | admin
```

Type `\q` to exit.

---

### **Step 2: Upload Files to GitHub (10 min)**

#### **Option A: Via GitHub Web (Easiest)**

1. Go to your repo on GitHub
2. Delete old files (see cleanup guide below)
3. For each file in the package:
   - Click "Add file" → "Create new file"
   - Copy full path (e.g., `backend/server.js`)
   - Paste content
   - Commit

#### **Option B: Via Terminal (If You Have Git)**

```bash
# Extract the zip
cd ~/Downloads
unzip dashboard-complete.zip

# Copy to your repo
cd ~/carolina-order-portal
rm -rf backend/* frontend/src/*

cp -r ~/Downloads/dashboard-complete/* .

# Commit
git add .
git commit -m "Complete authenticated dashboard v2.0"
git push origin main
```

---

### **Step 3: Set Environment Variables (2 min)**

Go to Heroku Dashboard → Settings → Reveal Config Vars

**Add these variables:**

```
DATABASE_URL = postgres://u9n6f8574fvslb:pbbaea1aa6a3784c7d21c2d12060ca9f6b2a71139b57f9d8f0ba78b7d91f6d88a@c18qegamsgjut6.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/ddck8ad5ui945n

CAROLINA_DATABASE_URL = postgres://u94ms567lm08kn:p7a5febeb4dff59a1be0bb868fa6398b11f95d305dac1d382b1b6bd7205e9c975@ca8lne8pi75f88.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/d6dt0etqrfv3g6

JWT_SECRET = your-random-secret-key-change-this

NODE_ENV = production

NPM_CONFIG_PRODUCTION = false
```

---

### **Step 4: Deploy on Heroku (2 min)**

1. Go to Deploy tab
2. Manual Deploy → Deploy Branch
3. Watch build logs (should see "npm run build")
4. Wait for "Build succeeded"
5. Click "More" → "Restart all dynos"

---

### **Step 5: TEST! (1 min)**

1. Go to your app URL
2. You'll see the login page
3. Login with:
   - **Username:** `admin`
   - **Password:** `admin123`
4. You should see the dashboard with your orders!

---

## 🎯 **What the Dashboard Shows**

### **Statistics Cards:**
- Total Estimates
- In Production count
- Ready for Pickup count
- Completed count

### **Estimates Section:**
- Estimate number
- Status (sent/accepted)
- Amount
- Dates (sent, valid until)

### **Work Orders Section:**
- DR number
- Work order number
- Status
- Promised date
- Material received date
- Location
- Completion status

---

## 🔧 **Add More Users**

From Heroku console (psql):

```sql
-- Connect to portal DB
psql <YOUR_DATABASE_URL>

-- Add user (replace values)
INSERT INTO users (username, email, password_hash, company_name, role)
VALUES (
  'jason',
  'jason@company.com',
  '$2a$10$YQiiz/L.MK8qJJe5pGz1COvVzF8ZN8qJJK5y6Xn8aL.zPzJz.LqFu',
  'ABC Manufacturing',
  'user'
);
```

All users with that hash have password: `admin123`

**To create custom passwords:** Use bcrypt to generate hash first.

---

## 🗑️ **GitHub Cleanup Guide**

Before uploading new files, delete these old files:

```
frontend/src/App.js (old version)
frontend/src/App.css (old version)
frontend/src/pages/* (all old pages)
frontend/src/components/* (old components)
backend/server.js (old version)
backend/services/orderService.js (old service)
```

Keep:
- `.gitignore`
- `README.md` (will replace)
- Package.json files (will replace)

---

## 🐛 **Troubleshooting**

### **Can't Login**

**Check:**
1. Users table created? Run `\dt` in psql
2. Admin user exists? Run `SELECT * FROM users;`
3. Password hash correct? Should be 60 characters
4. JWT_SECRET set in Heroku config vars?

**Test directly:**
```bash
curl -X POST https://your-app.herokuapp.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Should return a token!

### **"Failed to load orders"**

**Check:**
1. CAROLINA_DATABASE_URL set correctly?
2. User has company_name? `SELECT company_name FROM users WHERE username='admin';`
3. Carolina DB has Estimates/WorkOrders tables?

**Test Carolina connection:**
```bash
psql postgres://u94ms567lm08kn:...
\dt
```

Should show `Estimates` and `WorkOrders` tables.

### **Build Failed**

**Check:**
1. NPM_CONFIG_PRODUCTION=false set?
2. All files uploaded correctly?
3. Build logs show "npm run build"?

---

## 🔐 **Security Notes**

### **Database Connections:**
- Portal DB: Read/Write (for users only)
- Carolina DB: Read-only (for orders)

### **Password:**
- Stored as bcrypt hash
- Never in plain text
- 10 salt rounds

### **JWT Tokens:**
- 7-day expiry
- Signed with JWT_SECRET
- Stored in localStorage

---

## 📱 **Mobile Support**

Works on:
- iPhones
- Android phones
- Tablets
- Desktop browsers

Auto-adapts layout!

---

## ✅ **Success Checklist**

After deployment:

- [ ] Can access login page
- [ ] Can login with admin/admin123
- [ ] Dashboard loads
- [ ] Statistics show correctly
- [ ] Estimates display (if any exist)
- [ ] Work orders display (if any exist)
- [ ] Refresh button works
- [ ] Logout works
- [ ] Mobile view works

---

## 🎊 **You're Done!**

Your authenticated order portal is live!

**Default credentials:**
- Username: `admin`
- Password: `admin123`

**Change the admin password after first login!**

---

## 💬 **Need Help?**

**Check these:**
1. Heroku logs: `More → View logs`
2. Browser console: Press F12
3. Database connection: Test with psql
4. Environment variables: Check config vars

**Common fixes:**
- Restart dynos
- Check all env vars set
- Verify database setup ran
- Clear browser cache

---

**Enjoy your working dashboard!** 🎉
