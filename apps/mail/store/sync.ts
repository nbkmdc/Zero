import { atom } from 'jotai';

export const syncConnectionAtom = atom<{
  isConnected: boolean;
  connectionId: string | null;
  lastSync: Date | null;
}>({
  isConnected: false,
  connectionId: null,
  lastSync: null,
});

export const threadsAtom = atom<Record<string, any[]>>({});
export const threadAtom = atom<Record<string, any>>({});

export const syncQueueAtom = atom<Array<{
  id: string;
  type: 'list' | 'get' | 'action';
  params: any;
  timestamp: Date;
}>>([]);

export const threadListAtom = atom<Record<string, {
  threads: any[];
  nextPageToken: string | null;
  isLoading: boolean;
  lastUpdated: Date;
}>>({});
