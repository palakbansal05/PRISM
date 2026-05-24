import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../api/axios';
import './LatencyChart.css';

export default function LatencyChart({ endpoints }) {
  const [range, setRange] = useState('24h');
  const [data, setData] = useState([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);

  useEffect(() => {
    if (endpoints.length > 0 && !selectedEndpoint) {
      setSelectedEndpoint(endpoints[0]._id);
    }
  }, [endpoints, selectedEndpoint]);

  useEffect(() => {
    if (!selectedEndpoint) return;

    const fetchLatency = async () => {
      try {
        const res = await api.get(`/stats/latency/${selectedEndpoint}?range=${range}`);
        const points = (res.data.dataPoints || []).map((dp) => ({
          ...dp,
          time: new Date(dp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }));
        setData(points);
      } catch (err) {
        console.error('Failed to fetch latency data:', err);
      }
    };

    fetchLatency();
  }, [selectedEndpoint, range]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="chart-tooltip">
        <p className="chart-tooltip-time">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }} className="chart-tooltip-line">
            {p.name}: <strong>{Math.round(p.value)}ms</strong>
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="latency-chart">
      <div className="latency-chart-header">
        <h3 className="card-title">Latency Trend</h3>
        <div className="latency-chart-controls">
          {endpoints.length > 1 && (
            <select
              className="latency-ep-select"
              value={selectedEndpoint || ''}
              onChange={(e) => setSelectedEndpoint(e.target.value)}
            >
              {endpoints.map((ep) => (
                <option key={ep._id} value={ep._id}>{ep.name}</option>
              ))}
            </select>
          )}
          <div className="time-filters">
            {['24h', '7d', '30d'].map((r) => (
              <button
                key={r}
                className={`time-filter-btn ${range === r ? 'active' : ''}`}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="chart-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#5A8068" strokeWidth="1.5">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          <p>No latency data yet. Waiting for health checks...</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1A3A20" />
            <XAxis dataKey="time" stroke="#3D6348" fontSize={11} tickLine={false} />
            <YAxis stroke="#3D6348" fontSize={11} tickLine={false} unit="ms" />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
              iconType="circle"
              iconSize={8}
            />
            <Line type="monotone" dataKey="p50" stroke="#00FF41" strokeWidth={2} dot={false} name="p50" />
            <Line type="monotone" dataKey="p95" stroke="#FFB647" strokeWidth={2} dot={false} name="p95" />
            <Line type="monotone" dataKey="p99" stroke="#FF4757" strokeWidth={2} dot={false} name="p99" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
