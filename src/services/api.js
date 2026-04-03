// API Service for communicating with the backend
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ==================== Users ====================

export const usersAPI = {
  async getAll() {
    try {
      const response = await fetch(`${API_URL}/users`);
      if (!response.ok) throw new Error('Failed to fetch users');
      return await response.json();
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  },

  async create(user) {
    try {
      const response = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });
      if (!response.ok) throw new Error('Failed to create user');
      return await response.json();
    } catch (error) {
      console.error('Error creating user:', error);
      return null;
    }
  },

  async login(email, password) {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }
      return await response.json();
    } catch (error) {
      console.error('Error logging in:', error);
      throw error;
    }
  },

  async getByEmail(email) {
    try {
      const response = await fetch(`${API_URL}/users/${email}`);
      if (!response.ok) throw new Error('User not found');
      return await response.json();
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  }
};

// ==================== Calendars ====================

export const calendarsAPI = {
  async create(calendar) {
    try {
      const response = await fetch(`${API_URL}/calendars`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(calendar)
      });
      if (!response.ok) throw new Error('Failed to create calendar');
      return await response.json();
    } catch (error) {
      console.error('Error creating calendar:', error);
      return null;
    }
  },

  async get(id) {
    try {
      const response = await fetch(`${API_URL}/calendars/${id}`);
      if (!response.ok) throw new Error('Calendar not found');
      return await response.json();
    } catch (error) {
      console.error('Error fetching calendar:', error);
      return null;
    }
  },

  async addNonWorkingDay(calendarId, dateKey) {
    try {
      const response = await fetch(`${API_URL}/calendars/${calendarId}/nonWorkingDays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateKey })
      });
      if (!response.ok) throw new Error('Failed to add non-working day');
      return await response.json();
    } catch (error) {
      console.error('Error adding non-working day:', error);
      return null;
    }
  },

  async removeNonWorkingDay(calendarId, dateKey) {
    try {
      const response = await fetch(`${API_URL}/calendars/${calendarId}/nonWorkingDays/${dateKey}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to remove non-working day');
      return await response.json();
    } catch (error) {
      console.error('Error removing non-working day:', error);
      return null;
    }
  }
};

// ==================== Companies ====================

export const companiesAPI = {
  async getByUserId(userId) {
    try {
      const response = await fetch(`${API_URL}/companies/user/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch companies');
      return await response.json();
    } catch (error) {
      console.error('Error fetching companies:', error);
      return [];
    }
  },

  async get(id) {
    try {
      const response = await fetch(`${API_URL}/companies/${id}`);
      if (!response.ok) throw new Error('Company not found');
      return await response.json();
    } catch (error) {
      console.error('Error fetching company:', error);
      return null;
    }
  },

  async create(company) {
    try {
      const response = await fetch(`${API_URL}/companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(company)
      });
      if (!response.ok) throw new Error('Failed to create company');
      return await response.json();
    } catch (error) {
      console.error('Error creating company:', error);
      return null;
    }
  },

  async update(id, updates) {
    try {
      const response = await fetch(`${API_URL}/companies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error('Failed to update company');
      return await response.json();
    } catch (error) {
      console.error('Error updating company:', error);
      return null;
    }
  },

  async delete(id) {
    try {
      const response = await fetch(`${API_URL}/companies/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete company');
      return await response.json();
    } catch (error) {
      console.error('Error deleting company:', error);
      return null;
    }
  }
};

// ==================== Schedules ====================

export const schedulesAPI = {
  async getByCompanyId(companyId) {
    try {
      const response = await fetch(`${API_URL}/schedules/company/${companyId}`);
      if (!response.ok) throw new Error('Failed to fetch schedules');
      return await response.json();
    } catch (error) {
      console.error('Error fetching schedules:', error);
      return [];
    }
  },

  async getByUserId(userId) {
    try {
      const response = await fetch(`${API_URL}/schedules/user/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch schedules');
      return await response.json();
    } catch (error) {
      console.error('Error fetching schedules:', error);
      return [];
    }
  },

  async get(id) {
    try {
      const response = await fetch(`${API_URL}/schedules/${id}`);
      if (!response.ok) throw new Error('Schedule not found');
      return await response.json();
    } catch (error) {
      console.error('Error fetching schedule:', error);
      return null;
    }
  },

  async create(schedule) {
    try {
      const response = await fetch(`${API_URL}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedule)
      });
      if (!response.ok) throw new Error('Failed to create schedule');
      return await response.json();
    } catch (error) {
      console.error('Error creating schedule:', error);
      return null;
    }
  },

  async update(id, updates) {
    try {
      const response = await fetch(`${API_URL}/schedules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error('Failed to update schedule');
      return await response.json();
    } catch (error) {
      console.error('Error updating schedule:', error);
      return null;
    }
  },

  async delete(id) {
    try {
      const response = await fetch(`${API_URL}/schedules/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete schedule');
      return await response.json();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      return null;
    }
  }
};
// ==================== Tasks ====================

export const tasksAPI = {
  async getByProjectId(projectId) {
    try {
      const response = await fetch(`${API_URL}/tasks/project/${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch tasks');
      return await response.json();
    } catch (error) {
      console.error('Error fetching tasks:', error);
      return [];
    }
  },

  async create(task) {
    try {
      const response = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
      });
      if (!response.ok) throw new Error('Failed to create task');
      return await response.json();
    } catch (error) {
      console.error('Error creating task:', error);
      return null;
    }
  },

  async update(id, updates) {
    try {
      const response = await fetch(`${API_URL}/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error('Failed to update task');
      return await response.json();
    } catch (error) {
      console.error('Error updating task:', error);
      return null;
    }
  },

  async delete(id) {
    try {
      const response = await fetch(`${API_URL}/tasks/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete task');
      return await response.json();
    } catch (error) {
      console.error('Error deleting task:', error);
      return null;
    }
  }
};
// ==================== Health Check ====================

export const healthAPI = {
  async check() {
    try {
      const response = await fetch(`${API_URL}/health`);
      return response.ok;
    } catch (error) {
      console.error('Backend not available:', error);
      return false;
    }
  }
};
