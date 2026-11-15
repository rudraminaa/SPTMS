import { useMemo, useState } from 'react';
import {
  Accessibility,
  Car,
  CheckCircle2,
  Clock,
  Layers,
  Play,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  CATEGORY_LABELS,
  computeFacilityMetrics,
  filterBays,
  formatInr,
  pickVehicleCssColor,
  VEHICLE_LABELS,
  type BayCategory,
  type BayStatus,
  type ParkingBay,
  type VehicleType,
} from '../shared/parkingLogic.ts';

interface AccessibleFloorplanProps {
  bays: ParkingBay[];
  selectedBayId: string | null;
  categoryFilter: BayCategory | 'all';
  statusFilter: BayStatus | 'all';
  searchQuery: string;
  simulating?: boolean;
  onSelectBay: (bayId: string) => void;
  onCategoryFilterChange: (category: BayCategory | 'all') => void;
  onStatusFilterChange: (status: BayStatus | 'all') => void;
  onSearchChange: (query: string) => void;
  onSimulateTraffic?: () => void;
}

const ZONE_FILTER_OPTIONS: Array<{ id: BayCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All Zones' },
  { id: 'standard', label: 'Standard' },
  { id: 'ev', label: 'EV' },
  { id: 'accessible', label: 'Accessible' },
  { id: 'vip', label: 'VIP' },
];

const ZONE_SECTIONS: Array<{ zone: 'A' | 'E' | 'P' | 'V'; title: string; subtitle: string }> = [
  { zone: 'A', title: 'Zone A · Solar Covered Bays', subtitle: 'North wing photovoltaic canopy' },
  { zone: 'E', title: 'Zone E · EV Fast-Charge Wing', subtitle: '150–250 kW DC smart pedestals' },
  { zone: 'P', title: 'Zone P · Accessible Priority', subtitle: 'Wide 3.05m stalls adjacent to Terminal Skybridge' },
  { zone: 'V', title: 'Zone V · Express VIP', subtitle: 'Direct Entry & Exit ANPR gate access' },
];

const LAMP_COORDS: Array<[number, number, number]> = [
  [-17.5, -14.2, -90],
  [-4.0, -14.2, -90],
  [10.5, -14.2, -90],
  [-17.5, 14.2, 90],
  [-2.0, 14.2, 90],
  [12.5, 14.2, 90],
];

const TREE_COORDS: Array<[number, number, number, string]> = [
  [-19.5, -13.8, 0.95, '#2d6a4f'],
  [17.5, -13.8, 1.05, '#40916c'],
  [-19.5, 13.6, 0.9, '#2d6a4f'],
  [17.5, 13.6, 1.0, '#52b788'],
  [-4.8, 12.6, 0.85, '#40916c'],
  [15.2, -6.5, 0.88, '#2d6a4f'],
];

const ROAD_ARROWS: Array<{ x: number; z: number; angleDeg: number }> = [
  { x: -13.0, z: 6.85, angleDeg: 0 },
  { x: -4.5, z: 6.85, angleDeg: 0 },
  { x: 9.5, z: 6.85, angleDeg: 0 },
  { x: 13.5, z: 0, angleDeg: -90 },
  { x: 7.5, z: -6.85, angleDeg: 180 },
  { x: -4.5, z: -6.85, angleDeg: 180 },
  { x: -15.5, z: 0, angleDeg: 90 },
];

const SOLAR_COLUMN_X = [-13.8, -7.8, -1.8, 4.2, 10.6];

function getStatusColors(status: BayStatus) {
  if (status === 'available') {
    return {
      stroke: '#10b981',
      fill: 'rgba(16, 185, 129, 0.10)',
      badge: '#34d399',
      label: 'Available',
    };
  }
  if (status === 'reserved') {
    return {
      stroke: '#f59e0b',
      fill: 'rgba(245, 158, 11, 0.16)',
      badge: '#fbbf24',
      label: 'Reserved',
    };
  }
  return {
    stroke: '#f43f5e',
    fill: 'rgba(244, 63, 94, 0.13)',
    badge: '#fb7185',
    label: 'Occupied',
  };
}

function getCategoryAccent(category: BayCategory): string {
  if (category === 'ev') return '#10b981';
  if (category === 'accessible') return '#38bdf8';
  if (category === 'vip') return '#f59e0b';
  return '#94a3b8';
}

