const SECRET_PATTERNS = [
  /danaa_ext_[A-Za-z0-9_-]+/g,
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /(token|cookie|authorization|idempotency-key)\s*[:=]\s*[^,\s]+/gi
];

export function redact(value: unknown): string {
  let text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern, "[redacted]");
  }
  return text;
}

export function assertNoSensitiveLogging(value: unknown): void {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (/danaa_ext_|Bearer\s+|token_hash|health answer/i.test(text)) {
    throw new Error("Sensitive value reached logging boundary");
  }
}
