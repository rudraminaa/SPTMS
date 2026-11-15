import { useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  computeAnalyticsSummary,
  computeDemandHeatmap,
  formatInr,
  project7DayRevenue,
  type DemandHeatmapCell,
  type FacilityState,
  type HourlyTelemetryPoint,
  type RevenueProjectionPoint,
} from '../shared/parkingLogic.ts';

interface FacilityAnalyticsPanelProps {
  facilityState: FacilityState;
  simulating?: boolean;
  onSimulateTraffic?: () => void;
}

type WindowHours = 24 | 12 | 6;

const WINDOW_OPTIONS: Array<{ value: WindowHours; label: string }> = [
  { value: 24, label: '24 Hours' },
  { value: 12, label: 'Last 12 Hours' },
  { value: 6, label: 'Last 6 Hours' },
];

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: HourlyTelemetryPoint }>;
}

function RevenueTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs shadow-xl">
      <div className="font-mono-tabular font-semibold text-white">{pt.hourLabel}</div>
      <div className="mt-1 flex items-center justify-between gap-4 text-slate-300">
        <span>Hourly Revenue</span>
        <span className="font-mono-tabular font-semibold text-sky-300">
          {formatInr(pt.revenue)}
        </span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-4 text-slate-400">
        <span>Completed Exits</span>
        <span className="font-mono-tabular text-slate-200">{pt.transactions}</span>
      </div>
    </div>
  );
}

function OccupancyTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs shadow-xl">
      <div className="font-mono-tabular font-semibold text-white">{pt.hourLabel}</div>
      <div className="mt-1 flex items-center justify-between gap-4 text-slate-300">
        <span>Occupancy Rate</span>
        <span className="font-mono-tabular font-semibold text-emerald-300">
          {pt.occupancyRate}%
        </span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-4 text-slate-400">
        <span>Occupied / Reserved</span>
        <span className="font-mono-tabular text-slate-200">
          {pt.occupiedCount} / {pt.reservedCount}
        </span>
      </div>
    </div>
  );
}

function ProjectionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: RevenueProjectionPoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0].payload;
  const delta = pt.projectedRevenue - pt.baselineRevenue;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs shadow-xl">
      <div className="font-mono-tabular font-semibold text-white">{pt.dayLabel}</div>
      <div className="mt-1 flex items-center justify-between gap-4 text-slate-300">
        <span>Projected Revenue</span>
        <span className="font-mono-tabular font-semibold text-sky-300">
          {formatInr(pt.projectedRevenue)}
        </span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-4 text-slate-400">
        <span>24h Baseline</span>
        <span className="font-mono-tabular text-slate-200">
          {formatInr(pt.baselineRevenue)} ({delta >= 0 ? '+' : '-'}{formatInr(Math.abs(delta))})
        </span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-4 text-slate-400">
        <span>Expected Occupancy</span>
        <span className="font-mono-tabular font-semibold text-amber-300">
          {pt.expectedOccupancyPct}%
        </span>
      </div>
    </div>
  );
}

const HEATMAP_ZONE_AXIS_LABELS: Record<number, string> = {
  0: 'VIP (V)',
  1: 'Access (P)',
  2: 'EV Wing (E)',
  3: 'Solar (A)',
};

function getHeatmapFill(demandPct: number): string {
  if (demandPct >= 85) return '#f43f5e';
  if (demandPct >= 70) return '#f59e0b';
  if (demandPct >= 50) return '#14b8a6';
  if (demandPct >= 30) return '#0284c7';
  return '#1e3a5f';
}

function getDemandTierLabel(demandPct: number): string {
  if (demandPct >= 85) return 'Peak';
  if (demandPct >= 70) return 'High';
  if (demandPct >= 50) return 'Busy';
  if (demandPct >= 30) return 'Moderate';
  return 'Low';
}

function DemandHeatmapTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DemandHeatmapCell }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const cell = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs shadow-xl">
      <div className="font-mono-tabular font-semibold text-white">
        {cell.hourLabel} · {cell.zoneLabel}
        {cell.isCurrentHour ? ' (Live)' : ''}
      </div>
      <div className="mt-1 flex items-center justify-between gap-4 text-slate-300">
        <span>Demand Intensity</span>
        <span className="font-mono-tabular font-semibold text-white">
          {cell.demandPct}% ({getDemandTierLabel(cell.demandPct)})
        </span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-4 text-slate-400">
        <span>Active Bays</span>
        <span className="font-mono-tabular text-slate-200">
          {cell.activeStalls} / {cell.totalStalls}
        </span>
      </div>
    </div>
  );
}

