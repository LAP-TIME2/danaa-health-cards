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

`setup all` requires both Claude Code and Codex CLI to be installed. If you only use one tool, run the matching single-tool command.

These commands:

- reuse an existing valid OS keyring token, or start DANAA device login if needed
- save the issued token to the OS keyring
- register the MCP server in Claude Code and/or Codex CLI
- register a Stop hook so a DANAA card can appear after a normal AI answer finishes
- install a small skill guide so short replies like `1`, `skip`, `30 minutes later`, or `stop for today` are handled correctly
- do not print the token
- do not store the token in Claude/Codex config
- do not ask users to choose localhost or production

Manual-only install:

```powershell
npx -y github:LAP-TIME2/danaa-health-cards setup claude --manual-only
npx -y github:LAP-TIME2/danaa-health-cards setup codex --manual-only
```

Use manual-only mode if a Windows Codex environment repeatedly shows `Stop hook failed` or `CreateProcessAsUser failed: 5`. That error happens before the DANAA Node.js code runs, so the safe fallback is to keep MCP check-ins working and disable automatic Stop-hook insertion.

Dry-run:

```powershell
npx -y github:LAP-TIME2/danaa-health-cards setup claude --dry-run
npx -y github:LAP-TIME2/danaa-health-cards setup codex --dry-run
```

## During Login

The setup command now tries to open the DANAA approval page automatically. Terminal link behavior still depends on VS Code, Claude Code, Windows Terminal, browser profile, and remote-control settings, so the CLI always prints the URL as a fallback too.

- If the browser does not open, copy the printed URL into the browser where you are logged into DANAA.
- If the wrong browser profile opens, copy the same URL into the correct browser profile.
- If the code expired, run the same `setup` command again and use the new code.
- If the terminal keeps printing dots, it is waiting for approval in the browser.
- If token saving fails, unlock or enable your OS credential store, then run `danaa-health-cards doctor`.
- If you are on a remote/headless terminal, use `--no-open` and copy the URL manually.

Example:

```powershell
npx -y github:LAP-TIME2/danaa-health-cards setup claude --no-open
```

## First Codex Permission Prompt

Codex may show a safety prompt the first time a DANAA MCP tool runs. For example, `danaa_checkin_next` asks the DANAA server for the next check-in card, so Codex may ask for permission.

Recommended choice:

```text
3. Always allow
```

This choice must be made by the user. DANAA setup does not silently bypass Codex's permission model. After you choose `Always allow` once for a DANAA tool, repeated prompts for that tool should be reduced. If Windows Codex keeps failing the Stop hook, run `npx -y github:LAP-TIME2/danaa-health-cards setup codex --manual-only` and use `질문카드 보여줘` for manual check-ins.

## Testing After Today's Cards Are Complete

If your DANAA account already answered every card for today, `no_pending` or “all cards are complete” is the correct server result. You can still test Codex permission prompts, MCP connection, and token storage, but you cannot test another real answer save on the same account today.

For a full save test, use one of these safe options:

- sign in with a fresh DANAA test account and run the check-in flow
- wait until the next day when new cards open
- do not delete production health records just to retest; that touches real user data

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
