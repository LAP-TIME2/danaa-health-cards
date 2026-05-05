import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { DanaaNextCheckin } from "./api.js";

export type LocalState = {
  installedAt?: string;
  latestCard?: DanaaNextCheckin;
  latestLeaseId?: string;
  latestShownAt?: string;
  lastHookTurnId?: string;
  autoSuppressedUntil?: string;
  snoozeUntil?: string;
  dndUntil?: string;
  pendingDeviceLogin?: {
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    expiresAt: string;
    intervalSeconds: number;
  };
};

export function getDataDir(): string {
  if (process.env.DANAA_HEALTH_CARDS_HOME) return process.env.DANAA_HEALTH_CARDS_HOME;
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, "danaa-health-cards");
  }
  return path.join(os.homedir(), ".danaa-health-cards");
}

export function getStatePath(): string {
  return path.join(getDataDir(), "state.json");
}

export function readState(): LocalState {
  try {
    return JSON.parse(readFileSync(getStatePath(), "utf8")) as LocalState;
  } catch {
    return {};
  }
}

export function writeState(nextState: LocalState): void {
  mkdirSync(getDataDir(), { recursive: true });
  writeFileSync(getStatePath(), `${JSON.stringify(nextState, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

export function updateState(updater: (state: LocalState) => LocalState): LocalState {
  const nextState = updater(readState());
  writeState(nextState);
  return nextState;
}

export function rememberLatestCard(card: DanaaNextCheckin): void {
  if (!card.lease_id) return;
  updateState((state) => ({
    ...state,
    latestCard: card,
    latestLeaseId: card.lease_id ?? undefined,
    latestShownAt: new Date().toISOString()
  }));
}

export function clearLatestCard(leaseId?: string): void {
  updateState((state) => {
    if (leaseId && state.latestLeaseId && state.latestLeaseId !== leaseId) return state;
    const { latestCard, latestLeaseId, ...rest } = state;
    return rest;
  });
}

export function completeLatestCard(leaseId?: string, suppressMinutes = 0.25): LocalState {
  const autoSuppressedUntil = new Date(Date.now() + suppressMinutes * 60 * 1000).toISOString();
  return updateState((state) => {
    if (leaseId && state.latestLeaseId && state.latestLeaseId !== leaseId) {
      return { ...state, autoSuppressedUntil };
    }
    const { latestCard, latestLeaseId, ...rest } = state;
    return { ...rest, autoSuppressedUntil };
  });
}

export function rememberPendingDeviceLogin(input: {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  intervalSeconds: number;
}): LocalState {
  const expiresAt = new Date(Date.now() + input.expiresIn * 1000).toISOString();
  return updateState((state) => ({
    ...state,
    pendingDeviceLogin: {
      deviceCode: input.deviceCode,
      userCode: input.userCode,
      verificationUri: input.verificationUri,
      expiresAt,
      intervalSeconds: input.intervalSeconds
    }
  }));
}

export function clearPendingDeviceLogin(): LocalState {
  return updateState((state) => {
    const { pendingDeviceLogin, ...rest } = state;
    return rest;
  });
}

export function clearAccountState(): LocalState {
  return updateState((state) => ({
    installedAt: state.installedAt,
    lastHookTurnId: state.lastHookTurnId
  }));
}

export function ensureInstalledAt(): LocalState {
  return updateState((state) => {
    if (state.installedAt) return state;
    return { ...state, installedAt: new Date().toISOString() };
  });
}

export function suppressAutoForMinutes(minutes: number): LocalState {
  const autoSuppressedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  return updateState((state) => ({ ...state, autoSuppressedUntil }));
}

export function isFuture(value?: string): boolean {
  return Boolean(value && Date.parse(value) > Date.now());
}
