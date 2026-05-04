# Install for Codex CLI

One-line install:

```bash
npx -y github:LAP-TIME2/danaa-health-cards setup codex
```

This runs DANAA login, stores the token in the OS keyring, registers the MCP server, enables Codex hooks, installs the Stop hook, and installs the DANAA check-in skill.

Manual-only install:

```bash
npx -y github:LAP-TIME2/danaa-health-cards setup codex --manual-only
```

Dry-run:

```bash
npx -y github:LAP-TIME2/danaa-health-cards setup codex --dry-run
```

If login gets confusing:

- The setup command tries to open the DANAA approval page automatically.
- If no browser opens, copy the printed URL into your browser.
- If the wrong browser profile opens, copy the same URL into the browser profile where you are logged into DANAA.
- If dots keep appearing in the terminal, it is waiting for browser approval.
- If the code expires, rerun the same setup command.
- In remote/headless terminals, use `--no-open`.

```bash
npx -y github:LAP-TIME2/danaa-health-cards setup codex --no-open
```

Local backend development only:

```bash
npx -y github:LAP-TIME2/danaa-health-cards login --api-base http://localhost:8000/api/v1
```
