# DANAA Health Cards

Automatic health check-in cards for Claude Code and Codex CLI.

DANAA Health Cards lets a user answer short, server-approved health questions while working in an AI coding tool. With the automatic hook enabled, Claude Code or Codex CLI can append a short DANAA card after a normal answer finishes. It does not read code, chat transcripts, terminal output, or medical records. It only saves the option the user explicitly selects.

## Status

Preview. The one-line setup commands are ready. Automatic check-ins need the DANAA backend external API and auto-policy endpoints to be deployed at:

```text
https://danaa.r-e.kr/api/v1
```

If setup shows `404`, the plugin installed correctly but the DANAA backend has not deployed `/api/v1/external-auth/*` and `/api/v1/external/*` yet.

## One-Line Setup

Claude Code:

```powershell
npx -y github:LAP-TIME2/danaa-health-cards setup claude
```

Codex CLI:

```powershell
npx -y github:LAP-TIME2/danaa-health-cards setup codex
```

Both:

```powershell
npx -y github:LAP-TIME2/danaa-health-cards setup all
```

These commands:

- reuse an existing valid OS keyring token, or start DANAA device login if needed
- save the issued token to the OS keyring
- register the MCP server in Claude Code and/or Codex CLI
- register a Stop hook so a DANAA card can appear after a normal AI answer finishes
- install a small skill guide so short replies like `1`, `skip`, `30분 뒤`, or `오늘 그만` are handled correctly
- do not print the token
- do not store the token in Claude/Codex config
- do not ask users to choose localhost or production

Manual-only install:

```powershell
npx -y github:LAP-TIME2/danaa-health-cards setup claude --manual-only
npx -y github:LAP-TIME2/danaa-health-cards setup codex --manual-only
```

Dry-run:

```powershell
npx -y github:LAP-TIME2/danaa-health-cards setup claude --dry-run
npx -y github:LAP-TIME2/danaa-health-cards setup codex --dry-run
```

## Manual Commands

```powershell
npx -y github:LAP-TIME2/danaa-health-cards --help
npx -y github:LAP-TIME2/danaa-health-cards login
npx -y github:LAP-TIME2/danaa-health-cards checkin
npx -y github:LAP-TIME2/danaa-health-cards answer-latest 1
npx -y github:LAP-TIME2/danaa-health-cards skip-latest
npx -y github:LAP-TIME2/danaa-health-cards snooze 30m
npx -y github:LAP-TIME2/danaa-health-cards dnd today
npx -y github:LAP-TIME2/danaa-health-cards doctor
```

Local backend development only:

```powershell
npx -y github:LAP-TIME2/danaa-health-cards login --api-base http://localhost:8000/api/v1
```

## MCP Tools

- `danaa_checkin_next`
- `danaa_checkin_answer_numbers`
- `danaa_checkin_answer`
- `danaa_checkin_skip`
- `danaa_checkin_answer_latest_numbers`
- `danaa_checkin_skip_latest`
- `danaa_checkin_snooze`
- `danaa_checkin_status`
- `danaa_settings_get`
- `danaa_settings_update`

## Safety

- Explicit answer only: no automatic transcript extraction
- Hook is non-blocking: network or token errors fail silently so coding work continues
- Server lease required: answers must match a server-issued question
- Consent required: DANAA rejects check-ins without health-data consent
- Token is stored in the OS keyring, not in Claude/Codex config
- Not a medical device: lifestyle check-in only

## License

Apache-2.0
