# DANAA Health Cards

Health check-in cards for Claude Code and Codex CLI.

DANAA Health Cards lets a user answer short, server-approved health questions while working in an AI coding tool. It does not read code, chat transcripts, terminal output, or medical records. It only saves the option the user explicitly selects.

## One-Line Install For Claude Code

Paste this into PowerShell, Terminal, or the Claude Code terminal:

```powershell
claude mcp add danaa-health-cards -- npx -y github:LAP-TIME2/danaa-health-cards
```

That one line:

- downloads this GitHub repo through `npx`
- builds the TypeScript package automatically
- registers the MCP server in Claude Code as `danaa-health-cards`
- uses the deployed DANAA API base by default
- does not ask you to choose between localhost and production

Check that Claude Code can see it:

```powershell
claude mcp list
```

## Login

After installing the MCP server, connect your DANAA account:

```powershell
npx -y github:LAP-TIME2/danaa-health-cards login
```

The login command opens DANAA device login. It does not ask for an API base. The default API base is:

```text
https://danaa-project.vercel.app/api/v1
```

If the production external check-in API has not been deployed yet, login may return `404`. That means the plugin installed correctly, but the DANAA backend endpoint is not live yet.

For local backend development only:

```powershell
npx -y github:LAP-TIME2/danaa-health-cards login --api-base http://localhost:8000/api/v1
```

## Use In Claude Code

After login, ask Claude Code:

```text
Show my DANAA health check-in card and let me answer by number.
```

Available MCP tools:

- `danaa_checkin_next`
- `danaa_checkin_answer_numbers`
- `danaa_checkin_answer`
- `danaa_checkin_skip`
- `danaa_settings_get`
- `danaa_settings_update`

## Manual CLI

```powershell
npx -y github:LAP-TIME2/danaa-health-cards --help
npx -y github:LAP-TIME2/danaa-health-cards checkin
```

## Safety

- Explicit answer only: no automatic transcript extraction
- Server lease required: answers must match a server-issued question
- Consent required: DANAA rejects check-ins without health-data consent
- No token or health answer is stored in plugin config files
- Not a medical device: lifestyle check-in only

## License

Apache-2.0
