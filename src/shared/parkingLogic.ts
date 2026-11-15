export type BayZone = 'A' | 'E' | 'P' | 'V';
export type BayCategory = 'standard' | 'ev' | 'accessible' | 'vip';
export type BayStatus = 'available' | 'reserved' | 'occupied';
export type VehicleType = 'sedan' | 'suv' | 'ev_hatch' | 'compact';
export type BookingStatus = 'reserved' | 'checked_in' | 'completed' | 'cancelled';

export interface BayCoordinates {
  x: number;
  z: number;
  rotationY: number;
}

export interface ParkingBay {
  id: string;
  label: string;
  zone: BayZone;
  category: BayCategory;
  status: BayStatus;
  hourlyRate: number;
  chargerKw: number | null;
  sensorOnline: boolean;
  coords: BayCoordinates;
  currentBookingId: string | null;
  licensePlate: string | null;
  driverName: string | null;
  vehicleType: VehicleType | null;
}

export interface BookingRecord {
  id: string;
  bayId: string;
  bayLabel: string;
  zone: BayZone;
  category: BayCategory;
  driverName: string;
  licensePlate: string;
  vehicleType: VehicleType;
  durationHours: number;
  hourlyRate: number;
  totalAmount: number;
  status: BookingStatus;
  accessCode: string;
  createdAt: string;
  checkedInAt: string | null;
  completedAt: string | null;
}

export interface GateEvent {
  id: string;
  timestamp: string;
  gate: 'entry' | 'exit' | 'system';
  action: 'reservation' | 'check_in' | 'check_out' | 'cancelled' | 'walk_in';
  bayId: string;
  licensePlate: string;
  summary: string;
}

export interface HourlyTelemetryPoint {
  hourOffset: number;
  hourLabel: string;
  revenue: number;
  occupancyRate: number;
  occupiedCount: number;
  reservedCount: number;
  transactions: number;
}

export interface ZoneUtilization {
  zone: BayZone;
  category: BayCategory;
  label: string;
  totalBays: number;
  availableBays: number;
  reservedBays: number;
  occupiedBays: number;
  utilizationPct: number;
  hourlyRate: number;
}

export interface AnalyticsSummary {
  totalRevenue24h: number;
  currentHourRevenue: number;
  avgOccupancy24h: number;
  currentOccupancyPct: number;
  peakOccupancyRate: number;
  peakOccupancyHour: string;
  peakHourlyRevenue: number;
  peakRevenueHour: string;
  totalTransactions24h: number;
  zoneBreakdown: ZoneUtilization[];
}

export interface RevenueProjectionPoint {
  dayIndex: number;
  dayLabel: string;
  weekdayLabel: string;
  projectedRevenue: number;
  baselineRevenue: number;
  expectedOccupancyPct: number;
}

export interface DemandHeatmapCell {
  hourIndex: number;
  hourLabel: string;
  zoneIndex: number;
  zone: BayZone;
  zoneLabel: string;
  demandPct: number;
  activeStalls: number;
  totalStalls: number;
  isCurrentHour: boolean;
}

export interface FacilityState {
  bays: ParkingBay[];
  bookings: BookingRecord[];
  gateEvents: GateEvent[];
  hourlyHistory: HourlyTelemetryPoint[];
  revenueToday: number;
  lastUpdated: string;
}

export interface FacilityMetrics {
  totalBays: number;
  availableBays: number;
  reservedBays: number;
  occupiedBays: number;
  occupancyPct: number;
  evAvailable: number;
  accessibleAvailable: number;
  vipAvailable: number;
  standardAvailable: number;
  revenueToday: number;
}

export interface BookingInput {
  bayId: string;
  driverName: string;
  licensePlate: string;
  vehicleType: VehicleType;
  durationHours: number;
}

export interface ValidationResult {
  valid: boolean;
  fieldErrors: Partial<Record<'bayId' | 'driverName' | 'licensePlate' | 'durationHours', string>>;
}

export type MutationResult =
  | {
      ok: true;
      state: FacilityState;
      booking?: BookingRecord;
      event: GateEvent;
      updatedBay: ParkingBay;
    }
  | {
      ok: false;
      error: string;
      fieldErrors?: ValidationResult['fieldErrors'];
    };

export const CATEGORY_LABELS: Record<BayCategory, string> = {
  standard: 'Solar Covered',
  ev: 'EV Fast-Charge',
  accessible: 'Accessible Priority',
  vip: 'Express VIP',
};

export const VEHICLE_LABELS: Record<VehicleType, string> = {
  sedan: 'Executive Sedan',
  suv: 'Urban SUV',
  ev_hatch: 'EV Hatchback',
  compact: 'City Compact',
};

const VEHICLE_PALETTES: Record<VehicleType, number[]> = {
  sedan: [0x2b4c7e, 0xd8dee9, 0x3b4252, 0x7c2d12, 0x0f766e],
  suv: [0x374151, 0x1e3a5f, 0xe5e7eb, 0x4b5563, 0x14532d],
  ev_hatch: [0x0ea5e9, 0x10b981, 0xf8fafc, 0x6366f1],
  compact: [0xd97706, 0x2563eb, 0xf1f5f9, 0xe11d48],
};

export function pickVehicleColor(type: VehicleType, plate: string | null): number {
  const list = VEHICLE_PALETTES[type];
  if (!plate) return list[0];
  let hash = 0;
  for (let i = 0; i < plate.length; i += 1) {
    hash = (hash * 31 + plate.charCodeAt(i)) >>> 0;
  }
  return list[hash % list.length];
}

