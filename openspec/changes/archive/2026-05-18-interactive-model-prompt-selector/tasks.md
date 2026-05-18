## 1. Command Flow

- [x] 1.1 Refactor `/model-prompt` command handling to distinguish bare invocation from explicit `status`, `use`, and `reset` actions.
- [x] 1.2 Add a selector helper in `extensions/model-prompts/index.ts` that validates matched model family, available versions, and `ctx.hasUI` before opening UI.
- [x] 1.3 Use `ctx.ui.select()` to present available versions for the current matched model family when `/model-prompt` is run without arguments.
- [x] 1.4 Persist selector results through `setSelectedVersion()`, clearing state when `default` is selected and storing named variants otherwise.
- [x] 1.5 Leave state unchanged and fail softly when the selector is cancelled, UI is unavailable, no model family matches, or no versions are available.

## 2. User Feedback

- [x] 2.1 Add success notifications that include the matched model family and selected version after interactive selection.
- [x] 2.2 Add fallback notifications that explain explicit alternatives such as `/model-prompt status`, `/model-prompt use <version>`, and `/model-prompt reset` when interactive UI cannot be used.
- [x] 2.3 Preserve existing status output and explicit command behavior for scriptable workflows.

## 3. Tests

- [x] 3.1 Add command-level tests or test harness coverage for bare `/model-prompt` opening a selector with available versions.
- [x] 3.2 Add tests for selecting a named version and verifying persisted state affects prompt resolution.
- [x] 3.3 Add tests for selecting `default` and verifying persisted selection is cleared.
- [x] 3.4 Add tests for selector cancellation leaving previous state unchanged.
- [x] 3.5 Add tests for fallback paths: no UI, no matched model family, and no available versions.
- [x] 3.6 Add parser coverage ensuring only the exact reserved `all.md` filename is treated as global, while variants such as `All.md` and `all@strict.md` are ignored.
- [x] 3.7 Run `npm test` and `npm run typecheck` to verify behavior and types.
