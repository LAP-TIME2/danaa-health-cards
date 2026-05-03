# DANAA Health Cards

Claude Code와 Codex CLI에서 DANAA 건강 체크인 카드를 사용할 수 있게 해주는 MCP 플러그인입니다.

사용자는 AI 코딩 도구 안에서 짧은 건강질문을 보고, 번호로 직접 답변합니다. 플러그인은 코드, 터미널 출력, 대화 전문, 의료 기록을 읽어서 자동 저장하지 않습니다. 사용자가 고른 답변만 DANAA 계정에 저장합니다.

## 현재 상태

미리보기 단계입니다. 한 줄 설치 명령은 준비됐지만, 로그인까지 성공하려면 DANAA 본 서버에 외부 API가 배포되어야 합니다.

기본 API 주소:

```text
https://danaa.r-e.kr/api/v1
```

`setup` 중 `404`가 나오면 설치 실패가 아니라, DANAA 백엔드에 `/api/v1/external-auth/*`, `/api/v1/external/*`가 아직 배포되지 않았다는 뜻입니다.

## 한 줄 설정

Claude Code:

```powershell
npx -y github:LAP-TIME2/danaa-health-cards setup claude
```

Codex CLI:

```powershell
npx -y github:LAP-TIME2/danaa-health-cards setup codex
```

둘 다 한 번에:

```powershell
npx -y github:LAP-TIME2/danaa-health-cards setup all
```

이 명령이 하는 일:

- DANAA device login을 시작합니다.
- 발급된 토큰을 OS 안전 저장소에 저장합니다.
- Claude Code 또는 Codex CLI에 MCP 서버를 등록합니다.
- 토큰을 터미널에 출력하지 않습니다.
- Claude/Codex 설정 파일에 토큰을 저장하지 않습니다.
- 사용자에게 localhost와 배포 서버 중 무엇을 쓸지 묻지 않습니다.

미리보기:

```powershell
npx -y github:LAP-TIME2/danaa-health-cards setup claude --dry-run
npx -y github:LAP-TIME2/danaa-health-cards setup codex --dry-run
```

## 직접 실행

```powershell
npx -y github:LAP-TIME2/danaa-health-cards --help
npx -y github:LAP-TIME2/danaa-health-cards login
npx -y github:LAP-TIME2/danaa-health-cards checkin
npx -y github:LAP-TIME2/danaa-health-cards doctor
```

로컬 백엔드 개발자만 아래처럼 주소를 직접 지정하면 됩니다.

```powershell
npx -y github:LAP-TIME2/danaa-health-cards login --api-base http://localhost:8000/api/v1
```

## 제공 도구

- `danaa_checkin_next`: 다음 건강 체크인 카드 받기
- `danaa_checkin_answer_numbers`: 질문 순서대로 번호 답변 저장
- `danaa_checkin_answer`: 정확한 필드 값으로 답변 저장
- `danaa_checkin_skip`: 이번 질문 건너뛰기
- `danaa_settings_get`: 설정 확인
- `danaa_settings_update`: 질문 간격 변경

## 안전 기준

- 사용자가 직접 고른 답변만 저장합니다.
- 서버가 발급한 질문권이 있어야 저장합니다.
- 건강정보 동의가 없으면 DANAA 서버가 저장을 거부합니다.
- 토큰은 OS 안전 저장소에 저장하며 Claude/Codex 설정에는 저장하지 않습니다.
- 의료 진단이나 처방이 아니라 생활습관 체크인 도구입니다.
