## 1. Extension Scaffolding

- [ ] 1.1 Create the Pi extension file in the project extension location and register it with a clear extension name.
- [ ] 1.2 Add the project-local `.pi/model-prompts/prompts/` directory convention and sample prompt files for manual smoke testing.
- [ ] 1.3 Add project package/config/test scaffolding needed to typecheck and test the extension code.

## 2. Prompt Discovery and Parsing

- [ ] 2.1 Implement a single filename parser for `all.md`, `<model-key>.md`, and `<model-key>@<version>.md`.
- [ ] 2.2 Implement prompt directory discovery that scans only direct Markdown children of `.pi/model-prompts/prompts/`.
- [ ] 2.3 Implement safe handling for missing directories, empty files, unreadable files, unsupported filenames, and diagnostics.

## 3. Model Resolution and Prompt Assembly

- [ ] 3.1 Implement model identity extraction using available active model id/name values from Pi.
- [ ] 3.2 Implement normalized fuzzy matching with longest matching model key precedence.
- [ ] 3.3 Implement variant resolution with unversioned default fallback, selected-version handling, missing-selection fallback, and no-guess behavior for only-versioned prompts.
- [ ] 3.4 Implement system prompt assembly in `before_agent_start` with `all.md` first, selected model prompt second, and Pi's existing `event.systemPrompt` last.

## 4. Version Selection Command and State

- [ ] 4.1 Implement project-local version selection state keyed by normalized model family.
- [ ] 4.2 Register `/model-prompt status` to display active model identities, matched family, active variant, prompt directory, injected files, warnings, and ignored files.
- [ ] 4.3 Register `/model-prompt use <version>` to persist a valid variant for the currently matched model family.
- [ ] 4.4 Register `/model-prompt reset` to clear the selected variant for the currently matched model family.
- [ ] 4.5 Ensure invalid command usage fails softly and reports available versions without changing state.

## 5. Validation

- [ ] 5.1 Add unit tests for filename parsing, prompt discovery filtering, and invalid filename diagnostics.
- [ ] 5.2 Add unit tests for model matching, longest-key precedence, and no-match behavior.
- [ ] 5.3 Add unit tests for variant selection, fallback behavior, empty prompt omission, and injection order.
- [ ] 5.4 Add command/state tests or a documented smoke test for status, use, and reset flows.
- [ ] 5.5 Run typecheck, tests, and lint or document unavailable validation commands before marking the change complete.
