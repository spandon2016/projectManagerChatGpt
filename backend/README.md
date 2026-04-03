# Project Manager Backend

Express server and SQLite database for the Project Manager application.

## Quick Start

```bash
npm install
npm start
```

Server runs on **http://localhost:5000**

## What This Does

1. **Creates SQLite Database**
   - Creates `project_manager.db` automatically on first run
   - Sets up all required tables
   - Ready to accept API requests

2. **Provides REST API**
   - Users management
   - Calendars & non-working days
   - Companies management
   - Schedules management

3. **Enables Data Persistence**
   - All data saved to database
   - Survives app restarts
   - Accessible via REST endpoints

## Database Location

`./project_manager.db` - Created automatically in this folder

## Environment

- **Node.js**: v14+ required
- **Port**: 5000
- **Database**: SQLite3

## Development

For auto-reload on file changes:

```bash
npm run dev
```

Requires `nodemon` (already in devDependencies)

## Verifying it Works

1. Backend started successfully:
   ```
   Backend server running on http://localhost:5000
   Connected to SQLite database at: /path/to/project_manager.db
   Database schema initialized successfully
   ```

2. Test the API:
   ```bash
   curl http://localhost:5000/api/health
   # Response: {"status":"Backend is running"}
   ```

3. Check database file exists:
   ```bash
   ls -la project_manager.db
   # or on Windows: dir project_manager.db
   ```

## Troubleshooting

**"Port 5000 already in use"**
- Another process is using port 5000
- Kill it or change the PORT in server.js

**"No such file or directory"**
- Make sure you're in the backend folder
- Check node_modules exists after npm install

**Database not created**
- Check write permissions in backend folder
- Look for error messages in console
