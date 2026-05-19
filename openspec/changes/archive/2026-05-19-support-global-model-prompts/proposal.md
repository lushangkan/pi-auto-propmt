## Why

Model prompt files are currently discovered only from the project-local `.pi/model-prompts/prompts` directory, which prevents users from maintaining reusable prompt defaults across projects. Supporting both global and project prompt sources lets users define shared defaults while still allowing project-specific overrides and variants.

## What Changes

- Discover prompt files from both `~/.pi/model-prompts/prompts` and the existing project `.pi/model-prompts/prompts` directory.
- Resolve prompt injection in the requested precedence order: global `ALL.md`, project `ALL.md`, selected global model prompt, selected project model prompt, then Pi's original system prompt.
- Keep project prompt content later in the injected stack so project-specific guidance can refine global defaults.
- Update `/model-prompt` selection UX to expose separate Global and Project selector pages when that source has two or more versions for the current model family.
- Preserve safe no-op behavior when either prompt directory is absent or unreadable.

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `model-prompt-injection`: Prompt discovery, injection ordering, variant selection, and selector behavior now account for global and project prompt sources.

## Impact

- Affected code: `extensions/model-prompts/core.ts`, selector/command registration in `extensions/model-prompts/index.ts` if needed, and model prompt tests.
- Affected data: existing per-project selection state may need to distinguish global and project source selections.
- User-facing behavior: users can maintain shared prompt files under `~/.pi/model-prompts/prompts` and choose variants separately from project-specific variants.
- No breaking changes are intended for existing project-only prompt files or command arguments.
