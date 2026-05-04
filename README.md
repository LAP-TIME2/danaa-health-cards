# DANAA Health Cards

Health check-in cards for Claude Code and Codex CLI.

DANAA Health Cards lets a user answer short, server-approved health questions while working in an AI coding tool. It does not read code, chat transcripts, terminal output, or medical records. It only saves the option the user explicitly selects.

## Status

Preview. The one-line setup commands are ready, but login needs the DANAA backend external API to be deployed at:

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

- start DANAA device login
- save the issued token to the OS keyring
- register the MCP server in Claude Code and/or Codex CLI
- do not print the token
- do not store the token in Claude/Codex config
- do not ask users to choose localhost or production

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
- `danaa_settings_get`
- `danaa_settings_update`

## Safety

- Explicit answer only: no automatic transcript extraction
- Server lease required: answers must match a server-issued question
- Consent required: DANAA rejects check-ins without health-data consent
- Token is stored in the OS keyring, not in Claude/Codex config
- Not a medical device: lifestyle check-in only

## License

Apache-2.0
