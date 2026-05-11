import { useState } from 'react';
import api from '../api/axios';
import './SettingsPage.css';

export default function SettingsPage() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }

    setLoading(true);
    try {
      await api.put('/auth/password', { currentPassword, newPassword });
      setMessage({ type: 'success', text: 'Password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update password.' });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      {/* User Info Card */}
      <div className="settings-card">
        <h3>Profile</h3>
        <div className="settings-profile">
          <div className="settings-avatar">{getInitials(user.name)}</div>
          <div className="settings-profile-info">
            <div className="settings-field-row">
              <span className="settings-label">Name</span>
              <span className="settings-value">{user.name || 'N/A'}</span>
            </div>
            <div className="settings-field-row">
              <span className="settings-label">Email</span>
              <span className="settings-value">{user.email || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="settings-card">
        <h3>Change Password</h3>

        {message.text && (
          <div className={`settings-msg ${message.type}`}>{message.text}</div>
        )}

        <form onSubmit={handlePasswordChange}>
          <div className="settings-form-field">
            <label>Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <div className="settings-form-field">
            <label>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          <div className="settings-form-field">
            <label>Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" className="settings-submit" disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
