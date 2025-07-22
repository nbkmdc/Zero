export enum EProviders {
  google = 'google',
  outlook = 'outlook',
}

export interface ISubscribeBatch {
  connectionId: string;
  providerId: EProviders;
}

export interface IThreadBatch {
  providerId: EProviders;
  historyId: string;
  subscriptionName: string;
}
