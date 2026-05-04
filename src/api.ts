import crypto from "node:crypto";

import { getStoredToken, TokenStoreError } from "./token-store.js";

export const DEFAULT_DANAA_API_BASE = "https://danaa.r-e.kr/api/v1";

export type DanaaQuestion = {
  field: string;
  summary_label: string;
  text: string;
  input_type: string;
  options: Array<string | number | boolean>;
  condition?: string | null;
};

export type DanaaNextCheckin = {
  has_question: boolean;
  lease_id?: string | null;
  bundle_key?: string | null;
  bundle_name?: string | null;
  log_date?: string | null;
  expires_at?: string | null;
  questions: DanaaQuestion[];
  notice: string;
};

export type DanaaAnswerResponse = {
  status: "saved" | "skipped";
  saved_fields: string[];
  skipped_fields: string[];
  daily_log_date?: string | null;
  message: string;
};

export type DanaaSettings = {
  health_question_interval_minutes: 0 | 60 | 90 | 120;
  max_bundles_per_day: number;
  auto_question_enabled: boolean;
};

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string;
  idempotencyKey?: string;
};

export class DanaaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail: unknown
  ) {
    super(message);
  }
}

export function normalizeApiBase(apiBase: string): string {
  return apiBase.replace(/\/$/, "");
}

export function setApiBase(apiBase: string): void {
  process.env.DANAA_API_BASE = normalizeApiBase(apiBase);
}

export function getApiBase(): string {
  return normalizeApiBase(process.env.DANAA_API_BASE ?? DEFAULT_DANAA_API_BASE);
}

export function getTokenFromEnv(): string {
  const token = process.env.DANAA_HEALTH_TOKEN;
  if (!token) {
    try {
      const storedToken = getStoredToken();
      if (storedToken) return storedToken;
    } catch (error) {
      if (error instanceof TokenStoreError) {
        throw new DanaaApiError(
          "DANAA token is unavailable because the OS keyring could not be read. Run `danaa-health-cards doctor`.",
          401,
          { error_code: "TOKEN_KEYRING_UNAVAILABLE" }
        );
      }
      throw error;
    }
    throw new DanaaApiError(
      "DANAA token is not set. Run `danaa-health-cards setup claude`, `setup codex`, or `login`.",
      401,
      { error_code: "TOKEN_MISSING" }
    );
  }
  return token;
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export async function danaaFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "@danaa/health-cards/0.1.0"
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBase()}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
  } catch (error) {
    throw new DanaaApiError("DANAA API is unreachable", 0, {
      api_base: getApiBase(),
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text.slice(0, 500) };
  }
  if (!response.ok) {
    throw new DanaaApiError(`DANAA API returned ${response.status}`, response.status, payload);
  }
  return payload as T;
}

export async function nextCheckin(): Promise<DanaaNextCheckin> {
  return danaaFetch<DanaaNextCheckin>("/external/checkins/next", {
    token: getTokenFromEnv()
  });
}

export async function answerCheckin(
  leaseId: string,
  answers: Record<string, string | number | boolean>,
  idempotencyKey = newIdempotencyKey()
): Promise<DanaaAnswerResponse> {
  return danaaFetch<DanaaAnswerResponse>("/external/checkins/answer", {
    method: "POST",
    token: getTokenFromEnv(),
    idempotencyKey,
    body: { lease_id: leaseId, answers }
  });
}

export async function skipCheckin(
  leaseId: string,
  idempotencyKey = newIdempotencyKey()
): Promise<DanaaAnswerResponse> {
  return danaaFetch<DanaaAnswerResponse>("/external/checkins/answer", {
    method: "POST",
    token: getTokenFromEnv(),
    idempotencyKey,
    body: { lease_id: leaseId, skip: true }
  });
}

export async function getSettings(): Promise<DanaaSettings> {
  return danaaFetch<DanaaSettings>("/external/settings", {
    token: getTokenFromEnv()
  });
}

export async function updateSettings(intervalMinutes: 0 | 60 | 90 | 120): Promise<DanaaSettings> {
  return danaaFetch<DanaaSettings>("/external/settings", {
    method: "PATCH",
    token: getTokenFromEnv(),
    body: { health_question_interval_minutes: intervalMinutes }
  });
}
