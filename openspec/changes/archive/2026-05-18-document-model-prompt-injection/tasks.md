## 1. Extension Scaffolding

- [x] 1.1 Create the Pi extension under the package `extensions/` directory and register it with a clear extension name.
- [x] 1.2 Document the consuming-project `.pi/model-prompts/prompts/` directory convention and provide sample prompt files for manual smoke testing.
- [x] 1.3 Add project package/config/test scaffolding needed to typecheck and test the extension code.

## 2. Prompt Discovery and Parsing

- [x] 2.1 Implement a single filename parser for `all.md`, `<model-key>.md`, and `<model-key>@<version>.md`.
- [x] 2.2 Implement prompt directory discovery that scans only direct Markdown children of `.pi/model-prompts/prompts/`.
- [x] 2.3 Implement safe handling for missing directories, empty files, unreadable files, unsupported filenames, and diagnostics.

## 3. Model Resolution and Prompt Assembly

- [x] 3.1 Implement model identity extraction using available active model id/name values from Pi.
- [x] 3.2 Implement normalized fuzzy matching with longest matching model key precedence.
- [x] 3.3 Implement variant resolution with unversioned default fallback, selected-version handling, missing-selection fallback, and no-guess behavior for only-versioned prompts.
- [x] 3.4 Implement system prompt assembly in `before_agent_start` with `all.md` first, selected model prompt second, and Pi's existing `event.systemPrompt` last.

## 4. Version Selection Command and State

- [x] 4.1 Implement project-local version selection state keyed by normalized model family.
- [x] 4.2 Register `/model-prompt status` to display active model identities, matched family, active variant, prompt directory, injected files, warnings, and ignored files.
- [x] 4.3 Register `/model-prompt use <version>` to persist a valid variant for the currently matched model family.
- [x] 4.4 Register `/model-prompt reset` to clear the selected variant for the currently matched model family.
- [x] 4.5 Ensure invalid command usage fails softly and reports available versions without changing state.

## 5. Package Distribution

- [x] 5.1 Move extension implementation out of `.pi/extensions/` into a standard package `extensions/` directory.
- [x] 5.2 Add `package.json` npm metadata, `pi.extensions` manifest, package `files`, exports, keywords, peer dependency, and publish/install scripts.
- [x] 5.3 Move sample prompt files under `examples/` so the npm package can include examples without activating project-local prompts in this repository.
- [x] 5.4 Add README installation, usage, local development, and publishing instructions for npm/GitHub and `pi install`.
- [x] 5.5 Verify `npm pack --dry-run` includes only the intended package artifacts.

## 6. Validation

- [x] 6.1 Add unit tests for filename parsing, prompt discovery filtering, and invalid filename diagnostics.
- [x] 6.2 Add unit tests for model matching, longest-key precedence, and no-match behavior.
- [x] 6.3 Add unit tests for variant selection, fallback behavior, empty prompt omission, and injection order.
- [x] 6.4 Add command/state tests or a documented smoke test for status, use, and reset flows.
- [x] 6.5 Run typecheck, tests, and lint or document unavailable validation commands before marking the change complete.
