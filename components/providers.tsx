'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function Providers({ children }: { children: ReactNode }) {
  // Lazy-init the QueryClient so it's created exactly once per browser tab.
  // Keeping it in useState guarantees the same client survives re-renders,
  // and the lazy initializer avoids creating a new client on every render.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 30s before data is considered stale and a background refetch is allowed.
            staleTime: 30_000,
            // Keep unused cache entries around for 5 minutes before garbage collection.
            gcTime: 5 * 60_000,
            // Don't surprise the user with refetches when they tab back in.
            refetchOnWindowFocus: false,
            // One retry is enough — surface persistent failures to the user via toasts.
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
