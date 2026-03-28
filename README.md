# 🎯 Carolina Order Portal v2.0

**Complete authenticated dashboard with Carolina database integration**

Login → View Dashboard → Track Orders → Done! ✅

---

## ✨ Features

### **Authentication:**
- 🔐 Secure login page
- 🔑 JWT token-based auth
- 👤 User management
- 🛡️ Role-based access

### **Dashboard:**
- 📊 Statistics overview
- 📋 Estimates list
- 🔧 Work orders list
- 🔄 Auto-refresh (5 min)
- 📱 Mobile responsive

### **Data:**
- 💾 Portal DB: User authentication
- 💾 Carolina DB: Order data (read-only)
- 🔗 Dual database connections
- ⚡ Real-time from Carolina

---

## 🚀 Quick Deploy

**Time: 20 minutes**

1. **Setup users database** (5 min)
2. **Upload files to GitHub** (10 min)
3. **Set environment variables** (2 min)
4. **Deploy on Heroku** (2 min)
5. **Login and test!** (1 min)

**See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for complete guide**

---

## 🎯 Default Login

**Username:** `admin`  
**Password:** `admin123`  
**Company:** Nowell

*Change password after first login!*

---

## 📦 What's Included

- ✅ Complete backend (Express + PostgreSQL)
- ✅ Complete frontend (React)
- ✅ Authentication system (bcrypt + JWT)
- ✅ Dashboard with statistics
- ✅ Orders display
- ✅ Database setup scripts
- ✅ Complete documentation
- ✅ Ready to deploy!

---

## 🗄️ Database Structure

### **Portal DB (Authentication):**
```sql
users
├── id
├── username
├── email
├── password_hash
├── company_name
├── role
└── created_at
```

### **Carolina DB (Read-Only):**
```sql
Estimates
WorkOrders
WorkOrderParts
```

---

## 🔧 Tech Stack

- **Backend:** Node.js + Express
- **Frontend:** React 18
- **Database:** PostgreSQL (dual connections)
- **Auth:** bcryptjs + JWT
- **Hosting:** Heroku
- **Styling:** Pure CSS

---

## 📱 Screenshots

### Login Page:
Clean, simple login with username/password

### Dashboard:
- Statistics cards at top
- Estimates section with cards
- Work orders section with cards
- Refresh button
- Logout button

---

## 🎯 What It Shows

### **For Each Estimate:**
- Estimate number
- Status (sent/accepted/declined)
- Amount
- Dates
- Color-coded status badges

### **For Each Work Order:**
- DR number
- Work order number
- Status
- Promised date
- Material status
- Location
- Completion dates

---

## 🔐 Security

- ✅ Passwords hashed with bcrypt
- ✅ JWT tokens (7-day expiry)
- ✅ Read-only Carolina DB access
- ✅ HTTPS only
- ✅ CORS enabled
- ✅ SQL injection prevention

---

## 📖 Documentation

- **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Complete deployment guide
- **[.env.example](.env.example)** - Environment variables
- **[backend/database/setup.sql](backend/database/setup.sql)** - Database setup

---

## 🐛 Troubleshooting

### **Can't login?**
- Check users table exists
- Verify password hash
- Check JWT_SECRET set

### **No orders showing?**
- Check CAROLINA_DATABASE_URL
- Verify company_name in users table
- Test Carolina DB connection

### **Build failed?**
- Set NPM_CONFIG_PRODUCTION=false
- Check all files uploaded
- View Heroku build logs

**See DEPLOYMENT.md for detailed troubleshooting!**

---

## ✅ Success Criteria

After deployment:
- [ ] Login page loads
- [ ] Can login with admin/admin123
- [ ] Dashboard displays
- [ ] Orders show (if any exist)
- [ ] Statistics accurate
- [ ] Refresh works
- [ ] Logout works

---

## 🎊 What Makes This Different

### **vs. Simple Tracker:**
- ✅ Full authentication
- ✅ Multi-user support
- ✅ Role-based access
- ✅ Secure login

### **vs. Old Portal:**
- ✅ Direct DB connection (no API)
- ✅ Faster data loading
- ✅ Simpler architecture
- ✅ Actually works!

---

## 💡 Future Enhancements

Easy to add:
- 📧 Email notifications
- 👥 More user roles
- 📊 Advanced statistics
- 📄 PDF export
- 🔍 Advanced search
- 📱 Push notifications

---

## 📞 Support

**Check documentation first:**
- DEPLOYMENT.md
- Heroku logs
- Browser console

**Common issues:**
- Database not setup
- Environment variables missing
- Build not completing

---

## 🎉 You're Ready!

**Download the package**  
**Follow DEPLOYMENT.md**  
**Deploy in 20 minutes**  
**Enjoy your working dashboard!**

---

**Made with ❤️ for Carolina Rolling**

*Version 2.0 - Complete Authenticated Dashboard*
