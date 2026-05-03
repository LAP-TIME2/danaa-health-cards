import { Entry } from "@napi-rs/keyring";

export const KEYRING_SERVICE = "DANAA Health Cards";
export const KEYRING_ACCOUNT = "external-checkin-token";

export class TokenStoreError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
  }
}

function tokenEntry(): Entry {
  return new Entry(KEYRING_SERVICE, KEYRING_ACCOUNT);
}

export function getStoredToken(): string | null {
  try {
    return tokenEntry().getPassword();
  } catch (error) {
    throw new TokenStoreError("Unable to read DANAA token from the OS keyring.", error);
  }
}

export function saveStoredToken(token: string): void {
  try {
    tokenEntry().setPassword(token);
  } catch (error) {
    throw new TokenStoreError("Unable to save DANAA token to the OS keyring.", error);
  }
}

export function deleteStoredToken(): boolean {
  try {
    return tokenEntry().deletePassword();
  } catch (error) {
    throw new TokenStoreError("Unable to delete DANAA token from the OS keyring.", error);
  }
}
