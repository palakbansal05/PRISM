import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import LatencyChart from '../components/LatencyChart';
import IncidentFeed from '../components/IncidentFeed';
import EndpointTable from '../components/EndpointTable';
import ReplayModal from '../components/ReplayModal';
import './OverviewPage.css';

export default function OverviewPage() {
  const [stats, setStats] = useState({
    totalEndpoints: 0,
    overallUptimePercent: 100,
    activeIncidentsCount: 0,
    avgLatency: 0,
  });
  const [endpoints, setEndpoints] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [replayData, setReplayData] = useState(null);
  const [replayLoading, setReplayLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, endpointsRes, incidentsRes] = await Promise.all([
        api.get('/stats'),
        api.get('/endpoints'),
        api.get('/incidents'),
      ]);
      setStats(statsRes.data);
      setEndpoints(endpointsRes.data.endpoints || []);
      setIncidents(incidentsRes.data.incidents || []);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleReplay = async (endpointId) => {
    setReplayLoading(true);
    try {
      const res = await api.post(`/incidents/replay/${endpointId}`);
      setReplayData(res.data);
    } catch (err) {
      console.error('Replay failed:', err);
    } finally {
      setReplayLoading(false);
    }
  };

  const statCards = [
    {
      label: 'TOTAL ENDPOINTS',
      value: stats.totalEndpoints,
      sub: 'Monitored',
      subColor: '#00D4FF',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
      ),
    },
    {
      label: 'OVERALL UPTIME',
      value: `${stats.overallUptimePercent}%`,
      sub: 'Last 24 hours',
      subColor: '#00E68A',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
      ),
    },
    {
      label: 'ACTIVE INCIDENTS',
      value: stats.activeIncidentsCount,
      sub: stats.activeIncidentsCount > 0 ? 'Needs attention' : 'All clear',
      subColor: stats.activeIncidentsCount > 0 ? '#FF4757' : '#00E68A',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      ),
    },
    {
      label: 'AVG LATENCY',
      value: `${stats.avgLatency}ms`,
      sub: 'P50 (24h median)',
      subColor: '#FFB647',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      ),
    },
  ];

  return (
    <div className="overview">
      <div className="overview-header">
        <h1>Overview</h1>
        <span className="overview-live-badge">
          <span className="pulse-dot"></span> Live
        </span>
      </div>

      {/* Stat Cards */}
      <div className="stat-cards">
        {statCards.map((card, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-card-top">
              <span className="stat-card-label">{card.label}</span>
              <div className="stat-card-icon" style={{ color: card.subColor }}>{card.icon}</div>
            </div>
            <div className="stat-card-value">{card.value}</div>
            <div className="stat-card-sub" style={{ color: card.subColor }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Middle: Latency Chart + Incident Feed */}
      <div className="overview-mid">
        <div className="overview-card overview-chart-card">
          <LatencyChart endpoints={endpoints} />
        </div>
        <div className="overview-card overview-incidents-card">
          <IncidentFeed incidents={incidents} onReplay={handleReplay} />
        </div>
      </div>

      {/* Endpoint Status Table */}
      <div className="overview-card overview-table-card">
        <h3 className="card-title">Endpoint Status</h3>
        <EndpointTable endpoints={endpoints} />
      </div>

      {/* Replay Modal */}
      {replayData && (
        <ReplayModal data={replayData} loading={replayLoading} onClose={() => setReplayData(null)} />
      )}
    </div>
  );
}
