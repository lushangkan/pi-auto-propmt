## Context

The existing model prompt extension injects project-local prompt Markdown in `before_agent_start` and registers `/model-prompt` for status and explicit variant changes. Variant state is already persisted in `.pi/model-prompts/state.json` through `setSelectedVersion()`, and `resolvePrompts()` already exposes the matched model family, active variant, selected variant, available versions, and diagnostics.

The filename parser also reserves a single exact global filename, `all.md`. Variants such as `All.md` or `all@strict.md` must not be treated as global or model-family prompt files because they create ambiguous semantics around whether `all` is a reserved keyword or a selectable family.

The missing piece is command ergonomics: users currently need to type `/model-prompt use <version>` and know the available version names. Pi extension dialogs provide `ctx.ui.select()` for simple interactive selection without adding dependencies or custom TUI components.

## Goals / Non-Goals

**Goals:**

- Make bare `/model-prompt` open an interactive selector for the active model family's available versions.
- Use existing resolution data and persistence functions so selection affects the next prompt injection deterministically.
- Preserve `/model-prompt status`, `/model-prompt use <version>`, and `/model-prompt reset` behavior for explicit and non-interactive workflows.
- Keep `all.md` special-cased as one exact reserved filename rather than a prompt family that can have variants or model-specific selections.
- Fail softly with notifications when selection cannot proceed.
- Keep implementation small, testable, and dependency-free.

**Non-Goals:**

- Replacing Pi's built-in `/model` model selector.
- Adding a new prompt file format or changing prompt discovery rules.
- Supporting `all` as a model-family key for version selection or special configuration.
- Building a custom `ctx.ui.custom()` component unless `ctx.ui.select()` cannot satisfy requirements.
- Supporting selection across model families other than the currently matched active model family.

## Decisions

1. **Use bare `/model-prompt` as the selector entrypoint.**
   - Rationale: This matches the user's requested command modification and makes the most discoverable path interactive.
   - Alternative considered: Add `/model-prompt select`; rejected because it preserves the current friction and makes the common path less obvious.

2. **Use `ctx.ui.select()` rather than a custom component.**
   - Rationale: The Pi extension dialog API directly supports selecting from options and is sufficient for a list of prompt versions. This keeps the implementation aligned with Pi docs and avoids custom keyboard/rendering code.
   - Alternative considered: `ctx.ui.custom()` with `SelectList`; deferred because it is only needed if richer metadata, search, or multi-column rendering becomes necessary.

3. **Represent reset-to-default as the `default` option.**
   - Rationale: `resolvePrompts()` already exposes default variants as `default`, and `/model-prompt use default` already clears persisted selection. The selector should use the same mental model and persistence behavior.
   - Alternative considered: Add a separate `Reset to default` synthetic option; rejected to avoid two labels for the same state.

4. **Persist only non-default selections.**
   - Rationale: Existing behavior stores named versions and clears state for `default`; keeping this behavior avoids migration and preserves current fallback semantics.
   - Alternative considered: Persist `default` explicitly; rejected because it would change the state model without improving UX.

5. **Keep command logic thin and extract helpers if needed.**
   - Rationale: The current command handler already performs validation. Implementation can add a small `selectPromptVariant()` command helper in `index.ts`, while lower-level discovery/state behavior remains in `core.ts`.
   - Alternative considered: Move all command behavior to `core.ts`; rejected because `ctx.ui` belongs to the extension/runtime boundary, not pure core resolution logic.

6. **Reserve `all` exclusively for the single global file.**
   - Rationale: `all.md` is a global prepend that applies before model-family selection. Allowing `All.md`, `all@strict.md`, or similar files would blur the line between global and per-model behavior and could produce unexpected injection or selector options.
   - Alternative considered: Treat `all@<version>.md` as configurable global variants; rejected because the current state model, command surface, and requirements are all model-family scoped, not global-profile scoped.

## Risks / Trade-offs

- **Non-interactive mode has no usable dialog** → Check `ctx.hasUI` before opening the selector and show status/usage guidance instead of failing.
- **No matched model family** → Notify the user that the active model has no matching prompt family and include status context.
- **No available versions** → Notify that no selectable variants exist for the matched family.
- **User cancels the selector** → Leave persisted state unchanged and notify or silently return with no mutation.
- **Stale result after selection** → Persist through `setSelectedVersion()` and optionally re-resolve for confirmation messaging so displayed active state reflects the updated selection.
- **Ambiguous default semantics** → Treat selected `default` exactly like `/model-prompt use default`: clear persisted selection for the matched model family.
