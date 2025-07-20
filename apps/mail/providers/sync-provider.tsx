import { useActiveConnection } from '@/hooks/use-connections';
import { useSyncService } from '@/lib/sync-service';
import { useEffect, type PropsWithChildren } from 'react';
import React from 'react';

export function SyncProvider({ children }: PropsWithChildren) {
  const { data: activeConnection } = useActiveConnection();
  const { isConnected } = useSyncService(activeConnection?.id || null);

  useEffect(() => {
    if (isConnected && activeConnection?.id) {
      console.log('Sync service connected for connection:', activeConnection.id);
    }
  }, [isConnected, activeConnection?.id]);

  return <>{children}</>;
}
