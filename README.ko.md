# DANAA Health Cards

Claude Code와 Codex CLI에서 DANAA 건강 체크인 카드를 사용할 수 있게 해주는 MCP 플러그인입니다.

사용자는 AI 코딩 도구 안에서 짧은 건강질문을 보고, 번호로 직접 답변합니다. 플러그인은 코드, 터미널 출력, 대화 전문을 읽어서 자동 저장하지 않습니다. 사용자가 고른 답변만 DANAA 계정에 저장합니다.

## 가장 쉬운 설치 방법: Claude Code에 그대로 붙여넣기

새 폴더에서 Claude Code를 실행한 뒤, 아래 문장을 그대로 입력하세요.

```text
https://github.com/LAP-TIME2/danaa-health-cards.git 저장소를 현재 폴더에 clone한 뒤, danaa-health-cards 폴더로 들어가서 npm install, npm run build, npm link를 순서대로 실행해줘. 그 다음 danaa-health-cards-mcp 명령이 정상 인식되는지 확인해줘. 토큰이나 비밀번호는 파일에 저장하지 말고, 필요한 값은 나에게 물어봐.
```

이 문장은 Claude Code에게 아래 작업을 부탁하는 뜻입니다.

```powershell
git clone https://github.com/LAP-TIME2/danaa-health-cards.git
cd danaa-health-cards
npm install
npm run build
npm link
```

## GitHub에서 무엇을 복사하나요?

GitHub의 초록색 `Code` 버튼을 누른 뒤, `HTTPS` 주소를 복사하면 됩니다.

```text
https://github.com/LAP-TIME2/danaa-health-cards.git
```

주의: 주소만 Claude Code에 붙여넣으면 “이 주소로 무엇을 하라는 건지” 애매할 수 있습니다. 그래서 위의 설치 프롬프트처럼 `clone하고 설치해줘`까지 같이 말하는 것이 좋습니다.

## 직접 명령어로 설치하기

PowerShell에서 직접 실행하려면 아래 순서대로 입력하세요.

```powershell
mkdir "C:\Users\%USERNAME%\Desktop\danaa-claude-test"
cd "C:\Users\%USERNAME%\Desktop\danaa-claude-test"
git clone https://github.com/LAP-TIME2/danaa-health-cards.git
cd danaa-health-cards
npm install
npm run build
npm link
```

설치 확인:

```powershell
danaa-health-cards-mcp --help
```

`--help`가 지원되지 않는 환경이면 아래 명령으로 실행 여부만 확인해도 됩니다.

```powershell
where danaa-health-cards-mcp
```

## Claude Code에 MCP 서버 등록하기

설치가 끝나면 Claude Code에 아래 프롬프트를 입력하세요.

```text
danaa-health-cards-mcp를 Claude Code MCP 서버로 등록해줘. 이름은 danaa-health-cards로 해줘. 등록 후 claude mcp list로 확인해줘.
```

직접 명령어로 등록하려면:

```powershell
claude mcp add danaa-health-cards danaa-health-cards-mcp
claude mcp list
```

## DANAA 토큰 설정

실제로 DANAA 계정에 건강 답변을 저장하려면 `DANAA_HEALTH_TOKEN`이 필요합니다.

```powershell
$env:DANAA_API_BASE="http://localhost:8000/api/v1"
$env:DANAA_HEALTH_TOKEN="danaa_ext_발급받은토큰"
```

토큰은 GitHub, README, 채팅창, 코드 파일에 저장하지 마세요.

현재 MVP에서는 DANAA 웹의 기기 승인 화면이 아직 연결되지 않았기 때문에, 토큰 발급은 개발 환경에서 수동 승인 절차가 필요합니다.

## Claude Code에서 사용하기

Claude Code 안에서 이렇게 말하면 됩니다.

```text
다나아 건강 체크인 카드를 보여줘. danaa_checkin_next 도구를 사용해줘.
```

카드가 나오면:

```text
1번, 2번으로 저장해줘.
```

건너뛰고 싶으면:

```text
이번 질문은 건너뛰어줘.
```

## 제공 도구

- `danaa_checkin_next`: 다음 건강 체크인 카드 받기
- `danaa_checkin_answer_numbers`: 질문 순서대로 번호 답변 저장
- `danaa_checkin_answer`: 정확한 필드 값으로 답변 저장
- `danaa_checkin_skip`: 이번 질문 건너뛰기
- `danaa_settings_get`: 설정 확인
- `danaa_settings_update`: 질문 간격 변경

## 안전 기준

- 사용자가 직접 선택한 답변만 저장합니다.
- 서버가 발급한 질문권이 있어야 저장합니다.
- 건강정보 동의가 없으면 저장하지 않습니다.
- 의료 진단이나 처방이 아니라 생활습관 기록용입니다.
