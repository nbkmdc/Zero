import React from 'react';
import { useSyncDemo } from '@/hooks/use-sync-demo';

export function SyncTest() {
  const { isConnected, connectionId, threadCount, testConnection } = useSyncDemo();

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Sync Engine Test</h3>
      <div className="space-y-2">
        <div>
          Connection Status: {isConnected ? '✅ Connected' : '❌ Disconnected'}
        </div>
        <div>
          Connection ID: {connectionId || 'None'}
        </div>
        <div>
          Thread Lists: {threadCount}
        </div>
        <button 
          onClick={testConnection}
          className="px-3 py-1 bg-blue-500 text-white rounded"
          disabled={!isConnected}
        >
          Test Sync
        </button>
      </div>
    </div>
  );
}
