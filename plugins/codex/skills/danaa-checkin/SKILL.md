# DANAA Check-in Skill

Use this skill when the user wants DANAA health check-in cards inside Codex CLI.

Workflow:

1. Call `danaa_checkin_next`.
2. Show the questions and numbered options.
3. If the user answers with numbers, call `danaa_checkin_answer_numbers`.
4. If the user says skip, call `danaa_checkin_skip`.

Do not infer health data from code, files, terminal output, or chat history.
Only the user's explicit number choice can be submitted.
