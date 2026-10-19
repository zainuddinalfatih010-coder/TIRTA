# SKILL_ROUTER.md

## Purpose
This file tells a brand-new coding agent which local skills/tools are already available on the owner machine and how to use them selectively.

User-level Codex skills are installed under:
C:\Users\zainu\.agents\skills

Do not assume a skill exists merely because this document names a category.
If running in a different agent/runtime (for example Antigravity) that cannot resolve these Codex skills, use the principles in this package directly and do not fake skill execution.

## Prime directive
Use skills because a task triggers them, not because they are installed.
Loading every skill at once wastes context and usually reduces quality.

## Planning/context skills
### context-engineering
Use when:
- multi-file context is large;
- scientific + UX + implementation constraints could be lost;
- a long session needs deliberate context compression.

Do not use as ritual for tiny edits.

### workspace-memory
Use for durable workspace/session continuity when the runtime supports it.
Disk specs/checkpoints remain authoritative.

### spec-driven-development
Use for:
- implementing a substantial feature from these written specs;
- mapping requirements to tasks/tests;
- maintaining acceptance traceability.

Strong default for initial TIRTA greenfield phases.

### incremental-implementation
Use when:
- the direction is clear;
- implementation should proceed in small verifiable slices;
- giant-bang changes would be risky.

### efficient-agent-work
Use for tool/context economy on long missions.

## Product/UI design skills
### impeccable
Use for:
- UI design critique;
- high-fidelity composition;
- visual hierarchy/polish;
- anti-generic design review.

It does not override user taste or proposal truth.

### emil-design-eng
Use for:
- craft judgment;
- interaction details;
- product-feeling UI;
- hierarchy/motion decisions.

### web-design-guidelines
Use for:
- broad web UI quality checks;
- responsive/accessibility conventions.

### pick-ui-library
Use only if choosing between UI primitive/component libraries.
Do not choose a whole visual identity from a library.

### animate
Use only after static composition is strong and a new purposeful animation is justified.

### find-animation-opportunities
Use to identify where motion could improve comprehension/continuity.
Do not implement everything it finds.

### review-animations / improve-animations
Use for auditing existing motion once motion exists.

### transitions-dev / transitions-polish
Use when implementing/polishing specific interaction transitions.
Respect reduced motion.

## React architecture skills
### vercel-react-best-practices
Use for:
- React component/state/performance review;
- hooks/effects;
- rendering patterns;
- avoidable rerenders.

### vercel-composition-patterns
Use for:
- component API design;
- prop explosion;
- reusable compound patterns;
- clean component boundaries.

### code-simplification
Use after a meaningful implementation when behavior is already verified.
Never simplify scientific logic by changing semantics.

## Testing/debugging skills
### systematic-debugging
Mandatory mindset for:
- failing tests;
- runtime bugs;
- unexplained state;
- responsive regressions;
- flaky behavior.

Reproduce before patching.

### debugging-and-error-recovery
Useful for recovery strategy and robust error paths.

### test-driven-development
Use for:
- scientific/domain rules;
- regression bugs;
- deterministic optimizer behavior;
- migration/import behavior.

Do not force TDD for purely exploratory visual comp work.

### playwright-cli
Preferred browser automation path.
Use for:
- actual viewport verification;
- E2E;
- screenshots;
- interaction;
- console/page errors;
- offline browser tests.

Avoid diagnosing layout from cropped screenshots without checking the effective viewport.

### verification-before-completion
Use before saying a significant batch/gate is done.

### requesting-code-review
Use after meaningful milestone implementations.

### receiving-code-review
Use when processing reviewer findings; verify technically before applying.

## Parallel-agent skill
### subagent-driven-development
Use only for genuinely independent work.
Good:
- one read-only UX audit;
- one independent test-plan review;
- one dependency/license investigation.

Bad:
- multiple agents editing the same shared UI files;
- spawning agents for sequential tiny tasks.

One lead owns authoritative mutations.

## Security/quality skills
### security-review
Use at sensitive/final milestones, not every CSS patch.

### semgrep
Use for targeted static security/code pattern auditing.

Other verified local CLI-quality tools historically available:
- react-doctor
- knip
- lhci
- stryker
- semgrep
- trivy
- gitleaks
- playwright-cli

