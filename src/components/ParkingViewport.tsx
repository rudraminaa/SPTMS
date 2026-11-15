import { useEffect, useRef } from 'react';
import type { BayCategory, FacilityState } from '../shared/parkingLogic.ts';
import {
  ParkingSceneManager,
  type CameraPresetId,
  type LightingMode,
} from '../three/ParkingSceneManager.ts';

interface ParkingViewportProps {
  facilityState: FacilityState;
  selectedBayId: string | null;
  categoryFilter: BayCategory | 'all';
  lightingMode: LightingMode;
  cameraCommand: { preset: CameraPresetId; seq: number } | null;
  focusBayCommand: { bayId: string; seq: number } | null;
  onSelectBay: (bayId: string) => void;
  onHoverBay: (bayId: string | null) => void;
  onContextLost: () => void;
}

export function ParkingViewport({
  facilityState,
  selectedBayId,
  categoryFilter,
  lightingMode,
  cameraCommand,
  focusBayCommand,
  onSelectBay,
  onHoverBay,
  onContextLost,
}: ParkingViewportProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const managerRef = useRef<ParkingSceneManager | null>(null);
  const initialStateRef = useRef<FacilityState>(facilityState);

  const onSelectRef = useRef(onSelectBay);
  const onHoverRef = useRef(onHoverBay);
  const onContextLostRef = useRef(onContextLost);

  onSelectRef.current = onSelectBay;
  onHoverRef.current = onHoverBay;
  onContextLostRef.current = onContextLost;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let manager: ParkingSceneManager | null = null;
    try {
      manager = new ParkingSceneManager({
        container,
        initialState: initialStateRef.current,
        onSelectBay: (bayId) => onSelectRef.current(bayId),
        onHoverBay: (bayId) => onHoverRef.current(bayId),
        onContextLost: () => onContextLostRef.current(),
      });
      managerRef.current = manager;
    } catch {
      onContextLostRef.current();
    }

    return () => {
      manager?.dispose();
      managerRef.current = null;
    };
  }, []);

  useEffect(() => {
    managerRef.current?.syncState(facilityState, true);
  }, [facilityState]);

  useEffect(() => {
    managerRef.current?.setSelectedBay(selectedBayId);
  }, [selectedBayId]);

  useEffect(() => {
    managerRef.current?.setCategoryFilter(categoryFilter);
  }, [categoryFilter]);

  useEffect(() => {
    managerRef.current?.applyLightingMode(lightingMode);
  }, [lightingMode]);

  useEffect(() => {
    if (cameraCommand) {
      managerRef.current?.setCameraPreset(cameraCommand.preset);
    }
  }, [cameraCommand]);

  useEffect(() => {
    if (focusBayCommand) {
      managerRef.current?.focusBay(focusBayCommand.bayId);
    }
  }, [focusBayCommand]);

  return (
    <div
      ref={mountRef}
      data-testid="parking-3d-canvas"
      className="w-full h-full select-none outline-none"
      aria-label="Interactive 3D smart-city parking facility viewport. Use mouse drag to orbit, scroll to zoom, and click a bay to inspect or book."
    />
  );
}
