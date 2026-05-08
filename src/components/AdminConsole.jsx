import React, { useState, useEffect } from 'react';
import { usersAPI } from '../services/api';

function AdminConsole({ currentUser, onLogout }) {
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ id: '', email: '', password: '', role: 'user' });
  const [resetPassword, setResetPassword] = useState({ userId: '', newPassword: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      loadUsers();
    }
  }, [currentUser]);

  const loadUsers = async () => {
    try {
      const data = await usersAPI.getAllAdmin(currentUser.id);
      setUsers(data);
    } catch (error) {
      setMessage('Error loading users');
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await usersAPI.createAdmin(newUser, currentUser.id);
      setMessage('User added successfully');
      setNewUser({ id: '', email: '', password: '', role: 'user' });
      loadUsers();
    } catch (error) {
      setMessage('Error adding user');
    }
    setLoading(false);
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await usersAPI.deleteAdmin(userId, currentUser.id);
      setMessage('User deleted successfully');
      loadUsers();
    } catch (error) {
      setMessage('Error deleting user');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetPassword.userId || !resetPassword.newPassword) {
      setMessage('Please select a user and enter a password');
      return;
    }
    setLoading(true);
    try {
      await usersAPI.resetPasswordAdmin(resetPassword.userId, resetPassword.newPassword, currentUser.id);
      setMessage('Password reset successfully');
      setResetPassword({ userId: '', newPassword: '' });
      loadUsers();
    } catch (error) {
      setMessage('Error resetting password: ' + error.message);
    }
    setLoading(false);
  };

  if (currentUser?.role !== 'admin') {
    return <div>Access denied. Admin role required.</div>;
  }

  return (
    <div className="admin-console">
      <h2>Admin Console</h2>
      <button onClick={onLogout}>Logout</button>
      
      {message && <p>{message}</p>}

      <h3>Users</h3>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Email</th>
            <th>Role</th>
            <th>Created At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              <td>{user.id}</td>
              <td>{user.email}</td>
              <td>{user.role}</td>
              <td>{user.createdAt}</td>
              <td>
                <button onClick={() => handleDeleteUser(user.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Add User</h3>
      <form onSubmit={handleAddUser}>
        <input
          type="text"
          placeholder="User ID"
          value={newUser.id}
          onChange={(e) => setNewUser({...newUser, id: e.target.value})}
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={newUser.email}
          onChange={(e) => setNewUser({...newUser, email: e.target.value})}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={newUser.password}
          onChange={(e) => setNewUser({...newUser, password: e.target.value})}
          required
        />
        <select
          value={newUser.role}
          onChange={(e) => setNewUser({...newUser, role: e.target.value})}
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" disabled={loading}>Add User</button>
      </form>

      <h3>Reset Password</h3>
      <form onSubmit={handleResetPassword}>
        <select
          value={resetPassword.userId}
          onChange={(e) => setResetPassword({...resetPassword, userId: e.target.value})}
          required
        >
          <option value="">Select User</option>
          {users.map(user => (
            <option key={user.id} value={user.id}>{user.email}</option>
          ))}
        </select>
        <input
          type="password"
          placeholder="New Password"
          value={resetPassword.newPassword}
          onChange={(e) => setResetPassword({...resetPassword, newPassword: e.target.value})}
          required
        />
        <button type="submit" disabled={loading}>Reset Password</button>
      </form>
    </div>
  );
}

export default AdminConsole;