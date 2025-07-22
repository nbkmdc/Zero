import { durableObjects } from './cloudflare-proxy';
import { createDriver } from './driver';

export const getZeroDB = async (userId: string) => {
  const stub = durableObjects.ZERO_DB.get(durableObjects.ZERO_DB.idFromName(userId));
  const rpcTarget = await stub.setMetaData(userId);
  return rpcTarget;
};

export const getZeroAgent = async (connectionId: string) => {
  const stub = durableObjects.ZERO_DRIVER.get(durableObjects.ZERO_DRIVER.idFromName(connectionId));
  const rpcTarget = await stub.setMetaData(connectionId);
  await rpcTarget.setupAuth();
  return rpcTarget;
};

export const getZeroSocketAgent = async (connectionId: string) => {
  const stub = durableObjects.ZERO_AGENT.get(durableObjects.ZERO_AGENT.idFromName(connectionId));
  return stub;
};

export const verifyToken = async (token: string): Promise<boolean> => {
  try {
    return true;
  } catch {
    return false;
  }
};
