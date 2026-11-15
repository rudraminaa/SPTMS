import { useEffect, useState, type FormEvent } from 'react';
import { Car, CheckCircle2, Clock, DoorOpen, X, Zap } from 'lucide-react';
import {
  CATEGORY_LABELS,
  VEHICLE_LABELS,
  calculateBookingCost,
  formatInr,
  validateBookingInput,
  type BookingInput,
  type BookingRecord,
  type ParkingBay,
  type ValidationResult,
  type VehicleType,
} from '../shared/parkingLogic.ts';
import type { ApiActionResponse } from '../hooks/useFacilitySync.ts';

interface BayInspectorDrawerProps {
  bay: ParkingBay | null;
  availableBays: ParkingBay[];
  activeBooking: BookingRecord | null;
  quickBookMode: boolean;
  onSelectBayId: (bayId: string) => void;
  onBookingSuccess?: () => void;
  onClose: () => void;
  onReserve: (input: BookingInput) => Promise<ApiActionResponse>;
  onWalkIn: (bayId: string, input: Omit<BookingInput, 'bayId'>) => Promise<ApiActionResponse>;
  onCheckIn: (bookingId: string) => Promise<ApiActionResponse>;
  onRelease: (bayId: string) => Promise<ApiActionResponse>;
}

export function BayInspectorDrawer({
  bay,
  availableBays,
  activeBooking,
  quickBookMode,
  onSelectBayId,
  onBookingSuccess,
  onClose,
  onReserve,
  onWalkIn,
  onCheckIn,
  onRelease,
}: BayInspectorDrawerProps) {
  const [driverName, setDriverName] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('sedan');
  const [durationHours, setDurationHours] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ValidationResult['fieldErrors']>({});

  useEffect(() => {
    setFormError(null);
    setFieldErrors({});
    if (bay?.category === 'ev') {
      setVehicleType('ev_hatch');
    }
  }, [bay?.id, bay?.category]);

  if (!bay && !quickBookMode) return null;

  const targetBay = bay ?? availableBays[0] ?? null;
  const estimatedCost = targetBay ? calculateBookingCost(targetBay.hourlyRate, durationHours) : 0;

  const handleReserveSubmit = async (e: FormEvent, instantCheckIn: boolean) => {
    e.preventDefault();
    if (!targetBay) return;

    const validation = validateBookingInput({
      bayId: targetBay.id,
      driverName,
      licensePlate,
      vehicleType,
      durationHours,
    });
    if (!validation.valid) {
      setFieldErrors(validation.fieldErrors);
      setFormError('Please correct the highlighted booking fields.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const res = instantCheckIn
      ? await onWalkIn(targetBay.id, { driverName, licensePlate, vehicleType, durationHours })
      : await onReserve({ bayId: targetBay.id, driverName, licensePlate, vehicleType, durationHours });

    setSubmitting(false);
    if (!res.ok) {
      setFormError(res.error ?? 'Could not process booking.');
      setFieldErrors(res.fieldErrors ?? {});
      return;
    }

    setDriverName('');
    setLicensePlate('');
    setDurationHours(2);
    onBookingSuccess?.();
  };

  const handleCheckIn = async () => {
    if (!activeBooking) return;
    setSubmitting(true);
    setFormError(null);
    const res = await onCheckIn(activeBooking.id);
    setSubmitting(false);
    if (!res.ok) setFormError(res.error ?? 'Check-in failed.');
  };

  const handleRelease = async () => {
    if (!targetBay) return;
    setSubmitting(true);
    setFormError(null);
    const res = await onRelease(targetBay.id);
    setSubmitting(false);
    if (!res.ok) setFormError(res.error ?? 'Release failed.');
  };

  return (
    <aside
      aria-label="Bay Inspector and Booking Panel"
      className="fixed top-16 right-4 bottom-4 sm:bottom-24 z-30 w-[calc(100vw-2rem)] sm:w-96 rounded-2xl border border-slate-800 bg-slate-950/95 text-slate-100 shadow-2xl flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-white">
            {targetBay ? `${targetBay.label} Inspector` : 'Quick Book'}
          </h2>
          {targetBay ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span>{CATEGORY_LABELS[targetBay.category]}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">{formatInr(targetBay.hourlyRate)}/h</span>
              {targetBay.chargerKw ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular text-emerald-400">{targetBay.chargerKw} kW</span>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close bay inspector"
          className="p-2 min-w-10 min-h-10 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {!targetBay ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
            All 24 bays are currently reserved or occupied. Release a bay or wait for an exit departure.
          </div>
        ) : (
          <>
            {quickBookMode && targetBay.status === 'available' && availableBays.length > 0 ? (
              <div className="space-y-1.5">
                <label htmlFor="quick-bay-select" className="block text-xs font-medium text-slate-300">
                  Select Available Bay
                </label>
                <select
                  id="quick-bay-select"
                  value={targetBay.id}
                  onChange={(e) => onSelectBayId(e.target.value)}
                  className="w-full min-h-11 px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {availableBays.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.id} — {CATEGORY_LABELS[b.category]} ({formatInr(b.hourlyRate)}/h)
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {/* Bay Status Summary */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-slate-400">Sensor Telemetry</div>
                <div className="mt-1 flex items-center gap-2 text-sm font-medium text-white">
                  {targetBay.status === 'available' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                      <span>Available · Ultrasonic Clear</span>
                    </>
                  ) : targetBay.status === 'reserved' ? (
                    <>
                      <Clock className="w-4 h-4 text-amber-400" aria-hidden="true" />
                      <span>Reserved · Awaiting Gate Entry</span>
                    </>
                  ) : (
                    <>
                      <Car className="w-4 h-4 text-rose-400" aria-hidden="true" />
                      <span>Occupied · Vehicle Detected</span>
                    </>
                  )}
                </div>
              </div>
              {targetBay.chargerKw ? (
                <div className="text-right">
                  <div className="text-xs text-slate-400">Charger</div>
                  <div className="mt-1 inline-flex items-center gap-1 text-xs font-mono-tabular text-emerald-400">
                    <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{targetBay.chargerKw} kW DC</span>
                  </div>
                </div>
              ) : null}
            </div>

            {formError ? (
              <div
                role="alert"
                className="rounded-lg border border-rose-500/40 bg-rose-950/60 px-3.5 py-2.5 text-xs text-rose-200"
              >
                {formError}
              </div>
            ) : null}

            {targetBay.status === 'available' ? (
              <form onSubmit={(e) => handleReserveSubmit(e, false)} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <label htmlFor="booking-driver" className="block text-xs font-medium text-slate-300">
                    Driver Full Name
                  </label>
                  <input
                    id="booking-driver"
                    type="text"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="e.g. Aarav Sharma"
                    className="w-full min-h-11 px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  {fieldErrors.driverName ? (
                    <p className="text-xs text-rose-400">{fieldErrors.driverName}</p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="booking-plate" className="block text-xs font-medium text-slate-300">
                    License Plate (ANPR)
                  </label>
                  <input
                    id="booking-plate"
                    type="text"
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                    placeholder="e.g. MH12-EV9042"
                    className="w-full min-h-11 px-3 py-2 text-sm font-mono-tabular bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  {fieldErrors.licensePlate ? (
                    <p className="text-xs text-rose-400">{fieldErrors.licensePlate}</p>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="booking-vehicle" className="block text-xs font-medium text-slate-300">
                      Vehicle Class
                    </label>
                    <select
                      id="booking-vehicle"
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value as VehicleType)}
                      className="w-full min-h-11 px-2.5 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      {(Object.keys(VEHICLE_LABELS) as VehicleType[]).map((vt) => (
                        <option key={vt} value={vt}>
                          {VEHICLE_LABELS[vt]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="booking-duration" className="block text-xs font-medium text-slate-300">
                      Duration (Hours)
                    </label>
                    <input
                      id="booking-duration"
                      type="number"
                      min={1}
                      max={24}
                      value={durationHours}
                      onChange={(e) => setDurationHours(Number(e.target.value))}
                      className="w-full min-h-11 px-3 py-2 text-sm font-mono-tabular bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    {fieldErrors.durationHours ? (
                      <p className="text-xs text-rose-400">{fieldErrors.durationHours}</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-sm">
                  <span className="text-slate-400">Estimated Total</span>
                  <span className="font-mono-tabular text-lg font-semibold text-white">
                    {formatInr(estimatedCost)}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 pt-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full min-h-11 px-4 py-2.5 text-sm font-semibold rounded-lg bg-sky-500 text-slate-950 hover:bg-sky-400 disabled:opacity-60 transition-colors"
                  >
                    {submitting ? 'Processing...' : `Reserve ${targetBay.id}`}
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={(e) => void handleReserveSubmit(e, true)}
                    className="w-full min-h-11 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 disabled:opacity-60 transition-colors"
                  >
                    Direct ANPR Drive-In
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <dl className="rounded-xl border border-slate-800 bg-slate-900/70 divide-y divide-slate-800 text-sm">
                  <div className="px-4 py-2.5 flex justify-between gap-3">
                    <dt className="text-slate-400">Driver</dt>
                    <dd className="font-medium text-white text-right">
                      {targetBay.driverName ?? activeBooking?.driverName ?? 'Registered Driver'}
                    </dd>
                  </div>
                  <div className="px-4 py-2.5 flex justify-between gap-3">
                    <dt className="text-slate-400">License Plate</dt>
                    <dd className="font-mono-tabular font-semibold text-white">
                      {targetBay.licensePlate ?? activeBooking?.licensePlate ?? '—'}
                    </dd>
                  </div>
                  {activeBooking ? (
                    <>
                      <div className="px-4 py-2.5 flex justify-between gap-3">
                        <dt className="text-slate-400">Gate Pass</dt>
                        <dd className="font-mono-tabular text-sky-300">{activeBooking.accessCode}</dd>
                      </div>
                      <div className="px-4 py-2.5 flex justify-between gap-3">
                        <dt className="text-slate-400">Duration</dt>
                        <dd className="font-mono-tabular text-slate-200">
                          {activeBooking.durationHours}h · {formatInr(activeBooking.totalAmount)}
                        </dd>
                      </div>
                    </>
                  ) : null}
                </dl>

                <div className="space-y-2.5">
                  {targetBay.status === 'reserved' && activeBooking ? (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleCheckIn()}
                      className="w-full min-h-11 px-4 py-2.5 text-sm font-semibold rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <DoorOpen className="w-4 h-4" aria-hidden="true" />
                      <span>Open Entry Gate & Check In</span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleRelease()}
                    className="w-full min-h-11 px-4 py-2.5 text-sm font-medium rounded-lg border border-rose-500/40 bg-rose-950/40 text-rose-200 hover:bg-rose-900/50 disabled:opacity-60 transition-colors"
                  >
                    {targetBay.status === 'occupied'
                      ? 'Open Exit Gate & Check Out'
                      : 'Cancel Reservation'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
