# Threat Model

## Assets

- External client token
- Health answer values
- DANAA account identity
- Server-issued lease

## Main Risks

- Token leak
- Cross-account write
- Health answer logged
- Prompt injection asking the tool to reveal secrets
- Replay or duplicate submission

## Controls

- Tokens are stored as hashes on the server.
- The plugin reads tokens from environment variables and does not write them to config files.
- The server requires health-data consent.
- Every answer requires a lease.
- Idempotency keys prevent duplicate writes.
- The MCP server redacts token-like values in error messages.
