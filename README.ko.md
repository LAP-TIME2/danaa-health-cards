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

`setup all`은 Claude Code와 Codex CLI가 둘 다 설치되어 있어야 합니다. 하나만 쓰는 사용자는 `setup claude` 또는 `setup codex`처럼 해당 도구 명령만 실행하면 됩니다.

이 명령은 아래 작업을 한 번에 합니다.

- OS keyring(운영체제 안전 저장소)에 유효한 토큰이 있으면 그대로 재사용합니다.
- 유효한 토큰이 없으면 DANAA device login을 시작하고 발급된 토큰을 OS keyring에 저장합니다.
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

## 로그인 중 막혔을 때

`setup` 명령은 DANAA 승인 페이지를 자동으로 열려고 시도합니다. 다만 VS Code, Claude Code, Windows Terminal, 브라우저 프로필, 원격 제어 상태에 따라 터미널의 링크 열기 방식이 달라질 수 있어서, CLI는 항상 복사 가능한 URL도 같이 보여줍니다.

- 브라우저가 안 열리면 터미널에 나온 URL을 복사해서 DANAA에 로그인된 브라우저에 붙여넣으세요.
- 엉뚱한 브라우저 프로필이 열리면 같은 URL을 올바른 프로필에 붙여넣으세요.
- 코드가 만료되면 같은 `setup` 명령을 다시 실행해서 새 코드를 받으면 됩니다.
- 점(`.`)이 계속 찍히는 것은 터미널이 브라우저 승인을 기다리는 중이라는 뜻입니다.
- 토큰 저장에 실패하면 Windows Credential Manager, macOS Keychain, Linux keyring 같은 OS 안전 저장소를 사용할 수 있는지 확인한 뒤 `danaa-health-cards doctor`를 실행하세요.
- 원격 서버나 브라우저가 없는 터미널에서는 `--no-open`을 붙이고 URL을 직접 복사하면 됩니다.

예시:

```powershell
npx -y github:LAP-TIME2/danaa-health-cards setup claude --no-open
```

## Codex에서 처음 권한창이 뜰 때

Codex는 MCP 도구를 처음 실행할 때 보안 확인창을 띄울 수 있습니다. 예를 들어 `danaa_checkin_next`는 DANAA 서버에서 다음 질문카드를 가져오는 도구라서 처음 한 번 허용을 물어볼 수 있어요.

권장 선택:

```text
3. Always allow
```

이 선택은 사용자가 직접 해야 합니다. DANAA 플러그인이 몰래 자동 승인하지 않습니다. 대신 한 번 `Always allow`를 선택하면 같은 DANAA 도구 호출에서는 반복 확인이 줄어듭니다.

## 이미 오늘 질문카드를 다 답한 계정으로 테스트할 때

이미 오늘 카드가 모두 끝난 계정은 `no_pending` 또는 “오늘 기록할 건강 카드가 모두 끝났어요”가 정상입니다. 이 상태에서도 Codex 권한창, MCP 연결, 토큰 저장은 테스트할 수 있지만, “답변 저장”까지 다시 테스트할 수는 없습니다.

저장까지 실제로 테스트하려면 아래 중 하나가 안전합니다.

- 새 DANAA 테스트 계정으로 로그인해서 체크인 흐름을 다시 진행합니다.
- 다음 날 새 질문카드가 열렸을 때 다시 테스트합니다.
- 운영 DB에서 오늘 기록을 직접 지우는 방식은 권장하지 않습니다. 실제 사용자 건강 기록을 건드리는 작업이라 테스트 방법으로 쓰면 안 됩니다.

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
