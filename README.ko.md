# DANAA Health Cards

Claude Code와 Codex CLI에서 DANAA 건강 체크인 카드를 자동으로 붙여주는 MCP 플러그인입니다.

일반 개발 대화가 끝난 뒤, 조건이 맞으면 짧은 건강 질문 카드가 답변 아래에 붙습니다. 이 플러그인은 코드, 대화 원문, 터미널 출력, 의료 기록을 읽거나 저장하지 않습니다. 사용자가 직접 고른 번호만 DANAA 계정에 저장합니다.

## 현재 상태

미리보기 단계입니다. 한 줄 설치 명령은 준비되어 있습니다. 자동 체크인이 끝까지 작동하려면 DANAA 백엔드 외부 API와 자동 노출 정책이 아래 주소에 배포되어 있어야 합니다.

```text
https://danaa.r-e.kr/api/v1
```

`setup` 중 `404`가 나오면 설치 명령이 틀린 것이 아니라, DANAA 백엔드에 `/api/v1/external-auth/*`, `/api/v1/external/*`가 아직 배포되지 않은 상태입니다.

## 한 줄 설치

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

이 명령은 아래 작업을 한 번에 합니다.

- DANAA device login을 시작합니다.
- 발급된 토큰을 OS keyring(운영체제 안전 저장소)에 저장합니다.
- Claude Code 또는 Codex CLI에 MCP 서버를 등록합니다.
- 일반 답변이 끝난 뒤 카드를 붙일 수 있도록 Stop hook(답변 종료 시점 실행 장치)을 등록합니다.
- `1`, `skip`, `30분 뒤`, `오늘 그만` 같은 짧은 답을 이해하도록 skill 안내를 설치합니다.
- 토큰을 터미널에 출력하지 않습니다.
- Claude/Codex 설정 파일에 토큰을 저장하지 않습니다.
- 사용자에게 localhost와 배포 서버 중 무엇을 쓸지 묻지 않습니다.

수동 체크인만 쓰고 싶다면:

```powershell
npx -y github:LAP-TIME2/danaa-health-cards setup claude --manual-only
npx -y github:LAP-TIME2/danaa-health-cards setup codex --manual-only
```

미리보기 실행:

```powershell
npx -y github:LAP-TIME2/danaa-health-cards setup claude --dry-run
npx -y github:LAP-TIME2/danaa-health-cards setup codex --dry-run
```

## 직접 실행 명령

```powershell
npx -y github:LAP-TIME2/danaa-health-cards --help
npx -y github:LAP-TIME2/danaa-health-cards login
npx -y github:LAP-TIME2/danaa-health-cards checkin
npx -y github:LAP-TIME2/danaa-health-cards answer-latest 1
npx -y github:LAP-TIME2/danaa-health-cards skip-latest
npx -y github:LAP-TIME2/danaa-health-cards snooze 30m
npx -y github:LAP-TIME2/danaa-health-cards dnd today
npx -y github:LAP-TIME2/danaa-health-cards doctor
```

로컬 백엔드 개발자만 아래처럼 주소를 직접 지정합니다.

```powershell
npx -y github:LAP-TIME2/danaa-health-cards login --api-base http://localhost:8000/api/v1
```

## 제공 도구

- `danaa_checkin_next`: 다음 건강 체크인 카드 받기
- `danaa_checkin_answer_numbers`: 질문 순서대로 번호 답변 저장
- `danaa_checkin_answer`: 정확한 필드 값으로 답변 저장
- `danaa_checkin_skip`: 이번 질문 건너뛰기
- `danaa_checkin_answer_latest_numbers`: 가장 최근 카드에 번호로 답변
- `danaa_checkin_skip_latest`: 가장 최근 카드 건너뛰기
- `danaa_checkin_snooze`: 30분 뒤, 1시간 뒤, 오늘 그만 처리
- `danaa_checkin_status`: 로컬 자동 체크인 상태 확인
- `danaa_settings_get`: 설정 확인
- `danaa_settings_update`: 질문 간격 변경

## 안전 기준

- 사용자가 직접 고른 답만 저장합니다.
- 코드나 대화 원문에서 건강 답변을 추론해 저장하지 않습니다.
- 서버가 발급한 질문권이 있어야 저장합니다.
- 건강정보 동의가 없으면 DANAA 서버가 저장을 거부합니다.
- 토큰은 OS keyring에만 저장하고 Claude/Codex 설정에는 저장하지 않습니다.
- 서버나 네트워크에 문제가 있어도 개발 흐름을 막지 않고 조용히 종료합니다.
- 의료 진단이나 처방이 아니라 생활습관 체크인 도구입니다.

## License

Apache-2.0
