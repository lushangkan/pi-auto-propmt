## 1. Discovery and Data Model

- [x] 1.1 Add source-aware prompt directory configuration for global `~/.pi/model-prompts/prompts/` and project `.pi/model-prompts/prompts/` roots.
- [x] 1.2 Update prompt discovery to scan both roots non-recursively, tag each discovered file with `global` or `project`, and preserve diagnostics for missing/unreadable roots.
- [x] 1.3 Update filename parsing and discovered prompt indexes so `all.md`, default model prompts, and named variants remain source-scoped.

## 2. Resolution and Injection

- [x] 2.1 Update model key matching to consider model prompt keys discovered from either source while preserving longest-match behavior.
- [x] 2.2 Implement source-scoped variant resolution with legacy state treated as project-source selection.
- [x] 2.3 Assemble injected prompt content in the required order: global `all.md`, project `all.md`, selected global model prompt, selected project model prompt, existing system prompt.
- [x] 2.4 Ensure empty or unreadable resolved prompt files are skipped without adding empty separators or blocking the run.

## 3. Command and Selector UX

- [x] 3.1 Update `/model-prompt status` to show global/project directories, active global/project variants, missing directories, and injected files by source.
- [x] 3.2 Update the interactive `/model-prompt` flow to expose a Global page when global variants for the matched model have at least two versions.
- [x] 3.3 Update the interactive `/model-prompt` flow to expose a Project page when project variants for the matched model have at least two versions.
- [x] 3.4 Keep existing `/model-prompt use <version>` and `/model-prompt reset` behavior as project-source operations for backward compatibility.
- [x] 3.5 Add source-qualified command handling for selecting and resetting global variants if the current command parser can support it cleanly.

## 4. Tests and Documentation

- [x] 4.1 Add tests for project-only behavior to prove existing prompt injection remains compatible.
- [x] 4.2 Add tests for global-only prompt discovery, resolution, and injection.
- [x] 4.3 Add tests for combined global/project prompt injection order.
- [x] 4.4 Add tests for independent global and project selected variants, including legacy state fallback.
- [x] 4.5 Add tests for selector page visibility when global and/or project sources have two or more versions.
- [x] 4.6 Update README or examples to document global prompt directory usage and source-specific variant selection behavior.
