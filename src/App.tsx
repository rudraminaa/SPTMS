import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Moon, Play, Sun } from 'lucide-react';
import { AccessibleFloorplan } from './components/AccessibleFloorplan.tsx';
import { BayInspectorDrawer } from './components/BayInspectorDrawer.tsx';
import { FacilityAnalyticsPanel } from './components/FacilityAnalyticsPanel.tsx';
import { OperationsDrawer } from './components/OperationsDrawer.tsx';
import { ParkingViewport } from './components/ParkingViewport.tsx';
import { useFacilitySync } from './hooks/useFacilitySync.ts';
import {
  CATEGORY_LABELS,
  computeFacilityMetrics,
  formatInr,
  type BayCategory,
  type BayStatus,
} from './shared/parkingLogic.ts';
import type { CameraPresetId, LightingMode } from './three/ParkingSceneManager.ts';

type ViewMode = '3d' | '2d' | 'analytics';

const CAMERA_LABELS: Array<{ id: CameraPresetId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'entry_gate', label: 'Entry Gate' },
  { id: 'ev_wing', label: 'EV Wing' },
  { id: 'terminal', label: 'Terminal' },
];

const CATEGORY_FILTERS: Array<{ id: BayCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All Zones' },
  { id: 'standard', label: 'Standard' },
  { id: 'ev', label: 'EV' },
  { id: 'accessible', label: 'Accessible' },
  { id: 'vip', label: 'VIP' },
];

