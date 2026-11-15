# SPTMS — Technical Code Report

**Project:** Smart Parking & Traffic Management System  
**Repository version:** 1.0.0  
**Report date:** 15 November 2026  
**Implementation inspected:** uploaded source archive

## 1. Executive summary

SPTMS is a browser-based smart parking facility operations prototype. It presents the facility as an interactive Three.js scene and as a 2D floorplan, with an analytics view for occupancy and revenue. The frontend communicates with an Express server over HTTP for commands and WebSockets for live state synchronization.

The strongest architectural decision in the supplied implementation is the shared domain layer: parking rules, booking transitions, validation, metrics and projections are centralized in `src/shared/parkingLogic.ts`. Both the server and client use its types and operations, reducing the risk of implementing business rules differently in two places.

The application is a functional demo, not a production-ready parking platform. The server's state lives in memory, seeded demo data is used, and there is no database, authentication, payment integration or real sensor/gate hardware connection in the supplied source.

## 2. Goals and scope

### Implemented scope

- Visualize a multi-zone parking facility in 3D.
- Provide a 2D floorplan alternative.
- Represent bays, categories, availability and active bookings.
- Reserve a bay, check in a reservation, register a walk-in and release a bay.
- Synchronize state changes between connected browser clients.
- Calculate occupancy and revenue summaries, hourly history, demand heatmap and a seven-day revenue projection.
- Simulate traffic activity for demonstration purposes.

### Not implemented in the inspected source

- Durable database storage or recovery after process restart.
- User accounts, authentication, authorization or operator roles.
- Real payment collection, refunds, invoices or payment reconciliation.
- Physical IoT sensor, ANPR/camera, barrier or charger control.
- External maps, routing or live traffic provider integration.
- Automated deployment pipeline or end-to-end browser test suite.

## 3. Technology and runtime architecture

| Layer | Implementation | Responsibility |
|---|---|---|
| Presentation | React 19 + TypeScript | Application state, controls, drawers and views |
| 3D visualization | Three.js | Scene, camera, lighting, bay/vehicle models and interaction |
| 2D visualization | React floorplan component | Accessible non-WebGL representation of bays |
| Analytics | Recharts + shared calculations | Occupancy, revenue, forecast and demand views |
| HTTP server | Express | Snapshot and parking operation endpoints |
| Realtime transport | `ws` WebSocket server | Initial state and broadcast synchronization |
| Domain layer | `src/shared/parkingLogic.ts` | Types, validation, state transitions and calculations |

### Runtime flow

```text
Browser (React UI)
   |                         
   | REST commands / snapshot       WebSocket state updates
   v                                      ^
Express server ---------------------------+
   |
   | calls shared domain functions
   v
In-memory FacilityState
   |
   +--> bookings, bays, telemetry, revenue and gate events
```

The browser loads the initial snapshot from `GET /api/state`, then opens `/ws`. The server sends an initial state frame. When an operation succeeds, the server replaces its in-memory state and broadcasts a `state:sync` message to connected clients. The client hook applies the new snapshot to React state.

## 4. Repository and module walkthrough

### Root files

- `server.ts`: creates the Express app, HTTP server and WebSocket server; defines API routes; serves Vite middleware in development and `dist/` in production.
- `package.json`: dependency manifest and development/build/test scripts.
- `vite.config.ts`: React and Tailwind Vite plugins, alias configuration and development server options.
- `tsconfig.json`: TypeScript compiler configuration for browser-oriented source and bundler resolution.
- `index.html`: document shell, metadata, font loading and React mount point.

### `src/App.tsx`

The top-level React component composes the main application. It coordinates the active view (3D, 2D or analytics), bay selection, category/status filters, search, lighting mode, camera preset, quick-booking state and operations drawer. It consumes `useFacilitySync` for server state and actions.

### `src/components/`