function TopDownVehicleGraphic({
  type,
  plate,
  rotationY,
}: {
  type: VehicleType;
  plate: string | null;
  rotationY: number;
}) {
  const bodyColor = pickVehicleCssColor(type, plate);
  const dims =
    type === 'suv'
      ? { len: 3.62, wid: 1.66, cabLen: 2.15, cabOffset: -0.14 }
      : type === 'compact'
        ? { len: 3.02, wid: 1.48, cabLen: 1.65, cabOffset: -0.08 }
        : type === 'ev_hatch'
          ? { len: 3.32, wid: 1.56, cabLen: 1.92, cabOffset: -0.12 }
          : { len: 3.58, wid: 1.58, cabLen: 1.86, cabOffset: -0.1 };

  // In 3D: rotationY = 0 faces +Z (down/South in SVG); rotationY = Math.PI faces -Z (up/North in SVG)
  const facingAngle = rotationY === 0 ? 0 : 180;
  const hw = dims.wid / 2;
  const hl = dims.len / 2;

  return (
    <g transform={`rotate(${facingAngle})`} pointerEvents="none">
      {/* Grounded contact shadow */}
      <rect
        x={-hw - 0.12}
        y={-hl - 0.1}
        width={dims.wid + 0.24}
        height={dims.len + 0.2}
        rx={0.44}
        fill="rgba(2, 6, 23, 0.58)"
      />
      {/* Left & right side mirrors */}
      <rect x={-hw - 0.12} y={0.28} width={0.14} height={0.24} rx={0.05} fill={bodyColor} stroke="#0f172a" strokeWidth={0.04} />
      <rect x={hw - 0.02} y={0.28} width={0.14} height={0.24} rx={0.05} fill={bodyColor} stroke="#0f172a" strokeWidth={0.04} />

      {/* Main sculpted body shell */}
      <rect
        x={-hw}
        y={-hl}
        width={dims.wid}
        height={dims.len}
        rx={0.34}
        fill={bodyColor}
        stroke="#0f172a"
        strokeWidth={0.07}
      />

      {/* Hood crease accent */}
      <line
        x1={-hw * 0.52}
        y1={hl - 0.28}
        x2={-hw * 0.36}
        y2={dims.cabOffset + dims.cabLen / 2}
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={0.045}
      />
      <line
        x1={hw * 0.52}
        y1={hl - 0.28}
        x2={hw * 0.36}
        y2={dims.cabOffset + dims.cabLen / 2}
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={0.045}
      />

      {/* Glasshouse cabin */}
      <rect
        x={-hw + 0.18}
        y={dims.cabOffset - dims.cabLen / 2}
        width={dims.wid - 0.36}
        height={dims.cabLen}
        rx={0.22}
        fill="#0b1322"
        stroke="rgba(148, 163, 184, 0.32)"
        strokeWidth={0.04}
      />

      {/* Painted roof panel */}
      <rect
        x={-hw + 0.26}
        y={dims.cabOffset - dims.cabLen * 0.28}
        width={dims.wid - 0.52}
        height={dims.cabLen * 0.54}
        rx={0.14}
        fill={bodyColor}
        fillOpacity={0.92}
      />

      {/* Front LED headlights (+Y forward) */}
      <rect x={-hw + 0.14} y={hl - 0.12} width={0.34} height={0.1} rx={0.04} fill="#fef08a" />
      <rect x={hw - 0.48} y={hl - 0.12} width={0.34} height={0.1} rx={0.04} fill="#fef08a" />

      {/* Rear red taillights (-Y rear) */}
      <rect x={-hw + 0.16} y={-hl + 0.03} width={0.36} height={0.09} rx={0.03} fill="#ef4444" />
      <rect x={hw - 0.52} y={-hl + 0.03} width={0.36} height={0.09} rx={0.03} fill="#ef4444" />
    </g>
  );
}

function StatusBadge({ status }: { status: BayStatus }) {
  if (status === 'available') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Available</span>
      </span>
    );
  }
  if (status === 'reserved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400">
        <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Reserved</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-400">
      <Car className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>Occupied</span>
    </span>
  );
}

function CategoryIcon({ category }: { category: BayCategory }) {
  if (category === 'ev') return <Zap className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />;
  if (category === 'accessible') return <Accessibility className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />;
  if (category === 'vip') return <Sparkles className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />;
  return null;
}