export function pickVehicleCssColor(type: VehicleType, plate: string | null): string {
  const hex = pickVehicleColor(type, plate);
  return `#${hex.toString(16).padStart(6, '0')}`;
}

export function normalizeLicensePlate(plate: string): string {
  return plate
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 12);
}

export function formatInr(amount: number, showDecimals = false): string {
  const rounded = Math.round(amount * 100) / 100;
  const hasFraction = Math.abs(rounded - Math.round(rounded)) > 0.001;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals || hasFraction ? 2 : 0,
    maximumFractionDigits: showDecimals || hasFraction ? 2 : 0,
  }).format(rounded);
}

export function calculateBookingCost(hourlyRate: number, durationHours: number): number {
  const safeHours = Math.max(1, Math.min(24, Math.round(durationHours)));
  return Number((hourlyRate * safeHours).toFixed(2));
}

export function validateBookingInput(input: BookingInput): ValidationResult {
  const fieldErrors: ValidationResult['fieldErrors'] = {};

  if (!input.bayId || !input.bayId.trim()) {
    fieldErrors.bayId = 'Select an available parking bay.';
  }

  const trimmedName = input.driverName.trim();
  if (trimmedName.length < 2) {
    fieldErrors.driverName = 'Enter a driver name (at least 2 characters).';
  } else if (trimmedName.length > 48) {
    fieldErrors.driverName = 'Driver name must be 48 characters or fewer.';
  }

  const plate = normalizeLicensePlate(input.licensePlate);
  if (plate.length < 4 || !/[A-Z0-9]{2,}/.test(plate)) {
    fieldErrors.licensePlate = 'Enter a valid plate number (4–12 letters/digits).';
  }

  if (!Number.isFinite(input.durationHours) || input.durationHours < 1 || input.durationHours > 24) {
    fieldErrors.durationHours = 'Duration must be between 1 and 24 hours.';
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
  };
}

function generateAccessCode(bayId: string, plate: string): string {
  const suffix = plate.slice(-3).padStart(3, '0');
  const randomDigits = Math.floor(100 + Math.random() * 900);
  return `${bayId}-${suffix}-${randomDigits}`;
}

function createEventId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const BASE_HOURLY_PROFILE: Array<{
  hourLabel: string;
  occupancyRate: number;
  occupiedCount: number;
  reservedCount: number;
  revenue: number;
  transactions: number;
}> = [
  { hourLabel: '23:00', occupancyRate: 21, occupiedCount: 4, reservedCount: 1, revenue: 180, transactions: 2 },
  { hourLabel: '00:00', occupancyRate: 17, occupiedCount: 4, reservedCount: 0, revenue: 120, transactions: 1 },
  { hourLabel: '01:00', occupancyRate: 17, occupiedCount: 4, reservedCount: 0, revenue: 80, transactions: 1 },
  { hourLabel: '02:00', occupancyRate: 13, occupiedCount: 3, reservedCount: 0, revenue: 80, transactions: 1 },
  { hourLabel: '03:00', occupancyRate: 13, occupiedCount: 3, reservedCount: 0, revenue: 60, transactions: 1 },
  { hourLabel: '04:00', occupancyRate: 17, occupiedCount: 3, reservedCount: 1, revenue: 120, transactions: 1 },
  { hourLabel: '05:00', occupancyRate: 25, occupiedCount: 5, reservedCount: 1, revenue: 220, transactions: 2 },
  { hourLabel: '06:00', occupancyRate: 33, occupiedCount: 6, reservedCount: 2, revenue: 360, transactions: 3 },
  { hourLabel: '07:00', occupancyRate: 46, occupiedCount: 9, reservedCount: 2, revenue: 580, transactions: 4 },
  { hourLabel: '08:00', occupancyRate: 63, occupiedCount: 12, reservedCount: 3, revenue: 840, transactions: 6 },
  { hourLabel: '09:00', occupancyRate: 71, occupiedCount: 14, reservedCount: 3, revenue: 980, transactions: 7 },
  { hourLabel: '10:00', occupancyRate: 75, occupiedCount: 15, reservedCount: 3, revenue: 1040, transactions: 7 },
  { hourLabel: '11:00', occupancyRate: 79, occupiedCount: 16, reservedCount: 3, revenue: 1160, transactions: 8 },
  { hourLabel: '12:00', occupancyRate: 83, occupiedCount: 17, reservedCount: 3, revenue: 1240, transactions: 8 },
  { hourLabel: '13:00', occupancyRate: 88, occupiedCount: 18, reservedCount: 3, revenue: 1360, transactions: 9 },
  { hourLabel: '14:00', occupancyRate: 83, occupiedCount: 17, reservedCount: 3, revenue: 1180, transactions: 7 },
  { hourLabel: '15:00', occupancyRate: 75, occupiedCount: 15, reservedCount: 3, revenue: 1020, transactions: 6 },
  { hourLabel: '16:00', occupancyRate: 71, occupiedCount: 14, reservedCount: 3, revenue: 940, transactions: 6 },
  { hourLabel: '17:00', occupancyRate: 79, occupiedCount: 16, reservedCount: 3, revenue: 1120, transactions: 7 },
  { hourLabel: '18:00', occupancyRate: 67, occupiedCount: 13, reservedCount: 3, revenue: 880, transactions: 6 },
  { hourLabel: '19:00', occupancyRate: 58, occupiedCount: 11, reservedCount: 3, revenue: 720, transactions: 5 },
  { hourLabel: '20:00', occupancyRate: 50, occupiedCount: 9, reservedCount: 3, revenue: 560, transactions: 4 },
  { hourLabel: '21:00', occupancyRate: 42, occupiedCount: 7, reservedCount: 3, revenue: 440, transactions: 3 },
  { hourLabel: '22:00', occupancyRate: 38, occupiedCount: 6, reservedCount: 3, revenue: 420, transactions: 3 },
];

