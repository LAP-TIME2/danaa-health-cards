# DANAA Health Cards

Health check-in cards for Claude Code and Codex CLI.

DANAA Health Cards lets a user answer short, server-approved health questions while working in an AI coding tool. It does not read code, chat transcripts, or medical records. It only saves the option the user explicitly selects.

## Quick Start: Copy This Into Claude Code

Install link:

```text
https://github.com/LAP-TIME2/danaa-health-cards.git
```

Open Claude Code in a new empty folder, then paste this whole prompt:

```text
아래 설치 링크로 DANAA Health Cards를 설치하고 Claude Code에서 사용할 준비까지 한 번에 진행해줘.

설치 링크:
https://github.com/LAP-TIME2/danaa-health-cards.git

진행 순서:
1. 현재 폴더에 저장소를 clone해줘.
2. danaa-health-cards 폴더로 이동해줘.
3. npm install을 실행해줘.
4. npm run build를 실행해줘.
5. npm test를 실행해줘.
6. npm link를 실행해줘.
7. danaa-health-cards-mcp 명령이 인식되는지 확인해줘.
8. Claude Code MCP 서버에 danaa-health-cards-mcp를 danaa-health-cards 이름으로 등록해줘.
9. claude mcp list로 등록 여부를 확인해줘.
10. DANAA 계정 연결이 필요하면 danaa-health-cards login을 실행하고, 나온 인증 URL과 user_code를 나에게 보여줘.

중요:
- 토큰, 비밀번호, 쿠키는 절대 파일에 저장하지 마.
- .env 파일을 만들지 마.
- GitHub에 push하지 마.
- 설치와 연결 확인만 진행해.
- 필요한 비밀번호나 토큰은 내가 직접 입력할 수 있게 물어봐.
```

This prompt tells Claude Code to run:

```powershell
git clone https://github.com/LAP-TIME2/danaa-health-cards.git
cd danaa-health-cards
npm install
npm run build
npm test
npm link
```

If you prefer manual commands:

```powershell
mkdir "$env:USERPROFILE\Desktop\danaa-claude-test"
cd "$env:USERPROFILE\Desktop\danaa-claude-test"
git clone https://github.com/LAP-TIME2/danaa-health-cards.git
cd danaa-health-cards
npm install
npm run build
npm test
npm link
claude mcp add danaa-health-cards danaa-health-cards-mcp
claude mcp list
```

After installation, test it in Claude Code:

```text
다나아 건강 체크인 카드를 보여줘. danaa_checkin_next 도구를 사용해줘.
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
