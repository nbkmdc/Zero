import React from 'react';
import { SyncTest } from '@/components/sync-test';

export default function SyncTestPage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Sync Engine Test Page</h1>
      <SyncTest />
    </div>
  );
}
