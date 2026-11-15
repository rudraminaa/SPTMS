import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBookingCost,
  checkInBooking,
  computeAnalyticsSummary,
  computeDemandHeatmap,
  computeFacilityMetrics,
  createInitialFacilityState,
  filterBays,
  formatInr,
  normalizeLicensePlate,
  project7DayRevenue,
  releaseBay,
  reserveBay,
  simulateTrafficPulse,
  validateBookingInput,
  walkInOccupyBay,
} from './parkingLogic.ts';

test('createInitialFacilityState creates 24 unique bays with accurate metrics', () => {
  const state = createInitialFacilityState();
  assert.equal(state.bays.length, 24);
  const ids = new Set(state.bays.map((b) => b.id));
  assert.equal(ids.size, 24);

  const metrics = computeFacilityMetrics(state);
  assert.equal(metrics.totalBays, 24);
  assert.equal(metrics.availableBays + metrics.reservedBays + metrics.occupiedBays, 24);
  assert.ok(metrics.availableBays > 0);
  assert.ok(metrics.evAvailable > 0);
});

test('validateBookingInput rejects empty or invalid inputs without silent fallback', () => {
  const bad = validateBookingInput({
    bayId: '',
    driverName: 'A',
    licensePlate: '!',
    vehicleType: 'sedan',
    durationHours: 0,
  });
  assert.equal(bad.valid, false);
  assert.ok(bad.fieldErrors.bayId);
  assert.ok(bad.fieldErrors.driverName);
  assert.ok(bad.fieldErrors.licensePlate);
  assert.ok(bad.fieldErrors.durationHours);

  const good = validateBookingInput({
    bayId: 'A2',
    driverName: 'Aarav Sharma',
    licensePlate: 'mh12-ev902',
    vehicleType: 'ev_hatch',
    durationHours: 3,
  });
  assert.equal(good.valid, true);
  assert.equal(normalizeLicensePlate(' mh12-ev902! '), 'MH12-EV902');
  assert.equal(calculateBookingCost(120, 3), 360);
});

test('reserveBay -> checkInBooking -> releaseBay updates bay status, counts, and revenue', () => {
  const initial = createInitialFacilityState();
  const initialMetrics = computeFacilityMetrics(initial);

  const reserved = reserveBay(initial, {
    bayId: 'A2',
    driverName: 'Aarav Sharma',
    licensePlate: 'MH12-JT4410',
    vehicleType: 'sedan',
    durationHours: 2,
  });
  assert.equal(reserved.ok, true);
  if (!reserved.ok || !reserved.booking) return;

  assert.equal(reserved.updatedBay.status, 'reserved');
  assert.equal(reserved.updatedBay.licensePlate, 'MH12-JT4410');
  assert.equal(reserved.booking.totalAmount, 120);

  const duplicateReserve = reserveBay(reserved.state, {
    bayId: 'A2',
    driverName: 'Another Driver',
    licensePlate: 'KA01-AB1234',
    vehicleType: 'compact',
    durationHours: 1,
  });
  assert.equal(duplicateReserve.ok, false);

  const checkedIn = checkInBooking(reserved.state, reserved.booking.id);
  assert.equal(checkedIn.ok, true);
  if (!checkedIn.ok) return;
  assert.equal(checkedIn.updatedBay.status, 'occupied');
  assert.equal(checkedIn.booking?.status, 'checked_in');

  const released = releaseBay(checkedIn.state, 'A2');
  assert.equal(released.ok, true);
  if (!released.ok) return;
  assert.equal(released.updatedBay.status, 'available');
  assert.equal(released.updatedBay.licensePlate, null);
  assert.equal(released.state.revenueToday, initial.revenueToday + 120);

  const finalMetrics = computeFacilityMetrics(released.state);
  assert.equal(finalMetrics.availableBays, initialMetrics.availableBays);
});

test('releaseBay on reserved-only bay cancels without adding revenue', () => {
  const initial = createInitialFacilityState();
  const reserved = reserveBay(initial, {
    bayId: 'E2',
    driverName: 'Alex Morgan',
    licensePlate: 'EV-5555',
    vehicleType: 'ev_hatch',
    durationHours: 4,
  });
  assert.equal(reserved.ok, true);
  if (!reserved.ok) return;

  const cancelled = releaseBay(reserved.state, 'E2');
  assert.equal(cancelled.ok, true);
  if (!cancelled.ok) return;
  assert.equal(cancelled.updatedBay.status, 'available');
  assert.equal(cancelled.state.revenueToday, initial.revenueToday);
  assert.equal(cancelled.state.bookings[0].status, 'cancelled');
});

test('filterBays and simulateTrafficPulse behave deterministically', () => {
  const initial = createInitialFacilityState();
  const evOnly = filterBays(initial.bays, 'ev', 'available', '');
  assert.ok(evOnly.every((b) => b.category === 'ev' && b.status === 'available'));

  const pulsed = simulateTrafficPulse(initial, 1);
  assert.equal(pulsed.ok, true);
});

