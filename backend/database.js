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
        role TEXT DEFAULT 'user',
        createdAt TEXT NOT NULL
      )
    `);

    // Add role column if it doesn't exist (for migration)
    db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding role column:', err);
      }
    });

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
        plannedResource TEXT,
        seq INTEGER,
        duration INTEGER,
        startTime TEXT,
        endTime TEXT,
        currentStart TEXT,
        currentEnd TEXT,
        revisedDuration REAL,
        remaining_duration REAL,
        currentSequence INTEGER,
        percentComplete REAL,
        currentResource TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (scheduleId) REFERENCES schedules(id),
        FOREIGN KEY (companyId) REFERENCES companies(id),
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `);

    const migrateCurrentTaskColumns = (mappings, index = 0) => {
      if (index >= mappings.length) return;
      const { legacyName, currentName, type } = mappings[index];

      db.all('PRAGMA table_info(tasks)', (err, columns) => {
        if (err) {
          console.error(`Error reading task columns for ${currentName} migration:`, err);
          return;
        }

        const columnNames = new Set(columns.map(column => column.name));
        const continueMigration = () => migrateCurrentTaskColumns(mappings, index + 1);
        if (columnNames.has(legacyName) && !columnNames.has(currentName)) {
          db.run(`ALTER TABLE tasks RENAME COLUMN ${legacyName} TO ${currentName}`, migrationError => {
            if (migrationError) {
              console.error(`Error renaming ${legacyName} column:`, migrationError);
              return;
            }
            continueMigration();
          });
        } else if (columnNames.has(legacyName) && columnNames.has(currentName)) {
          db.run(
            `UPDATE tasks SET ${currentName} = ${legacyName} WHERE ${currentName} IS NULL`,
            migrationError => {
              if (migrationError) {
                console.error(`Error copying ${legacyName} values to ${currentName}:`, migrationError);
                return;
              }
              db.run(`ALTER TABLE tasks DROP COLUMN ${legacyName}`, dropError => {
                if (dropError) {
                  console.error(`Error dropping legacy ${legacyName} column:`, dropError);
                  return;
                }
                continueMigration();
              });
            }
          );
        } else if (!columnNames.has(currentName)) {
          db.run(`ALTER TABLE tasks ADD COLUMN ${currentName} ${type}`, migrationError => {
            if (migrationError) {
              console.error(`Error adding ${currentName} column:`, migrationError);
              return;
            }
            continueMigration();
          });
        } else {
          continueMigration();
        }
      });
    };

    migrateCurrentTaskColumns([
      { legacyName: 'actualStart', currentName: 'currentStart', type: 'TEXT' },
      { legacyName: 'actualEnd', currentName: 'currentEnd', type: 'TEXT' },
      { legacyName: 'actualSequence', currentName: 'currentSequence', type: 'INTEGER' },
      { legacyName: 'actualResource', currentName: 'currentResource', type: 'TEXT' }
    ]);
    db.all('PRAGMA table_info(tasks)', (err, columns) => {
      if (err) {
        console.error('Error reading task columns for plannedResource migration:', err);
        return;
      }

      const columnNames = new Set(columns.map(column => column.name));
      if (columnNames.has('resource') && !columnNames.has('plannedResource')) {
        db.run('ALTER TABLE tasks RENAME COLUMN resource TO plannedResource', migrationError => {
          if (migrationError) {
            console.error('Error renaming resource column:', migrationError);
          }
        });
      } else if (!columnNames.has('plannedResource')) {
        db.run('ALTER TABLE tasks ADD COLUMN plannedResource TEXT', migrationError => {
          if (migrationError) {
            console.error('Error adding plannedResource column:', migrationError);
          }
        });
      }
    });
    db.all('PRAGMA table_info(tasks)', (err, columns) => {
      if (err) {
        console.error('Error reading task columns for revisedDuration migration:', err);
        return;
      }

      const columnNames = new Set(columns.map(column => column.name));
      if (columnNames.has('actualDuration') && !columnNames.has('revisedDuration')) {
        db.run('ALTER TABLE tasks RENAME COLUMN actualDuration TO revisedDuration', (migrationError) => {
          if (migrationError) {
            console.error('Error renaming actualDuration column:', migrationError);
          }
        });
      } else if (!columnNames.has('revisedDuration')) {
        db.run('ALTER TABLE tasks ADD COLUMN revisedDuration REAL', (migrationError) => {
          if (migrationError) {
            console.error('Error adding revisedDuration column:', migrationError);
          }
        });
      } else if (columnNames.has('actualDuration')) {
        db.run(
          'UPDATE tasks SET revisedDuration = actualDuration WHERE revisedDuration IS NULL',
          (migrationError) => {
            if (migrationError) {
              console.error('Error copying actualDuration values to revisedDuration:', migrationError);
            }
          }
        );
      }
    });
    db.run(`ALTER TABLE tasks ADD COLUMN remaining_duration REAL`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding remaining_duration column:', err);
      }
    });
    db.run(`ALTER TABLE tasks ADD COLUMN percentComplete REAL`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding percentComplete column:', err);
      }
    });
    console.log('Database schema initialized successfully');
  });
}

module.exports = db;
