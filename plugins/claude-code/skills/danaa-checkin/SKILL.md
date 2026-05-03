# DANAA Check-in Skill

Use this skill when the user wants to answer DANAA health cards inside Claude Code.

Rules:

- Ask for explicit numbered choices.
- Do not infer health answers from unrelated conversation.
- Do not ask the user to paste tokens into chat.
- Use `danaa_checkin_next` first.
- Use `danaa_checkin_answer_numbers` when the user gives option numbers.
- Use `danaa_checkin_skip` when the user says skip.
- Say clearly that this is lifestyle tracking, not medical advice.
