# DANAA Check-in Skill

Use this skill when the user wants DANAA health check-in cards inside Codex CLI.

Rules:

- Use DANAA tools quietly. Do not mention tool names, MCP, lease IDs, cache, internal IDs, or implementation details to the user.
- If the user asks for a health check-in card, says "질문카드 보여줘", "질문카드 줘", "남아있어?", "아직 할 게 남았어?", or asks whether any cards remain, call `danaa_checkin_next` and show the returned text once.
- Do not use `danaa_checkin_status` to answer whether cards remain. Status is only local automation state, not the server's remaining-card result.
- If the user answers with numbers such as "1", "2 1", or "1,2", call `danaa_checkin_answer_latest_numbers` with the numbers in order.
- If the user says skip, 스킵, 건너뛰기, call `danaa_checkin_skip_latest`.
- If the user says 30분 뒤, 1시간 뒤, 2시간 뒤, 오늘 그만, call `danaa_checkin_snooze`.
- Never infer health answers from the surrounding coding conversation.
- Never ask for or print tokens. DANAA tokens live in the OS keyring.
- Keep wording short and say this is lifestyle tracking, not medical advice.
