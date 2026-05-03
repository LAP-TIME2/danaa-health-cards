# Security Policy

## Supported Versions

`0.x` is an MVP. Security fixes are accepted on the main branch.

## Reporting a Vulnerability

Please report privately through GitHub Security Advisories when the repository is public.

Do not open public issues for:

- leaked tokens
- account takeover
- cross-account health data access
- health answer logging
- prompt injection that exposes secrets

## Release Blockers

A release must stop if any of these are found:

- token printed by the MCP server
- token committed to config
- health answer logged
- one account can write to another account
- answer saved without health-data consent
- answer saved without a valid server lease
