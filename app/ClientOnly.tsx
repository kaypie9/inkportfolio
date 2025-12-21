'use client';

import { useSyncExternalStore } from 'react';
import type { PropsWithChildren, ReactNode } from 'react';

function subscribe() {
  return () => {};
}

/**
 * true only after JS is hydrated on the client
 */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

interface ClientOnlyProps extends PropsWithChildren {
  fallback?: ReactNode;
}

/**
 * Render children only after client hydration.
 * Show optional fallback until then.
 */
export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const hydrated = useHydrated();
  return hydrated ? <>{children}</> : <>{fallback}</>;
}
