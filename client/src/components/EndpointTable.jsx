import { useEffect, useState } from 'react';
import api from '../api/axios';
import './EndpointTable.css';

function timeAgo(date) {
  if (!date) return 'Never';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function MethodBadge({ method }) {
  const colors = {
    GET: '#00FF41',
    POST: '#00FF7F',
    PUT: '#FFB647',
    DELETE: '#FF4757',
    PATCH: '#39FF78',
    HEAD: '#5A8068',
  };
  const color = colors[method] || '#6B7280';
  return (
    <span className="method-badge" style={{ color, borderColor: `${color}40`, background: `${color}12` }}>
      {method}
    </span>
  );
}

function StatusBadge({ endpoint }) {
  const lastPing = endpoint.lastPing;
  if (!lastPing) return <span className="status-badge neutral">Pending</span>;
  if (!lastPing.success) return <span className="status-badge down">Down</span>;
  if (lastPing.latencyMs > 1000) return <span className="status-badge slow">Slow</span>;
  return <span className="status-badge up">Up</span>;
}

function UptimeMinibar({ endpointId }) {
  const [buckets, setBuckets] = useState([]);

  useEffect(() => {
    api.get(`/stats/uptime-history/${endpointId}`)
      .then((res) => setBuckets(res.data.buckets || []))
      .catch(() => setBuckets([]));
  }, [endpointId]);

  const colorMap = { up: '#00FF7F', down: '#FF4757', slow: '#FFB647', empty: '#1A3A20' };

  return (
    <div className="uptime-minibar">
      <span className="uptime-minibar-label left">90d</span>
      <div className="uptime-minibar-bars">
        {buckets.length > 0
          ? buckets.map((b, i) => (
              <div
                key={i}
                className="uptime-bar"
                style={{ background: colorMap[b.status] || colorMap.empty }}
                title={`${b.status} (${b.successes}/${b.total} checks)`}
              />
            ))
          : Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="uptime-bar" style={{ background: colorMap.empty }} />
            ))}
      </div>
      <span className="uptime-minibar-label right">today</span>
    </div>
  );
}

export default function EndpointTable({ endpoints, showDelete = false, onDelete }) {
  return (
    <div className="endpoint-table-wrap">
      {(!endpoints || endpoints.length === 0) ? (
        <div className="endpoint-table-empty">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#5A8068" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          <p>No endpoints registered yet. Add one to get started.</p>
        </div>
      ) : (
        <table className="endpoint-table">
          <thead>
            <tr>
              <th>Method</th>
              <th>Endpoint</th>
              <th>Status</th>
              <th>Latency</th>
              <th>Uptime (90d)</th>
              <th>Last Checked</th>
              {showDelete && <th></th>}
            </tr>
          </thead>
          <tbody>
            {endpoints.map((ep) => (
              <tr key={ep._id}>
                <td><MethodBadge method={ep.method} /></td>
                <td>
                  <div className="ep-name-cell">
                    <span className="ep-name">{ep.name}</span>
                    <span className="ep-url">{ep.url}</span>
                  </div>
                </td>
                <td><StatusBadge endpoint={ep} /></td>
                <td className="ep-latency">
                  {ep.lastPing?.latencyMs ? `${Math.round(ep.lastPing.latencyMs)}ms` : '—'}
                </td>
                <td><UptimeMinibar endpointId={ep._id} /></td>
                <td className="ep-last-checked">{timeAgo(ep.lastChecked)}</td>
                {showDelete && (
                  <td>
                    <button className="ep-delete-btn" onClick={() => onDelete(ep._id)} title="Delete endpoint">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
