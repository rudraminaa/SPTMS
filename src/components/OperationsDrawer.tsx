import { useState } from 'react';
import { Crosshair, DoorOpen, LogOut, X } from 'lucide-react';
import { formatInr, type BookingRecord, type GateEvent } from '../shared/parkingLogic.ts';
import type { ApiActionResponse } from '../hooks/useFacilitySync.ts';

interface OperationsDrawerProps {
  activeTab: 'bookings' | 'gatelog' | null;
  bookings: BookingRecord[];
  gateEvents: GateEvent[];
  onSwitchTab: (tab: 'bookings' | 'gatelog') => void;
  onClose: () => void;
  onFocusBay: (bayId: string) => void;
  onCheckIn: (bookingId: string) => Promise<ApiActionResponse>;
  onRelease: (bayId: string) => Promise<ApiActionResponse>;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

export function OperationsDrawer({
  activeTab,
  bookings,
  gateEvents,
  onSwitchTab,
  onClose,
  onFocusBay,
  onCheckIn,
  onRelease,
}: OperationsDrawerProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active');

  if (!activeTab) return null;

  const q = search.trim().toLowerCase();
  const filteredBookings = bookings.filter((bk) => {
    if (statusFilter === 'active' && (bk.status === 'completed' || bk.status === 'cancelled')) {
      return false;
    }
    if (!q) return true;
    return (
      bk.bayId.toLowerCase().includes(q) ||
      bk.licensePlate.toLowerCase().includes(q) ||
      bk.driverName.toLowerCase().includes(q) ||
      bk.accessCode.toLowerCase().includes(q)
    );
  });

  return (
    <aside
      aria-label="Facility Bookings and Gate Telemetry"
      className="fixed top-16 left-4 bottom-24 z-30 w-[calc(100vw-2rem)] sm:w-[27rem] rounded-2xl border border-slate-800 bg-slate-950/95 text-slate-100 shadow-2xl flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => onSwitchTab('bookings')}
            className={`px-3 py-1.5 min-h-9 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'bookings'
                ? 'bg-sky-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Bookings ({bookings.filter((b) => b.status === 'reserved' || b.status === 'checked_in').length})
          </button>
          <button
            type="button"
            onClick={() => onSwitchTab('gatelog')}
            className={`px-3 py-1.5 min-h-9 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'gatelog'
                ? 'bg-sky-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Gate Log ({gateEvents.length})
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close operations drawer"
          className="p-2 min-w-10 min-h-10 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {activeTab === 'bookings' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-800/80 space-y-2.5">
            <div className="flex items-center gap-2">
              <label htmlFor="bookings-search" className="sr-only">
                Search bookings by plate, driver, or bay
              </label>
              <input
                id="bookings-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by plate, driver, or bay..."
                className="flex-1 min-h-10 px-3 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={() => setStatusFilter((s) => (s === 'active' ? 'all' : 'active'))}
                className="px-3 min-h-10 text-xs font-medium rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                {statusFilter === 'active' ? 'Active Only' : 'All History'}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {filteredBookings.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 text-center text-sm text-slate-400">
                No booking records match this filter.
              </div>
            ) : (
              filteredBookings.map((bk) => (
                <div
                  key={bk.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/85 p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-tabular text-sm font-semibold text-white">
                        {bk.bayId}
                      </span>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span className="font-mono-tabular text-sm text-sky-300">{bk.licensePlate}</span>
                    </div>
                    <span
                      className={`text-xs font-medium capitalize ${
                        bk.status === 'checked_in'
                          ? 'text-emerald-400'
                          : bk.status === 'reserved'
                            ? 'text-amber-400'
                            : 'text-slate-400'
                      }`}
                    >
                      {bk.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="truncate">{bk.driverName}</span>
                    <span className="font-mono-tabular text-slate-300">
                      {bk.durationHours}h · {formatInr(bk.totalAmount)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onFocusBay(bk.bayId)}
                      className="px-2.5 py-1.5 min-h-9 text-xs font-medium rounded-lg border border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Locate</span>
                    </button>

                    {bk.status === 'reserved' ? (
                      <button
                        type="button"
                        onClick={() => void onCheckIn(bk.id)}
                        className="px-2.5 py-1.5 min-h-9 text-xs font-semibold rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <DoorOpen className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Check In</span>
                      </button>
                    ) : null}

                    {(bk.status === 'reserved' || bk.status === 'checked_in') ? (
                      <button
                        type="button"
                        onClick={() => void onRelease(bk.bayId)}
                        className="px-2.5 py-1.5 min-h-9 text-xs font-medium rounded-lg border border-rose-500/40 bg-rose-950/40 text-rose-200 hover:bg-rose-900/50 inline-flex items-center gap-1.5 whitespace-nowrap ml-auto"
                      >
                        <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{bk.status === 'checked_in' ? 'Check Out' : 'Cancel'}</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {gateEvents.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 text-center text-sm text-slate-400">
              No gate activity recorded yet.
            </div>
          ) : (
            gateEvents.map((evt) => (
              <div
                key={evt.id}
                className="rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2.5 space-y-1"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono-tabular font-semibold text-sky-300 uppercase">
                    {evt.gate} · {evt.bayId}
                  </span>
                  <span className="font-mono-tabular text-slate-400">{formatTime(evt.timestamp)}</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">{evt.summary}</p>
              </div>
            ))
          )}
        </div>
      )}
    </aside>
  );
}