Verify each executable is currently available before depending on it.

Suggested uses:
- React Doctor: targeted React health review;
- Knip: dead files/exports/dependencies at cleanup milestone;
- Lighthouse CI: performance/accessibility checkpoint;
- Stryker: mutation testing only for high-value domain logic;
- Semgrep: static code/security patterns;
- Trivy: dependency/filesystem/container vulnerability review where relevant;
- Gitleaks: secret scan.

Do not add these as runtime app dependencies merely for QA.

## Design/UI supporting categories observed locally
The owner machine also has skills such as:
- art-consistency
- animation-vocabulary
- performance-optimization
- deep-research-operator
- router
- skill-creator
- system-connector
- desktop-commander-guide
- godmode
- gstack

Most are not default TIRTA build dependencies.

### deep-research-operator
Useful for a bounded research question where current public evidence materially changes a decision.

### performance-optimization
Use only after measurement identifies a real performance problem.

### gstack
Treat as review/planning support unless explicitly authorized otherwise.
Do not let a generic workflow tool override the TIRTA specs, mutate production arbitrarily, or deploy without authorization.

## Desktop Commander
Hands-on local filesystem/terminal/browser-adjacent execution may use Desktop Commander when available.
Use it for:
- repo inspection;
- commands/builds;
- file operations;
- tool verification.

Never infer command success from no output.
Capture actual results.

## Research/browser
For current:
- library docs;
- license status;
- browser/platform behavior;
- domain interaction references
use web/current sources when available.

For TIRTA science:
public research can inform questions, but no scientific default enters production until it is explicitly validated and recorded.

## Skill sequencing examples
### New major UI stage
1. spec-driven-development
2. impeccable + emil-design-eng for composition
3. incremental-implementation
4. vercel-react-best-practices as needed
5. playwright-cli runtime QA
6. verification-before-completion
7. requesting-code-review

### Scientific optimizer work
1. spec-driven-development
2. test-driven-development
3. implement pure domain logic
4. systematic-debugging on failures
5. verification-before-completion
6. requesting-code-review

### Responsive bug
1. reproduce with playwright-cli at exact viewport
2. systematic-debugging
3. smallest CSS/layout correction
4. retest nearby viewport matrix
5. verification-before-completion

### Final hardening
1. playwright-cli full E2E
2. accessibility/performance tooling
3. semgrep / gitleaks / dependency audit
4. code-simplification only if safe
5. requesting-code-review
6. verification-before-completion

## Skill anti-patterns
Do NOT:
- load 15 skills before a simple task;
- let a design skill pick TIRTA scientific meaning;
- use a score from a skill as proof the owner likes the UI;
- install a dependency because a skill suggests it without TIRTA justification;
- rerun broad audits after every one-line fix;
- use review tools as a substitute for real browser interaction.

## Agent-specific note
Codex should be able to use installed user-level skills when its environment exposes them.
Antigravity receives the exact same package for parity, but may have a different tool/skill system.
Antigravity must still follow the same process and acceptance rules even if skill names differ.

## Newly installed design skill stack — filtered use

The owner machine now also has these user-level skills under:
C:\Users\zainu\.agents\skills

### frontend-design
Source: Anthropic public skills repository.
Use for distinctive art direction and anti-template pressure.
Do not let it turn TIRTA into a marketing page.

### interface-design
Use for product-tool craft, hierarchy, dense/data-rich interface composition, states, and design-system discipline.

### motion-design
Use only after static hierarchy and interaction are correct.
Every animation needs a clear product job.

### design-review
Use after a runnable representative build exists.
Screenshot-based review is mandatory; source review alone is insufficient.

### web-accessibility
Use for interaction/accessibility contracts and evidence.
Do not claim full conformance from automated checks alone.

### tirta-design-director
TIRTA-specific orchestrator/filter.
This skill must be consulted before material TIRTA visual/product-design work.

Important:
Do NOT load all design skills for one task.
Use the proposer -> TIRTA filter -> critic -> runtime evidence loop defined in tirta-design-director.

Recommended maximum for one phase:
- 2 proposer/design skills
- 1 motion specialist
- 2 critique/review skills

Skills provide advice, never authority.
Proposal/science/user outcome remain above all skill suggestions.
