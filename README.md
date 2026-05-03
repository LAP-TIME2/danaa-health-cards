# DANAA Health Cards

Health check-in cards for Claude Code and Codex CLI.

DANAA Health Cards lets a user answer short, server-approved health questions while working in an AI coding tool. It does not read code, chat transcripts, or medical records. It only saves the option the user explicitly selects.

## Korean Quick Start for Claude Code

Open Claude Code in a new folder, then paste this prompt:

```text
https://github.com/LAP-TIME2/danaa-health-cards.git 저장소를 현재 폴더에 clone한 뒤, danaa-health-cards 폴더로 들어가서 npm install, npm run build, npm link를 순서대로 실행해줘. 그 다음 danaa-health-cards-mcp 명령이 정상 인식되는지 확인해줘. 토큰이나 비밀번호는 파일에 저장하지 말고, 필요한 값은 나에게 물어봐.
```

This tells Claude Code to run:

```powershell
git clone https://github.com/LAP-TIME2/danaa-health-cards.git
cd danaa-health-cards
npm install
npm run build
npm link
```

After installation, ask Claude Code:

```text
danaa-health-cards-mcp를 Claude Code MCP 서버로 등록해줘. 이름은 danaa-health-cards로 해줘. 등록 후 claude mcp list로 확인해줘.
```

Read the full Korean guide: [README.ko.md](README.ko.md)

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
