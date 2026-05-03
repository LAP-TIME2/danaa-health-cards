# DANAA Health Cards

Claude Code와 Codex CLI에서 DANAA 건강 체크인 카드를 사용할 수 있게 해주는 MCP 플러그인입니다.

사용자는 AI 코딩 도구 안에서 짧은 건강질문을 보고, 번호로 직접 답변합니다. 플러그인은 코드, 터미널 출력, 대화 전문, 의료 기록을 읽어서 자동 저장하지 않습니다. 사용자가 고른 답변만 DANAA 계정에 저장합니다.

## Claude Code 한 줄 설치

PowerShell, Terminal, 또는 Claude Code 터미널에 아래 한 줄만 입력하세요.

```powershell
claude mcp add danaa-health-cards -- npx -y github:LAP-TIME2/danaa-health-cards
```

이 한 줄이 하는 일:

- GitHub 저장소를 `npx`로 받아옵니다.
- TypeScript 코드를 자동으로 빌드합니다.
- Claude Code에 `danaa-health-cards` MCP 서버를 등록합니다.
- 기본 API 주소는 배포 주소를 사용합니다.
- `localhost`를 쓸지, 배포 서버를 쓸지 묻지 않습니다.

등록 확인:

```powershell
claude mcp list
```

## DANAA 계정 연결

설치 후 DANAA 계정을 연결하려면 아래 명령을 실행하세요.

```powershell
npx -y github:LAP-TIME2/danaa-health-cards login
```

`login`은 DANAA 배포 서버로 device login을 요청합니다. API 주소를 따로 묻지 않습니다.

기본 API 주소:

```text
https://danaa-project.vercel.app/api/v1
```

주의: 현재 배포 서버에 외부 체크인 API가 아직 올라가지 않았다면 `404`가 나올 수 있습니다. 이 경우 설치 실패가 아니라, DANAA 백엔드에 외부 체크인 API가 아직 배포되지 않은 상태라는 뜻입니다.

로컬 백엔드 개발자만 아래처럼 직접 주소를 지정하면 됩니다.

```powershell
npx -y github:LAP-TIME2/danaa-health-cards login --api-base http://localhost:8000/api/v1
```

## Claude Code에서 사용하기

Claude Code에서 이렇게 말하면 됩니다.

```text
DANAA 건강 체크인 카드를 보여주고 번호로 답할 수 있게 해줘.
```

제공 도구:

- `danaa_checkin_next`: 다음 건강 체크인 카드 받기
- `danaa_checkin_answer_numbers`: 질문 순서대로 번호 답변 저장
- `danaa_checkin_answer`: 정확한 필드 값으로 답변 저장
- `danaa_checkin_skip`: 이번 질문 건너뛰기
- `danaa_settings_get`: 설정 확인
- `danaa_settings_update`: 질문 간격 변경

## 직접 실행

```powershell
npx -y github:LAP-TIME2/danaa-health-cards --help
npx -y github:LAP-TIME2/danaa-health-cards checkin
```

## 안전 기준

- 사용자가 직접 고른 답변만 저장합니다.
- 서버가 발급한 질문권이 있어야 저장합니다.
- 건강정보 동의가 없으면 DANAA 서버가 저장을 거부합니다.
- 토큰이나 건강 답변 원문을 플러그인 설정 파일에 저장하지 않습니다.
- 의료 진단이나 처방이 아니라 생활습관 체크인 도구입니다.