- `ParkingViewport.tsx`: owns the DOM mount point and lifecycle of `ParkingSceneManager`. It forwards state, selected bay, filters, lighting and camera commands into the Three.js manager and routes scene interactions back to React callbacks.
- `AccessibleFloorplan.tsx`: renders the 2D facility view, bay categories/status, filtering and selection without requiring WebGL.
- `BayInspectorDrawer.tsx`: presents the selected bay and its booking/inspection actions.
- `OperationsDrawer.tsx`: presents operational records such as bookings and gate activity.
- `FacilityAnalyticsPanel.tsx`: renders facility analytics, revenue/projection charts and demand heatmap.

### `src/hooks/useFacilitySync.ts`

This hook is the frontend transport boundary. It:

1. Fetches an initial snapshot from `/api/state`.
2. Connects to `/ws` and requests state on open.
3. Applies incoming `state:init` and `state:sync` messages.
4. Tracks connection status, client count, latest event and fetch errors.
5. Reconnects after a closed socket using an increasing delay capped at four seconds.
6. Exposes typed action functions for reserve, walk-in, check-in, release and simulation requests.

The hook keeps transport concerns out of the view components. The server remains authoritative for mutations.

### `src/shared/parkingLogic.ts`

This is the domain core and source of truth for the data model. It defines bay zones/categories/statuses, vehicle types, booking statuses, booking input, telemetry, analytics and facility state types. It also implements:

- Initial facility and telemetry construction.
- License-plate normalization and booking-input validation.
- Booking cost and INR formatting.
- Reservation, check-in, walk-in and release transitions.
- Facility metric and analytics summaries.
- Seven-day revenue projections.
- Demand heatmap generation.
- Bay filtering and deterministic traffic simulation.

State operations return structured results rather than directly mutating global server state. The server assigns the returned state only when an operation succeeds.

### `src/shared/parkingLogic.test.ts`

The Node test-runner suite validates initial facility structure, input validation, booking lifecycle, cancellation behavior, filtering, simulation, hourly analytics, revenue projection sensitivity, demand heatmap behavior, deterministic vehicle color and Indian currency formatting.

### `src/three/`

- `ParkingSceneManager.ts`: manages the Three.js scene lifecycle, renderer, camera, controls, lighting, bay visuals, selection/hover interaction and synchronization with facility state.
- `cityModels.ts`: creates procedural 3D geometry for vehicles, EV charger pedestals, gate plaza, terminal pavilion, solar canopies, streetlamps and trees.
- `textures.ts`: creates canvas-based textures for asphalt, solar panels, bay markings, road arrows, status displays and building facades.

The supplied archive uses procedural model/texture construction in source. No external `.glb` model files are present in the uploaded archive.

## 5. Domain model and state transitions

The core state is `FacilityState`, which groups parking bays, bookings, event/telemetry history and revenue-related data. A `ParkingBay` has an identifier, zone, category, hourly rate, coordinates and occupancy/booking-related attributes. Booking records capture driver/vehicle details, duration, cost and lifecycle status.

The principal lifecycle is:

```text
AVAILABLE --reserve--> RESERVED --check-in--> OCCUPIED --release--> AVAILABLE
     |                                              ^
     +---------------- walk-in ---------------------+

RESERVED --release/cancel--> AVAILABLE
```

A reservation records the booking and changes the bay to reserved. Check-in changes the booking lifecycle to checked-in and the bay to occupied. Releasing a reserved bay cancels the reservation without recording completed parking revenue; releasing an occupied bay completes the parking lifecycle and updates revenue according to the domain function.

Validation is centralized in `validateBookingInput`. The tests verify rejection of missing/invalid bay, driver, plate and duration values, as well as normalization of license plates and booking cost calculation.

## 6. Server and API design

The Express server creates one HTTP server shared with the WebSocket server. JSON request bodies are parsed with Express middleware. The routes call domain functions and return a client-friendly success or error response.

