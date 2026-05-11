import './IncidentFeed.css';

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

export default function IncidentFeed({ incidents, onReplay }) {
  return (
    <div className="incident-feed">
      <h3 className="card-title">Recent Incidents</h3>
      <div className="incident-feed-list">
        {(!incidents || incidents.length === 0) ? (
          <div className="incident-feed-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="1.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <p>No incidents — all clear!</p>
          </div>
        ) : (
          incidents.map((inc) => {
            const ep = inc.endpointId;
            return (
              <div className="incident-item" key={inc._id}>
                <div className="incident-dot-col">
                  <span className={`incident-dot ${inc.success ? 'green' : 'red'}`}></span>
                </div>
                <div className="incident-info">
                  <span className="incident-title">{ep?.name || 'Unknown Endpoint'}</span>
                  <span className="incident-meta">
                    {ep?.method || 'GET'} &middot; {timeAgo(inc.timestamp)} &middot;{' '}
                    <span className={inc.statusCode ? '' : 'incident-err'}>
                      {inc.statusCode || 'Error'}
                    </span>
                  </span>
                  {inc.error && (
                    <span className="incident-error-msg">{inc.error}</span>
                  )}
                </div>
                <button
                  className="incident-replay-btn"
                  onClick={() => onReplay(ep?._id)}
                  title="Replay this request"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Replay
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
