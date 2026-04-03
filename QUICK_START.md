# 🚀 QUICK START - Get Database Working Now

Follow these steps **in order** to start using the database system.

## Step 1: Terminal Window 1 - Backend Server

Open a **new terminal/PowerShell window** and run:

```powershell
cd C:\Users\sterg\javascriptstuff\react_funda\project-manager\backend
npm install
npm start
```

**Wait for this message:**
```
Backend server running on http://localhost:5000
Connected to SQLite database at: C:\Users\sterg\...\project_manager.db
Database schema initialized successfully
```

✅ Leave this terminal running!

## Step 2: Terminal Window 2 - Frontend App

Open **another new terminal/PowerShell window** and run:

```powershell
cd C:\Users\sterg\javascriptstuff\react_funda\project-manager
npm start
```

**Wait for this message:**
```
Compiled successfully!
You can now view project-manager in the browser.
  Local:            http://localhost:3000
```

✅ Your app opens automatically in the browser!

## Step 3: Verify It Works

1. In the app, look at the **top-right corner**
2. You should see: `Backend: ✓ Connected` (in green)
3. If you see `Backend: ✗ Disconnected` (in red), check Step 1

## Step 4: Create a Test Company

1. Log in with email/password
2. Go to **Companies** page
3. Create a new company: type name and click "Add Company"
4. You should see in the **backend terminal**:
   ```
   ✓ Company saved to database: Your Company Name
   ```

## Step 5: Verify Database Created

In the **backend folder**, you should now see:
```
project-manager/backend/project_manager.db
```

This is your SQLite database file!

## ✅ Success Checklist

- [ ] Backend terminal shows "Backend server running"
- [ ] Frontend shows "✓ Connected" in top-right
- [ ] Can create a company
- [ ] Backend terminal shows "✓ Company saved to database"
- [ ] Database file exists at `backend/project_manager.db`
- [ ] Refresh the page and company still appears

## ❌ Troubleshooting

### "Backend: ✗ Disconnected"
- Make sure backend terminal is **still running**
- Check for errors in backend terminal
- Verify it says port 5000

### "Port 5000 already in use"
**Option 1:** Kill the process using port 5000
```powershell
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

**Option 2:** Use a different port by editing `backend/server.js` line with `PORT = 5000`

### No database file appears
- Check backend terminal for errors
- Verify you have write permissions in backend folder
- Try creating a company with backend connected

### App still doesn't save
1. Check browser console (F12) for JavaScript errors
2. Check backend terminal for API errors
3. Make sure both terminals are still running

## 📝 What's Happening Behind the Scenes

1. **Backend** creates a SQLite database on startup
2. **Frontend** connects to backend via API
3. When you create/edit/delete companies:
   - Frontend sends request to backend API
   - Backend saves to SQLite database
   - Data persists even after refresh

## Next Steps

- See `SETUP_GUIDE.md` for complete documentation
- See `backend/README.md` for backend details
- See `src/services/api.js` for all available API calls
