# Project Manager - Complete Setup & Running Guide

This is a full-stack React project management application with Node.js/Express backend and SQLite database for persistent data storage.

## 🚀 Quick Start - 2 Terminal Windows Required

### Terminal 1: Start Backend Server

```bash
cd backend
npm install
npm start
```

The backend will start on **http://localhost:5000** and create `project_manager.db` automatically.

✓ Expected output: `Backend server running on http://localhost:5000`

### Terminal 2: Start Frontend App

```bash
npm install
npm start
```

The React app will start on **http://localhost:3000**.

**IMPORTANT**: Both servers must be running simultaneously for the database features to work!

## 📱 How the System Works

1. **Frontend (React)** - User interface for managing companies, projects, and schedules
2. **Backend (Express)** - REST API server that handles database operations
3. **Database (SQLite)** - Stores all persistent data: users, companies, calendars, and schedules

### Connection Status
- Look at the top-right corner of the app to see backend connection status
- **Green "✓ Connected"** = Database features are active
- **Red "✗ Disconnected"** = Backend not running, data won't save to database

## 🗄️ Database Schema

### Users Table
```
id (PRIMARY KEY)
email (UNIQUE)
passwordHash
createdAt
```

### Calendars Table
```
id (PRIMARY KEY)
workStartHour (default: 9)
workEndHour (default: 17)
createdAt
```

### NonWorkingDays Table (Related to Calendars)
```
id (PRIMARY KEY)
calendarId (FOREIGN KEY)
dateKey (YYYY-MM-DD format)
```

### Companies Table
```
id (PRIMARY KEY)
name
userId (FOREIGN KEY → Users)
calendarId (FOREIGN KEY → Calendars)
createdAt
updatedAt
```

### Schedules Table
```
id (PRIMARY KEY)
name
userId (FOREIGN KEY → Users) - Who created it
companyId (FOREIGN KEY → Companies) - Associated company
calendarId (FOREIGN KEY → Calendars) - Work schedule used
startDate
endDate
createdAt
updatedAt
```

## 🔄 Data Persistence Features

### Automatic Saving
When you create or edit a company, it's automatically saved to the database if the backend is connected.

### Manual Save Button
Click the "Save" button next to a company to force-sync it to the database.

### LocalStorage Fallback
If the backend is disconnected, data is saved locally in your browser. When the backend reconnects, re-sync by clicking the Save button.

## 🌐 API Endpoints

### Users
- `GET /api/users` - Get all users
- `POST /api/users` - Create user
- `GET /api/users/:email` - Get user by email

### Calendars
- `POST /api/calendars` - Create calendar
- `GET /api/calendars/:id` - Get calendar
- `POST /api/calendars/:id/nonWorkingDays` - Add non-working day
- `DELETE /api/calendars/:id/nonWorkingDays/:dateKey` - Remove non-working day

### Companies
- `GET /api/companies/user/:userId` - Get user's companies
- `GET /api/companies/:id` - Get company
- `POST /api/companies` - Create company
- `PUT /api/companies/:id` - Update company
- `DELETE /api/companies/:id` - Delete company

### Schedules
- `GET /api/schedules/company/:companyId` - Get company schedules
- `GET /api/schedules/user/:userId` - Get user schedules
- `GET /api/schedules/:id` - Get schedule
- `POST /api/schedules` - Create schedule
- `PUT /api/schedules/:id` - Update schedule
- `DELETE /api/schedules/:id` - Delete schedule

### Health
- `GET /api/health` - Check if backend is running

## 🔧 Troubleshooting

### "Backend not available" message in console
1. Make sure backend terminal is running `npm start`
2. Check that it says "Backend server running on http://localhost:5000"
3. Verify no other app is using port 5000

### Database file not appearing
1. The database is created automatically in `/backend/project_manager.db`
2. Check the backend terminal for any errors
3. Ensure you have write permissions in the backend directory

### Data not persisting
1. Check if "✓ Connected" shows in the top-right
2. If disconnected, start the backend server
3. Try creating a new company - it should auto-save
4. Check browser console (F12) for error messages

### Port 5000 already in use
```bash
# Find what's using port 5000 (Windows)
netstat -ano | findstr :5000

# Kill the process by PID (replace XXXX with PID)
taskkill /PID XXXX /F
```

## 📁 Project Structure

```
project-manager/
├── backend/
│   ├── database.js          - SQLite setup
│   ├── server.js            - Express server with API routes
│   ├── package.json
│   └── project_manager.db   - Database file (auto-created)
├── src/
│   ├── App.js               - Main React component
│   ├── services/
│   │   └── api.js           - API client for backend
│   ├── models/
│   │   ├── company.js
│   │   ├── user.js
│   │   └── calendar.js
│   └── ...
└── SETUP_GUIDE.md           - This file
```

## 💡 Development Notes

- Hot reload works on both frontend and backend (with nodemon)
- All data is synced with SQLite in real-time
- Users are stored locally in localStorage (can be migrated to DB)
- API calls include automatic error handling and logging

## ✅ Checklist for Full Setup

- [ ] Backend installed: `cd backend && npm install`
- [ ] Backend running: `npm start` (in backend folder)
- [ ] Frontend installed: `npm install` (in root folder)
- [ ] Frontend running: `npm start` (in root folder)
- [ ] Backend shows "✓ Connected" in app header
- [ ] Created a test company and see database file created
- [ ] Refreshed page and company data persists