| Endpoint | Operation |
|---|---|
| `GET /api/health` | Returns health status, WebSocket client count and bay count |
| `GET /api/state` | Returns the current facility snapshot and client count |
| `POST /api/bookings` | Validates and reserves a bay |
| `POST /api/bookings/:id/checkin` | Checks in a booking |
| `POST /api/bays/:bayId/walkin` | Creates an immediate walk-in occupancy |
| `POST /api/bays/:bayId/release` | Releases a bay |
| `POST /api/simulate` | Runs a deterministic traffic pulse using an incrementing seed |
| `WS /ws` | Sends initial state and broadcasts state/presence updates |

On successful mutations, the server updates its in-memory `facilityState`, broadcasts the resulting state and event, then responds to the initiating HTTP request. On invalid mutations it returns a 400 response with an error and, where available, field-level validation errors.

## 7. Analytics and calculations

The domain layer computes operational summaries from the current facility state. The UI presents these results rather than owning the business calculations.

- **Facility metrics:** counts bays by availability/reservation/occupancy and category.
- **Hourly telemetry:** keeps a 24-point hourly history and synchronizes the current hour's metrics.
- **Revenue summary:** aggregates revenue and transaction activity over selectable time windows.
- **Seven-day projection:** estimates upcoming revenue from baseline demand patterns and current occupancy conditions. It is a deterministic demonstration forecast, not a statistically validated prediction model.
- **Demand heatmap:** generates a 24-hour by zone matrix (96 cells for four zones) with demand percentages and active/total stall counts.
- **Traffic pulse:** deterministic seeded simulation changes facility state for demo purposes; it is not a live traffic feed.

## 8. Quality practices present in the code

- **Separation of concerns:** UI, transport, rendering and domain rules are separated into modules.
- **Shared domain rules:** server and client consume the same TypeScript types and domain functions.
- **Typed contracts:** interfaces and union types describe bays, bookings, events, analytics and API inputs.
- **Explicit validation:** booking inputs are validated before state transitions.
- **Immutable-style updates:** domain functions return updated state/results rather than directly editing the server's global state.
- **Lifecycle cleanup:** React effects dispose the Three.js manager and close WebSocket/reconnect resources when unmounted.
- **Resilience:** the 3D viewport can signal WebGL context failure and the application can switch to the 2D floorplan; WebSocket reconnect logic is included.
- **Automated unit tests:** core domain behavior has direct regression coverage.

These are observed implementation practices, not a claim of formal SOLID certification. The codebase can be improved further with explicit service/repository interfaces, API schema validation, integration tests and persistent storage.

## 9. Run, test and build

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run build
```

Open `http://localhost:3000` while the development server is running. For production, build first and start with `NODE_ENV=production`.

## 10. Limitations and recommended next steps

| Priority | Improvement | Why it matters |
|---|---|---|
| Critical before real use | Add authentication and authorization | Prevents anonymous or unauthorized operational actions |
| Critical before real use | Add database persistence and transactions | Prevents state loss and concurrent booking conflicts |
| Critical before real use | Validate request schemas and enforce payload limits | Strengthens API boundary safety |
| High | Add integration and end-to-end tests | Verifies API, WebSocket and browser behavior together |
| High | Add rate limiting, secure headers and origin controls | Reduces common deployment risks |
| High | Add audit trail and privacy/retention controls | Supports accountability and responsible handling of driver data |
| Medium | Add real sensor/gate/charger adapters | Connects the prototype to physical infrastructure |
| Medium | Add calibrated forecasting and operational data ingestion | Makes analytics decision-useful rather than illustrative |
| Medium | Add CI workflow and dependency automation | Makes quality checks repeatable on pull requests |

## 11. Conclusion

SPTMS demonstrates an end-to-end application structure for a smart parking operations interface: interactive visualization, typed domain logic, HTTP mutations, WebSocket synchronization and operational analytics. Its shared domain module and separation between UI, server and 3D rendering provide a useful foundation for further development. Before real-world deployment, the prototype needs durable storage, identity and access management, security controls, operational integrations and broader automated testing.
