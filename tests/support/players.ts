import { act, renderHook } from '@testing-library/react';

/**
 * Mounts one player's copy of a game hook and waits for the room to load.
 * Call it once per seat: each copy has its own local state and its own
 * realtime subscription, exactly as separate browsers would.
 */
export async function seat<R>(hook: () => R) {
  const view = renderHook(hook);
  await act(async () => {});
  return view.result;
}

/** Runs player actions inside React's act, so their state settles before asserting. */
export async function play(...actions: Array<() => Promise<unknown>>) {
  await act(async () => {
    await Promise.all(actions.map((action) => action()));
  });
}
