import crypto from "node:crypto";

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

export function getApiBase(): string {
  return (process.env.DANAA_API_BASE ?? "http://localhost:8000/api/v1").replace(/\/$/, "");
}

export function getTokenFromEnv(): string {
  const token = process.env.DANAA_HEALTH_TOKEN;
  if (!token) {
    throw new DanaaApiError(
      "DANAA_HEALTH_TOKEN is not set. Run `danaa-health-cards login` and set the token as an environment variable.",
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

  const response = await fetch(`${getApiBase()}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
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