function createInitialHourlyHistory(bays: ParkingBay[]): HourlyTelemetryPoint[] {
  let occupiedCount = 0;
  let reservedCount = 0;
  for (const bay of bays) {
    if (bay.status === 'occupied') occupiedCount += 1;
    else if (bay.status === 'reserved') reservedCount += 1;
  }
  const total = bays.length || 1;
  const currentRate = Math.round(((occupiedCount + reservedCount) / total) * 100);

  return BASE_HOURLY_PROFILE.map((point, index) => {
    const isCurrent = index === BASE_HOURLY_PROFILE.length - 1;
    return {
      hourOffset: index - (BASE_HOURLY_PROFILE.length - 1),
      hourLabel: point.hourLabel,
      revenue: point.revenue,
      occupancyRate: isCurrent ? currentRate : point.occupancyRate,
      occupiedCount: isCurrent ? occupiedCount : point.occupiedCount,
      reservedCount: isCurrent ? reservedCount : point.reservedCount,
      transactions: point.transactions,
    };
  });
}

function syncCurrentHourTelemetry(
  history: HourlyTelemetryPoint[],
  bays: ParkingBay[],
  revenueDelta = 0,
  txDelta = 0,
): HourlyTelemetryPoint[] {
  if (history.length === 0) return createInitialHourlyHistory(bays);
  let occupiedCount = 0;
  let reservedCount = 0;
  for (const bay of bays) {
    if (bay.status === 'occupied') occupiedCount += 1;
    else if (bay.status === 'reserved') reservedCount += 1;
  }
  const total = bays.length || 1;
  const occupancyRate = Math.round(((occupiedCount + reservedCount) / total) * 100);
  const next = [...history];
  const lastIdx = next.length - 1;
  const current = next[lastIdx];
  next[lastIdx] = {
    ...current,
    occupancyRate,
    occupiedCount,
    reservedCount,
    revenue: Number((current.revenue + revenueDelta).toFixed(2)),
    transactions: current.transactions + txDelta,
  };
  return next;
}

