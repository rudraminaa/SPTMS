import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import {
  checkInBooking,
  createInitialFacilityState,
  releaseBay,
  reserveBay,
  simulateTrafficPulse,
  walkInOccupyBay,
  type BookingInput,
  type FacilityState,
  type GateEvent,
} from './src/shared/parkingLogic.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT ?? 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

let facilityState: FacilityState = createInitialFacilityState();
let simCounter = 1;

const app = express();
app.use(express.json());

const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

function broadcast(payload: Record<string, unknown>) {
  const raw = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(raw);
    }
  }
}

function broadcastState(event?: GateEvent) {
  broadcast({
    type: 'state:sync',
    state: facilityState,
    event: event ?? null,
    clientCount: wss.clients.size,
  });
}

wss.on('connection', (socket) => {
  socket.send(
    JSON.stringify({
      type: 'state:init',
      state: facilityState,
      clientCount: wss.clients.size,
    }),
  );

  broadcast({
    type: 'presence:count',
    clientCount: wss.clients.size,
  });

  socket.on('message', (raw) => {
    try {
      const msg = JSON.parse(String(raw)) as { type?: string };
      if (msg.type === 'state:request') {
        socket.send(
          JSON.stringify({
            type: 'state:init',
            state: facilityState,
            clientCount: wss.clients.size,
          }),
        );
      } else if (msg.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong' }));
      }
    } catch {
      // Ignore malformed client messages
    }
  });

  socket.on('close', () => {
    broadcast({
      type: 'presence:count',
      clientCount: wss.clients.size,
    });
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, clients: wss.clients.size, bays: facilityState.bays.length });
});

app.get('/api/state', (_req, res) => {
  res.json({ state: facilityState, clientCount: wss.clients.size });
});

app.post('/api/bookings', (req, res) => {
  const body = (req.body ?? {}) as Partial<BookingInput>;
  const result = reserveBay(facilityState, {
    bayId: String(body.bayId ?? ''),
    driverName: String(body.driverName ?? ''),
    licensePlate: String(body.licensePlate ?? ''),
    vehicleType: (body.vehicleType ?? 'sedan') as BookingInput['vehicleType'],
    durationHours: Number(body.durationHours ?? 0),
  });

  if (!result.ok) {
    res.status(400).json({ error: result.error, fieldErrors: result.fieldErrors });
    return;
  }

  facilityState = result.state;
  broadcastState(result.event);
  res.status(201).json({
    booking: result.booking,
    updatedBay: result.updatedBay,
    event: result.event,
    state: facilityState,
  });
});

app.post('/api/bookings/:id/checkin', (req, res) => {
  const result = checkInBooking(facilityState, req.params.id);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  facilityState = result.state;
  broadcastState(result.event);
  res.json({
    booking: result.booking,
    updatedBay: result.updatedBay,
    event: result.event,
    state: facilityState,
  });
});

app.post('/api/bays/:bayId/walkin', (req, res) => {
  const body = (req.body ?? {}) as Partial<BookingInput>;
  const result = walkInOccupyBay(facilityState, {
    bayId: req.params.bayId,
    driverName: String(body.driverName ?? ''),
    licensePlate: String(body.licensePlate ?? ''),
    vehicleType: (body.vehicleType ?? 'sedan') as BookingInput['vehicleType'],
    durationHours: Number(body.durationHours ?? 2),
  });
  if (!result.ok) {
    res.status(400).json({ error: result.error, fieldErrors: result.fieldErrors });
    return;
  }
  facilityState = result.state;
  broadcastState(result.event);
  res.status(201).json({
    booking: result.booking,
    updatedBay: result.updatedBay,
    event: result.event,
    state: facilityState,
  });
});

app.post('/api/bays/:bayId/release', (req, res) => {
  const result = releaseBay(facilityState, req.params.bayId);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  facilityState = result.state;
  broadcastState(result.event);
  res.json({
    updatedBay: result.updatedBay,
    event: result.event,
    state: facilityState,
  });
});

app.post('/api/simulate', (_req, res) => {
  const result = simulateTrafficPulse(facilityState, simCounter++);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  facilityState = result.state;
  broadcastState(result.event);
  res.json({
    updatedBay: result.updatedBay,
    event: result.event,
    state: facilityState,
  });
});

async function startServer() {
  if (IS_PROD) {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`SPTMS server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SPTMS server:', err);
  process.exit(1);
});
