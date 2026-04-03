const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'project_manager.db');

// Create or open the database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        createdAt TEXT NOT NULL
      )
    `);

    // Calendars table
    db.run(`
      CREATE TABLE IF NOT EXISTS calendars (
        id TEXT PRIMARY KEY,
        workStartHour INTEGER DEFAULT 9,
        workEndHour INTEGER DEFAULT 17,
        createdAt TEXT NOT NULL
      )
    `);

    // Non-working days (related to calendars)
    db.run(`
      CREATE TABLE IF NOT EXISTS nonWorkingDays (
        id TEXT PRIMARY KEY,
        calendarId TEXT NOT NULL,
        dateKey TEXT NOT NULL,
        FOREIGN KEY (calendarId) REFERENCES calendars(id) ON DELETE CASCADE,
        UNIQUE(calendarId, dateKey)
      )
    `);

    // Companies table
    db.run(`
      CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        userId TEXT NOT NULL,
        calendarId TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (calendarId) REFERENCES calendars(id)
      )
    `);

    // Schedules table with foreign keys to User, Calendar, and Company
    db.run(`
      CREATE TABLE IF NOT EXISTS schedules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        userId TEXT NOT NULL,
        companyId TEXT NOT NULL,
        calendarId TEXT NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (companyId) REFERENCES companies(id),
        FOREIGN KEY (calendarId) REFERENCES calendars(id)
      )
    `);

    // Task table to persist project tasks from taskLists
    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        scheduleId TEXT NOT NULL,
        companyId TEXT NOT NULL,
        userId TEXT NOT NULL,
        projectId TEXT NOT NULL,
        name TEXT NOT NULL,
        resource TEXT,
        seq INTEGER,
        duration INTEGER,
        startTime TEXT,
        endTime TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (scheduleId) REFERENCES schedules(id),
        FOREIGN KEY (companyId) REFERENCES companies(id),
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `);

    console.log('Database schema initialized successfully');
  });
}

module.exports = db;
