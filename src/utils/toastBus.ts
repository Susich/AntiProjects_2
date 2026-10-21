export type GlobalToastType = 'success' | 'info' | 'warning' | 'error';

export interface GlobalToastOptions {
  type?: GlobalToastType;
  duration?: number;
  icon?: unknown;
}

type ToastListener = (message: string, options?: GlobalToastOptions) => void;

let listener: ToastListener | null = null;

/**
 * Lets background code (request queue, sync engine) show the same toast as a
 * screen without importing React context. The provider registers one listener.
 */
export function registerGlobalToastListener(next: ToastListener): () => void {
  listener = next;
  return () => {
    if (listener === next) listener = null;
  };
}

export function showGlobalToast(message: string, options?: GlobalToastOptions): void {
  if (listener) {
    listener(message, options);
    return;
  }
  // Before the provider mounts (or in tests) keep the message visible in logs
  // instead of throwing from a background task.
  console.warn('[Toast]', message);
}
