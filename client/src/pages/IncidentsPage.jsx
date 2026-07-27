import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import ReplayModal from '../components/ReplayModal';
import './IncidentsPage.css';

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(startedAt, resolvedAt) {
  const start = new Date(startedAt).getTime();
  const end = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  const ms = end - start;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState([]);
  const [replayData, setReplayData] = useState(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [inlineReplay, setInlineReplay] = useState({}); // endpointId -> replay data

  const fetchIncidents = useCallback(async () => {
    try {
      const res = await api.get('/incidents');
      setIncidents(res.data.incidents || []);
    } catch (err) {
      console.error('Failed to fetch incidents:', err);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const handleReplay = async (endpointId, inline = false) => {
    if (inline) {
      setInlineReplay((prev) => ({ ...prev, [endpointId]: { loading: true } }));
    } else {
      setReplayLoading(true);
    }

    try {
      const res = await api.post(`/incidents/replay/${endpointId}`);
      if (inline) {
        setInlineReplay((prev) => ({ ...prev, [endpointId]: { loading: false, data: res.data } }));
      } else {
        setReplayData(res.data);
      }
    } catch (err) {
      console.error('Replay failed:', err);
      if (inline) {
        setInlineReplay((prev) => ({
          ...prev,
          [endpointId]: { loading: false, error: err.response?.data?.error || 'Replay failed' },
        }));
      }
    } finally {
      setReplayLoading(false);
    }
  };

  return (
    <div className="incidents-page">
      <div className="incidents-header">
        <h1>Incidents</h1>
        <span className="incidents-count">{incidents.length} total</span>
      </div>

      <div className="incidents-list-card">
        {incidents.length === 0 ? (
          <div className="incidents-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="1.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <p>No incidents recorded. All endpoints are healthy!</p>
          </div>
        ) : (
          <div className="incidents-list">
            <div className="incident-row-header">
              <div className="incident-row-dot"></div>
              <div className="incident-row-info">Endpoint</div>
              <div className="incident-row-status">Status</div>
              <div className="incident-row-duration">Duration</div>
              <div className="incident-row-failures">Failures</div>
              <div className="incident-row-time">Started</div>
              <div className="incident-replay-btn" style={{ visibility: 'hidden' }}>Replay</div>
            </div>
            {incidents.map((inc) => {
              const ep = inc.endpointId;
              const epId = ep?._id;
              const replay = inlineReplay[epId];
              const isActive = inc.status === 'ACTIVE';
              const canReplay = Boolean(epId);

              return (
                <div className="incident-row" key={inc._id}>
                  <div className="incident-row-main">
                    <div className="incident-row-dot">
                      <span className={`incident-dot ${isActive ? 'red' : 'green'}`}></span>
                    </div>
                    <div className="incident-row-info">
                      <span className="incident-row-name">{ep?.name || 'Unknown'}</span>
                      <span className="incident-row-url">{ep?.url || ''}</span>
                    </div>
                    <div className="incident-row-status">
                      <span className={`incident-status-badge ${isActive ? 'active' : 'resolved'}`}>
                        {isActive ? 'ACTIVE' : 'RESOLVED'}
                      </span>
                    </div>
                    <div className="incident-row-duration">
                      {formatDuration(inc.startedAt, inc.resolvedAt)}
                    </div>
                    <div className="incident-row-failures">
                      {inc.failureCount} failure{inc.failureCount !== 1 ? 's' : ''}
                    </div>
                    <div className="incident-row-time">{timeAgo(inc.startedAt)}</div>
                    <button
                      className="incident-replay-btn"
                      onClick={() => handleReplay(epId, true)}
                      disabled={!canReplay || replay?.loading}
                    >
                      {replay?.loading ? (
                        <span className="mini-spinner"></span>
                      ) : !canReplay ? (
                        'Unavailable'
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                          Replay
                        </>
                      )}
                    </button>
                  </div>

                  {/* Inline diff panel */}
                  {replay?.data && (
                    <div className="incident-inline-diff">
                      <div className="inline-diff-row">
                        <span className="inline-diff-label">Status</span>
                        <span className={`inline-diff-value ${replay.data.diff.isResolved ? 'improved' : 'worse'}`}>
                          {replay.data.diff.oldStatusCode || 'Err'} → {replay.data.diff.newStatusCode || 'Err'}
                        </span>
                      </div>
                      <div className="inline-diff-row">
                        <span className="inline-diff-label">Latency</span>
                        <span className={`inline-diff-value ${replay.data.diff.latencyDelta < 0 ? 'improved' : 'worse'}`}>
                          {replay.data.diff.latencyDelta > 0 ? '+' : ''}{Math.round(replay.data.diff.latencyDelta)}ms
                        </span>
                      </div>
                      <div className="inline-diff-row">
                        <span className="inline-diff-label">Resolved</span>
                        <span className={`inline-diff-value ${replay.data.diff.isResolved ? 'improved' : 'worse'}`}>
                          {replay.data.diff.isResolved ? '✓ Yes' : '✗ No'}
                        </span>
                      </div>
                      <button className="inline-diff-close" onClick={() => setInlineReplay((prev) => { const n = {...prev}; delete n[epId]; return n; })}>
                        Dismiss
                      </button>
                    </div>
                  )}

                  {replay?.error && (
                    <div className="incident-inline-error">{replay.error}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {replayData && (
        <ReplayModal data={replayData} loading={replayLoading} onClose={() => setReplayData(null)} />
      )}
    </div>
  );
}