export function createInitialFacilityState(): FacilityState {
  const now = new Date('2026-11-14T22:15:00.000Z').toISOString();

  const rawBays: Array<Omit<ParkingBay, 'sensorOnline' | 'currentBookingId' | 'licensePlate' | 'driverName' | 'vehicleType' | 'status'>> = [
    // Zone A: North Outer Row (A1-A4) at z = -11.05, facing +Z (0)
    { id: 'A1', label: 'Bay A1', zone: 'A', category: 'standard', hourlyRate: 60, chargerKw: null, coords: { x: -12.5, z: -11.05, rotationY: 0 } },
    { id: 'A2', label: 'Bay A2', zone: 'A', category: 'standard', hourlyRate: 60, chargerKw: null, coords: { x: -9.5, z: -11.05, rotationY: 0 } },
    { id: 'A3', label: 'Bay A3', zone: 'A', category: 'standard', hourlyRate: 60, chargerKw: null, coords: { x: -6.5, z: -11.05, rotationY: 0 } },
    { id: 'A4', label: 'Bay A4', zone: 'A', category: 'standard', hourlyRate: 60, chargerKw: null, coords: { x: -3.5, z: -11.05, rotationY: 0 } },
    // Zone E: North Outer EV Wing (E1-E4) at z = -11.05, facing +Z (0)
    { id: 'E1', label: 'EV Bay E1', zone: 'E', category: 'ev', hourlyRate: 120, chargerKw: 150, coords: { x: 0.5, z: -11.05, rotationY: 0 } },
    { id: 'E2', label: 'EV Bay E2', zone: 'E', category: 'ev', hourlyRate: 120, chargerKw: 150, coords: { x: 3.5, z: -11.05, rotationY: 0 } },
    { id: 'E3', label: 'EV Bay E3', zone: 'E', category: 'ev', hourlyRate: 120, chargerKw: 150, coords: { x: 6.5, z: -11.05, rotationY: 0 } },
    { id: 'E4', label: 'EV Bay E4', zone: 'E', category: 'ev', hourlyRate: 120, chargerKw: 150, coords: { x: 9.5, z: -11.05, rotationY: 0 } },
    // Center Island North-facing (A5-A8, E5-E6) at z = -2.65, facing -Z (Math.PI)
    { id: 'A5', label: 'Bay A5', zone: 'A', category: 'standard', hourlyRate: 60, chargerKw: null, coords: { x: -12.5, z: -2.65, rotationY: Math.PI } },
    { id: 'A6', label: 'Bay A6', zone: 'A', category: 'standard', hourlyRate: 60, chargerKw: null, coords: { x: -9.5, z: -2.65, rotationY: Math.PI } },
    { id: 'A7', label: 'Bay A7', zone: 'A', category: 'standard', hourlyRate: 60, chargerKw: null, coords: { x: -6.5, z: -2.65, rotationY: Math.PI } },
    { id: 'A8', label: 'Bay A8', zone: 'A', category: 'standard', hourlyRate: 60, chargerKw: null, coords: { x: -3.5, z: -2.65, rotationY: Math.PI } },
    { id: 'E5', label: 'EV Bay E5', zone: 'E', category: 'ev', hourlyRate: 120, chargerKw: 250, coords: { x: 0.5, z: -2.65, rotationY: Math.PI } },
    { id: 'E6', label: 'EV Bay E6', zone: 'E', category: 'ev', hourlyRate: 120, chargerKw: 250, coords: { x: 3.5, z: -2.65, rotationY: Math.PI } },
    // Center Island South-facing (P1-P4, V1-V2) at z = +2.65, facing +Z (0)
    { id: 'P1', label: 'Access P1', zone: 'P', category: 'accessible', hourlyRate: 40, chargerKw: null, coords: { x: -12.0, z: 2.65, rotationY: 0 } },
    { id: 'P2', label: 'Access P2', zone: 'P', category: 'accessible', hourlyRate: 40, chargerKw: null, coords: { x: -8.5, z: 2.65, rotationY: 0 } },
    { id: 'P3', label: 'Access P3', zone: 'P', category: 'accessible', hourlyRate: 40, chargerKw: null, coords: { x: -5.0, z: 2.65, rotationY: 0 } },
    { id: 'P4', label: 'Access P4', zone: 'P', category: 'accessible', hourlyRate: 40, chargerKw: null, coords: { x: -1.5, z: 2.65, rotationY: 0 } },
    { id: 'V1', label: 'VIP Bay V1', zone: 'V', category: 'vip', hourlyRate: 160, chargerKw: 50, coords: { x: 3.5, z: 2.65, rotationY: 0 } },
    { id: 'V2', label: 'VIP Bay V2', zone: 'V', category: 'vip', hourlyRate: 160, chargerKw: 50, coords: { x: 6.5, z: 2.65, rotationY: 0 } },
    // South Outer Row (V3-V6) at z = +11.05, facing -Z (Math.PI)
    { id: 'V3', label: 'VIP Bay V3', zone: 'V', category: 'vip', hourlyRate: 160, chargerKw: 50, coords: { x: -1.5, z: 11.05, rotationY: Math.PI } },
    { id: 'V4', label: 'VIP Bay V4', zone: 'V', category: 'vip', hourlyRate: 160, chargerKw: 50, coords: { x: 1.5, z: 11.05, rotationY: Math.PI } },
    { id: 'V5', label: 'VIP Bay V5', zone: 'V', category: 'vip', hourlyRate: 160, chargerKw: 50, coords: { x: 4.5, z: 11.05, rotationY: Math.PI } },
    { id: 'V6', label: 'VIP Bay V6', zone: 'V', category: 'vip', hourlyRate: 160, chargerKw: 50, coords: { x: 7.5, z: 11.05, rotationY: Math.PI } },
  ];

  const seededOccupants: Record<
    string,
    {
      status: BayStatus;
      driverName: string;
      licensePlate: string;
      vehicleType: VehicleType;
      durationHours: number;
    }
  > = {
    A1: { status: 'occupied', driverName: 'Aarav Sharma', licensePlate: 'MH12-AB4092', vehicleType: 'sedan', durationHours: 3 },
    A3: { status: 'occupied', driverName: 'Rohan Kulkarni', licensePlate: 'DL03-CW8140', vehicleType: 'compact', durationHours: 2 },
    A6: { status: 'reserved', driverName: 'Priya Nair', licensePlate: 'KL07-EV2094', vehicleType: 'suv', durationHours: 4 },
    E1: { status: 'occupied', driverName: 'Vikram Malhotra', licensePlate: 'KA01-EV7712', vehicleType: 'ev_hatch', durationHours: 2 },
    E4: { status: 'occupied', driverName: 'Ananya Iyer', licensePlate: 'TN09-EV5120', vehicleType: 'sedan', durationHours: 3 },
    E5: { status: 'reserved', driverName: 'Devansh Patel', licensePlate: 'GJ05-EV9042', vehicleType: 'ev_hatch', durationHours: 2 },
    P2: { status: 'occupied', driverName: 'Arjun Deshmukh', licensePlate: 'MH02-PQ3180', vehicleType: 'suv', durationHours: 5 },
    V1: { status: 'occupied', driverName: 'Kavya Reddy', licensePlate: 'TS09-VP0008', vehicleType: 'sedan', durationHours: 3 },
    V5: { status: 'reserved', driverName: 'Siddharth Verma', licensePlate: 'HR26-VP4410', vehicleType: 'suv', durationHours: 2 },
  };

  const bookings: BookingRecord[] = [];
  const gateEvents: GateEvent[] = [];

  const bays: ParkingBay[] = rawBays.map((base, idx) => {
    const seed = seededOccupants[base.id];
    if (!seed) {
      return {
        ...base,
        sensorOnline: true,
        status: 'available',
        currentBookingId: null,
        licensePlate: null,
        driverName: null,
        vehicleType: null,
      };
    }

    const bookingId = `bk-seed-${base.id.toLowerCase()}`;
    const totalAmount = calculateBookingCost(base.hourlyRate, seed.durationHours);
    const bookingStatus: BookingStatus = seed.status === 'occupied' ? 'checked_in' : 'reserved';

    bookings.push({
      id: bookingId,
      bayId: base.id,
      bayLabel: base.label,
      zone: base.zone,
      category: base.category,
      driverName: seed.driverName,
      licensePlate: seed.licensePlate,
      vehicleType: seed.vehicleType,
      durationHours: seed.durationHours,
      hourlyRate: base.hourlyRate,
      totalAmount,
      status: bookingStatus,
      accessCode: `${base.id}-${seed.licensePlate.slice(-3)}-${100 + idx}`,
      createdAt: now,
      checkedInAt: seed.status === 'occupied' ? now : null,
      completedAt: null,
    });

    gateEvents.push({
      id: `evt-seed-${base.id.toLowerCase()}`,
      timestamp: now,
      gate: seed.status === 'occupied' ? 'entry' : 'system',
      action: seed.status === 'occupied' ? 'check_in' : 'reservation',
      bayId: base.id,
      licensePlate: seed.licensePlate,
      summary:
        seed.status === 'occupied'
          ? `${seed.licensePlate} cleared Entry ANPR into ${base.id}`
          : `${base.id} reserved for ${seed.licensePlate} (${seed.durationHours}h)`,
    });

    return {
      ...base,
      sensorOnline: true,
      status: seed.status,
      currentBookingId: bookingId,
      licensePlate: seed.licensePlate,
      driverName: seed.driverName,
      vehicleType: seed.vehicleType,
    };
  });

  return {
    bays,
    bookings,
    gateEvents: gateEvents.slice(0, 25),
    hourlyHistory: createInitialHourlyHistory(bays),
    revenueToday: 4280,
    lastUpdated: now,
  };
}

