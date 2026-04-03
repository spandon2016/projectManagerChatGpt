const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');
const argon2 = require('argon2');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// ==================== USER ENDPOINTS ====================

// Get all users
app.get('/api/users', (req, res) => {
  db.all('SELECT id, email, createdAt FROM users', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows || []);
    }
  });
});

// Create user
app.post('/api/users', async (req, res) => {
  const { id, email, password, createdAt } = req.body;
  
  if (!id || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Hash password with argon2
    const passwordHash = await argon2.hash(password);
    
    db.run(
      'INSERT INTO users (id, email, passwordHash, createdAt) VALUES (?, ?, ?, ?)',
      [id, email, passwordHash, createdAt || new Date().toISOString()],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json({ id, email, createdAt });
        }
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Password hashing failed' });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!row) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    try {
      // Verify password with argon2
      const isValid = await argon2.verify(row.passwordHash, password);
      
      if (isValid) {
        // Return user data (excluding password hash)
        const { passwordHash, ...userData } = row;
        res.json(userData);
      } else {
        res.status(401).json({ error: 'Invalid email or password' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Password verification failed' });
    }
  });
});

// Get user by email
app.get('/api/users/:email', (req, res) => {
  const { email } = req.params;
  
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!row) {
      res.status(404).json({ error: 'User not found' });
    } else {
      res.json(row);
    }
  });
});

// ==================== CALENDAR ENDPOINTS ====================

// Create calendar
app.post('/api/calendars', (req, res) => {
  const { id, workStartHour, workEndHour } = req.body;
  
  if (!id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  db.run(
    'INSERT INTO calendars (id, workStartHour, workEndHour, createdAt) VALUES (?, ?, ?, ?)',
    [id, workStartHour || 9, workEndHour || 17, new Date().toISOString()],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ id, workStartHour: workStartHour || 9, workEndHour: workEndHour || 17 });
      }
    }
  );
});

// Get calendar
app.get('/api/calendars/:id', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM calendars WHERE id = ?', [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!row) {
      res.status(404).json({ error: 'Calendar not found' });
    } else {
      // Get non-working days for this calendar
      db.all('SELECT dateKey FROM nonWorkingDays WHERE calendarId = ?', [id], (err, nonWorkingDays) => {
        const nonWorkingDateKeys = (nonWorkingDays || []).map(d => d.dateKey);
        res.json({ ...row, nonWorkingDays: nonWorkingDateKeys });
      });
    }
  });
});

// Add non-working day
app.post('/api/calendars/:id/nonWorkingDays', (req, res) => {
  const { id } = req.params;
  const { dateKey } = req.body;
  
  if (!dateKey) {
    return res.status(400).json({ error: 'Missing dateKey' });
  }

  const nonWorkingDayId = `nwd_${Date.now()}`;
  db.run(
    'INSERT INTO nonWorkingDays (id, calendarId, dateKey) VALUES (?, ?, ?)',
    [nonWorkingDayId, id, dateKey],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ id: nonWorkingDayId, calendarId: id, dateKey });
      }
    }
  );
});

// Remove non-working day
app.delete('/api/calendars/:id/nonWorkingDays/:dateKey', (req, res) => {
  const { id, dateKey } = req.params;
  
  db.run('DELETE FROM nonWorkingDays WHERE calendarId = ? AND dateKey = ?', [id, dateKey], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ success: true });
    }
  });
});

// ==================== COMPANY ENDPOINTS ====================

// Get all companies for a user
app.get('/api/companies/user/:userId', (req, res) => {
  const { userId } = req.params;
  
  db.all('SELECT * FROM companies WHERE userId = ?', [userId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows || []);
    }
  });
});

// Get company by ID
app.get('/api/companies/:id', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM companies WHERE id = ?', [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!row) {
      res.status(404).json({ error: 'Company not found' });
    } else {
      res.json(row);
    }
  });
});

// Create company
app.post('/api/companies', (req, res) => {
  const { id, name, userId, calendarId } = req.body;
  
  if (!id || !name || !userId || !calendarId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const now = new Date().toISOString();
  db.run(
    'INSERT INTO companies (id, name, userId, calendarId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, userId, calendarId, now, now],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ id, name, userId, calendarId, createdAt: now, updatedAt: now });
      }
    }
  );
});

// Update company
app.put('/api/companies/:id', (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const now = new Date().toISOString();
  db.run(
    'UPDATE companies SET name = ?, updatedAt = ? WHERE id = ?',
    [name, now, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (this.changes === 0) {
        res.status(404).json({ error: 'Company not found' });
      } else {
        res.json({ success: true, updatedAt: now });
      }
    }
  );
});

