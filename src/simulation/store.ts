import { useSyncExternalStore } from 'react';
import { TICK_DT } from './constants';
import { PhysicsEngine, type SimSnapshot } from './physicsEngine';

// Singleton engine + 10 Hz driver exposed through useSyncExternalStore.
// The Three.js scene reads getSnapshot() every frame without React renders.

export const engine = new PhysicsEngine();

type Listener = () => void;
const listeners = new Set<Listener>();
let snapshot: SimSnapshot = engine.snapshot();
let timer: ReturnType<typeof setInterval> | null = null;

function emit() {
  snapshot = engine.snapshot();
  listeners.forEach((l) => l());
}

export function startSimulation() {
  if (timer) return;
  timer = setInterval(() => {
    engine.step(TICK_DT);
    emit();
  }, TICK_DT * 1000);
}

/** Runs a command against the engine and publishes the new state immediately. */
export function command(fn: (e: PhysicsEngine) => void) {
  fn(engine);
  emit();
}

export const getSnapshot = () => snapshot;

export function subscribe(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useSim(): SimSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot);
}

// --- UI-only view state (not physics) ---------------------------------------
export interface ViewState {
  showLabels: boolean;
  cameraPreset: 'orbit' | 'top' | 'habitat' | 'reactor';
  presetNonce: number;
}

let view: ViewState = { showLabels: true, cameraPreset: 'orbit', presetNonce: 0 };
const viewListeners = new Set<Listener>();

export function setView(patch: Partial<ViewState>) {
  view = { ...view, ...patch };
  viewListeners.forEach((l) => l());
}
export const getView = () => view;
export function useView(): ViewState {
  return useSyncExternalStore(
    (l) => {
      viewListeners.add(l);
      return () => {
        viewListeners.delete(l);
      };
    },
    getView,
  );
}
