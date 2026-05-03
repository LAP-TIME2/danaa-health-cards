# Privacy

DANAA Health Cards is designed to minimize data movement.

## Collected by the Plugin

The plugin sends only:

- the external token in the HTTPS `Authorization` header
- the server-issued `lease_id`
- the selected answer values
- the idempotency key

The plugin does not send:

- source code
- chat transcripts
- terminal output
- emails
- cookies
- local file paths

## Local Storage

The MVP does not write access tokens, refresh tokens, or health answers into plugin configuration files. Users provide the token through an environment variable.

## Server Storage

DANAA stores external client tokens as hashes. Raw tokens are returned once during login and are not stored by the backend.

## Medical Notice

This project is a lifestyle check-in tool, not a medical device and not medical advice.
