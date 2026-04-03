import Calendar from './calendar';

class Company {
  constructor(opts = {}) {
    this.id = opts.id || String(Date.now());
    this.name = opts.name || 'New Company';
    this.userId = opts.userId || '';
    this.projects = (opts.projects || []).map(p => p);
    this.calendar = opts.calendar instanceof Calendar ? opts.calendar : Calendar.fromObject(opts.calendar || {});
  }

  addProject(project) {
    if (!this.projects.find(p => p.id === project.id)) {
      this.projects = [...this.projects, project];
    }
  }

  removeProject(projectId) {
    this.projects = (this.projects || []).filter(p => p.id !== projectId);
  }

  getProject(projectId) {
    return (this.projects || []).find(p => p.id === projectId) || null;
  }

  updateProject(projectId, updates) {
    const idx = (this.projects || []).findIndex(p => p.id === projectId);
    if (idx !== -1) {
      this.projects[idx] = { ...this.projects[idx], ...updates };
    }
  }

  toJSON() {
    return { id: this.id, name: this.name, userId: this.userId, projects: this.projects || [], calendar: this.calendar ? this.calendar.toJSON() : {} };
  }

  static fromObject(obj = {}) {
    const c = new Company({ id: obj.id, name: obj.name, userId: obj.userId, projects: obj.projects || [], calendar: obj.calendar || {} });
    return c;
  }
}

export default Company;
