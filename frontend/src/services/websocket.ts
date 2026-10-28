import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

class WebSocketService {
  socket: Socket | null = null;

  connect() {
    if (!this.socket) {
      this.socket = io(WS_URL, {
        autoConnect: true,
        transports: ['websocket'],
      });

      this.socket.on('connect', () => {
        console.log('[WS] Connected to server');
      });

      this.socket.on('disconnect', () => {
        console.log('[WS] Disconnected from server');
      });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  subscribe(event: string, callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  unsubscribe(event: string) {
    if (this.socket) {
      this.socket.off(event);
    }
  }
}

export const wsService = new WebSocketService();
