import React, { useState } from 'react';
import './App.css';
import Company from './models/company';
import User from './models/user';
import { companiesAPI, usersAPI, healthAPI, calendarsAPI, tasksAPI, schedulesAPI } from './services/api';

function App() {
  const WORK_START_HOUR = 9;
  const WORK_END_HOUR = 17; // exclusive end (workday is 9..17)
  const WORK_HOURS_PER_DAY = WORK_END_HOUR - WORK_START_HOUR;

  const [companies, setCompanies] = useState([]);
  const [companyName, setCompanyName] = useState('');
  const [editingCompanyId, setEditingCompanyId] = useState(null);
  const [editingCompanyName, setEditingCompanyName] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [calendarCompanyId, setCalendarCompanyId] = useState(null);
  const [newNonWorkingDate, setNewNonWorkingDate] = useState('');
  const [calendarRangeStart, setCalendarRangeStart] = useState('');
  const [calendarRangeEnd, setCalendarRangeEnd] = useState('');
  const [projectName, setProjectName] = useState('');

  // Authentication state
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [backendConnected, setBackendConnected] = useState(false);

  const groupTasksByResource = (tasks = []) => {
    return tasks.reduce((acc, task) => {
      const resourceKey = task.resource || '';
      if (!acc[resourceKey]) acc[resourceKey] = [];
      acc[resourceKey].push({
        id: task.id,
        name: task.name,
        resource: resourceKey,
        seq: task.seq || 0,
        duration: task.duration || 0,
        startTime: task.startTime || '',
        endTime: task.endTime || ''
      });
      acc[resourceKey].sort((a, b) => (a.seq || 0) - (b.seq || 0) || String(a.id).localeCompare(String(b.id)));
      return acc;
    }, {});
  };

  const hydrateCompanyFromBackend = async (companyRow) => {
    const calendarData = await calendarsAPI.get(companyRow.calendarId);
    const scheduleRows = await schedulesAPI.getByCompanyId(companyRow.id);

    const projects = await Promise.all((scheduleRows || []).map(async (schedule) => {
      const taskRows = await tasksAPI.getByProjectId(schedule.id);
      return {
        id: schedule.id,
        name: schedule.name,
        taskLists: groupTasksByResource(taskRows || []),
        taskInput: '',
        durationInput: '',
        resourceInput: '',
        startDate: schedule.startDate,
        endDate: schedule.endDate
      };
    }));

    return Company.fromObject({
      id: companyRow.id,
      name: companyRow.name,
      userId: companyRow.userId,
      projects,
      calendar: calendarData || {}
    });
  };

  const loadUsersFromBackend = async () => {
    const rows = await usersAPI.getAll();
    setUsers((rows || []).map((row) => User.fromObject(row)));
  };

  const loadCompaniesForUser = async (userId) => {
    if (!backendConnected || !userId) {
      setCompanies([]);
      return;
    }

    try {
      const companyRows = await companiesAPI.getByUserId(userId);
      const hydrated = await Promise.all((companyRows || []).map(hydrateCompanyFromBackend));
      setCompanies(hydrated);
    } catch (error) {
      console.error('Failed to load companies from backend:', error);
      setCompanies([]);
    }
  };

  const reloadCurrentUserData = async () => {
    if (currentUser?.id) {
      await loadCompaniesForUser(currentUser.id);
    }
  };

  // --- Work time helpers ---
  const isWeekend = (d) => {
    const day = d.getDay();
    return day === 0 || day === 6;
  };

  const setToWorkStart = (d, calendar = null) => {
    if (calendar && typeof calendar.setToWorkStart === 'function') return calendar.setToWorkStart(d);
    const r = new Date(d);
    r.setHours(WORK_START_HOUR, 0, 0, 0);
    return r;
  };

  const setToWorkEnd = (d, calendar = null) => {
    if (calendar && typeof calendar.setToWorkEnd === 'function') return calendar.setToWorkEnd(d);
    const r = new Date(d);
    r.setHours(WORK_END_HOUR, 0, 0, 0);
    return r;
  };

  // If date is during work hours on a weekday, return same date.
  // Otherwise return the next valid work start (9:00 on next weekday).
  const adjustToWorkStart = (date, calendar = null) => {
    if (calendar && typeof calendar.adjustToWorkStart === 'function') return calendar.adjustToWorkStart(date);

    let d = new Date(date);
    // If weekend -> move to next Monday at WORK_START_HOUR
    while (isWeekend(d)) {
      d.setDate(d.getDate() + 1);
      d = setToWorkStart(d);
    }
    const startOfDay = setToWorkStart(d);
    const endOfDay = setToWorkEnd(d);

    if (d < startOfDay) return startOfDay;
    if (d >= endOfDay) {
      // move to next day start (skip weekends)
      d.setDate(d.getDate() + 1);
      d = setToWorkStart(d);
      while (isWeekend(d)) d.setDate(d.getDate() + 1);
      return setToWorkStart(d);
    }
    // within working hours -> return as-is
    return d;
  };

  // Add N working hours to a start date/time, skipping weekends and outside hours.
  const addWorkingHours = (startDate, hours, calendar = null) => {
    if (calendar && typeof calendar.addWorkingHours === 'function') return calendar.addWorkingHours(startDate, hours);

    let remaining = hours;
    let cursor = adjustToWorkStart(startDate, calendar);

    while (remaining > 0) {
      const endOfDay = setToWorkEnd(cursor, calendar);
      const available = (endOfDay - cursor) / (1000 * 60 * 60); // in hours
      if (available <= 0) {
        // move to next workday start
        cursor.setDate(cursor.getDate() + 1);
        cursor = setToWorkStart(cursor, calendar);
        while (isWeekend(cursor)) cursor.setDate(cursor.getDate() + 1);
        cursor = setToWorkStart(cursor, calendar);
        continue;
      }
      if (remaining <= available) {
        // finish within this day
        const end = new Date(cursor.getTime() + remaining * 60 * 60 * 1000);
        return end;
      }
      // consume available and move to next workday
      remaining -= available;
      cursor.setDate(cursor.getDate() + 1);
      cursor = setToWorkStart(cursor, calendar);
      while (isWeekend(cursor)) cursor.setDate(cursor.getDate() + 1);
      cursor = setToWorkStart(cursor, calendar);
    }
    return cursor;
  };

  const formatDateTime = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleString();
  };

  // --- Authentication functions ---
  const handleLogin = async () => {
    if (!authEmail || !authPassword) {
      alert('Please enter email and password');
      return;
    }

    // Try backend login first if connected
    if (backendConnected) {
      try {
        const userData = await usersAPI.login(authEmail, authPassword);
        const user = User.fromObject(userData);
        setCurrentUser(user);
        setAuthEmail('');
        setAuthPassword('');
        return;
      } catch (error) {
        console.error('Backend login failed:', error);
        alert('Login failed: ' + error.message);
        return;
      }
    }

    alert('Backend not connected. Please start the backend server on port 5000.');
  };

  const handleSignup = async () => {
    if (!authEmail || !authPassword) {
      alert('Please enter email and password');
      return;
    }
    if (users.find(u => u.email === authEmail)) {
      alert('User already exists');
      return;
    }

    const userId = String(Date.now());
    const newUser = new User({ id: userId, email: authEmail });
    newUser.setPassword(authPassword); // keep local password hash for fallback

    const signUpEmail = authEmail;
    const signUpPassword = authPassword;

    try {
      console.log('Attempting to save user to backend...');
      const createdUser = await usersAPI.create({
        id: userId,
        email: signUpEmail,
        password: signUpPassword,
        createdAt: new Date().toISOString()
      });
      if (!createdUser) {
        alert('Failed to save user to backend.');
        return;
      }
      console.log('✓ User saved to database:', signUpEmail);
    } catch (error) {
      console.error('Backend save failed:', error);
      alert('Failed to save user to backend.');
      return;
    }

    setUsers(prev => [...prev, newUser]);
    setCurrentUser(newUser);
    setAuthEmail('');
    setAuthPassword('');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAuthMode('login');
  };

  React.useEffect(() => {
    loadCompaniesForUser(currentUser?.id);
  }, [backendConnected, currentUser]);

  // Check backend connectivity on mount
  React.useEffect(() => {
    const checkBackend = async () => {
      const isConnected = await healthAPI.check();
      setBackendConnected(isConnected);
      if (isConnected) {
        await loadUsersFromBackend();
      } else {
        setUsers([]);
        setCompanies([]);
      }
      if (isConnected) {
        console.log('✓ Backend connected successfully');
      } else {
        console.warn('✗ Backend not available. Please start the backend server.');
      }
    };
    checkBackend();
  }, []);

  // Load users
  React.useEffect(() => {
    if (backendConnected) {
      loadUsersFromBackend();
    }
  }, [backendConnected]);

  React.useEffect(() => {
    // Companies are persisted to the backend, not browser storage.
  }, [companies]);

  // Save users (without credentials)
  React.useEffect(() => {
    // Users are persisted to the backend, not browser storage.
  }, [users]);

  // Get current work day start (9 AM today if weekday, or next working day at 9 AM)
  const getCurrentWorkDay = (calendar = null) => {
    if (calendar && typeof calendar.adjustToWorkStart === 'function') return calendar.adjustToWorkStart(new Date());
    let d = new Date();
    if (isWeekend(d)) {
      while (isWeekend(d)) {
        d.setDate(d.getDate() + 1);
      }
    }
    return setToWorkStart(d);
  };

  // Calculate 2 weeks from a start date, ending on a workday (move to end of workday and adjust for weekends/non-working days)
  const getTwoWeeksFromStart = (startDate, calendar = null) => {
    let d = new Date(startDate);
    d.setDate(d.getDate() + 14);
    // Move to end of workday using calendar if provided
    d = setToWorkEnd(d, calendar);
    // If it's not a working day, move back until it is
    if (calendar && typeof calendar.isWorkingDay === 'function') {
      while (!calendar.isWorkingDay(d)) {
        d.setDate(d.getDate() - 1);
      }
      return d;
    }
    while (isWeekend(d)) {
      d.setDate(d.getDate() - 1);
    }
    return d;
  };

  // --- Project & task operations ---
  const handleSelectCompany = (companyId) => {
    setSelectedCompanyId(companyId === selectedCompanyId ? null : companyId);
    setSelectedProjectId(null); // Reset project selection when switching companies
  };

  const handleSelectProject = (projectId) => {
    setSelectedProjectId(projectId === selectedProjectId ? null : projectId);
  };

  const handleAddProject = async () => {
    if (!selectedCompanyId || !currentUser) return;
    if (!backendConnected) {
      alert('Backend not connected. Please start the backend server on port 5000.');
      return;
    }
    if (projectName.trim() === '') return;
    const company = companies.find(c => c.id === selectedCompanyId);
    if (!company) return;
    const startDate = getCurrentWorkDay(company.calendar);
    const endDate = getTwoWeeksFromStart(startDate, company.calendar);
    const projectId = String(Date.now());

    try {
      const created = await schedulesAPI.create({
        id: projectId,
        name: projectName.trim(),
        userId: currentUser.id,
        companyId: company.id,
        calendarId: `cal_${company.id}`,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      if (!created) {
        alert('Failed to save project to backend.');
        return;
      }
      setProjectName('');
      await reloadCurrentUserData();
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleAddCompany = async () => {
    if (!companyName || !companyName.trim()) return;
    if (!backendConnected || !currentUser) {
      alert('Backend not connected. Please start the backend server on port 5000.');
      return;
    }
    const companyId = String(Date.now());
    const c = new Company({ id: companyId, name: companyName.trim(), userId: currentUser.id });
    setCompanyName('');

    // Save to database if backend is connected
    if (backendConnected) {
      try {
        // Create calendar first
        const calendarId = `cal_${companyId}`;
        const createdCalendar = await calendarsAPI.create({
          id: calendarId,
          workStartHour: c.calendar.workStartHour,
          workEndHour: c.calendar.workEndHour
        });

        // Create company
        const createdCompany = createdCalendar ? await companiesAPI.create({
          id: companyId,
          name: c.name,
          userId: currentUser.id,
          calendarId: calendarId
        }) : null;
        if (!createdCalendar || !createdCompany) {
          alert('Failed to save company to backend.');
          return;
        }
        await loadCompaniesForUser(currentUser.id);
        console.log('✓ Company saved to database:', c.name);
      } catch (error) {
        console.error('Error saving company to database:', error);
      }
    }
  };

  const handleDeleteCompany = async (companyId) => {
    if (selectedCompanyId === companyId) setSelectedCompanyId(null);
    if (calendarCompanyId === companyId) setCalendarCompanyId(null);
    // Delete from database if backend is connected
    if (backendConnected) {
      try {
        await companiesAPI.delete(companyId);
        await reloadCurrentUserData();
        console.log('✓ Company deleted from database');
      } catch (error) {
        console.error('Error deleting company from database:', error);
      }
    }
  };

  const startEditCompany = (company) => {
    setEditingCompanyId(company.id);
    setEditingCompanyName(company.name || '');
  };

  const saveEditCompany = async () => {
    if (!editingCompanyId) return;
    setEditingCompanyId(null);
    setEditingCompanyName('');

    // Update in database if backend is connected
    if (backendConnected) {
      try {
        await companiesAPI.update(editingCompanyId, { name: editingCompanyName });
        await reloadCurrentUserData();
        console.log('✓ Company updated in database');
      } catch (error) {
        console.error('Error updating company in database:', error);
      }
    }
  };

  const handleSaveCompanyToDatabase = async (companyId) => {
    await reloadCurrentUserData();
    return;
    if (!backendConnected) {
      alert('Backend not connected. Please start the backend server on port 5000.');
      return;
    }

    const company = companies.find(c => c.id === companyId);
    if (!company) return;

    try {
      // Ensure the calendar exists in the database
      const calendarId = `cal_${companyId}`;
      await calendarsAPI.create({
        id: calendarId,
        workStartHour: company.calendar.workStartHour,
        workEndHour: company.calendar.workEndHour
      });

      // Save/update the company
      await companiesAPI.create({
        id: company.id,
        name: company.name,
        userId: company.userId,
        calendarId: calendarId
      });

      // Save all current projects as schedules in the database
      const now = new Date().toISOString();
      if (Array.isArray(company.projects)) {
        for (const project of company.projects) {
          if (!project || !project.id) continue;
          try {
            await schedulesAPI.create({
              id: String(project.id),
              name: project.name || 'Untitled Project',
              userId: company.userId,
              companyId: company.id,
              calendarId: calendarId,
              startDate: project.startDate || now,
              endDate: project.endDate || now,
              createdAt: now,
              updatedAt: now
            });
          } catch (scheduleError) {
            console.warn(`Warning: failed to save project schedule ${project.id}:`, scheduleError);
          }

          // Save tasks for this project
          const taskLists = project.taskLists || {};
          for (const resourceKey of Object.keys(taskLists)) {
            for (const task of (taskLists[resourceKey] || [])) {
              if (!task || !task.id) continue;
              try {
                await tasksAPI.create({
                  id: String(task.id),
                  scheduleId: String(project.id),
                  companyId: company.id,
                  userId: company.userId,
                  projectId: String(project.id),
                  name: task.name || 'Untitled Task',
                  resource: resourceKey || '',
                  seq: task.seq || 0,
                  duration: task.duration || 0,
                  startTime: task.startTime ? (new Date(task.startTime)).toISOString() : '',
                  endTime: task.endTime ? (new Date(task.endTime)).toISOString() : '',
                  createdAt: now,
                  updatedAt: now
                });
              } catch (taskError) {
                console.warn(`Warning: failed to save task ${task.id} for project ${project.id}:`, taskError);
              }
            }
          }
        }
      }

      alert(`✓ Company "${company.name}" and projects saved to database successfully!`);
    } catch (error) {
      console.error('Error saving company + projects:', error);
      alert(`Error saving company: ${error.message}`);
    }
  };

  // --- Company calendar handlers ---
  const openCalendar = (companyId) => {
    setCalendarCompanyId(companyId);
  };

  const recalcAllProjectsForCompany = (companyId) => {
    setCompanies(prev => prev.map(c => {
      if (c.id !== companyId) return c;
      const nc = Company.fromObject(c.toJSON());
      nc.projects = (nc.projects || []).map(project => {
        const taskLists = project.taskLists || {};
        const newLists = {};
        Object.keys(taskLists).forEach(k => {
          newLists[k] = recalcResourceList(taskLists[k] || [], 1, project.startDate, nc.calendar);
        });
        return { ...project, taskLists: newLists };
      });
      return nc;
    }));
  };

  const handleAddNonWorkingDay = async (dateString) => {
    if (!dateString || !calendarCompanyId) return;
    await calendarsAPI.addNonWorkingDay(`cal_${calendarCompanyId}`, dateString);
    await reloadCurrentUserData();
  };

  const handleRemoveNonWorkingDay = async (dateString) => {
    if (!dateString || !calendarCompanyId) return;
    await calendarsAPI.removeNonWorkingDay(`cal_${calendarCompanyId}`, dateString);
    await reloadCurrentUserData();
  };

  const handleToggleDateRange = async (startDateString, endDateString) => {
    if (!startDateString || !endDateString || !calendarCompanyId) return;
    
    // Parse dates as local time (date input format is YYYY-MM-DD)
    const [startYear, startMonth, startDay] = startDateString.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDateString.split('-').map(Number);
    const startDate = new Date(startYear, startMonth - 1, startDay);
    const endDate = new Date(endYear, endMonth - 1, endDay);
    
    if (startDate > endDate) {
      alert('Start date must be before end date');
      return;
    }

    const company = companies.find(c => c.id === calendarCompanyId);
    if (!company) return;

    const datesInRange = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      datesInRange.push(`${year}-${month}-${day}`);
      current.setDate(current.getDate() + 1);
    }

    const nonWorkingDays = company.calendar ? company.calendar.getNonWorkingDays() : [];
    const allNonWorking = datesInRange.every(dateStr => nonWorkingDays.includes(dateStr));

    for (const dateStr of datesInRange) {
      const [year, month, day] = dateStr.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      if (isWeekend(d)) continue;

      if (allNonWorking) {
        await calendarsAPI.removeNonWorkingDay(`cal_${calendarCompanyId}`, dateStr);
      } else if (!nonWorkingDays.includes(dateStr)) {
        await calendarsAPI.addNonWorkingDay(`cal_${calendarCompanyId}`, dateStr);
      }
    }

    await reloadCurrentUserData();
  };

  const handleDeleteProject = async (id) => {
    if (!backendConnected || !selectedCompanyId) return;
    const existingTasks = await tasksAPI.getByProjectId(String(id));
    for (const task of existingTasks || []) {
      await tasksAPI.delete(String(task.id));
    }
    await schedulesAPI.delete(String(id));
    await reloadCurrentUserData();
  };

  const handleProjectStartDateChange = async (projectId, dateString) => {
    if (!dateString || !selectedCompanyId) return;
    const company = companies.find(c => c.id === selectedCompanyId);
    const project = company?.projects?.find(p => p.id === projectId);
    if (!company || !project) return;
    const newStartDate = adjustToWorkStart(new Date(dateString), company.calendar);
    const newEndDate = (!project.endDate || new Date(project.endDate) < newStartDate)
      ? getTwoWeeksFromStart(newStartDate, company.calendar)
      : project.endDate;
    await schedulesAPI.update(String(projectId), {
      startDate: new Date(newStartDate).toISOString(),
      endDate: new Date(newEndDate).toISOString()
    });
    await reloadCurrentUserData();
  };

  const handleProjectEndDateChange = async (projectId, dateString) => {
    if (!dateString || !selectedCompanyId) return;
    const company = companies.find(c => c.id === selectedCompanyId);
    const project = company?.projects?.find(p => p.id === projectId);
    if (!project) return;
    await schedulesAPI.update(String(projectId), {
      endDate: new Date(adjustToWorkStart(new Date(dateString), company.calendar)).toISOString()
    });
    await reloadCurrentUserData();
  };

  const handleTaskInputChange = (projectId, value) => {
    if (!selectedCompanyId) return;
    setCompanies(prev => prev.map(c => {
      if (c.id !== selectedCompanyId) return c;
      const nc = Company.fromObject(c.toJSON());
      nc.projects = (nc.projects || []).map(project => project.id === projectId ? { ...project, taskInput: value } : project);
      return nc;
    }));
  };

  const handleDurationInputChange = (projectId, value) => {
    if (!selectedCompanyId) return;
    setCompanies(prev => prev.map(c => {
      if (c.id !== selectedCompanyId) return c;
      const nc = Company.fromObject(c.toJSON());
      nc.projects = (nc.projects || []).map(project => project.id === projectId ? { ...project, durationInput: value } : project);
      return nc;
    }));
  };

  const handleResourceInputChange = (projectId, value) => {
    if (!selectedCompanyId) return;
    setCompanies(prev => prev.map(c => {
      if (c.id !== selectedCompanyId) return c;
      const nc = Company.fromObject(c.toJSON());
      nc.projects = (nc.projects || []).map(project => project.id === projectId ? { ...project, resourceInput: value } : project);
      return nc;
    }));
  };

  const handleTaskResourceChange = async (projectId, taskId, value) => {
    if (!selectedCompanyId || !backendConnected) return;

    let updatedTask = null;
    const company = companies.find(c => c.id === selectedCompanyId);
    if (!company) return;

    const project = company.projects.find(p => p.id === projectId);
    if (!project) return;
    const lists = { ...(project.taskLists || {}) };
    const found = findTaskInLists(lists, taskId);
    if (!found) return;

    const { resourceKey: oldKey, task } = found;
    const newKey = (value || '').trim();

    lists[oldKey] = lists[oldKey].filter(t => t.id !== taskId);
    lists[oldKey] = resequenceTasksInList(lists[oldKey]);
    lists[oldKey] = recalcResourceList(lists[oldKey], 1, project.startDate, company.calendar);

    if (!lists[newKey]) lists[newKey] = [];
    const maxSeq = lists[newKey].reduce((m, t) => Math.max(m, t.seq || 0), 0);
    const moved = { ...task, resource: newKey, seq: maxSeq + 1 };
    lists[newKey] = [...lists[newKey], moved];
    lists[newKey] = resequenceTasksInList(lists[newKey]);
    lists[newKey] = recalcResourceList(lists[newKey], moved.seq || 1, project.startDate, company.calendar);

    updatedTask = lists[newKey].find(t => t.id === taskId) || moved;

    if (updatedTask) {
      try {
        await tasksAPI.update(String(updatedTask.id), {
          resource: updatedTask.resource,
          seq: updatedTask.seq,
          startTime: updatedTask.startTime ? new Date(updatedTask.startTime).toISOString() : '',
          endTime: updatedTask.endTime ? new Date(updatedTask.endTime).toISOString() : '',
          duration: updatedTask.duration
        });
        await reloadCurrentUserData();
      } catch (error) {
        console.warn('Failed to update task resource in database:', error);
      }
    }
  };

  // Recalculate tasks within a single resource list, for seq >= threshold.
  // If there are earlier tasks in the list, base on their endTime; otherwise use projectStartDate or now.
  const recalcResourceList = (tasks = [], threshold = 1, projectStartDate = null, calendar = null) => {
    const earlier = (tasks || []).filter(t => (t.seq || 0) < threshold)
      .sort((a, b) => (a.seq || 0) - (b.seq || 0) || (a.id - b.id));

    let baseStart;
    if (earlier.length) {
      baseStart = new Date(earlier[earlier.length - 1].endTime);
    } else if (projectStartDate) {
      baseStart = adjustToWorkStart(projectStartDate, calendar);
    } else {
      baseStart = adjustToWorkStart(new Date(), calendar);
    }

    const toRecalc = (tasks || []).filter(t => (t.seq || 0) >= threshold)
      .sort((a, b) => (a.seq || 0) - (b.seq || 0) || (a.id - b.id));

    const recalcedMap = {};
    let cursor = adjustToWorkStart(baseStart, calendar);
    for (const t of toRecalc) {
      const start = adjustToWorkStart(cursor, calendar);
      const dur = parseInt(t.duration, 10) || 0;
      const end = addWorkingHours(start, dur, calendar);
      recalcedMap[t.id] = { ...t, startTime: start, endTime: end };
      cursor = new Date(end);
    }

    return (tasks || []).map(t => recalcedMap[t.id] ? recalcedMap[t.id] : t);
  };

  const handleAddTask = async (projectId) => {
    if (!selectedCompanyId || !backendConnected) return;

    const tasksToSave = [];
    const company = companies.find(c => c.id === selectedCompanyId);
    const project = company?.projects?.find(p => p.id === projectId);
    if (!company || !project) return;
    if (!project.taskInput || project.taskInput.trim() === '' || !project.durationInput || isNaN(parseInt(project.durationInput, 10))) return;

    const duration = parseInt(project.durationInput, 10);
    const lists = { ...(project.taskLists || {}) };
    const resources = (project.resourceInput || '').split(',').map(r => r.trim()).filter(v => v !== '');
    if (resources.length === 0) resources.push('');

    resources.forEach(resKey => {
      if (!lists[resKey]) lists[resKey] = [];
      const seq = lists[resKey].reduce((m, t) => Math.max(m, (t.seq || 0)), 0) + 1;
      const last = lists[resKey].slice().sort((a, b) => (a.seq || 0) - (b.seq || 0)).slice(-1)[0];
      const rawStart = last ? new Date(last.endTime) : (project.startDate || new Date());
      const startTime = adjustToWorkStart(rawStart, company.calendar);
      const endTime = addWorkingHours(startTime, duration, company.calendar);
      tasksToSave.push({
        id: String(Date.now() + Math.floor(Math.random() * 1000)),
        scheduleId: String(project.id),
        companyId: company.id,
        userId: company.userId,
        projectId: String(project.id),
        name: project.taskInput,
        resource: resKey,
        seq,
        duration,
        startTime,
        endTime
      });
    });

    for (const task of tasksToSave) {
      try {
        await tasksAPI.create({
          id: task.id,
          scheduleId: task.scheduleId,
          companyId: task.companyId,
          userId: task.userId,
          projectId: task.projectId,
          name: task.name,
          resource: task.resource || '',
          seq: task.seq || 0,
          duration: task.duration || 0,
          startTime: task.startTime ? new Date(task.startTime).toISOString() : '',
          endTime: task.endTime ? new Date(task.endTime).toISOString() : '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        console.warn('Failed to save task to database:', error);
      }
    }
    await reloadCurrentUserData();
  };

  const handleDeleteTask = async (projectId, taskId) => {
    if (!selectedCompanyId || !backendConnected) return;
    try {
      await tasksAPI.delete(String(taskId));
      await reloadCurrentUserData();
    } catch (error) {
      console.warn('Failed to delete task from database:', error);
    }
  };

  const handleTaskSeqChange = async (projectId, taskId, newSeqRaw) => {
    if (!selectedCompanyId || !backendConnected) return;
    const newSeq = parseInt(newSeqRaw, 10);
    if (isNaN(newSeq)) return;

    let updatedTask = null;
    const company = companies.find(c => c.id === selectedCompanyId);
    const project = company?.projects?.find(p => p.id === projectId);
    const lists = { ...(project?.taskLists || {}) };
    const found = findTaskInLists(lists, taskId);
    if (!company || !project || !found) return;
    const { resourceKey } = found;

    lists[resourceKey] = lists[resourceKey].map(t => t.id === taskId ? { ...t, seq: newSeq } : t);
    lists[resourceKey] = resequenceTasksInList(lists[resourceKey]);
    const oldSeq = found.task ? (found.task.seq || 0) : 0;
    const threshold = Math.min(oldSeq || 1, newSeq || 1);
    lists[resourceKey] = recalcResourceList(lists[resourceKey], threshold, project.startDate, company.calendar);
    updatedTask = lists[resourceKey].find(t => t.id === taskId) || null;

    if (updatedTask) {
      try {
        await tasksAPI.update(String(updatedTask.id), {
          seq: updatedTask.seq,
          startTime: updatedTask.startTime ? new Date(updatedTask.startTime).toISOString() : '',
          endTime: updatedTask.endTime ? new Date(updatedTask.endTime).toISOString() : ''
        });
        await reloadCurrentUserData();
      } catch (error) {
        console.warn('Failed to update task sequence in database:', error);
      }
    }
  };

  const handleTaskDurationChange = async (projectId, taskId, newDurationRaw) => {
    if (!selectedCompanyId || !backendConnected) return;
    const newDuration = parseInt(newDurationRaw, 10);
    if (isNaN(newDuration)) return;

    let updatedTask = null;
    const company = companies.find(c => c.id === selectedCompanyId);
    const project = company?.projects?.find(p => p.id === projectId);
    const lists = { ...(project?.taskLists || {}) };
    const found = findTaskInLists(lists, taskId);
    if (!company || !project || !found) return;
    const { resourceKey } = found;

    lists[resourceKey] = lists[resourceKey].map(t => t.id === taskId ? { ...t, duration: newDuration } : t);
    const edited = lists[resourceKey].find(t => t.id === taskId);
    const threshold = edited.seq || 0;
    lists[resourceKey] = recalcResourceList(lists[resourceKey], threshold, project.startDate, company.calendar);
    updatedTask = lists[resourceKey].find(t => t.id === taskId) || null;

    if (updatedTask) {
      try {
        await tasksAPI.update(String(updatedTask.id), {
          duration: updatedTask.duration,
          startTime: updatedTask.startTime ? new Date(updatedTask.startTime).toISOString() : '',
          endTime: updatedTask.endTime ? new Date(updatedTask.endTime).toISOString() : ''
        });
        await reloadCurrentUserData();
      } catch (error) {
        console.warn('Failed to update task duration in database:', error);
      }
    }
  };

  const handleTaskStartTimeChange = async (projectId, taskId, newStartTimeString) => {
    if (!selectedCompanyId || !newStartTimeString || !backendConnected) return;

    let updatedTask = null;
    const company = companies.find(c => c.id === selectedCompanyId);
    const project = company?.projects?.find(p => p.id === projectId);
    const lists = { ...(project?.taskLists || {}) };
    const found = findTaskInLists(lists, taskId);
    if (!company || !project || !found) return;
    const { resourceKey, task } = found;

    const newStartTime = adjustToWorkStart(new Date(newStartTimeString), company.calendar);
    const newDuration = task.duration || 0;
    const newEndTime = addWorkingHours(newStartTime, newDuration, company.calendar);

    lists[resourceKey] = lists[resourceKey].map(t => t.id === taskId ? { ...t, startTime: newStartTime, endTime: newEndTime } : t);
    const threshold = (task.seq || 0) + 1;
    lists[resourceKey] = recalcResourceList(lists[resourceKey], threshold, project.startDate, company.calendar);
    updatedTask = lists[resourceKey].find(t => t.id === taskId) || null;

    if (updatedTask) {
      try {
        await tasksAPI.update(String(updatedTask.id), {
          startTime: updatedTask.startTime ? new Date(updatedTask.startTime).toISOString() : '',
          endTime: updatedTask.endTime ? new Date(updatedTask.endTime).toISOString() : '',
          duration: updatedTask.duration
        });
        await reloadCurrentUserData();
      } catch (error) {
        console.warn('Failed to update task timing in database:', error);
      }
    }
  };

  // Find a task in taskLists by id. Returns { resourceKey, task, index } or null.
  const findTaskInLists = (lists = {}, taskId) => {
    for (const key of Object.keys(lists)) {
      const idx = lists[key].findIndex(t => t.id === taskId);
      if (idx !== -1) return { resourceKey: key, task: lists[key][idx], index: idx };
    }
    return null;
  };

  // Resequence tasks to contiguous seq values within a list
  const resequenceTasksInList = (tasks) => {
    const sorted = (tasks || []).slice().sort((a, b) => (a.seq || 0) - (b.seq || 0) || (a.id - b.id));
    return sorted.map((t, i) => ({ ...t, seq: i + 1 }));
  };

  return (
    <div className="App">
      <header className="App-header">
        {currentUser ? (
          <>
            <h1>Project Manager</h1>
            <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
              <div style={{ marginBottom: '10px', fontSize: '0.9em' }}>
                <span style={{ marginRight: '12px' }}>
                  Backend: <span style={{ color: backendConnected ? '#28a745' : '#dc3545', fontWeight: 'bold' }}>
                    {backendConnected ? '✓ Connected' : '✗ Disconnected'}
                  </span>
                </span>
              </div>
              <span>Welcome, {currentUser.email} </span>
              <button onClick={handleLogout} style={{ marginLeft: '8px' }}>Logout</button>
            </div>

            {/* Views */}
            {calendarCompanyId ? (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <button onClick={() => setCalendarCompanyId(null)}>← Back</button>
              <h2 style={{ display: 'inline-block', marginLeft: '12px' }}>Calendar for {companies.find(c => c.id === calendarCompanyId)?.name || 'Unknown'}</h2>
            </div>

            <div style={{ marginBottom: '12px', padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
              <h3 style={{ marginTop: 0 }}>Add/Toggle Single Day</h3>
              <input type="date" value={newNonWorkingDate} onChange={e => setNewNonWorkingDate(e.target.value)} style={{ marginRight: '8px' }} />
              <button onClick={() => { handleAddNonWorkingDay(newNonWorkingDate); setNewNonWorkingDate(''); }}>Add non-working day</button>
            </div>

            <div style={{ marginBottom: '12px', padding: '10px', backgroundColor: '#f0f8ff', borderRadius: '4px' }}>
              <h3 style={{ marginTop: 0 }}>Add/Toggle Date Range</h3>
              <div>
                <label style={{ marginRight: '8px' }}>Start Date:</label>
                <input type="date" value={calendarRangeStart} onChange={e => setCalendarRangeStart(e.target.value)} style={{ marginRight: '12px' }} />
                <label style={{ marginRight: '8px' }}>End Date:</label>
                <input type="date" value={calendarRangeEnd} onChange={e => setCalendarRangeEnd(e.target.value)} style={{ marginRight: '8px' }} />
                <button onClick={() => { handleToggleDateRange(calendarRangeStart, calendarRangeEnd); setCalendarRangeStart(''); setCalendarRangeEnd(''); }}>Toggle Range</button>
              </div>
              <p style={{ fontSize: '0.9em', color: '#666', marginTop: '6px' }}>
                Select a range to mark all days (except weekends) as non-working, or select an existing non-working range to toggle it back to working days.
              </p>
            </div>

            <div>
              <h3>Non-working days</h3>
              <div>
                {(() => {
                  const company = companies.find(c => c.id === calendarCompanyId);
                  if (!company) return <div style={{ color: '#666' }}>Company not found</div>;
                  const days = company.calendar ? company.calendar.getNonWorkingDays() : [];
                  if (days.length === 0) return <div style={{ color: '#666' }}>No non-working days set</div>;
                  return (
                    <ul>
                      {days.map(d => (
                        <li key={d} style={{ marginBottom: '6px' }}>
                          {d}
                          <button onClick={() => handleRemoveNonWorkingDay(d)} style={{ marginLeft: '8px' }}>Delete</button>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </div>
            </div>
          </div>
        ) : !selectedCompanyId ? (
          <div>
            <h2>Companies</h2>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="New company name"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                style={{ marginRight: '8px' }}
              />
              <button onClick={handleAddCompany}>Add Company</button>
            </div>

            <div style={{ marginBottom: '12px' }}>
              {companies.length === 0 ? (
                <div style={{ color: '#666' }}>No companies yet — create a company to get started.</div>
              ) : (
                <ul>
                  {companies.filter(c => c.userId === currentUser.id).map(c => (
                    <li key={c.id} style={{ marginBottom: '6px' }}>
                      {editingCompanyId === c.id ? (
                        <span>
                          <input value={editingCompanyName} onChange={e => setEditingCompanyName(e.target.value)} style={{ marginRight: '8px' }} />
                          <button onClick={saveEditCompany}>Save</button>
                          <button onClick={() => { setEditingCompanyId(null); setEditingCompanyName(''); }} style={{ marginLeft: '6px' }}>Cancel</button>
                        </span>
                      ) : (
                        <span>
                          <strong style={{ cursor: 'pointer' }} onClick={() => handleSelectCompany(c.id)}>{c.name}</strong>
                          <button onClick={() => startEditCompany(c)} style={{ marginLeft: '8px' }}>Edit</button>
                          <button onClick={() => openCalendar(c.id)} style={{ marginLeft: '6px' }}>Calendar</button>
                          <button onClick={() => handleSaveCompanyToDatabase(c.id)} style={{ marginLeft: '6px' }}>Save</button>
                          <button onClick={() => handleDeleteCompany(c.id)} style={{ marginLeft: '6px' }}>Delete</button>
                          
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : selectedProjectId ? (
          /* Project Schedule View */
          <div>
            <div style={{ marginBottom: '12px' }}>
              <button onClick={() => handleSelectProject(selectedProjectId)}>← Back to Projects</button>
              <h2 style={{ display: 'inline-block', marginLeft: '12px' }}>
                Schedules for {companies.find(c => c.id === selectedCompanyId)?.projects.find(p => p.id === selectedProjectId)?.name || 'Unknown'}
              </h2>
            </div>



            <div style={{ border: '1px solid #e0e0e0', padding: '12px', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
              <h3>Project Details</h3>
              {(() => {
                const project = companies.find(c => c.id === selectedCompanyId)?.projects.find(p => p.id === selectedProjectId);
                if (!project) return null;
                return (
                  <div>
                    <p><strong>Project Name:</strong> {project.name}</p>
                    <p><strong>Start Date:</strong> {formatDateTime(project.startDate)}</p>
                    <p><strong>End Date:</strong> {formatDateTime(project.endDate)}</p>
                    <p><strong>Tasks:</strong> {Object.values(project.taskLists || {}).reduce((sum, tasks) => sum + (tasks?.length || 0), 0)}</p>
                  </div>
                );
              })()}
            </div>
          </div>
        ) : (
          /* Project Management View for Selected Company */
          <div>
            <div style={{ marginBottom: '12px' }}>
              <button onClick={() => handleSelectCompany(selectedCompanyId)}>← Back to Companies</button>
              <h2 style={{ display: 'inline-block', marginLeft: '12px' }}>Projects for {companies.find(c => c.id === selectedCompanyId)?.name || 'Unknown'}</h2>
              <button onClick={() => openCalendar(selectedCompanyId)} style={{ marginLeft: '8px' }}>Calendar</button>
            </div>

            <div style={{ backgroundColor: '#f0f0f0', padding: '12px', borderRadius: '4px', marginBottom: '12px' }}>
              <p style={{ margin: '0', color: '#666' }}>
                Saving a company now also saves each project as a schedule to the backend database. After company save, schedules are persisted (except task-level rows, which still remain local for now).
              </p>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="New project name"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
              />
              <button onClick={handleAddProject}>Add Project</button>
            </div>

            <div>
              {(() => {
                const company = companies.find(c => c.id === selectedCompanyId);
                const projects = company?.projects || [];
                return projects.length === 0 ? (
                  <div style={{ color: '#666' }}>No projects yet</div>
                ) : (
                  projects.map(project => (
                    <div key={project.id} style={{ border: '1px solid #ccc', margin: '10px', padding: '10px' }}>
                      <h2>
                        <strong style={{ cursor: 'pointer', color: '#0066cc' }} onClick={() => handleSelectProject(project.id)}>
                          {project.name}
                        </strong>
                        <span style={{ fontSize: '0.7em', color: '#666', marginLeft: '10px' }}>
                          (ID: {project.id})
                        </span>
                        <button style={{ marginLeft: '10px' }} onClick={() => handleDeleteProject(project.id)}>
                          Delete Project
                        </button>
                      </h2>

                      <div style={{ marginBottom: '12px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                        <div style={{ marginBottom: '8px' }}>
                          <label style={{ marginRight: '15px', fontSize: '0.9em' }}>
                            Project Start Date:
                            <input
                              type="datetime-local"
                              value={project.startDate ? new Date(project.startDate).toISOString().slice(0, 16) : ''}
                              onChange={e => handleProjectStartDateChange(project.id, e.target.value)}
                              style={{ margin: '0 6px', width: '160px' }}
                            />
                            <span style={{ marginLeft: '6px', fontSize: '0.85em', color: '#666' }}>
                              {formatDateTime(project.startDate)}
                            </span>
                          </label>
                        </div>
                        <div>
                          <label style={{ marginRight: '15px', fontSize: '0.9em' }}>
                            Project End Date:
                            <input
                              type="datetime-local"
                              value={project.endDate ? new Date(project.endDate).toISOString().slice(0, 16) : ''}
                              onChange={e => handleProjectEndDateChange(project.id, e.target.value)}
                              style={{ margin: '0 6px', width: '160px' }}
                            />
                            <span style={{ marginLeft: '6px', fontSize: '0.85em', color: '#666' }}>
                              {formatDateTime(project.endDate)}
                            </span>
                          </label>
                        </div>
                      </div>

                      <div>
                        <input
                          type="text"
                          placeholder="New task"
                          value={project.taskInput}
                          onChange={e => handleTaskInputChange(project.id, e.target.value)}
                          style={{ marginRight: '8px' }}
                        />
                        <input
                          type="number"
                          min="1"
                          placeholder="Duration (hours)"
                          value={project.durationInput || ''}
                          onChange={e => handleDurationInputChange(project.id, e.target.value)}
                          style={{ width: '120px', marginRight: '8px' }}
                        />
                        <input
                          type="text"
                          placeholder="Resource (optional)"
                          value={project.resourceInput || ''}
                          onChange={e => handleResourceInputChange(project.id, e.target.value)}
                          style={{ width: '160px', marginRight: '8px' }}
                        />
                        <button onClick={() => handleAddTask(project.id)}>Add Task</button>
                      </div>

                      {/* Render persisted taskLists grouped by resource */}
                      <div>
                        {(() => {
                          const lists = project.taskLists || {};
                          const resourceKeys = Object.keys(lists).sort((a, b) => (a || '').localeCompare(b || ''));
                          if (resourceKeys.length === 0) return <div style={{ color: '#666' }}>No tasks</div>;
                          return resourceKeys.map(resourceKey => (
                            <div key={resourceKey || '__unassigned__'} style={{ marginBottom: '12px' }}>
                              <h3 style={{ margin: '6px 0' }}>Resource: {resourceKey || '(Unassigned)'}</h3>
                              <ul>
                                {lists[resourceKey]
                                  .slice()
                                  .sort((a, b) => (a.seq || 0) - (b.seq || 0) || (a.id - b.id))
                                  .map(task => (
                                    <li key={task.id} style={{ marginBottom: '8px' }}>
                                      <label style={{ marginRight: '8px', fontSize: '0.9em' }}>
                                        Seq:
                                        <input
                                          type="number"
                                          value={task.seq || 0}
                                          onChange={e => handleTaskSeqChange(project.id, task.id, e.target.value)}
                                          style={{ width: '70px', marginLeft: '6px' }}
                                        />
                                      </label>

                                      <strong style={{ color: (project.endDate && task.endTime && (new Date(task.endTime).getTime() > new Date(project.endDate).getTime())) ? 'crimson' : undefined }}>{task.name}</strong>
                                      <span style={{ fontSize: '0.8em', color: '#666', marginLeft: '8px' }}>
                                        (Task ID: {task.id})
                                      </span>

                                      <div style={{ marginTop: '6px', fontSize: '0.95em', color: '#555' }}>
                                        Start:
                                        <input
                                          type="datetime-local"
                                          value={task.startTime ? new Date(task.startTime).toISOString().slice(0, 16) : ''}
                                          onChange={e => handleTaskStartTimeChange(project.id, task.id, e.target.value)}
                                          style={{ margin: '0 6px', width: '160px' }}
                                        />
                                        {formatDateTime(task.startTime)} |
                                        Duration:
                                        <input
                                          type="number"
                                          min="1"
                                          value={task.duration}
                                          onChange={e => handleTaskDurationChange(project.id, task.id, e.target.value)}
                                          style={{ width: '60px', margin: '0 6px' }}
                                        />
                                        h | End: {formatDateTime(task.endTime)}
                                      </div>

                                      <div style={{ marginTop: '6px' }}>
                                        Resource:
                                        <input
                                          type="text"
                                          value={task.resource || ''}
                                          onChange={e => handleTaskResourceChange(project.id, task.id, e.target.value)}
                                          style={{ marginLeft: '8px', width: '180px' }}
                                        />
                                      </div>

                                      <button style={{ marginLeft: '10px', marginTop: '6px' }} onClick={() => handleDeleteTask(project.id, task.id)}>
                                        Delete Task
                                      </button>
                                      {project.endDate && task.endTime && (new Date(task.endTime).getTime() > new Date(project.endDate).getTime()) && (
                                        <div style={{ color: 'crimson', marginTop: '6px', fontSize: '0.9em' }}>
                                          Task exceeds project end date! Either extend project or remove tasks.
                                        </div>
                                      )}
                                    </li>
                                  ))}
                              </ul>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  ))
                );
              })()}
            </div>
          </div>
        )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <h1>Project Manager</h1>
            <h2>{authMode === 'login' ? 'Login' : 'Sign Up'}</h2>
            <div style={{ marginBottom: '20px' }}>
              <input
                type="email"
                placeholder="Email"
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                style={{ display: 'block', margin: '10px auto', padding: '10px', width: '200px' }}
              />
              <input
                type="password"
                placeholder="Password"
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                style={{ display: 'block', margin: '10px auto', padding: '10px', width: '200px' }}
              />
              <button
                onClick={authMode === 'login' ? handleLogin : handleSignup}
                style={{ padding: '10px 20px', margin: '10px' }}
              >
                {authMode === 'login' ? 'Login' : 'Sign Up'}
              </button>
            </div>
            <div>
              {authMode === 'login' ? (
                <p>Don't have an account? <button onClick={() => setAuthMode('signup')}>Sign Up</button></p>
              ) : (
                <p>Already have an account? <button onClick={() => setAuthMode('login')}>Login</button></p>
              )}
            </div>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