export function AccessibleFloorplan({
  bays,
  selectedBayId,
  categoryFilter,
  statusFilter,
  searchQuery,
  simulating = false,
  onSelectBay,
  onCategoryFilterChange,
  onStatusFilterChange,
  onSearchChange,
  onSimulateTraffic,
}: AccessibleFloorplanProps) {
  const [hoveredBayId, setHoveredBayId] = useState<string | null>(null);
  const [showSolarCanopy, setShowSolarCanopy] = useState(true);

  const visibleBays = useMemo(
    () => filterBays(bays, categoryFilter, statusFilter, searchQuery),
    [bays, categoryFilter, statusFilter, searchQuery],
  );
  const visibleIds = useMemo(() => new Set(visibleBays.map((b) => b.id)), [visibleBays]);

  const metrics = useMemo(
    () =>
      computeFacilityMetrics({
        bays,
        bookings: [],
        gateEvents: [],
        hourlyHistory: [],
        revenueToday: 0,
        lastUpdated: '',
      }),
    [bays],
  );

  const inspectedBay = useMemo(
    () =>
      bays.find((b) => b.id === hoveredBayId) ??
      bays.find((b) => b.id === selectedBayId) ??
      null,
    [bays, hoveredBayId, selectedBayId],
  );

  const hasActiveFilter = categoryFilter !== 'all' || statusFilter !== 'all' || searchQuery.trim().length > 0;

  return (
    <section
      aria-label="2D Architectural Facility Floorplan"
      className="h-full w-full overflow-y-auto bg-slate-950 text-slate-100 px-4 sm:px-8 pt-18 pb-10"
    >
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Header & Interactive Filter Controls */}
        <div className="flex flex-col gap-3.5 border-b border-slate-800 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
                2D Architectural Facility Floorplan
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-400">
                <span>40.0m × 29.0m Deck</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular text-emerald-400">
                  {metrics.availableBays} / {metrics.totalBays} Available
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular text-amber-400">{metrics.reservedBays} Reserved</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular text-rose-400">{metrics.occupiedBays} Occupied</span>
                {hasActiveFilter ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular text-sky-300">
                      {visibleBays.length} matching filter
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                aria-pressed={showSolarCanopy}
                onClick={() => setShowSolarCanopy((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-10 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  showSolarCanopy
                    ? 'border-sky-500/60 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25'
                    : 'border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Solar Canopy</span>
              </button>

              {onSimulateTraffic ? (
                <button
                  type="button"
                  disabled={simulating}
                  onClick={onSimulateTraffic}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-10 text-xs font-semibold rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-60 whitespace-nowrap shrink-0 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{simulating ? 'Updating...' : 'Simulate Traffic'}</span>
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex flex-wrap items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
              {(['all', 'available', 'reserved', 'occupied'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => onStatusFilterChange(st)}
                  className={`px-3 py-1.5 min-h-9 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 capitalize ${
                    statusFilter === st
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {st === 'all' ? 'All Statuses' : st}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
              {ZONE_FILTER_OPTIONS.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onCategoryFilterChange(cat.id)}
                  className={`px-2.5 py-1.5 min-h-9 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    categoryFilter === cat.id
                      ? 'bg-slate-100 text-slate-950'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="w-full sm:w-56 sm:ml-auto flex items-center gap-2">
              <label htmlFor="floorplan-search" className="sr-only">
                Search bay, plate, or driver
              </label>
              <input
                id="floorplan-search"
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search bay or plate..."
                className="w-full min-h-10 px-3 py-2 text-sm bg-slate-900 border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              {hasActiveFilter ? (
                <button
                  type="button"
                  onClick={() => {
                    onCategoryFilterChange('all');
                    onStatusFilterChange('all');
                    onSearchChange('');
                  }}
                  className="px-2.5 min-h-10 text-xs font-medium text-sky-300 hover:text-white border border-slate-800 bg-slate-900 rounded-lg whitespace-nowrap shrink-0"
                >
                  Reset
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Graphical 2D Architectural SVG Blueprint */}
        <div
          data-testid="floorplan-2d-blueprint"
          className="rounded-xl border border-slate-800 bg-[#080f1d] overflow-hidden shadow-2xl"
        >
          <div className="w-full">
            <svg
              viewBox="-27.5 -17.5 54 35"
              role="img"
              aria-label="Top-down architectural 2D floorplan of the SPTMS smart parking facility showing all 24 bays, entry and exit ANPR gates, terminal pavilion, crosswalk, solar canopy, EV fast chargers, and driving lanes"
              className="w-full h-auto max-h-[640px] block select-none"
            >
              <defs>
                <pattern id="fp-grid-1m" width="1" height="1" patternUnits="userSpaceOnUse">
                  <path
                    d="M 1 0 L 0 0 0 1"
                    fill="none"
                    stroke="rgba(148, 163, 184, 0.05)"
                    strokeWidth="0.03"
                  />
                </pattern>
                <pattern id="fp-grid-5m" width="5" height="5" patternUnits="userSpaceOnUse">
                  <rect width="5" height="5" fill="url(#fp-grid-1m)" />
                  <path
                    d="M 5 0 L 0 0 0 5"
                    fill="none"
                    stroke="rgba(148, 163, 184, 0.11)"
                    strokeWidth="0.05"
                  />
                </pattern>
                <pattern
                  id="fp-solar-grid"
                  width="1.2"
                  height="1.25"
                  patternUnits="userSpaceOnUse"
                >
                  <rect width="1.2" height="1.25" fill="rgba(14, 165, 233, 0.08)" />
                  <path
                    d="M 1.2 0 L 0 0 0 1.25"
                    fill="none"
                    stroke="rgba(56, 189, 248, 0.25)"
                    strokeWidth="0.04"
                  />
                </pattern>
                <pattern
                  id="fp-reserved-hatch"
                  width="0.6"
                  height="0.6"
                  patternTransform="rotate(45)"
                  patternUnits="userSpaceOnUse"
                >
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="0.6"
                    stroke="rgba(245, 158, 11, 0.35)"
                    strokeWidth="0.14"
                  />
                </pattern>
              </defs>

              {/* Outer urban site canvas + engineering grid */}
              <rect x="-27.5" y="-17.5" width="54" height="35" fill="#091120" />
              <rect x="-27.5" y="-17.5" width="54" height="35" fill="url(#fp-grid-5m)" />

              {/* Adjacent smart-city building edge footprints (North/West/East boundary context) */}
              <g fill="#0f1a2d" stroke="rgba(148, 163, 184, 0.16)" strokeWidth="0.08" strokeDasharray="0.3 0.2">
                <rect x="-22" y="-17.5" width="16" height="0.55" />
                <rect x="-1" y="-17.5" width="14" height="0.55" />
                <rect x="20.5" y="-17.5" width="5" height="0.55" />
                <rect x="-27.3" y="-8" width="2.2" height="10" />
                <rect x="23.8" y="-10.5" width="2.2" height="11" />
              </g>

              {/* Concrete Perimeter Sidewalk Plinth (44.5m x 33.5m centered at -0.5, 0) */}
              <rect
                x="-22.75"
                y="-16.75"
                width="44.5"
                height="33.5"
                rx="0.5"
                fill="#1e293b"
                stroke="#475569"
                strokeWidth="0.14"
              />
              {/* Sidewalk expansion joint lines */}
              <rect
                x="-21.6"
                y="-15.6"
                width="42.2"
                height="31.2"
                rx="0.25"
                fill="none"
                stroke="rgba(148, 163, 184, 0.16)"
                strokeWidth="0.06"
              />

              {/* West Entry Approach Avenue (x = -27.5 .. -20.5, z = 6.85 ± 2.4) */}
              <g>
                <rect x="-27.5" y="4.45" width="7.2" height="4.8" fill="#172234" />
                <line x1="-27.5" y1="4.45" x2="-20.5" y2="4.45" stroke="#94a3b8" strokeWidth="0.1" />
                <line x1="-27.5" y1="9.25" x2="-20.5" y2="9.25" stroke="#94a3b8" strokeWidth="0.1" />
                <line
                  x1="-27.2"
                  y1="6.85"
                  x2="-20.8"
                  y2="6.85"
                  stroke="#fbbf24"
                  strokeOpacity="0.45"
                  strokeWidth="0.08"
                  strokeDasharray="0.55 0.45"
                />
                <text
                  x="-24.1"
                  y="6.35"
                  textAnchor="middle"
                  fill="#38bdf8"
                  fontSize="0.68"
                  fontWeight="700"
                  letterSpacing="0.05"
                >
                  ENTRY AVE
                </text>
                <text x="-24.1" y="7.85" textAnchor="middle" fill="#94a3b8" fontSize="0.52">
                  INBOUND →
                </text>
              </g>

              {/* East Exit Approach Avenue (x = 19.5 .. 26.5, z = 6.85 ± 2.4) */}
              <g>
                <rect x="19.3" y="4.45" width="7.2" height="4.8" fill="#172234" />
                <line x1="19.5" y1="4.45" x2="26.5" y2="4.45" stroke="#94a3b8" strokeWidth="0.1" />
                <line x1="19.5" y1="9.25" x2="26.5" y2="9.25" stroke="#94a3b8" strokeWidth="0.1" />
                <line
                  x1="19.8"
                  y1="6.85"
                  x2="26.2"
                  y2="6.85"
                  stroke="#fbbf24"
                  strokeOpacity="0.45"
                  strokeWidth="0.08"
                  strokeDasharray="0.55 0.45"
                />
                <text
                  x="23.0"
                  y="6.35"
                  textAnchor="middle"
                  fill="#fbbf24"
                  fontSize="0.68"
                  fontWeight="700"
                  letterSpacing="0.05"
                >
                  EXIT AVE
                </text>
                <text x="23.0" y="7.85" textAnchor="middle" fill="#94a3b8" fontSize="0.52">
                  OUTBOUND →
                </text>
              </g>

              {/* Main Asphalt Parking Deck (40.0m x 29.0m centered at -0.5, 0) */}
              <rect
                x="-20.5"
                y="-14.5"
                width="40.0"
                height="29.0"
                rx="0.2"
                fill="#131c2b"
                stroke="#64748b"
                strokeWidth="0.12"
              />

              {/* Zone Perimeter Labels on Sidewalk Apron */}
              <text
                x="-8.0"
                y="-15.92"
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="0.6"
                fontWeight="600"
                letterSpacing="0.05"
              >
                ZONE A · SOLAR (A1–A4)
              </text>
              <text
                x="5.0"
                y="-15.92"
                textAnchor="middle"
                fill="#34d399"
                fontSize="0.6"
                fontWeight="600"
                letterSpacing="0.05"
              >
                ZONE E · EV WING (E1–E4)
              </text>
              <text
                x="3.0"
                y="16.2"
                textAnchor="middle"
                fill="#fbbf24"
                fontSize="0.6"
                fontWeight="600"
                letterSpacing="0.05"
              >
                ZONE V · EXPRESS VIP (V3–V6)
              </text>

              {/* One-Way Circulation Loop Guide Line */}
              <path
                d="M -20.2 6.85 L 19.2 6.85 M 13.5 6.85 L 13.5 -6.85 L -15.5 -6.85 L -15.5 6.85"
                fill="none"
                stroke="rgba(148, 163, 184, 0.22)"
                strokeWidth="0.1"
                strokeDasharray="0.5 0.45"
              />

              {/* Directional Lane Arrows matching 3D arrowPlacements */}
              {ROAD_ARROWS.map((ap, idx) => (
                <g
                  key={idx}
                  transform={`translate(${ap.x}, ${ap.z}) rotate(${ap.angleDeg})`}
                  pointerEvents="none"
                >
                  <path
                    d="M -0.58 -0.14 L 0.12 -0.14 L 0.12 -0.38 L 0.65 0 L 0.12 0.38 L 0.12 0.14 L -0.58 0.14 Z"
                    fill="rgba(226, 232, 240, 0.55)"
                  />
                </g>
              ))}

              {/* Central Landscaped Island Curb (23.5m x 0.7m at x = -2.5, z = 0) */}
              <g>
                <rect
                  x="-14.25"
                  y="-0.35"
                  width="23.5"
                  height="0.7"
                  rx="0.22"
                  fill="#334155"
                  stroke="#cbd5e1"
                  strokeWidth="0.08"
                />
              </g>

              {/* Pedestrian Zebra Crosswalk (x = -11.8 + i * 0.9, z = 6.85) */}
              <g pointerEvents="none">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <rect
                    key={i}
                    x={-11.8 + i * 0.9 - 0.225}
                    y={6.85 - 1.3}
                    width={0.45}
                    height={2.6}
                    rx={0.04}
                    fill="#f8fafc"
                    fillOpacity="0.88"
                  />
                ))}
              </g>

              {/* Hero Structure 1: Smart Terminal & Skybridge Pavilion (-10.2, 11.4) */}
              <g transform="translate(-10.2, 11.4)">
                {/* Stone stepped plinth (7.2m x 4.2m) */}
                <rect
                  x="-3.6"
                  y="-2.1"
                  width="7.2"
                  height="4.2"
                  rx="0.18"
                  fill="#334155"
                  stroke="#94a3b8"
                  strokeWidth="0.1"
                />
                {/* Cantilevered aluminum roof (7.4m x 4.5m) */}
                <rect
                  x="-3.7"
                  y="-2.25"
                  width="7.4"
                  height="4.5"
                  rx="0.14"
                  fill="#1e293b"
                  stroke="#38bdf8"
                  strokeOpacity="0.5"
                  strokeWidth="0.1"
                />
                {/* Warm interior atrium core */}
                <rect
                  x="-2.9"
                  y="-1.55"
                  width="5.8"
                  height="3.1"
                  rx="0.1"
                  fill="rgba(56, 189, 248, 0.15)"
                  stroke="#38bdf8"
                  strokeOpacity="0.35"
                  strokeWidth="0.07"
                />
                {/* Skylight louver */}
                <rect
                  x="-2.1"
                  y="-0.9"
                  width="4.2"
                  height="1.8"
                  rx="0.08"
                  fill="rgba(125, 211, 252, 0.28)"
                  stroke="#7dd3fc"
                  strokeWidth="0.07"
                />
                {/* 4 steel corner mullions */}
                {[
                  [-2.95, -1.6],
                  [2.95, -1.6],
                  [-2.95, 1.6],
                  [2.95, 1.6],
                ].map(([cx, cz], i) => (
                  <rect key={i} x={cx - 0.14} y={cz - 0.14} width={0.28} height={0.28} fill="#94a3b8" />
                ))}
                {/* Rooftop radar dome */}
                <circle cx="2.3" cy="-1.1" r="0.36" fill="#e2e8f0" stroke="#475569" strokeWidth="0.07" />
                <circle cx="2.3" cy="-1.1" r="0.16" fill="#38bdf8" />
                {/* Entrance marker facing crosswalk */}
                <path d="M -0.7 -2.1 L 0 -2.55 L 0.7 -2.1 Z" fill="#38bdf8" />
                <text
                  x="-0.25"
                  y="-0.05"
                  textAnchor="middle"
                  fill="#f8fafc"
                  fontSize="0.54"
                  fontWeight="700"
                  letterSpacing="0.03"
                >
                  TERMINAL PAVILION
                </text>
                <text x="-0.25" y="0.62" textAnchor="middle" fill="#bae6fd" fontSize="0.42">
                  Skybridge & Ticketing
                </text>

                {/* Live Digital Occupancy Totem at (4.55, 0.2) rotated 0.48 rad */}
                <g transform="translate(4.55, 0.2) rotate(-27.5)">
                  <rect
                    x="-0.75"
                    y="-0.22"
                    width="1.5"
                    height="0.44"
                    rx="0.08"
                    fill="#0f172a"
                    stroke="#38bdf8"
                    strokeWidth="0.08"
                  />
                  <text x="0" y="0.12" textAnchor="middle" fill="#34d399" fontSize="0.34" fontWeight="700">
                    {metrics.availableBays}/{metrics.totalBays} OPEN
                  </text>
                </g>
              </g>

              {/* Entry Gate Plaza at (-17.8, 6.85) */}
              <g transform="translate(-17.8, 6.85)">
                {/* Concrete island median */}
                <rect x="-1.1" y="-2.25" width="2.2" height="1.2" rx="0.14" fill="#64748b" stroke="#cbd5e1" strokeWidth="0.07" />
                {/* Reader kiosk */}
                <rect x="-0.7" y="-1.98" width="0.7" height="0.65" rx="0.08" fill="#0f172a" stroke="#0ea5e9" strokeWidth="0.09" />
                {/* ANPR gantry beam spanning lane */}
                <rect x="0.38" y="-1.95" width="0.34" height="3.9" rx="0.06" fill="#334155" stroke="#94a3b8" strokeWidth="0.06" />
                {/* Boom barrier arm */}
                <rect x="0.3" y="-1.25" width="0.12" height="2.7" fill="#ef4444" />
                <rect x="0.3" y="-0.8" width="0.12" height="0.45" fill="#f8fafc" />
                <rect x="0.3" y="0.1" width="0.12" height="0.45" fill="#f8fafc" />
                <rect x="0.3" y="1.0" width="0.12" height="0.45" fill="#f8fafc" />
                {/* Signal beacon */}
                <circle cx="0.55" cy="-1.4" r="0.22" fill="#10b981" stroke="#064e3b" strokeWidth="0.06" />
                <text x="0.4" y="-2.75" textAnchor="middle" fill="#38bdf8" fontSize="0.56" fontWeight="700">
                  ENTRY ANPR
                </text>
              </g>

              {/* Exit Gate Plaza at (16.2, 6.85) */}
              <g transform="translate(16.2, 6.85)">
                <rect x="-1.1" y="-2.25" width="2.2" height="1.2" rx="0.14" fill="#64748b" stroke="#cbd5e1" strokeWidth="0.07" />
                <rect x="-0.7" y="-1.98" width="0.7" height="0.65" rx="0.08" fill="#0f172a" stroke="#f59e0b" strokeWidth="0.09" />
                <rect x="0.38" y="-1.95" width="0.34" height="3.9" rx="0.06" fill="#334155" stroke="#94a3b8" strokeWidth="0.06" />
                <rect x="0.3" y="-1.25" width="0.12" height="2.7" fill="#ef4444" />
                <rect x="0.3" y="-0.8" width="0.12" height="0.45" fill="#f8fafc" />
                <rect x="0.3" y="0.1" width="0.12" height="0.45" fill="#f8fafc" />
                <rect x="0.3" y="1.0" width="0.12" height="0.45" fill="#f8fafc" />
                <circle cx="0.55" cy="-1.4" r="0.22" fill="#10b981" stroke="#064e3b" strokeWidth="0.06" />
                <text x="0.4" y="-2.75" textAnchor="middle" fill="#fbbf24" fontSize="0.56" fontWeight="700">
                  EXIT ANPR
                </text>
              </g>

              {/* All 24 Interactive Parking Bays */}
              {bays.map((bay) => {
                const stallW = bay.category === 'accessible' ? 3.05 : 2.55;
                const stallL = 4.2;
                const hw = stallW / 2;
                const hl = stallL / 2;
                const isSelected = bay.id === selectedBayId;
                const isHovered = bay.id === hoveredBayId;
                const isMatched = visibleIds.has(bay.id);
                const statusStyle = getStatusColors(bay.status);
                const catAccent = getCategoryAccent(bay.category);

                // Direction bay faces: rotationY = 0 faces +Z (open mouth at +hl, curb stop at -hl)
                // rotationY = Math.PI faces -Z (open mouth at -hl, curb stop at +hl)
                const openSouth = bay.coords.rotationY === 0;
                const stallPath = openSouth
                  ? `M ${-hw} ${hl} L ${-hw} ${-hl} L ${hw} ${-hl} L ${hw} ${hl}`
                  : `M ${-hw} ${-hl} L ${-hw} ${hl} L ${hw} ${hl} L ${hw} ${-hl}`;
                const wheelStopY = openSouth ? -hl + 0.25 : hl - 0.25;
                const mouthLabelY = openSouth ? hl + 0.62 : -hl - 0.16;

                // Sensor & EV charger coordinates matching 3D buildParkingBays
                const backSign = openSouth ? -1 : 1;
                const sensorY =
                  Math.abs(bay.coords.z) < 4
                    ? -bay.coords.z
                    : backSign * (stallL / 2 + 0.35);
                const chargerLocalY = Math.abs(bay.coords.z) < 4 ? -0.1 - bay.coords.z : sensorY;

                return (
                  <g
                    key={bay.id}
                    data-testid={`floorplan-bay-${bay.id}`}
                    transform={`translate(${bay.coords.x}, ${bay.coords.z})`}
                    opacity={isMatched ? 1 : 0.22}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    aria-label={`${bay.label}, ${CATEGORY_LABELS[bay.category]}, ${bay.status}, ${formatInr(bay.hourlyRate)} per hour${bay.licensePlate ? `, plate ${bay.licensePlate}` : ''}`}
                    onClick={() => onSelectBay(bay.id)}
                    onMouseEnter={() => setHoveredBayId(bay.id)}
                    onMouseLeave={() => setHoveredBayId((prev) => (prev === bay.id ? null : prev))}
                    onFocus={() => setHoveredBayId(bay.id)}
                    onBlur={() => setHoveredBayId((prev) => (prev === bay.id ? null : prev))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectBay(bay.id);
                      }
                    }}
                    className="cursor-pointer focus:outline-none"
                  >
                    {/* Clickable bounding pad */}
                    <rect
                      x={-hw - 0.12}
                      y={-hl - 0.12}
                      width={stallW + 0.24}
                      height={stallL + 0.24}
                      rx={0.14}
                      fill={statusStyle.fill}
                    />

                    {/* Reserved diagonal hatch overlay */}
                    {bay.status === 'reserved' ? (
                      <rect
                        x={-hw + 0.12}
                        y={-hl + 0.12}
                        width={stallW - 0.24}
                        height={stallL - 0.24}
                        rx={0.1}
                        fill="url(#fp-reserved-hatch)"
                      />
                    ) : null}

                    {/* Accessible hatched buffer strip */}
                    {bay.category === 'accessible' ? (
                      <rect
                        x={hw - 0.42}
                        y={-hl + 0.12}
                        width={0.3}
                        height={stallL - 0.24}
                        fill="rgba(56, 189, 248, 0.22)"
                      />
                    ) : null}

                    {/* Painted U-shaped parking stall lines */}
                    <path
                      d={stallPath}
                      fill="none"
                      stroke={isSelected || isHovered ? '#38bdf8' : catAccent}
                      strokeWidth={isSelected ? 0.16 : 0.1}
                      strokeLinejoin="round"
                    />

                    {/* Concrete wheel-stop curb bar */}
                    <rect
                      x={-hw + 0.35}
                      y={wheelStopY - 0.08}
                      width={stallW - 0.7}
                      height={0.16}
                      rx={0.06}
                      fill="#cbd5e1"
                      fillOpacity="0.65"
                    />

                    {/* Selection / Hover Ring */}
                    {isSelected || isHovered ? (
                      <rect
                        x={-hw - 0.16}
                        y={-hl - 0.16}
                        width={stallW + 0.32}
                        height={stallL + 0.32}
                        rx={0.18}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth={isSelected ? 0.16 : 0.1}
                      />
                    ) : null}

                    {/* Floor category watermark emblem when available or reserved */}
                    {bay.status !== 'occupied' ? (
                      <g pointerEvents="none" opacity={0.85}>
                        {bay.category === 'ev' ? (
                          <path
                            d="M 0.12 -0.65 L -0.45 0.1 L 0.02 0.1 L -0.14 0.75 L 0.48 -0.05 L 0.02 -0.05 Z"
                            fill="#34d399"
                          />
                        ) : bay.category === 'accessible' ? (
                          <g fill="none" stroke="#38bdf8" strokeWidth="0.14" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="-0.15" cy="-0.48" r="0.15" fill="#38bdf8" stroke="none" />
                            <path d="M -0.15 -0.25 L -0.15 0.22 L 0.25 0.22 L 0.38 0.58" />
                            <path d="M -0.15 -0.02 L 0.2 -0.02" />
                            <path d="M 0.05 0.35 A 0.38 0.38 0 1 1 -0.35 -0.05" />
                          </g>
                        ) : bay.category === 'vip' ? (
                          <path
                            d="M -0.45 -0.25 L 0 -0.65 L 0.45 -0.25 M -0.45 0.15 L 0 -0.25 L 0.45 0.15"
                            fill="none"
                            stroke="#fbbf24"
                            strokeWidth="0.15"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        ) : null}

                        {bay.status === 'reserved' ? (
                          <rect
                            x={-0.78}
                            y={-1.35}
                            width={1.56}
                            height={2.7}
                            rx={0.28}
                            fill="none"
                            stroke="#f59e0b"
                            strokeWidth={0.09}
                            strokeDasharray="0.28 0.2"
                          />
                        ) : null}
                      </g>
                    ) : (
                      <TopDownVehicleGraphic
                        type={bay.vehicleType ?? 'sedan'}
                        plate={bay.licensePlate}
                        rotationY={bay.coords.rotationY}
                      />
                    )}

                    {/* Overhead / Curb Sensor Status Indicator Dot */}
                    <circle
                      cx={0}
                      cy={
                        ['A1', 'A2', 'A3', 'A4', 'E1', 'E2', 'E3', 'E4'].includes(bay.id)
                          ? 0
                          : sensorY
                      }
                      r={0.2}
                      fill={statusStyle.stroke}
                      stroke="#0f172a"
                      strokeWidth={0.06}
                    />

                    {/* EV Fast-Charge Pedestal (E1-E6) */}
                    {bay.category === 'ev' ? (
                      <g transform={`translate(0.88, ${chargerLocalY})`} pointerEvents="none">
                        <rect
                          x={-0.33}
                          y={-0.24}
                          width={0.66}
                          height={0.48}
                          rx={0.08}
                          fill="#e2e8f0"
                          stroke="#0f172a"
                          strokeWidth={0.07}
                        />
                        <rect
                          x={-0.2}
                          y={-0.11}
                          width={0.4}
                          height={0.22}
                          rx={0.04}
                          fill={statusStyle.stroke}
                        />
                      </g>
                    ) : null}

                    {/* Bay ID Label cleanly placed on aisle entrance edge */}
                    <g transform={`translate(0, ${mouthLabelY})`} pointerEvents="none">
                      <rect
                        x={-0.68}
                        y={-0.38}
                        width={1.36}
                        height={0.56}
                        rx={0.14}
                        fill={isSelected ? '#0284c7' : '#0f172a'}
                        fillOpacity="0.92"
                        stroke={isSelected ? '#7dd3fc' : statusStyle.stroke}
                        strokeWidth={0.06}
                      />
                      <text
                        x={0}
                        y={0.04}
                        textAnchor="middle"
                        fill="#f8fafc"
                        fontSize="0.44"
                        fontWeight="700"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {bay.id}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Solar PV Canopy Overlay over A1-A4 & E1-E4 (-1.5, -11.1, 25.8m x 5.0m) */}
              {showSolarCanopy ? (
                <g pointerEvents="none">
                  <rect
                    x={-14.4}
                    y={-13.6}
                    width={25.8}
                    height={5.0}
                    rx={0.16}
                    fill="url(#fp-solar-grid)"
                    stroke="#38bdf8"
                    strokeOpacity="0.48"
                    strokeWidth="0.11"
                  />
                  {/* Under-canopy linear LED luminaire bar */}
                  <line
                    x1={-13.8}
                    y1={-9.85}
                    x2={10.8}
                    y2={-9.85}
                    stroke="#7dd3fc"
                    strokeOpacity="0.45"
                    strokeWidth="0.12"
                  />
                  {/* 5 steel support columns at z = -13.5 */}
                  {SOLAR_COLUMN_X.map((cx) => (
                    <g key={cx}>
                      <rect
                        x={cx - 0.16}
                        y={-13.66}
                        width={0.32}
                        height={0.32}
                        fill="#94a3b8"
                        stroke="#0f172a"
                        strokeWidth="0.05"
                      />
                      <line
                        x1={cx}
                        y1={-13.5}
                        x2={cx}
                        y2={-8.7}
                        stroke="rgba(148, 163, 184, 0.35)"
                        strokeWidth="0.09"
                        strokeDasharray="0.25 0.2"
                      />
                    </g>
                  ))}
                  <rect x={-1.5} y={-14.32} width={9.6} height={0.58} rx={0.12} fill="rgba(15, 23, 42, 0.88)" />
                  <text
                    x={3.3}
                    y={-13.92}
                    textAnchor="middle"
                    fill="#7dd3fc"
                    fontSize="0.4"
                    fontWeight="600"
                    letterSpacing="0.05"
                  >
                    PHOTOVOLTAIC SOLAR CANOPY (25.8m)
                  </text>
                </g>
              ) : null}

              {/* Smart LED Streetlamps along north & south curbs */}
              {LAMP_COORDS.map(([lx, lz, deg], i) => (
                <g
                  key={i}
                  transform={`translate(${lx}, ${lz}) rotate(${deg})`}
                  pointerEvents="none"
                >
                  <circle cx={0.85} cy={0} r={0.8} fill="rgba(253, 230, 138, 0.10)" />
                  <circle cx={0} cy={0} r={0.22} fill="#475569" stroke="#cbd5e1" strokeWidth="0.05" />
                  <line x1={0} y1={0} x2={0.85} y2={0} stroke="#64748b" strokeWidth="0.1" />
                  <rect x={0.62} y={-0.14} width={0.44} height={0.28} rx={0.06} fill="#fde68a" />
                </g>
              ))}

              {/* Landscaped Urban Trees in Planters */}
              {TREE_COORDS.map(([tx, tz, sc, tint], i) => (
                <g key={i} transform={`translate(${tx}, ${tz}) scale(${sc})`} pointerEvents="none">
                  <circle cx={0} cy={0} r={0.78} fill="#64748b" stroke="#cbd5e1" strokeWidth="0.07" />
                  <circle cx={0} cy={0} r={0.64} fill={tint} fillOpacity="0.92" />
                  <circle cx={0.28} cy={0.18} r={0.42} fill="#52b788" fillOpacity="0.65" />
                  <circle cx={-0.25} cy={-0.16} r={0.36} fill="#1b4332" fillOpacity="0.45" />
                </g>
              ))}

              {/* Architectural Compass Rose (Top-Right) & Metric Scale Bar (Bottom-Right) */}
              <g transform="translate(23.6, -15.2)" pointerEvents="none">
                <circle cx={0} cy={0} r={1.05} fill="rgba(15, 23, 42, 0.86)" stroke="#475569" strokeWidth="0.08" />
                <path d="M 0 -0.78 L 0.28 0.15 L 0 -0.05 L -0.28 0.15 Z" fill="#38bdf8" />
                <text x={0} y={0.68} textAnchor="middle" fill="#cbd5e1" fontSize="0.52" fontWeight="700">
                  N
                </text>
              </g>

              <g transform="translate(15.2, 16.05)" pointerEvents="none">
                <rect x={-0.4} y={-0.65} width={10.8} height={1.25} rx={0.14} fill="rgba(15, 23, 42, 0.85)" />
                <line x1={0} y1={0.15} x2={10} y2={0.15} stroke="#cbd5e1" strokeWidth="0.09" />
                <line x1={0} y1={-0.1} x2={0} y2={0.3} stroke="#cbd5e1" strokeWidth="0.09" />
                <line x1={5} y1={-0.06} x2={5} y2={0.26} stroke="#cbd5e1" strokeWidth="0.08" />
                <line x1={10} y1={-0.1} x2={10} y2={0.3} stroke="#cbd5e1" strokeWidth="0.09" />
                <text x={0} y={-0.2} textAnchor="middle" fill="#94a3b8" fontSize="0.42" fontFamily="JetBrains Mono, monospace">
                  0
                </text>
                <text x={5} y={-0.2} textAnchor="middle" fill="#94a3b8" fontSize="0.42" fontFamily="JetBrains Mono, monospace">
                  5m
                </text>
                <text x={10} y={-0.2} textAnchor="middle" fill="#94a3b8" fontSize="0.42" fontFamily="JetBrains Mono, monospace">
                  10m
                </text>
              </g>
            </svg>
          </div>

          {/* Live Inspected / Selected Bay Readout + Legend Footer inside Blueprint Sheet */}
          <div className="border-t border-slate-800 bg-slate-900/75 px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
            <div className="min-h-6 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {inspectedBay ? (
                <>
                  <span className="font-mono-tabular font-semibold text-white">
                    {inspectedBay.label}
                  </span>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <span className="text-slate-300">{CATEGORY_LABELS[inspectedBay.category]}</span>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <StatusBadge status={inspectedBay.status} />
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <span className="font-mono-tabular text-slate-200">
                    {formatInr(inspectedBay.hourlyRate)}/h
                  </span>
                  {inspectedBay.chargerKw ? (
                    <>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span className="font-mono-tabular text-emerald-400">
                        {inspectedBay.chargerKw} kW DC
                      </span>
                    </>
                  ) : null}
                  {inspectedBay.licensePlate ? (
                    <>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span className="font-mono-tabular font-medium text-sky-300">
                        {inspectedBay.licensePlate}
                      </span>
                      <span className="text-slate-400">
                        ({inspectedBay.driverName}
                        {inspectedBay.vehicleType ? ` · ${VEHICLE_LABELS[inspectedBay.vehicleType]}` : ''})
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span className="text-slate-400">Click bay to reserve or check in</span>
                    </>
                  )}
                </>
              ) : (
                <span className="text-slate-400">
                  Hover or select any parking stall on the blueprint to inspect telemetry, charger output, or vehicle details.
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-slate-300 shrink-0">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs border border-emerald-400 bg-emerald-500/20" aria-hidden="true" />
                <span>Available</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs border border-amber-400 bg-amber-500/25" aria-hidden="true" />
                <span>Reserved</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs border border-rose-400 bg-rose-500/25" aria-hidden="true" />
                <span>Occupied</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs border border-sky-400 bg-sky-500/20" aria-hidden="true" />
                <span>Solar / Terminal</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                <span>EV Charger</span>
              </span>
            </div>
          </div>
        </div>

        {/* Accessible Bay Directory Index below the Graphical Plan */}
        {visibleBays.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-8 text-center space-y-3">
            <p className="text-base font-medium text-slate-200">No bays match the current filters.</p>
            <p className="text-sm text-slate-400">
              Clear your search query or switch status filters to highlight all 24 bays on the floorplan.
            </p>
            <button
              type="button"
              onClick={() => {
                onCategoryFilterChange('all');
                onStatusFilterChange('all');
                onSearchChange('');
              }}
              className="px-4 py-2 min-h-11 text-sm font-medium bg-sky-500 text-slate-950 rounded-lg hover:bg-sky-400 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            {ZONE_SECTIONS.map((sec) => {
              const zoneBays = bays.filter((b) => b.zone === sec.zone && visibleIds.has(b.id));
              if (zoneBays.length === 0) return null;

              return (
                <div key={sec.zone} className="space-y-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-base font-semibold text-white">{sec.title}</h2>
                    <span className="text-xs text-slate-400">{sec.subtitle}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {zoneBays.map((bay) => {
                      const isSelected = bay.id === selectedBayId;
                      return (
                        <button
                          key={bay.id}
                          type="button"
                          onClick={() => onSelectBay(bay.id)}
                          aria-pressed={isSelected}
                          aria-label={`${bay.label}, ${CATEGORY_LABELS[bay.category]}, ${bay.status}, ${formatInr(bay.hourlyRate)} per hour${bay.licensePlate ? `, plate ${bay.licensePlate}` : ''}`}
                          className={`text-left p-4 min-h-28 rounded-xl border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                            isSelected
                              ? 'border-sky-400 bg-sky-950/40'
                              : 'border-slate-800 bg-slate-900/90 hover:border-slate-600 hover:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono-tabular text-base font-semibold text-white">
                                {bay.id}
                              </span>
                              <CategoryIcon category={bay.category} />
                            </div>
                            <StatusBadge status={bay.status} />
                          </div>

                          <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-400">
                            <span>{CATEGORY_LABELS[bay.category]}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular text-slate-300">
                              {formatInr(bay.hourlyRate)}/h
                            </span>
                            {bay.chargerKw ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono-tabular text-emerald-400">
                                  {bay.chargerKw} kW
                                </span>
                              </>
                            ) : null}
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-xs">
                            {bay.licensePlate ? (
                              <div className="flex items-center justify-between gap-2 text-slate-300">
                                <span className="font-mono-tabular font-medium text-white">
                                  {bay.licensePlate}
                                </span>
                                <span className="truncate text-slate-400">{bay.driverName}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">Ready for booking or ANPR entry</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
