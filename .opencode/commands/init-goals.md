---
description: Infer and seed project goal documentation with human approval
agent: design
---

Initialize or rebaseline the project's goal documentation. This command has two
approval-gated phases. Complete Phase 1, present its result, and stop. If the
human requests corrections, present the revised proposal and stop again. Perform
Phase 2 only after the human explicitly approves the current proposal for write.

## Phase 1 — Discover and propose

1. Load `goal-oriented-design`. Read its reference index and the existing goal
   tree and proof inventory, including separate library references. Treat an
   uninitialized seed as empty rather than as product direction.
2. Map the repository before proposing goals. Delegate bounded read-only scouts
   where context isolation or parallel inspection is useful. Keep these evidence
   streams distinct:
   - authoritative product direction and capability boundaries in project
     guidance and product documentation;
   - implemented user-visible behavior and durable data or workflow contracts;
   - tests, runners, and environments that may prove leaf outcomes.
3. Ask discovery scouts to report concrete file or symbol evidence, observed
   behavior, implementation gaps, contradictions, and ideas that are merely
   aspirational. For test discovery, require exact stable test IDs or titles,
   exact runnable commands when established, test type, environment, real versus
   replaced dependencies, prerequisite creation, cleanup ownership, and the
   product outcome actually demonstrated. Do not execute tests during discovery.
4. Synthesize a concise candidate hierarchy organized by durable user or product
   outcomes—not services, packages, APIs, tables, migrations, UI screens, or
   implementation tasks. A child must narrow its parent. Keep independent
   libraries under separate roots with separate proof inventories; link a
   library outcome to a product goal only when evidence supports that relation.
5. Assign only `target`, `partial`, `untested`, or `done`, using the definitions
   in the skill. Derive status from evidence, assess mixed parents
   conservatively, and do not call a leaf `done` unless multiple independent
   tests include at least one qualifying end-to-end test against production
   implementations and real required service boundaries.

Present a review packet containing:

- the candidate overarching outcome and numbered outcome tree;
- for each goal, its proposed status, concise rationale, and authoritative
  evidence links;
- contradictions, assumptions requiring confirmation, omitted aspirational
  ideas, and uncertain capability boundaries;
- candidate leaf-to-proof mappings with qualification gaps and cleanup gaps;
- the exact files that Phase 2 would change.

Ask the human to approve the proposal for write or provide corrections. A
correction is feedback, not write approval: incorporate it into a revised review
packet and ask again. Do not modify the goal tree, proof inventory, reference
index, or product-direction documentation in Phase 1. Never fabricate goals,
statuses, test qualification, commands, dependencies, environments, or cleanup
behavior.

## Phase 2 — Seed approved documentation

After explicit human approval of the current review packet, recheck the files
named in that packet. If relevant evidence or destination content changed,
report the difference and return to Phase 1 rather than overwriting it. Otherwise
update only the approved scope:

- `.opencode/skills/goal-oriented-design/references/goal-tree.md` with the
  concise approved hierarchy, statuses, and links to deeper authoritative
  context;
- `.opencode/skills/goal-oriented-design/references/e2e-proof.md` with verified
  proof candidates and explicit gaps, using stable IDs and exact commands only
  when observed;
- `.opencode/skills/goal-oriented-design/references/index.md` with product and
  independent-library references;
- approved independent-library goal trees and proof inventories in distinct
  reference files, creating and linking them from the index when needed rather
  than merging them into the product files;
- established product-direction documentation such as `AGENTS.md` only when
  the approved outcomes make it inaccurate or incomplete and ownership permits
  the edit.

Create a proof-inventory row for every approved leaf, even when no qualifying
test exists; record the gap explicitly. A leaf remains `untested` unless its
inventory contains multiple independent tests including at least one qualifying
end-to-end test. Preserve accurate existing guidance. Do not turn uncertain
evidence into an authoritative target. Report unresolved contradictions and
out-of-scope updates instead of silently resolving them. Finish by summarizing
written goals, statuses, proof gaps, files changed, and any decisions still
needed; this is a documentation initialization, so do not claim test execution
as verification.
