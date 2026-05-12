# Session Handoff Convention

When ending a significant work session, create a handoff file named:

```
references/session_handoff_YYYY-MM-DD[_descriptor].md
```

Example: `references/session_handoff_2026-05-12_initial_setup.md`

## Contents

```markdown
# Session Handoff — YYYY-MM-DD [descriptor]

## State at handoff
- Branch/HEAD: <git describe or commit hash>
- Tests: <passing/failing count or N/A>
- Lint: <exit 0 / known failures>

## What was accomplished
<Bullet list of completed work>

## In-flight / open
<Anything started but not finished; known blockers>

## Next session starting point
<First thing to do next session, with enough context to cold-start>
```

## When to write one

- After a major feature landing
- Before handing off to a parallel agent
- At the end of any session where significant state was accumulated that isn't obvious from git log