export function FacilityAnalyticsPanel({
  facilityState,
  simulating = false,
  onSimulateTraffic,
}: FacilityAnalyticsPanelProps) {
  const [windowHours, setWindowHours] = useState<WindowHours>(24);
  const [heatmapSize, setHeatmapSize] = useState({ w: 1080, h: 256 });

  const chartData = useMemo(
    () => facilityState.hourlyHistory.slice(-windowHours),
    [facilityState.hourlyHistory, windowHours],
  );

  const summary = useMemo(
    () => computeAnalyticsSummary(facilityState, windowHours),
    [facilityState, windowHours],
  );

  const projectionData = useMemo(
    () => project7DayRevenue(facilityState),
    [facilityState],
  );

  const projected7DayTotal = useMemo(
    () => projectionData.reduce((sum, pt) => sum + pt.projectedRevenue, 0),
    [projectionData],
  );

  const avgExpectedOccupancy = useMemo(() => {
    if (projectionData.length === 0) return 0;
    return Math.round(
      projectionData.reduce((sum, pt) => sum + pt.expectedOccupancyPct, 0) /
        projectionData.length,
    );
  }, [projectionData]);

  const heatmapCells = useMemo(
    () => computeDemandHeatmap(facilityState),
    [facilityState],
  );

  const peakHeatmapCell = useMemo(() => {
    if (heatmapCells.length === 0) return null;
    return heatmapCells.reduce((best, cell) =>
      cell.demandPct > best.demandPct ? cell : best,
    );
  }, [heatmapCells]);

  const plotW = Math.max(180, heatmapSize.w - 18 - 88);
  const plotH = Math.max(120, heatmapSize.h - 18 - 28);
  const cellW = Math.max(8, plotW / 24 - 3);
  const cellH = Math.max(24, plotH / 4 - 5);

  const renderHeatmapCell = (rawProps: unknown) => {
    const props = rawProps as {
      cx?: number;
      cy?: number;
      isActive?: boolean;
      payload?: DemandHeatmapCell;
    };
    if (
      typeof props.cx !== 'number' ||
      typeof props.cy !== 'number' ||
      !props.payload
    ) {
      return <g />;
    }
    const cell = props.payload;
    const fill = getHeatmapFill(cell.demandPct);
    const stroke = props.isActive
      ? '#ffffff'
      : cell.isCurrentHour
        ? '#38bdf8'
        : '#0f172a';
    const strokeWidth = props.isActive ? 2 : cell.isCurrentHour ? 1.5 : 1;

    return (
      <g>
        <rect
          x={props.cx - cellW / 2}
          y={props.cy - cellH / 2}
          width={cellW}
          height={cellH}
          rx={4}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        {cellW >= 30 ? (
          <text
            x={props.cx}
            y={props.cy + 3.5}
            textAnchor="middle"
            fill={cell.demandPct >= 70 ? '#0f172a' : '#f8fafc'}
            fontSize={10}
            fontWeight={600}
            style={{ pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}
          >
            {cell.demandPct}%
          </text>
        ) : null}
      </g>
    );
  };

  return (
    <section
      aria-label="Facility Analytics"
      className="h-full w-full overflow-y-auto bg-slate-950 text-slate-100 px-4 sm:px-8 pt-20 pb-12"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="max-w-xl">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Facility Analytics
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Hourly revenue trends and bay occupancy rates across the last 24 hours, updated live with gate checkouts and arrivals.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
            <div
              role="group"
              aria-label="Analytics time range"
              className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1"
            >
              {WINDOW_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setWindowHours(opt.value)}
                  className={`px-3 py-1.5 min-h-9 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    windowHours === opt.value
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

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

        {/* 4-Column KPI Summary Strip (Single Elevation, Hairline Dividers) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 rounded-xl border border-slate-800 bg-slate-900/75 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
          <div className="p-4 sm:p-5">
            <div className="text-xs text-slate-400">
              {windowHours === 24 ? '24h Total Revenue' : `${windowHours}h Total Revenue`}
            </div>
            <div
              data-testid="analytics-total-revenue"
              className="mt-1.5 text-2xl font-semibold font-mono-tabular text-white"
            >
              {formatInr(summary.totalRevenue24h)}
            </div>
            <div className="mt-1 text-xs text-slate-400 font-mono-tabular">
              Current hour {formatInr(summary.currentHourRevenue)} · {summary.totalTransactions24h} exits
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="text-xs text-slate-400">
              {windowHours === 24 ? '24h Avg Occupancy' : `${windowHours}h Avg Occupancy`}
            </div>
            <div
              data-testid="analytics-avg-occupancy"
              className="mt-1.5 text-2xl font-semibold font-mono-tabular text-white"
            >
              {summary.avgOccupancy24h}%
            </div>
            <div className="mt-1 text-xs text-emerald-400 font-mono-tabular">
              Live occupancy {summary.currentOccupancyPct}%
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="text-xs text-slate-400">Peak Occupancy Hour</div>
            <div className="mt-1.5 text-2xl font-semibold font-mono-tabular text-white">
              {summary.peakOccupancyRate}%
            </div>
            <div className="mt-1 text-xs text-slate-400 font-mono-tabular">
              Recorded at {summary.peakOccupancyHour}
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="text-xs text-slate-400">Peak Hourly Revenue</div>
            <div className="mt-1.5 text-2xl font-semibold font-mono-tabular text-white">
              {formatInr(summary.peakHourlyRevenue)}
            </div>
            <div className="mt-1 text-xs text-slate-400 font-mono-tabular">
              Recorded at {summary.peakRevenueHour}
            </div>
          </div>
        </div>

        {/* Dual Recharts Visualizations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div
            data-testid="revenue-chart-card"
            className="rounded-xl border border-slate-800 bg-slate-900/75 p-5 flex flex-col"
          >
            <div className="flex items-baseline justify-between gap-2 pb-4 border-b border-slate-800/80">
              <div>
                <h2 className="text-base font-semibold text-white">Hourly Revenue Trend</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Settled gate checkout revenue per hour (INR)
                </p>
              </div>
              <span className="text-xs font-mono-tabular text-sky-300 whitespace-nowrap">
                Today {formatInr(facilityState.revenueToday)}
              </span>
            </div>

            <div className="mt-4 h-72 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="revenueAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="hourLabel"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                    minTickGap={22}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val: number) =>
                      val >= 1000 ? `₹${(val / 1000).toFixed(1)}k` : `₹${Math.round(val)}`
                    }
                    width={50}
                  />
                  <Tooltip content={<RevenueTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Hourly Revenue"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    fill="url(#revenueAreaGradient)"
                    activeDot={{ r: 5, fill: '#38bdf8', stroke: '#0f172a', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div
            data-testid="occupancy-chart-card"
            className="rounded-xl border border-slate-800 bg-slate-900/75 p-5 flex flex-col"
          >
            <div className="flex items-baseline justify-between gap-2 pb-4 border-b border-slate-800/80">
              <div>
                <h2 className="text-base font-semibold text-white">Hourly Occupancy Rate</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Combined occupied &amp; reserved bay utilization (%)
                </p>
              </div>
              <span className="text-xs font-mono-tabular text-emerald-400 whitespace-nowrap">
                Now {summary.currentOccupancyPct}%
              </span>
            </div>

            <div className="mt-4 h-72 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="occupancyAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34d399" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="hourLabel"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                    minTickGap={22}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val: number) => `${val}%`}
                    width={42}
                  />
                  <ReferenceLine
                    y={80}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{
                      value: '80% High Demand',
                      position: 'insideTopRight',
                      fill: '#fbbf24',
                      fontSize: 10,
                    }}
                  />
                  <Tooltip content={<OccupancyTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="occupancyRate"
                    name="Occupancy Rate"
                    stroke="#34d399"
                    strokeWidth={2}
                    fill="url(#occupancyAreaGradient)"
                    activeDot={{ r: 5, fill: '#34d399', stroke: '#0f172a', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 7-Day Revenue Projection Chart */}
        <div
          data-testid="projection-chart-card"
          className="rounded-xl border border-slate-800 bg-slate-900/75 p-5 flex flex-col"
        >
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-4 border-b border-slate-800/80">
            <div>
              <h2 className="text-base font-semibold text-white">7-Day Revenue Projection</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Projected daily revenue and expected occupancy trend across the next 7 days
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono-tabular whitespace-nowrap">
              <span data-testid="analytics-7day-total" className="text-sky-300 font-semibold">
                7-Day Forecast {formatInr(projected7DayTotal)}
              </span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="text-amber-300">
                Avg Expected {avgExpectedOccupancy}%
              </span>
            </div>
          </div>

          <div className="mt-4 h-72 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <ComposedChart
                data={projectionData}
                margin={{ top: 12, right: 8, left: 0, bottom: 4 }}
              >
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="dayLabel"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  yAxisId="rev"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val: number) =>
                    val >= 1000 ? `₹${(val / 1000).toFixed(1)}k` : `₹${Math.round(val)}`
                  }
                  width={56}
                />
                <YAxis
                  yAxisId="occ"
                  orientation="right"
                  domain={[0, 100]}
                  stroke="#64748b"
                  tick={{ fill: '#fbbf24', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val: number) => `${val}%`}
                  width={42}
                />
                <Tooltip content={<ProjectionTooltip />} />
                <Bar
                  yAxisId="rev"
                  dataKey="projectedRevenue"
                  name="Projected Revenue"
                  fill="#0ea5e9"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={44}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="rev"
                  type="monotone"
                  dataKey="baselineRevenue"
                  name="24h Baseline"
                  stroke="#94a3b8"
                  strokeWidth={1.75}
                  strokeDasharray="4 4"
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="occ"
                  type="monotone"
                  dataKey="expectedOccupancyPct"
                  name="Expected Occupancy"
                  stroke="#fbbf24"
                  strokeWidth={2}
                  dot={{ r: 3.5, fill: '#fbbf24', stroke: '#0f172a', strokeWidth: 1.5 }}
                  activeDot={{ r: 5, fill: '#fbbf24', stroke: '#0f172a', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-400">
            <span className="inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-sky-500" aria-hidden="true" />
              <span>Projected Daily Revenue (INR)</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-4 border-t-2 border-dashed border-slate-400" aria-hidden="true" />
              <span>24h Baseline Rate</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-4 border-t-2 border-amber-400" aria-hidden="true" />
              <span>Expected Occupancy (%)</span>
            </span>
          </div>
        </div>

        {/* Peak Demand Heat Map by Time of Day */}
        <div
          data-testid="heatmap-chart-card"
          className="rounded-xl border border-slate-800 bg-slate-900/75 p-5 flex flex-col"
        >
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-4 border-b border-slate-800/80">
            <div>
              <h2 className="text-base font-semibold text-white">
                Peak Parking Demand Heat Map
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Hourly demand intensity (%) by time of day across all facility zones
              </p>
            </div>
            {peakHeatmapCell ? (
              <div
                data-testid="analytics-heatmap-peak"
                className="text-xs font-mono-tabular text-rose-300 whitespace-nowrap"
              >
                Peak {peakHeatmapCell.demandPct}% · {peakHeatmapCell.zoneLabel} at{' '}
                {peakHeatmapCell.hourLabel}
              </div>
            ) : null}
          </div>

          <div className="mt-4 h-64 w-full min-w-0">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              onResize={(w, h) => setHeatmapSize({ w, h })}
            >
              <ScatterChart margin={{ top: 10, right: 12, left: 6, bottom: 8 }}>
                <XAxis
                  type="number"
                  dataKey="hourIndex"
                  domain={[-0.5, 23.5]}
                  ticks={[0, 3, 6, 9, 12, 15, 18, 21, 23]}
                  tickFormatter={(h: number) => `${String(h).padStart(2, '0')}:00`}
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  type="number"
                  dataKey="zoneIndex"
                  domain={[-0.5, 3.5]}
                  ticks={[0, 1, 2, 3]}
                  tickFormatter={(idx: number) => HEATMAP_ZONE_AXIS_LABELS[idx] ?? ''}
                  stroke="#64748b"
                  tick={{ fill: '#cbd5e1', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={88}
                />
                <Tooltip cursor={false} content={<DemandHeatmapTooltip />} />
                <Scatter
                  name="Hourly Zone Demand"
                  data={heatmapCells}
                  shape={renderHeatmapCell}
                  isAnimationActive={false}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-400">
            <span className="inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#1e3a5f]" aria-hidden="true" />
              <span>&lt;30% Low</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#0284c7]" aria-hidden="true" />
              <span>30–49% Moderate</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#14b8a6]" aria-hidden="true" />
              <span>50–69% Busy</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b]" aria-hidden="true" />
              <span>70–84% High</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#f43f5e]" aria-hidden="true" />
              <span>85%+ Peak</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm border border-sky-400" aria-hidden="true" />
              <span>Live Hour</span>
            </span>
          </div>
        </div>

        {/* Live Zone Utilization Breakdown */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/75 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-white">Live Zone Utilization</h2>
            <span className="text-xs text-slate-400">
              Real-time capacity across all 24 smart-city stalls
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400">
                  <th scope="col" className="px-5 py-3 font-medium">Zone</th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">Rate</th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">Occupied</th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">Reserved</th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">Available</th>
                  <th scope="col" className="px-5 py-3 font-medium text-right">Utilization</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {summary.zoneBreakdown.map((z) => (
                  <tr key={z.zone} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3 font-medium text-white whitespace-nowrap">
                      {z.label}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular text-slate-300">
                      {formatInr(z.hourlyRate)}/h
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular text-rose-300">
                      {z.occupiedBays}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular text-amber-300">
                      {z.reservedBays}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular text-emerald-300">
                      {z.availableBays} / {z.totalBays}
                    </td>
                    <td className="px-5 py-3 text-right font-mono-tabular text-white">
                      <div className="inline-flex items-center gap-2.5 justify-end">
                        <div className="hidden sm:block w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-sky-400"
                            style={{ width: `${z.utilizationPct}%` }}
                          />
                        </div>
                        <span className="w-10 text-right">{z.utilizationPct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
