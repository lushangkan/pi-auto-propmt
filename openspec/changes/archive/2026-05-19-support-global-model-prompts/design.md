## Context

The model prompt extension currently resolves prompts from one project-local directory, `.pi/model-prompts/prompts/`, and treats `all.md` plus the matched model prompt as a single-source injection prefix. Users now need shared prompt defaults in `~/.pi/model-prompts/prompts/` while retaining project-level prompts and project-level variant choices.

This change affects prompt discovery, prompt resolution order, selection state, status output, and the interactive `/model-prompt` selector.

## Goals / Non-Goals

**Goals:**

- Discover Markdown prompt files from both global and project prompt directories.
- Preserve existing project-only behavior when no global directory exists.
- Inject prompts in this exact order: global `all.md`, project `all.md`, selected global model prompt, selected project model prompt, existing Pi system prompt.
- Let users choose global and project variants independently when either source has two or more versions for the active model family.
- Keep failure behavior soft for missing or unreadable prompt directories/files.

**Non-Goals:**

- No recursive prompt discovery.
- No change to prompt filename syntax.
- No remote prompt source support.
- No migration that rewrites existing project prompt files.

## Decisions

1. **Model prompt sources explicitly as `global` and `project`.**
   - Decision: represent discovered prompts with a source field and source-specific root directory.
   - Rationale: prompt order and selector grouping now depend on origin, not just filename.
   - Alternative considered: merge all files into one virtual directory. This was rejected because it cannot support independent global/project variant selection or deterministic source-specific injection order.

2. **Use source-scoped variant selection state.**
   - Decision: store selected variants per matched model key and source, e.g. global selection separate from project selection.
   - Rationale: a user may want a shared global variant and a stricter project variant simultaneously.
   - Alternative considered: one selected version for both sources. This was rejected because global and project sources may have different available versions.

3. **Resolve global and project prompts independently, then concatenate in fixed order.**
   - Decision: each source resolves its own `all.md` and selected/default model prompt; the final prefix is ordered global-all, project-all, global-model, project-model.
   - Rationale: this matches the requested precedence while preserving Pi's original system prompt last.
   - Alternative considered: group all prompts by source (`global all + global model + project all + project model`). This was rejected because the requested order places both `all.md` prompts before model-specific prompts.

4. **Selector exposes source pages only when useful.**
   - Decision: the interactive selector offers a Global page when the global source has at least two selectable versions, and a Project page when the project source has at least two selectable versions.
   - Rationale: this avoids unnecessary UI for sources with no meaningful choice while giving clear separation when both scopes are configurable.
   - Alternative considered: one combined list with labels. This was rejected because it is easier to accidentally change the wrong source and does not match the requested two-page UX.

5. **Keep command-line compatibility.**
   - Decision: existing `/model-prompt status`, `use`, and `reset` flows remain valid for project prompts; source targeting can be added without breaking existing arguments.
   - Rationale: existing users should not need to change commands for project-local behavior.

## Risks / Trade-offs

- [Risk] Existing state format may not contain a source dimension. → Mitigation: read legacy state as project-source selection and write the new source-scoped format going forward.
- [Risk] Global prompts can unexpectedly affect all projects. → Mitigation: status output must show both prompt directories and every injected file by source.
- [Risk] Ambiguous selector UX when only one source has variants. → Mitigation: open only the useful source page/list and clearly label the source being changed.
- [Risk] `~` expansion differs across environments. → Mitigation: resolve the global prompt root from the current user's home directory using Node/platform APIs rather than string literals.

## Migration Plan

- Add source-aware prompt discovery and resolution behind the existing extension entry points.
- Extend tests to cover project-only, global-only, combined global/project, missing directory, and selector grouping scenarios.
- Treat existing stored variant selections as project selections if the new state shape is absent.
- Rollback is safe by reverting code; prompt files remain ordinary Markdown files.

## Open Questions

- Should explicit CLI commands support source flags such as `/model-prompt use --global strict`, or should source selection be limited to the UI in the first implementation? The implementation should prefer backward-compatible source flags if the current command parser can support them cleanly.