export function reserveBay(state: FacilityState, rawInput: BookingInput): MutationResult {
  const validation = validateBookingInput(rawInput);
  if (!validation.valid) {
    return {
      ok: false,
      error: 'Please correct the highlighted booking fields.',
      fieldErrors: validation.fieldErrors,
    };
  }

  const bayIndex = state.bays.findIndex((b) => b.id === rawInput.bayId);
  if (bayIndex === -1) {
    return { ok: false, error: `Bay ${rawInput.bayId} was not found.` };
  }

  const targetBay = state.bays[bayIndex];
  if (targetBay.status !== 'available') {
    return {
      ok: false,
      error: `${targetBay.label} is currently ${targetBay.status}. Choose an available bay.`,
    };
  }

  const plate = normalizeLicensePlate(rawInput.licensePlate);
  const driverName = rawInput.driverName.trim();
  const durationHours = Math.round(rawInput.durationHours);
  const timestamp = new Date().toISOString();
  const bookingId = createEventId('bk');
  const totalAmount = calculateBookingCost(targetBay.hourlyRate, durationHours);

  const booking: BookingRecord = {
    id: bookingId,
    bayId: targetBay.id,
    bayLabel: targetBay.label,
    zone: targetBay.zone,
    category: targetBay.category,
    driverName,
    licensePlate: plate,
    vehicleType: rawInput.vehicleType,
    durationHours,
    hourlyRate: targetBay.hourlyRate,
    totalAmount,
    status: 'reserved',
    accessCode: generateAccessCode(targetBay.id, plate),
    createdAt: timestamp,
    checkedInAt: null,
    completedAt: null,
  };

  const updatedBay: ParkingBay = {
    ...targetBay,
    status: 'reserved',
    currentBookingId: booking.id,
    licensePlate: plate,
    driverName,
    vehicleType: rawInput.vehicleType,
  };

  const event: GateEvent = {
    id: createEventId('evt'),
    timestamp,
    gate: 'system',
    action: 'reservation',
    bayId: targetBay.id,
    licensePlate: plate,
    summary: `Reserved ${targetBay.id} for ${plate} (${durationHours}h · ${formatInr(totalAmount)})`,
  };

  const nextBays = [...state.bays];
  nextBays[bayIndex] = updatedBay;

  return {
    ok: true,
    booking,
    event,
    updatedBay,
    state: {
      ...state,
      bays: nextBays,
      bookings: [booking, ...state.bookings],
      gateEvents: [event, ...state.gateEvents].slice(0, 40),
      hourlyHistory: syncCurrentHourTelemetry(state.hourlyHistory, nextBays, 0, 0),
      lastUpdated: timestamp,
    },
  };
}

export function checkInBooking(state: FacilityState, bookingId: string): MutationResult {
  const bookingIdx = state.bookings.findIndex((bk) => bk.id === bookingId);
  if (bookingIdx === -1) {
    return { ok: false, error: 'Booking record not found.' };
  }

  const existingBooking = state.bookings[bookingIdx];
  if (existingBooking.status !== 'reserved') {
    return { ok: false, error: `Booking is already ${existingBooking.status}.` };
  }

  const bayIdx = state.bays.findIndex((b) => b.id === existingBooking.bayId);
  if (bayIdx === -1) {
    return { ok: false, error: `Assigned bay ${existingBooking.bayId} not found.` };
  }

  const timestamp = new Date().toISOString();
  const updatedBooking: BookingRecord = {
    ...existingBooking,
    status: 'checked_in',
    checkedInAt: timestamp,
  };

  const updatedBay: ParkingBay = {
    ...state.bays[bayIdx],
    status: 'occupied',
    currentBookingId: updatedBooking.id,
    licensePlate: updatedBooking.licensePlate,
    driverName: updatedBooking.driverName,
    vehicleType: updatedBooking.vehicleType,
  };

  const event: GateEvent = {
    id: createEventId('evt'),
    timestamp,
    gate: 'entry',
    action: 'check_in',
    bayId: updatedBay.id,
    licensePlate: updatedBooking.licensePlate,
    summary: `Entry gate opened: ${updatedBooking.licensePlate} parked in ${updatedBay.id}`,
  };

  const nextBookings = [...state.bookings];
  nextBookings[bookingIdx] = updatedBooking;
  const nextBays = [...state.bays];
  nextBays[bayIdx] = updatedBay;

  return {
    ok: true,
    booking: updatedBooking,
    event,
    updatedBay,
    state: {
      ...state,
      bays: nextBays,
      bookings: nextBookings,
      gateEvents: [event, ...state.gateEvents].slice(0, 40),
      hourlyHistory: syncCurrentHourTelemetry(state.hourlyHistory, nextBays, 0, 0),
      lastUpdated: timestamp,
    },
  };
}

