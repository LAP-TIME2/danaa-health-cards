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

First Codex permission prompt:

- Codex may ask whether to allow `danaa_checkin_next` or an answer tool.
- Choose `3. Always allow` if you trust the DANAA plugin and want the check-in flow to continue smoothly.
- DANAA setup cannot and should not silently set this for you.

If today's cards are already complete:

- `no_pending` means the server has no remaining card for that account today.
- You can still test MCP permission and connection.
- Use a fresh DANAA test account or wait until tomorrow to test another real answer save.

Local backend development only:

```bash
npx -y github:LAP-TIME2/danaa-health-cards login --api-base http://localhost:8000/api/v1
```
