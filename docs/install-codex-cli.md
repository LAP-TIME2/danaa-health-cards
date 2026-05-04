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

Local backend development only:

```bash
npx -y github:LAP-TIME2/danaa-health-cards login --api-base http://localhost:8000/api/v1
```