export function releaseBay(state: FacilityState, bayId: string): MutationResult {
  const bayIdx = state.bays.findIndex((b) => b.id === bayId);
  if (bayIdx === -1) {
    return { ok: false, error: `Bay ${bayId} was not found.` };
  }

  const targetBay = state.bays[bayIdx];
  if (targetBay.status === 'available') {
    return { ok: false, error: `${targetBay.label} is already available.` };
  }

  const timestamp = new Date().toISOString();
  const wasOccupied = targetBay.status === 'occupied';
  const plate = targetBay.licensePlate ?? 'UNKNOWN';
  let earned = 0;

  const nextBookings = state.bookings.map((bk) => {
    if (bk.id !== targetBay.currentBookingId) return bk;
    if (wasOccupied) {
      earned = bk.totalAmount;
    }
    return {
      ...bk,
      status: (wasOccupied ? 'completed' : 'cancelled') as BookingStatus,
      completedAt: timestamp,
    };
  });

  const updatedBay: ParkingBay = {
    ...targetBay,
    status: 'available',
    currentBookingId: null,
    licensePlate: null,
    driverName: null,
    vehicleType: null,
  };

  const event: GateEvent = {
    id: createEventId('evt'),
    timestamp,
    gate: wasOccupied ? 'exit' : 'system',
    action: wasOccupied ? 'check_out' : 'cancelled',
    bayId: targetBay.id,
    licensePlate: plate,
    summary: wasOccupied
      ? `Exit gate opened: ${plate} departed ${targetBay.id} (+${formatInr(earned)})`
      : `Reservation cancelled for ${plate} on ${targetBay.id}`,
  };

  const nextBays = [...state.bays];
  nextBays[bayIdx] = updatedBay;

  return {
    ok: true,
    event,
    updatedBay,
    state: {
      ...state,
      bays: nextBays,
      bookings: nextBookings,
      gateEvents: [event, ...state.gateEvents].slice(0, 40),
      hourlyHistory: syncCurrentHourTelemetry(
        state.hourlyHistory,
        nextBays,
        earned,
        wasOccupied ? 1 : 0,
      ),
      revenueToday: Number((state.revenueToday + earned).toFixed(2)),
      lastUpdated: timestamp,
    },
  };
}

export function walkInOccupyBay(state: FacilityState, rawInput: BookingInput): MutationResult {
  const reserved = reserveBay(state, rawInput);
  if (!reserved.ok || !reserved.booking) return reserved;
  const checkedIn = checkInBooking(reserved.state, reserved.booking.id);
  if (!checkedIn.ok) return checkedIn;
  return {
    ...checkedIn,
    event: {
      ...checkedIn.event,
      action: 'walk_in',
      summary: `Drive-up ANPR entry: ${checkedIn.booking?.licensePlate} assigned to ${checkedIn.updatedBay.id}`,
    },
  };
}

export function computeFacilityMetrics(state: FacilityState): FacilityMetrics {
  let availableBays = 0;
  let reservedBays = 0;
  let occupiedBays = 0;
  let evAvailable = 0;
  let accessibleAvailable = 0;
  let vipAvailable = 0;
  let standardAvailable = 0;

  for (const bay of state.bays) {
    if (bay.status === 'available') {
      availableBays += 1;
      if (bay.category === 'ev') evAvailable += 1;
      else if (bay.category === 'accessible') accessibleAvailable += 1;
      else if (bay.category === 'vip') vipAvailable += 1;
      else standardAvailable += 1;
    } else if (bay.status === 'reserved') {
      reservedBays += 1;
    } else {
      occupiedBays += 1;
    }
  }

  const totalBays = state.bays.length;
  const occupancyPct = totalBays > 0 ? Math.round(((occupiedBays + reservedBays) / totalBays) * 100) : 0;

  return {
    totalBays,
    availableBays,
    reservedBays,
    occupiedBays,
    occupancyPct,
    evAvailable,
    accessibleAvailable,
    vipAvailable,
    standardAvailable,
    revenueToday: state.revenueToday,
  };
}

const ZONE_META: Array<{ zone: BayZone; category: BayCategory; label: string }> = [
  { zone: 'A', category: 'standard', label: 'Zone A · Solar Covered' },
  { zone: 'E', category: 'ev', label: 'Zone E · EV Fast-Charge' },
  { zone: 'P', category: 'accessible', label: 'Zone P · Accessible Priority' },
  { zone: 'V', category: 'vip', label: 'Zone V · Express VIP' },
];

