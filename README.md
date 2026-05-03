# DANAA Health Cards

Health check-in cards for Claude Code and Codex CLI.

DANAA Health Cards lets a user answer short, server-approved health questions while working in an AI coding tool. It does not read code, chat transcripts, or medical records. It only saves the option the user explicitly selects.

## MVP Scope

- Claude Code support through MCP
- Codex CLI support through the same MCP server
- Manual check-in first: run the check-in command/tool when you want
- Safe settings: automatic interval can be `0`, `60`, `90`, or `120` minutes
- No token or health answer is stored in plugin config files

## Install

```bash
npm install -g @danaa/health-cards
```

For local development:

```bash
npm install
npm run build
```

## Login

```bash
danaa-health-cards login
```

Open the DANAA verification URL, approve the device code, then set the returned token as an environment variable:

```bash
export DANAA_HEALTH_TOKEN="danaa_ext_..."
export DANAA_API_BASE="https://your-danaa-api.example.com/api/v1"
```

Do not commit this token.

## MCP Server

```bash
danaa-health-cards-mcp
```

Tools:

- `danaa_checkin_next`
- `danaa_checkin_answer_numbers`
- `danaa_checkin_answer`
- `danaa_checkin_skip`
- `danaa_settings_get`
- `danaa_settings_update`

## Security Principles

- Explicit answer only: no automatic transcript extraction
- Server lease required: answers must match a server-issued question
- Idempotency key: duplicate submissions are blocked safely
- Consent required: DANAA rejects check-ins without health-data consent
- Not a medical device: lifestyle check-in only

## License

Apache-2.0
