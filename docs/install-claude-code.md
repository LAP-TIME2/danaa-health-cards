# Install for Claude Code

One-line install:

```bash
npx -y github:LAP-TIME2/danaa-health-cards setup claude
```

This runs DANAA login, stores the token in the OS keyring, registers the MCP server, installs the Stop hook, and installs the DANAA check-in skill.

Manual-only install:

```bash
npx -y github:LAP-TIME2/danaa-health-cards setup claude --manual-only
```

Dry-run:

```bash
npx -y github:LAP-TIME2/danaa-health-cards setup claude --dry-run
```

Local backend development only:

```bash
npx -y github:LAP-TIME2/danaa-health-cards login --api-base http://localhost:8000/api/v1
```
