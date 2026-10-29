import { useSyncExternalStore } from "react";

/**
 * Minimal external store built directly on React's useSyncExternalStore.
 * Same surface as the classic `create` helpers (hook + getState/setState/subscribe),
 * but with zero dependencies — guaranteeing a single React instance in the bundle.
 */
export type SetState<T> = (partial: Partial<T> | ((state: T) => Partial<T>)) => void;
export type GetState<T> = () => T;

export interface StoreHook<T> {
  (): T;
  <U>(selector: (state: T) => U): U;
  getState: GetState<T>;
  setState: SetState<T>;
  subscribe: (listener: () => void) => () => void;
}

export function create<T extends object>(initializer: (set: SetState<T>, get: GetState<T>) => T): StoreHook<T> {
  const listeners = new Set<() => void>();
  let state: T;

  const getState: GetState<T> = () => state;

  const setState: SetState<T> = (partial) => {
    const next = typeof partial === "function" ? (partial as (s: T) => Partial<T>)(state) : partial;
    if (!next) return;
    let changed = false;
    for (const key in next) {
      if (!Object.is((next as any)[key], (state as any)[key])) { changed = true; break; }
    }
    if (!changed) return;
    state = { ...state, ...next };
    listeners.forEach((l) => l());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  };

  state = initializer(setState, getState);

  function useStore(): T;
  function useStore<U>(selector: (s: T) => U): U;
  function useStore<U>(selector?: (s: T) => U) {
    const select = (selector ?? ((s: T) => s as unknown as U));
    const snapshot = () => select(state);
    return useSyncExternalStore(subscribe, snapshot, snapshot);
  }

  return Object.assign(useStore, { getState, setState, subscribe }) as StoreHook<T>;
}
