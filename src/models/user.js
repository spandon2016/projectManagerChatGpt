import CryptoJS from 'crypto-js';

class User {
  constructor(opts = {}) {
    this.id = opts.id || String(Date.now());
    this.email = opts.email || '';
    this.passwordHash = opts.passwordHash || '';
    this.role = opts.role || 'user';
    this.createdAt = opts.createdAt || new Date();
  }

  // Note: Password hashing is now handled by the backend with argon2
  // This method is kept for backward compatibility with local storage
  static hashPassword(password) {
    return CryptoJS.SHA256(password).toString();
  }

  setPassword(password) {
    this.passwordHash = User.hashPassword(password);
  }

  checkPassword(password) {
    return this.passwordHash === User.hashPassword(password);
  }

  toJSON() {
    // Never include passwordHash in cached data (localStorage)
    return {
      id: this.id,
      email: this.email,
      role: this.role,
      createdAt: this.createdAt
    };
  }

  static fromObject(obj = {}) {
    const user = new User({
      id: obj.id,
      email: obj.email,
      passwordHash: obj.passwordHash,
      role: obj.role || 'user',
      createdAt: obj.createdAt ? new Date(obj.createdAt) : new Date()
    });
    return user;
  }
}

export default User;