test('hourlyHistory tracks 24 hours and updates live with bookings and checkouts', () => {
  const initial = createInitialFacilityState();
  assert.equal(initial.hourlyHistory.length, 24);
  for (const pt of initial.hourlyHistory) {
    assert.ok(pt.occupancyRate >= 0 && pt.occupancyRate <= 100);
    assert.ok(pt.revenue >= 0);
  }

  const initialSummary = computeAnalyticsSummary(initial, 24);
  assert.equal(initialSummary.zoneBreakdown.length, 4);
  assert.equal(initialSummary.currentOccupancyPct, initial.hourlyHistory[23].occupancyRate);

  const reserved = reserveBay(initial, {
    bayId: 'A2',
    driverName: 'Sam Rivera',
    licensePlate: 'SR-204',
    vehicleType: 'sedan',
    durationHours: 2,
  });
  assert.equal(reserved.ok, true);
  if (!reserved.ok || !reserved.booking) return;

  const afterReserve = computeAnalyticsSummary(reserved.state, 24);
  assert.ok(afterReserve.currentOccupancyPct > initialSummary.currentOccupancyPct);

  const checkedIn = checkInBooking(reserved.state, reserved.booking.id);
  assert.equal(checkedIn.ok, true);
  if (!checkedIn.ok) return;

  const released = releaseBay(checkedIn.state, 'A2');
  assert.equal(released.ok, true);
  if (!released.ok) return;

  const afterCheckout = computeAnalyticsSummary(released.state, 24);
  assert.equal(
    afterCheckout.currentHourRevenue,
    Number((initialSummary.currentHourRevenue + 120).toFixed(2)),
  );
  assert.equal(
    afterCheckout.totalRevenue24h,
    Number((initialSummary.totalRevenue24h + 120).toFixed(2)),
  );
  assert.equal(afterCheckout.totalTransactions24h, initialSummary.totalTransactions24h + 1);

  const last6Summary = computeAnalyticsSummary(released.state, 6);
  assert.ok(last6Summary.totalRevenue24h < afterCheckout.totalRevenue24h);
});

test('project7DayRevenue forecasts 7 days and scales upward with higher live occupancy', () => {
  const initial = createInitialFacilityState();
  const baseForecast = project7DayRevenue(initial);

  assert.equal(baseForecast.length, 7);
  for (let i = 0; i < 7; i += 1) {
    assert.equal(baseForecast[i].dayIndex, i + 1);
    assert.ok(baseForecast[i].projectedRevenue > 0);
    assert.ok(baseForecast[i].baselineRevenue > 0);
    assert.ok(baseForecast[i].expectedOccupancyPct >= 12 && baseForecast[i].expectedOccupancyPct <= 98);
  }

  const base7DaySum = baseForecast.reduce((sum, pt) => sum + pt.projectedRevenue, 0);

  // Occupy two additional bays to raise live occupancy trends
  const occ1 = walkInOccupyBay(initial, {
    bayId: 'A2',
    driverName: 'Taylor Grant',
    licensePlate: 'TG-901',
    vehicleType: 'sedan',
    durationHours: 3,
  });
  assert.equal(occ1.ok, true);
  if (!occ1.ok) return;

  const occ2 = walkInOccupyBay(occ1.state, {
    bayId: 'E2',
    driverName: 'Dana Kim',
    licensePlate: 'DK-402',
    vehicleType: 'ev_hatch',
    durationHours: 2,
  });
  assert.equal(occ2.ok, true);
  if (!occ2.ok) return;

  const higherForecast = project7DayRevenue(occ2.state);
  const higher7DaySum = higherForecast.reduce((sum, pt) => sum + pt.projectedRevenue, 0);
  assert.ok(higher7DaySum > base7DaySum);
});

test('computeDemandHeatmap builds 24x4 matrix and reflects live zone occupancy', () => {
  const initial = createInitialFacilityState();
  const baseCells = computeDemandHeatmap(initial);
  assert.equal(baseCells.length, 96);

  for (const cell of baseCells) {
    assert.ok(cell.hourIndex >= 0 && cell.hourIndex <= 23);
    assert.ok(cell.zoneIndex >= 0 && cell.zoneIndex <= 3);
    assert.ok(cell.demandPct >= 0 && cell.demandPct <= 100);
    assert.ok(cell.totalStalls > 0);
  }

  const baseEvNow = baseCells.find((c) => c.zone === 'E' && c.isCurrentHour);
  assert.ok(baseEvNow);

  const occ = walkInOccupyBay(initial, {
    bayId: 'E2',
    driverName: 'Morgan Reid',
    licensePlate: 'MR-707',
    vehicleType: 'ev_hatch',
    durationHours: 2,
  });
  assert.equal(occ.ok, true);
  if (!occ.ok) return;

  const nextCells = computeDemandHeatmap(occ.state);
  const nextEvNow = nextCells.find((c) => c.zone === 'E' && c.isCurrentHour);
  assert.ok(nextEvNow);
  assert.ok(nextEvNow.demandPct > baseEvNow.demandPct);
  assert.equal(nextEvNow.activeStalls, baseEvNow.activeStalls + 1);
});

test('pickVehicleCssColor returns deterministic #rrggbb strings', async () => {
  const { pickVehicleCssColor } = await import('./parkingLogic.ts');
  const c1 = pickVehicleCssColor('sedan', 'MH12-AB4092');
  const c2 = pickVehicleCssColor('sedan', 'MH12-AB4092');
  assert.equal(c1, c2);
  assert.match(c1, /^#[0-9a-f]{6}$/);
});

test('formatInr formats Indian Rupee currency with en-IN grouping', () => {
  assert.equal(formatInr(60), '₹60');
  assert.equal(formatInr(4280), '₹4,280');
  assert.equal(formatInr(124560), '₹1,24,560');
});


