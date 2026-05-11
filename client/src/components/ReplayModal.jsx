import './ReplayModal.css';

export default function ReplayModal({ data, loading, onClose }) {
  if (!data) return null;

  const { original, replay, diff } = data;

  return (
    <div className="replay-overlay" onClick={onClose}>
      <div className="replay-modal" onClick={(e) => e.stopPropagation()}>
        <div className="replay-header">
          <h3>Incident Replay</h3>
          <button className="replay-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="replay-loading">
            <span className="replay-spinner"></span>
            <p>Replaying request...</p>
          </div>
        ) : (
          <>
            {/* Status comparison */}
            <div className="replay-comparison">
              <div className="replay-col">
                <span className="replay-col-label">Original</span>
                <div className={`replay-status-badge ${original.statusCode ? 'fail' : 'error'}`}>
                  {original.statusCode || 'Error'}
                </div>
                <span className="replay-latency">{original.latencyMs ? `${Math.round(original.latencyMs)}ms` : 'N/A'}</span>
                <span className="replay-time">{new Date(original.timestamp).toLocaleString()}</span>
              </div>

              <div className="replay-arrow">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>

              <div className="replay-col">
                <span className="replay-col-label">Replayed Now</span>
                <div className={`replay-status-badge ${replay.success ? 'success' : 'fail'}`}>
                  {replay.statusCode || 'Error'}
                </div>
                <span className="replay-latency">{replay.latencyMs ? `${Math.round(replay.latencyMs)}ms` : 'N/A'}</span>
                <span className="replay-time">Just now</span>
              </div>
            </div>

            {/* Diff Summary */}
            <div className="replay-diff">
              <h4>Diff Summary</h4>
              <div className="replay-diff-items">
                <div className="replay-diff-item">
                  <span className="replay-diff-label">Status Code</span>
                  <span className={`replay-diff-value ${diff.statusCodeChanged ? (diff.isResolved ? 'improved' : 'changed') : 'same'}`}>
                    {diff.statusCodeChanged
                      ? `${diff.oldStatusCode || 'Err'} → ${diff.newStatusCode || 'Err'}`
                      : 'No change'}
                  </span>
                </div>
                <div className="replay-diff-item">
                  <span className="replay-diff-label">Latency Delta</span>
                  <span className={`replay-diff-value ${diff.latencyDelta < 0 ? 'improved' : diff.latencyDelta > 0 ? 'worse' : 'same'}`}>
                    {diff.latencyDelta > 0 ? '+' : ''}{Math.round(diff.latencyDelta)}ms
                  </span>
                </div>
                <div className="replay-diff-item">
                  <span className="replay-diff-label">Resolution</span>
                  <span className={`replay-diff-value ${diff.isResolved ? 'improved' : 'worse'}`}>
                    {diff.isResolved ? '✓ Resolved' : '✗ Still failing'}
                  </span>
                </div>
              </div>
            </div>

            {replay.error && (
              <div className="replay-error">
                <strong>Error:</strong> {replay.error}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