export function computeAnalyticsSummary(
  state: FacilityState,
  windowHours: 24 | 12 | 6 = 24,
): AnalyticsSummary {
  const fullHistory = state.hourlyHistory;
  const sliced = fullHistory.slice(-windowHours);
  const metrics = computeFacilityMetrics(state);

  let totalRevenue24h = 0;
  let occupancySum = 0;
  let totalTransactions24h = 0;
  let peakOccupancyRate = -1;
  let peakOccupancyHour = sliced[0]?.hourLabel ?? '—';
  let peakHourlyRevenue = -1;
  let peakRevenueHour = sliced[0]?.hourLabel ?? '—';

  for (const pt of sliced) {
    totalRevenue24h += pt.revenue;
    occupancySum += pt.occupancyRate;
    totalTransactions24h += pt.transactions;
    if (pt.occupancyRate > peakOccupancyRate) {
      peakOccupancyRate = pt.occupancyRate;
      peakOccupancyHour = pt.hourLabel;
    }
    if (pt.revenue > peakHourlyRevenue) {
      peakHourlyRevenue = pt.revenue;
      peakRevenueHour = pt.hourLabel;
    }
  }

  const count = sliced.length || 1;
  const currentHourRevenue = fullHistory[fullHistory.length - 1]?.revenue ?? 0;

  const zoneBreakdown: ZoneUtilization[] = ZONE_META.map((meta) => {
    const zoneBays = state.bays.filter((b) => b.zone === meta.zone);
    const totalBays = zoneBays.length;
    const availableBays = zoneBays.filter((b) => b.status === 'available').length;
    const reservedBays = zoneBays.filter((b) => b.status === 'reserved').length;
    const occupiedBays = zoneBays.filter((b) => b.status === 'occupied').length;
    const utilizationPct = totalBays > 0 ? Math.round(((reservedBays + occupiedBays) / totalBays) * 100) : 0;
    const hourlyRate = zoneBays[0]?.hourlyRate ?? 0;

    return {
      zone: meta.zone,
      category: meta.category,
      label: meta.label,
      totalBays,
      availableBays,
      reservedBays,
      occupiedBays,
      utilizationPct,
      hourlyRate,
    };
  });

  return {
    totalRevenue24h: Number(totalRevenue24h.toFixed(2)),
    currentHourRevenue: Number(currentHourRevenue.toFixed(2)),
    avgOccupancy24h: Math.round(occupancySum / count),
    currentOccupancyPct: metrics.occupancyPct,
    peakOccupancyRate: Math.max(0, peakOccupancyRate),
    peakOccupancyHour,
    peakHourlyRevenue: Number(Math.max(0, peakHourlyRevenue).toFixed(2)),
    peakRevenueHour,
    totalTransactions24h,
    zoneBreakdown,
  };
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const WEEKDAY_DEMAND_FACTORS = [0.92, 1.06, 1.11, 1.13, 1.12, 1.16, 0.96] as const;

export function project7DayRevenue(state: FacilityState): RevenueProjectionPoint[] {
  const summary24h = computeAnalyticsSummary(state, 24);
  const baseRevenue = summary24h.totalRevenue24h > 0 ? summary24h.totalRevenue24h : 12000;

  const recent6 = state.hourlyHistory.slice(-6);
  const avgRecent6 =
    recent6.length > 0
      ? recent6.reduce((sum, pt) => sum + pt.occupancyRate, 0) / recent6.length
      : summary24h.avgOccupancy24h;

  const occupancyDelta = (summary24h.currentOccupancyPct - summary24h.avgOccupancy24h) / 100;
  const recentDelta = (avgRecent6 - summary24h.avgOccupancy24h) / 100;
  const rawShift = occupancyDelta * 0.85 + recentDelta * 0.25;
  const momentumFactor = 1 + Math.max(-0.25, Math.min(0.65, rawShift));

  const parsedAnchor = new Date(state.lastUpdated);
  const anchorMs = Number.isNaN(parsedAnchor.getTime())
    ? Date.UTC(2026, 10, 14)
    : Date.UTC(
        parsedAnchor.getUTCFullYear(),
        parsedAnchor.getUTCMonth(),
        parsedAnchor.getUTCDate(),
      );

  const points: RevenueProjectionPoint[] = [];
  for (let dayIndex = 1; dayIndex <= 7; dayIndex += 1) {
    const dt = new Date(anchorMs + dayIndex * 86_400_000);
    const weekday = dt.getUTCDay();
    const weekdayLabel = WEEKDAY_NAMES[weekday];
    const monthDay = `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`;
    const weekdayFactor = WEEKDAY_DEMAND_FACTORS[weekday];
    const horizonDrift = 1 + (dayIndex - 1) * (occupancyDelta >= 0 ? 0.012 : -0.008);

    const projectedRevenue = Math.round(
      baseRevenue * weekdayFactor * momentumFactor * horizonDrift,
    );
    const baselineRevenue = Math.round(baseRevenue * weekdayFactor);
    const expectedOccupancyPct = Math.max(
      12,
      Math.min(
        98,
        Math.round(
          summary24h.avgOccupancy24h * weekdayFactor * (0.85 + 0.15 * momentumFactor) +
            (summary24h.currentOccupancyPct - 38) * 0.35,
        ),
      ),
    );

    points.push({
      dayIndex,
      dayLabel: `${weekdayLabel} ${monthDay}`,
      weekdayLabel,
      projectedRevenue,
      baselineRevenue,
      expectedOccupancyPct,
    });
  }

  return points;
}

const ZONE_DIURNAL_FACTORS: Record<BayZone, readonly number[]> = {
  // 00:00 .. 23:00 diurnal demand profile per zone (0..1 scale)
  A: [0.18, 0.14, 0.12, 0.12, 0.16, 0.28, 0.42, 0.62, 0.78, 0.86, 0.88, 0.90, 0.92, 0.88, 0.82, 0.76, 0.70, 0.66, 0.56, 0.46, 0.36, 0.28, 0.25, 0.22],
  E: [0.22, 0.18, 0.15, 0.15, 0.18, 0.26, 0.36, 0.52, 0.68, 0.76, 0.82, 0.88, 0.94, 0.96, 0.88, 0.80, 0.78, 0.88, 0.84, 0.72, 0.58, 0.48, 0.50, 0.30],
  P: [0.10, 0.08, 0.08, 0.08, 0.10, 0.14, 0.24, 0.36, 0.52, 0.64, 0.72, 0.76, 0.78, 0.74, 0.70, 0.62, 0.54, 0.46, 0.38, 0.30, 0.24, 0.20, 0.25, 0.14],
  V: [0.16, 0.12, 0.10, 0.10, 0.12, 0.20, 0.30, 0.44, 0.58, 0.70, 0.78, 0.82, 0.84, 0.80, 0.74, 0.68, 0.72, 0.86, 0.88, 0.78, 0.66, 0.52, 0.50, 0.26],
};

const HEATMAP_ZONE_ORDER: Array<{ zone: BayZone; zoneIndex: number; zoneLabel: string }> = [
  { zone: 'V', zoneIndex: 0, zoneLabel: 'Zone V · VIP' },
  { zone: 'P', zoneIndex: 1, zoneLabel: 'Zone P · Access' },
  { zone: 'E', zoneIndex: 2, zoneLabel: 'Zone E · EV Wing' },
  { zone: 'A', zoneIndex: 3, zoneLabel: 'Zone A · Solar' },
];

export function computeDemandHeatmap(state: FacilityState): DemandHeatmapCell[] {
  const parsedLast = new Date(state.lastUpdated);
  const currentHour = Number.isNaN(parsedLast.getTime()) ? 22 : parsedLast.getUTCHours();

  const zoneStats = new Map<BayZone, { active: number; total: number }>();
  for (const meta of HEATMAP_ZONE_ORDER) {
    const zoneBays = state.bays.filter((b) => b.zone === meta.zone);
    const active = zoneBays.filter((b) => b.status !== 'available').length;
    zoneStats.set(meta.zone, { active, total: zoneBays.length });
  }

  const cells: DemandHeatmapCell[] = [];
  for (const meta of HEATMAP_ZONE_ORDER) {
    const stats = zoneStats.get(meta.zone) ?? { active: 0, total: 1 };
    const profile = ZONE_DIURNAL_FACTORS[meta.zone];

    for (let hourIndex = 0; hourIndex < 24; hourIndex += 1) {
      const hourLabel = `${String(hourIndex).padStart(2, '0')}:00`;
      const isCurrentHour = hourIndex === currentHour;

      let activeStalls: number;
      let demandPct: number;
      if (isCurrentHour) {
        activeStalls = stats.active;
        demandPct = stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0;
      } else {
        const factor = profile[hourIndex];
        demandPct = Math.round(factor * 100);
        activeStalls = Math.round(factor * stats.total);
      }

      cells.push({
        hourIndex,
        hourLabel,
        zoneIndex: meta.zoneIndex,
        zone: meta.zone,
        zoneLabel: meta.zoneLabel,
        demandPct,
        activeStalls,
        totalStalls: stats.total,
        isCurrentHour,
      });
    }
  }

  return cells;
}

export function filterBays(
  bays: ParkingBay[],
  category: BayCategory | 'all',
  status: BayStatus | 'all',
  query: string,
): ParkingBay[] {
  const q = query.trim().toLowerCase();
  return bays.filter((bay) => {
    if (category !== 'all' && bay.category !== category) return false;
    if (status !== 'all' && bay.status !== status) return false;
    if (!q) return true;
    return (
      bay.id.toLowerCase().includes(q) ||
      bay.label.toLowerCase().includes(q) ||
      (bay.licensePlate?.toLowerCase().includes(q) ?? false) ||
      (bay.driverName?.toLowerCase().includes(q) ?? false)
    );
  });
}

const SIM_PLATES = ['MH14-ST19', 'KA05-CT80', 'DL08-EC55', 'TN10-NE31', 'GJ01-MT64', 'TS07-LX91'];
const SIM_DRIVERS = ['Vivaan Joshi', 'Meera Krishnan', 'Kabir Bansal', 'Ishita Chatterjee', 'Aditya Menon', 'Neha Kapoor'];
const SIM_VEHICLES: VehicleType[] = ['sedan', 'ev_hatch', 'suv', 'compact'];

export function simulateTrafficPulse(state: FacilityState, seedIndex: number): MutationResult {
  const reservedBookings = state.bookings.filter((bk) => bk.status === 'reserved');
  const availableBays = state.bays.filter((b) => b.status === 'available');
  const occupiedBays = state.bays.filter((b) => b.status === 'occupied');

  // Prefer checking in a reserved booking first, or arriving if >= 6 bays free, else departing
  if (reservedBookings.length > 0 && seedIndex % 3 === 0) {
    const target = reservedBookings[seedIndex % reservedBookings.length];
    return checkInBooking(state, target.id);
  }

  if (availableBays.length >= 6 || occupiedBays.length === 0) {
    const bay = availableBays[seedIndex % availableBays.length];
    if (!bay) {
      return { ok: false, error: 'All bays are currently occupied.' };
    }
    const plate = SIM_PLATES[seedIndex % SIM_PLATES.length] + (seedIndex % 9);
    const driverName = SIM_DRIVERS[seedIndex % SIM_DRIVERS.length];
    const vehicleType = bay.category === 'ev' ? 'ev_hatch' : SIM_VEHICLES[seedIndex % SIM_VEHICLES.length];
    return walkInOccupyBay(state, {
      bayId: bay.id,
      driverName,
      licensePlate: plate,
      vehicleType,
      durationHours: 1 + (seedIndex % 4),
    });
  }

  const departing = occupiedBays[seedIndex % occupiedBays.length];
  return releaseBay(state, departing.id);
}
