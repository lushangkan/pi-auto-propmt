## Why

The current `/model-prompt` command requires users to know and type subcommands and exact version names, which makes switching prompt variants slower and error-prone. Pi already supports interactive extension dialogs, so the command can provide a discoverable selector for the active model family's available prompt versions.

## What Changes

- Change `/model-prompt` with no arguments from a help/status-only flow into an interactive selector for the current matched model family.
- Present available variants for the active model through `ctx.ui` so users can choose the version to activate without typing it manually.
- Persist the selected version using the existing model prompt selection state so the next agent run injects the chosen prompt variant.
- Keep existing explicit command forms such as `/model-prompt status`, `/model-prompt use <version>`, and `/model-prompt reset` for scriptable/non-interactive usage.
- Fail softly when no UI is available, no model family matches, or no selectable variants exist.
- Continue treating only the exact reserved filename `all.md` as global; reject `all` variants such as `All.md` or `all@strict.md` so they cannot shadow model-family prompts or create ambiguous behavior.

## Capabilities

### New Capabilities

### Modified Capabilities

- `model-prompt-injection`: Add interactive variant selection behavior to the existing model prompt slash command.

## Impact

- Affected extension command handling in `extensions/model-prompts/`.
- Affected selection-state persistence and status messaging for model prompt variants.
- Tests for command behavior, UI selection success/cancel/fallback paths, and persisted active version.
- No new runtime dependencies are expected; implementation uses Pi extension `ctx.ui` APIs.