export default function App() {
  const {
    facilityState,
    connectionStatus,
    clientCount,
    latestEvent,
    fetchError,
    reloadSnapshot,
    createBooking,
    walkInBay,
    checkInBooking,
    releaseBay,
    simulateTraffic,
  } = useFacilitySync();

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return '2d';
    }
    return '3d';
  });
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  const [selectedBayId, setSelectedBayId] = useState<string | null>(null);
  const [hoveredBayId, setHoveredBayId] = useState<string | null>(null);
  const [quickBookMode, setQuickBookMode] = useState(false);
  const [operationsTab, setOperationsTab] = useState<'bookings' | 'gatelog' | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<BayCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<BayStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [lightingMode, setLightingMode] = useState<LightingMode>('day');
  const [activePreset, setActivePreset] = useState<CameraPresetId>('overview');
  const [cameraCommand, setCameraCommand] = useState<{ preset: CameraPresetId; seq: number } | null>(null);
  const [focusBayCommand, setFocusBayCommand] = useState<{ bayId: string; seq: number } | null>(null);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      return true;
    }
    return false;
  });
  const [simulating, setSimulating] = useState(false);

  // Keyboard shortcuts: Escape closes drawers, H toggles bottom control dock
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      if (e.key === 'Escape') {
        setSelectedBayId(null);
        setQuickBookMode(false);
        setOperationsTab(null);
      } else if (!inInput && (e.key === 'h' || e.key === 'H')) {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const metrics = useMemo(
    () => (facilityState ? computeFacilityMetrics(facilityState) : null),
    [facilityState],
  );

  const selectedBay = useMemo(
    () => facilityState?.bays.find((b) => b.id === selectedBayId) ?? null,
    [facilityState, selectedBayId],
  );

  const hoveredBay = useMemo(
    () => facilityState?.bays.find((b) => b.id === hoveredBayId) ?? null,
    [facilityState, hoveredBayId],
  );

  const availableBays = useMemo(
    () => facilityState?.bays.filter((b) => b.status === 'available') ?? [],
    [facilityState],
  );

  const activeBooking = useMemo(() => {
    if (!facilityState || !selectedBay?.currentBookingId) return null;
    return facilityState.bookings.find((bk) => bk.id === selectedBay.currentBookingId) ?? null;
  }, [facilityState, selectedBay]);

  const handleSelectBay = useCallback((bayId: string) => {
    setSelectedBayId(bayId);
    setQuickBookMode(false);
  }, []);

  const handleFocusBay = useCallback((bayId: string) => {
    setSelectedBayId(bayId);
    setQuickBookMode(false);
    setViewMode('3d');
    setFocusBayCommand((prev) => ({ bayId, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  const handlePresetClick = useCallback((preset: CameraPresetId) => {
    setActivePreset(preset);
    setViewMode('3d');
    setCameraCommand((prev) => ({ preset, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  const handleQuickBook = useCallback(() => {
    setQuickBookMode(true);
    setSelectedBayId(availableBays[0]?.id ?? null);
  }, [availableBays]);

  const handleSimulateTraffic = useCallback(async () => {
    setSimulating(true);
    await simulateTraffic();
    setSimulating(false);
  }, [simulateTraffic]);

  const handleContextLost = useCallback(() => {
    setWebglUnavailable(true);
    setViewMode('2d');
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar Contract: Zone 1 Brand | Zone 2 Single-line Nav | Zone 3 Primary CTA */}
      <header className="fixed top-0 inset-x-0 z-40 h-14 px-3 sm:px-6 bg-slate-950/92 border-b border-slate-800 flex items-center justify-between gap-2 sm:gap-8">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setViewMode('3d');
            handlePresetClick('overview');
          }}
          className="text-sm sm:text-lg font-display font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          SPTMS
        </a>

        <nav
          aria-label="Primary facility views"
          className="flex items-center gap-2 sm:gap-6"
        >
          <button
            type="button"
            disabled={webglUnavailable}
            onClick={() => setViewMode('3d')}
            className={`py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors ${
              viewMode === '3d'
                ? 'border-sky-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-100 disabled:opacity-40'
            }`}
          >
            <span className="sm:hidden">3D</span>
            <span className="hidden sm:inline">3D Facility</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('2d')}
            className={`py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors ${
              viewMode === '2d'
                ? 'border-sky-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-100'
            }`}
          >
            <span className="sm:hidden">2D</span>
            <span className="hidden sm:inline">2D Floorplan</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('analytics')}
            className={`py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors ${
              viewMode === 'analytics'
                ? 'border-sky-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-100'
            }`}
          >
            <span className="sm:hidden">Analytics</span>
            <span className="hidden sm:inline">Facility Analytics</span>
          </button>
          <button
            type="button"
            onClick={() => setOperationsTab((prev) => (prev === 'bookings' ? null : 'bookings'))}
            className={`py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors ${
              operationsTab === 'bookings'
                ? 'border-sky-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-100'
            }`}
          >
            Bookings
          </button>
          <button
            type="button"
            onClick={() => setOperationsTab((prev) => (prev === 'gatelog' ? null : 'gatelog'))}
            className={`py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors ${
              operationsTab === 'gatelog'
                ? 'border-sky-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-100'
            }`}
          >
            <span className="sm:hidden">Gates</span>
            <span className="hidden sm:inline">Gate Log</span>
          </button>
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={handleQuickBook}
            className="px-2.5 sm:px-4 py-1.5 sm:py-2 min-h-9 text-xs sm:text-sm font-semibold rounded-lg bg-sky-500 text-slate-950 hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0"
          >
            Quick Book
          </button>
        </div>
      </header>

      {/* Main Facility Viewport */}
      <main
        className="relative flex-1 w-full h-full"
        data-view={viewMode}
        data-ws={connectionStatus}
        data-available={metrics?.availableBays ?? ''}
        data-occupied={metrics?.occupiedBays ?? ''}
        data-reserved={metrics?.reservedBays ?? ''}
      >
        {!facilityState ? (
          <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center space-y-3 bg-slate-950">
            {fetchError ? (
              <>
                <p className="text-base font-medium text-rose-300">Unable to connect to facility server</p>
                <p className="text-sm text-slate-400">{fetchError}</p>
                <button
                  type="button"
                  onClick={() => void reloadSnapshot()}
                  className="px-4 py-2 min-h-11 text-sm font-medium rounded-lg bg-sky-500 text-slate-950 hover:bg-sky-400"
                >
                  Retry Connection
                </button>
              </>
            ) : (
              <p className="text-sm text-slate-300">Loading smart-city parking telemetry...</p>
            )}
          </div>
        ) : viewMode === '3d' && !webglUnavailable ? (
          <ParkingViewport
            facilityState={facilityState}
            selectedBayId={selectedBayId}
            categoryFilter={categoryFilter}
            lightingMode={lightingMode}
            cameraCommand={cameraCommand}
            focusBayCommand={focusBayCommand}
            onSelectBay={handleSelectBay}
            onHoverBay={setHoveredBayId}
            onContextLost={handleContextLost}
          />
        ) : viewMode === 'analytics' ? (
          <FacilityAnalyticsPanel
            facilityState={facilityState}
            simulating={simulating}
            onSimulateTraffic={() => void handleSimulateTraffic()}
          />
        ) : (
          <AccessibleFloorplan
            bays={facilityState.bays}
            selectedBayId={selectedBayId}
            categoryFilter={categoryFilter}
            statusFilter={statusFilter}
            searchQuery={searchQuery}
            simulating={simulating}
            onSelectBay={handleSelectBay}
            onCategoryFilterChange={setCategoryFilter}
            onStatusFilterChange={setStatusFilter}
            onSearchChange={setSearchQuery}
            onSimulateTraffic={() => void handleSimulateTraffic()}
          />
        )}

        {/* Quiet Top-Left Telemetry Readout (3D mode, hidden when left drawer is open) */}
        {metrics && viewMode === '3d' && !operationsTab ? (
          <div className="pointer-events-none fixed top-18 left-4 z-20 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-800 bg-slate-950/88 px-4 py-2.5 text-xs text-slate-200 shadow-lg">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono-tabular">
              <span className="font-semibold text-emerald-400">
                {metrics.availableBays} / {metrics.totalBays} Open
              </span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span>{metrics.evAvailable} EV Free</span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span>{metrics.reservedBays} Reserved</span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span>{formatInr(metrics.revenueToday)} Revenue</span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className={connectionStatus === 'connected' ? 'text-sky-300' : 'text-amber-300'}>
                {connectionStatus === 'connected'
                  ? `Live Sync (${clientCount})`
                  : connectionStatus === 'connecting'
                    ? 'Connecting'
                    : 'Reconnecting'}
              </span>
            </div>
            {latestEvent ? (
              <div className="mt-1 text-[11px] text-slate-400 truncate max-w-md">
                {latestEvent.summary}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Hover Tooltip Strip above bottom dock */}
        {viewMode === '3d' && hoveredBay ? (
          <div
            role="status"
            className="pointer-events-none fixed bottom-24 left-1/2 -translate-x-1/2 z-20 rounded-lg border border-slate-700 bg-slate-950/92 px-3.5 py-1.5 text-xs text-slate-100 whitespace-nowrap shadow-lg"
          >
            <span className="font-mono-tabular font-semibold text-white">{hoveredBay.id}</span>
            <span className="mx-2 text-slate-500" aria-hidden="true">·</span>
            <span>{CATEGORY_LABELS[hoveredBay.category]}</span>
            <span className="mx-2 text-slate-500" aria-hidden="true">·</span>
            <span className="font-mono-tabular">{formatInr(hoveredBay.hourlyRate)}/h</span>
            <span className="mx-2 text-slate-500" aria-hidden="true">·</span>
            <span
              className={`capitalize font-medium ${
                hoveredBay.status === 'available'
                  ? 'text-emerald-400'
                  : hoveredBay.status === 'reserved'
                    ? 'text-amber-400'
                    : 'text-rose-400'
              }`}
            >
              {hoveredBay.status}
            </span>
          </div>
        ) : null}

        {/* Slide-Over Left Operations Drawer (Bookings & Gate Log) */}
        {facilityState ? (
          <OperationsDrawer
            activeTab={operationsTab}
            bookings={facilityState.bookings}
            gateEvents={facilityState.gateEvents}
            onSwitchTab={(tab) => setOperationsTab(tab)}
            onClose={() => setOperationsTab(null)}
            onFocusBay={handleFocusBay}
            onCheckIn={checkInBooking}
            onRelease={releaseBay}
          />
        ) : null}

        {/* Slide-Over Right Bay Inspector & Booking Drawer */}
        <BayInspectorDrawer
          bay={selectedBay}
          availableBays={availableBays}
          activeBooking={activeBooking}
          quickBookMode={quickBookMode}
          onSelectBayId={(id) => setSelectedBayId(id)}
          onBookingSuccess={() => setQuickBookMode(false)}
          onClose={() => {
            setSelectedBayId(null);
            setQuickBookMode(false);
          }}
          onReserve={createBooking}
          onWalkIn={walkInBay}
          onCheckIn={checkInBooking}
          onRelease={releaseBay}
        />

        {/* Collapsible Bottom Control Dock (3D Viewport Only) */}
        {viewMode === '3d' && !webglUnavailable ? (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center max-w-[calc(100vw-1.5rem)]">
            <button
              type="button"
              onClick={() => setDockCollapsed((c) => !c)}
              aria-expanded={!dockCollapsed}
              className="mb-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-800 bg-slate-950/92 text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              {dockCollapsed ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Show Controls</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Hide Controls</span>
                </>
              )}
            </button>

            {!dockCollapsed ? (
              <div className="w-full rounded-2xl border border-slate-800 bg-slate-950/92 px-3 py-2 shadow-2xl flex flex-wrap lg:flex-nowrap items-center justify-center gap-2.5 sm:gap-3">
              {/* Camera Presets */}
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 shrink-0">
                {CAMERA_LABELS.map((cam) => (
                  <button
                    key={cam.id}
                    type="button"
                    disabled={webglUnavailable}
                    onClick={() => handlePresetClick(cam.id)}
                    className={`px-2.5 py-1.5 min-h-8 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      viewMode === '3d' && activePreset === cam.id
                        ? 'bg-sky-500 text-slate-950'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40'
                    }`}
                  >
                    {cam.label}
                  </button>
                ))}
              </div>

              <div className="h-5 w-px bg-slate-800 shrink-0" aria-hidden="true" />

              {/* Zone / Category Filters */}
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 shrink-0">
                {CATEGORY_FILTERS.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-2.5 py-1.5 min-h-8 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      categoryFilter === cat.id
                        ? 'bg-slate-100 text-slate-950'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="h-5 w-px bg-slate-800 shrink-0" aria-hidden="true" />

              {/* Lighting Mode + Traffic Simulation */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setLightingMode((m) => (m === 'day' ? 'dusk' : 'day'))}
                  aria-label={`Switch to ${lightingMode === 'day' ? 'dusk' : 'daylight'} lighting`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-9 text-xs font-medium rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  {lightingMode === 'day' ? (
                    <>
                      <Moon className="w-3.5 h-3.5 text-sky-300" aria-hidden="true" />
                      <span>Dusk</span>
                    </>
                  ) : (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                      <span>Daylight</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={simulating}
                  onClick={() => void handleSimulateTraffic()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-9 text-xs font-semibold rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-60 whitespace-nowrap shrink-0 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{simulating ? 'Updating...' : 'Simulate Traffic'}</span>
                </button>
              </div>
            </div>
          ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}
