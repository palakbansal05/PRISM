import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import EndpointTable from '../components/EndpointTable';
import './EndpointsPage.css';

export default function EndpointsPage() {
  const [endpoints, setEndpoints] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    url: '',
    method: 'GET',
    expectedStatus: 200,
    intervalSeconds: 60,
    expectedResponseMs: 5000,
    timeoutSeconds: 60,
    headers: '',
    body: '',
    alertEmail: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchEndpoints = useCallback(async () => {
    try {
      const res = await api.get('/endpoints');
      setEndpoints(res.data.endpoints || []);
    } catch (err) {
      console.error('Failed to fetch endpoints:', err);
    }
  }, []);

  useEffect(() => {
    fetchEndpoints();
  }, [fetchEndpoints]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/endpoints', {
        ...form,
        expectedStatus: Number(form.expectedStatus),
        intervalSeconds: Number(form.intervalSeconds),
        expectedResponseMs: Number(form.expectedResponseMs),
        timeoutSeconds: Number(form.timeoutSeconds),
        headers: form.headers || '{}',
      });
      setShowModal(false);
      setForm({
        name: '',
        url: '',
        method: 'GET',
        expectedStatus: 200,
        intervalSeconds: 60,
        expectedResponseMs: 5000,
        timeoutSeconds: 60,
        headers: '',
        body: '',
        alertEmail: '',
      });
      fetchEndpoints();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create endpoint.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this endpoint and all its ping history?')) return;
    try {
      await api.delete(`/endpoints/${id}`);
      fetchEndpoints();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const updateField = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="endpoints-page">
      <div className="endpoints-header">
        <h1>Endpoints</h1>
        <button className="add-endpoint-btn" onClick={() => setShowModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Endpoint
        </button>
      </div>

      <div className="endpoints-table-card">
        <EndpointTable endpoints={endpoints} showDelete onDelete={handleDelete} />
      </div>

      {/* Add Endpoint Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Endpoint</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {error && <div className="modal-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="modal-row">
                <div className="modal-field full">
                  <label>Name</label>
                  <input type="text" value={form.name} onChange={updateField('name')} placeholder="My API" required />
                </div>
              </div>
              <div className="modal-row">
                <div className="modal-field full">
                  <label>URL</label>
                  <input type="url" value={form.url} onChange={updateField('url')} placeholder="https://api.example.com/health" required />
                </div>
              </div>
              <div className="modal-row two-col">
                <div className="modal-field">
                  <label>Method</label>
                  <select value={form.method} onChange={updateField('method')}>
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
                <div className="modal-field">
                  <label>Expected Status</label>
                  <input type="number" value={form.expectedStatus} onChange={updateField('expectedStatus')} min="100" max="599" />
                </div>
              </div>
              <div className="modal-row">
                <div className="modal-field full">
                  <label>Check Interval</label>
                  <select value={form.intervalSeconds} onChange={updateField('intervalSeconds')}>
                    <option value="30">Every 30 seconds</option>
                    <option value="60">Every 1 minute</option>
                    <option value="300">Every 5 minutes</option>
                    <option value="600">Every 10 minutes</option>
                  </select>
                </div>
              </div>
              <div className="modal-row two-col">
                <div className="modal-field">
                  <label>Expected Response Time</label>
                  <select value={form.expectedResponseMs} onChange={updateField('expectedResponseMs')}>
                    <option value="1000">1 second</option>
                    <option value="2000">2 seconds</option>
                    <option value="5000">5 seconds</option>
                    <option value="10000">10 seconds</option>
                    <option value="30000">30 seconds</option>
                  </select>
                </div>
                <div className="modal-field">
                  <label>Timeout (Down Threshold)</label>
                  <select value={form.timeoutSeconds} onChange={updateField('timeoutSeconds')}>
                    <option value="60">60 seconds</option>
                    <option value="80">80 seconds</option>
                    <option value="100">100 seconds</option>
                  </select>
                </div>
              </div>
              <div className="modal-row">
                <div className="modal-field full">
                  <label>Headers <span className="optional">(JSON, optional)</span></label>
                  <textarea rows="2" value={form.headers} onChange={updateField('headers')} placeholder='{"Authorization": "Bearer token"}' />
                </div>
              </div>
              <div className="modal-row">
                <div className="modal-field full">
                  <label>Body <span className="optional">(optional)</span></label>
                  <textarea rows="2" value={form.body} onChange={updateField('body')} placeholder='{"key": "value"}' />
                </div>
              </div>
              <div className="modal-row">
                <div className="modal-field full">
                  <label>Alert Email <span className="optional">(optional)</span></label>
                  <input type="email" value={form.alertEmail} onChange={updateField('alertEmail')} placeholder="alerts@example.com" />
                </div>
              </div>
              <button type="submit" className="modal-submit" disabled={loading}>
                {loading ? 'Creating...' : 'Add Endpoint'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
