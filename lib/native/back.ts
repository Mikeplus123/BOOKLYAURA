"use client";
// A stack of "close me first" handlers for the Android back button / back gesture.
// Sheets, dialogs and full-screen players register here; the native bridge calls the top one
// before falling back to browser history (and finally minimising the app on the home screen).

type Handler = () => void;
const stack: Handler[] = [];

/** Register a handler (e.g. "close this sheet"). Returns an unregister function. */
export function pushBackHandler(handler: Handler): () => void {
  stack.push(handler);
  return () => {
    const i = stack.lastIndexOf(handler);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** Runs the top handler. Returns false when nothing was open. */
export function runBackHandler(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top();
  return true;
}
