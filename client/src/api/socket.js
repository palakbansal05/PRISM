import { io } from 'socket.io-client';

// Connect directly to the backend server (not through Vite proxy)
const socket = io('http://localhost:5000', {
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 2000,
  reconnectionAttempts: 10,
});

export default socket;
