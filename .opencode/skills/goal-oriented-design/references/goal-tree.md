# Product Goal Tree

This seed is intentionally uninitialized. A human must approve inferred goals before they become authoritative. Do not populate it from this template alone.

Goals describe durable user or product outcomes across implementation boundaries, not services, packages, APIs, tables, or tasks. Keep the hierarchy concise and link deeper context to authoritative project documentation.

## Statuses

- `target`: intended but not implemented.
- `partial`: only part of the outcome is implemented.
- `untested`: implemented, but required end-to-end proof is missing.
- `done`: implemented and required end-to-end proof exists.

Assess mixed branches conservatively: a parent remains `partial` when an essential child is incomplete or unproven.

## Initialization format

After explicit human approval, record an overarching goal and numbered descendants:

```markdown
## G0 — [durable overarching outcome]

**[status] —** [concise outcome statement]

### G1 — [child outcome]

**[status] —** [concise outcome statement]

- **[status] — G1.1 — [leaf outcome]:** [observable outcome]
- Evidence: [authoritative links]
- Implementation status: [observed facts, assumptions, contradictions, or gaps]
```

Maintain separate root trees for independent libraries and link them rather than nesting their technical details here.
