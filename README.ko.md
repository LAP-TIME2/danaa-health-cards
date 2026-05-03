# DANAA Health Cards

Claude Code와 Codex CLI에서 쓰는 DANAA 건강 체크인 플러그인입니다.

핵심은 간단합니다. 사용자가 AI 코딩 도구 안에서 짧은 건강질문을 보고, 번호로 직접 답하면 DANAA 계정에 저장됩니다. 코드 원문, 대화 전문, 의료 기록을 읽어서 자동 저장하지 않습니다.

## MVP 범위

- Claude Code: MCP 서버로 지원
- Codex CLI: 같은 MCP 서버 재사용
- 수동 체크인 우선
- 자동 질문 간격 설정: `0`, `60`, `90`, `120`분
- 플러그인 설정 파일에 토큰이나 건강 답변 원문 저장 금지

## 로그인

```bash
danaa-health-cards login
```

웹에서 기기 코드를 승인한 뒤, 출력된 토큰을 환경변수로 설정합니다.

```bash
setx DANAA_HEALTH_TOKEN "danaa_ext_..."
setx DANAA_API_BASE "http://localhost:8000/api/v1"
```

토큰은 GitHub에 올리면 안 됩니다.

## 사용하는 도구

- `danaa_checkin_next`: 다음 건강질문 카드 받기
- `danaa_checkin_answer_numbers`: 질문 순서대로 번호 답변 저장
- `danaa_checkin_answer`: 정확한 값으로 답변 저장
- `danaa_checkin_skip`: 이번 질문 건너뛰기
- `danaa_settings_get`: 설정 보기
- `danaa_settings_update`: 질문 간격 변경

## 안전 기준

- 사용자가 고른 번호만 저장합니다.
- 서버가 발급한 질문권이 있어야 저장합니다.
- 건강정보 동의가 없으면 저장하지 않습니다.
- 의료 진단이나 처방이 아니라 생활습관 기록용입니다.