// Delete company
app.delete('/api/companies/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM companies WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (this.changes === 0) {
      res.status(404).json({ error: 'Company not found' });
    } else {
      res.json({ success: true });
    }
  });
});

// ==================== SCHEDULE ENDPOINTS ====================

// Get all schedules for a company
app.get('/api/schedules/company/:companyId', (req, res) => {
  const { companyId } = req.params;
  
  db.all('SELECT * FROM schedules WHERE companyId = ?', [companyId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows || []);
    }
  });
});

// Get all schedules for a user
app.get('/api/schedules/user/:userId', (req, res) => {
  const { userId } = req.params;
  
  db.all('SELECT * FROM schedules WHERE userId = ?', [userId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows || []);
    }
  });
});

// Get schedule by ID
app.get('/api/schedules/:id', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM schedules WHERE id = ?', [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!row) {
      res.status(404).json({ error: 'Schedule not found' });
    } else {
      res.json(row);
    }
  });
});

// Create schedule
app.post('/api/schedules', (req, res) => {
  const { id, name, userId, companyId, calendarId, startDate, endDate } = req.body;
  
  if (!id || !name || !userId || !companyId || !calendarId || !startDate || !endDate) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const now = new Date().toISOString();
  db.run(
    `INSERT INTO schedules (id, name, userId, companyId, calendarId, startDate, endDate, createdAt, updatedAt) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, userId, companyId, calendarId, startDate, endDate, now, now],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ id, name, userId, companyId, calendarId, startDate, endDate, createdAt: now, updatedAt: now });
      }
    }
  );
});

// Update schedule
app.put('/api/schedules/:id', (req, res) => {
  const { id } = req.params;
  const { name, startDate, endDate } = req.body;
  
  if (!name && !startDate && !endDate) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  const now = new Date().toISOString();
  const updates = [];
  const values = [];
  
  if (name) {
    updates.push('name = ?');
    values.push(name);
  }
  if (startDate) {
    updates.push('startDate = ?');
    values.push(startDate);
  }
  if (endDate) {
    updates.push('endDate = ?');
    values.push(endDate);
  }
  
  updates.push('updatedAt = ?');
  values.push(now);
  values.push(id);

  db.run(
    `UPDATE schedules SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (this.changes === 0) {
        res.status(404).json({ error: 'Schedule not found' });
      } else {
        res.json({ success: true, updatedAt: now });
      }
    }
  );
});

// Delete schedule
app.delete('/api/schedules/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM schedules WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (this.changes === 0) {
      res.status(404).json({ error: 'Schedule not found' });
    } else {
      res.json({ success: true });
    }
  });
});

// ==================== TASKS ENDPOINTS ====================

// Get tasks for a project (schedule)
app.get('/api/tasks/project/:projectId', (req, res) => {
  const { projectId } = req.params;
  db.all('SELECT * FROM tasks WHERE projectId = ?', [projectId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows || []);
    }
  });
});

// Create task
app.post('/api/tasks', (req, res) => {
  const { id, scheduleId, companyId, userId, projectId, name, resource, seq, duration, startTime, endTime, createdAt, updatedAt } = req.body;

  if (!id || !scheduleId || !companyId || !userId || !projectId || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const now = new Date().toISOString();
  db.run(
    `INSERT INTO tasks (id, scheduleId, companyId, userId, projectId, name, resource, seq, duration, startTime, endTime, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, scheduleId, companyId, userId, projectId, name, resource || '', seq || 0, duration || 0, startTime || '', endTime || '', createdAt || now, updatedAt || now],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ id, scheduleId, companyId, userId, projectId, name, resource, seq, duration, startTime, endTime, createdAt: createdAt || now, updatedAt: updatedAt || now });
      }
    }
  );
});

// Update task
app.put('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { name, resource, seq, duration, startTime, endTime } = req.body;

  const fields = [];
  const values = [];

  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (resource !== undefined) { fields.push('resource = ?'); values.push(resource); }
  if (seq !== undefined) { fields.push('seq = ?'); values.push(seq); }
  if (duration !== undefined) { fields.push('duration = ?'); values.push(duration); }
  if (startTime !== undefined) { fields.push('startTime = ?'); values.push(startTime); }
  if (endTime !== undefined) { fields.push('endTime = ?'); values.push(endTime); }

  fields.push('updatedAt = ?'); values.push(new Date().toISOString());
  values.push(id);

  db.run(
    `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (this.changes === 0) {
        res.status(404).json({ error: 'Task not found' });
      } else {
        res.json({ success: true });
      }
    }
  );
});

// Delete task
app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM tasks WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (this.changes === 0) {
      res.status(404).json({ error: 'Task not found' });
    } else {
      res.json({ success: true });
    }
  });
});

// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) console.error(err);
    console.log('Database connection closed');
    process.exit(0);
  });
});
