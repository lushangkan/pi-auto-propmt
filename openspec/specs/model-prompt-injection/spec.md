## Requirements

### Requirement: Installable Pi Package

The extension SHALL be packaged as a standard Pi package that can be installed from npm, GitHub, or a local path with `pi install` or loaded with `pi -e`.

#### Scenario: Package declares extension resources

- **WHEN** Pi reads the package manifest
- **THEN** `package.json` declares the extension entry through the `pi.extensions` field

#### Scenario: Package is packed for npm

- **WHEN** the package is packed for publication
- **THEN** the tarball includes the extension files, README, license, package manifest, and example prompt files without requiring a project-local `.pi/extensions/` directory

### Requirement: Prompt Directory Discovery

The extension SHALL discover prompt Markdown files from the project-local `.pi/model-prompts/prompts/` directory.

#### Scenario: Prompt directory exists

- **WHEN** the project contains `.pi/model-prompts/prompts/`
- **THEN** the extension scans Markdown files directly inside that directory

#### Scenario: Prompt directory is missing

- **WHEN** the project does not contain `.pi/model-prompts/prompts/`
- **THEN** the extension continues without injecting model prompts and exposes the missing directory in status output

#### Scenario: Nested prompt file exists

- **WHEN** a Markdown file exists in a nested subdirectory below `.pi/model-prompts/prompts/`
- **THEN** the extension ignores that nested file during prompt discovery

### Requirement: Prompt Filename Parsing

The extension SHALL parse prompt filenames into reserved global prompts, default model prompts, and named model prompt variants.

#### Scenario: Global prompt file

- **WHEN** discovery finds `all.md`
- **THEN** the extension treats it as the global prompt for all model families

#### Scenario: Default model prompt file

- **WHEN** discovery finds `gpt-5.5.md`
- **THEN** the extension treats it as the default variant for model key `gpt-5.5`

#### Scenario: Named model prompt variant file

- **WHEN** discovery finds `gpt-5.5@strict.md`
- **THEN** the extension treats it as version `strict` for model key `gpt-5.5`

#### Scenario: Unsupported filename

- **WHEN** discovery finds a file that cannot be parsed as `all.md`, `<model-key>.md`, or `<model-key>@<version>.md`
- **THEN** the extension ignores that file and reports it in diagnostics without failing prompt injection

### Requirement: Model Family Matching

The extension SHALL match the active model to prompt model keys using deterministic fuzzy substring matching.

#### Scenario: Model name contains prompt key

- **WHEN** the active model identity is `ikun-gpt-5.5`
- **THEN** the extension matches prompt files with model key `gpt-5.5`

#### Scenario: Model id contains prompt key

- **WHEN** the active model id contains `gpt-5.5`
- **THEN** the extension matches prompt files with model key `gpt-5.5` even if the display name differs

#### Scenario: Multiple prompt keys match

- **WHEN** prompt keys `gpt`, `gpt-5.5`, and `gpt-5.5-mini` all match the active model identity
- **THEN** the extension selects the longest matching model key

#### Scenario: No prompt key matches

- **WHEN** no discovered model prompt key matches the active model identity
- **THEN** the extension injects `all.md` if present and injects no model-specific prompt

### Requirement: Prompt Injection Order

The extension SHALL prepend resolved prompt content to Pi's existing system prompt in a stable order.

#### Scenario: Global and model prompts are resolved

- **WHEN** both `all.md` and the selected model-specific prompt contain non-empty content
- **THEN** the extension assembles the system prompt as `all.md`, then the selected model-specific prompt, then Pi's existing system prompt

#### Scenario: Only global prompt is resolved

- **WHEN** `all.md` exists and no model-specific prompt is resolved
- **THEN** the extension assembles the system prompt as `all.md`, then Pi's existing system prompt

#### Scenario: Prompt file is empty

- **WHEN** a resolved prompt file contains only whitespace
- **THEN** the extension omits that prompt from the injected prefix and avoids adding empty separators for it

#### Scenario: Existing system prompt is present

- **WHEN** Pi provides an existing system prompt to the extension
- **THEN** the extension MUST NOT discard or rebuild that existing system prompt

### Requirement: Prompt Variant Selection

The extension SHALL support selecting one prompt variant per matched model family.

#### Scenario: No version is selected and default exists

- **WHEN** the matched model key has `gpt-5.5.md` and no selected version is stored
- **THEN** the extension injects `gpt-5.5.md` as the model-specific prompt

#### Scenario: Selected version exists

- **WHEN** the matched model key has selected version `strict` and `gpt-5.5@strict.md` exists
- **THEN** the extension injects `gpt-5.5@strict.md` as the model-specific prompt

#### Scenario: Selected version is missing

- **WHEN** the stored selected version no longer exists on disk
- **THEN** the extension falls back to the default unversioned prompt when available and reports the missing selected version in diagnostics

#### Scenario: Only named variants exist with no selection

- **WHEN** the matched model key has only named variant files and no selected version is stored
- **THEN** the extension injects no model-specific prompt and reports that the user must select a version

### Requirement: Version Switching Command

The extension SHALL provide a slash command for inspecting and changing the current model family's prompt variant, including an interactive selector when the command is invoked without arguments in a UI-capable session.

#### Scenario: Command opens interactive selector

- **WHEN** the user runs `/model-prompt` with no arguments while the current model matches `gpt-5.5` and versions are available
- **THEN** the extension presents a `ctx.ui` selector containing the available versions for model key `gpt-5.5`

#### Scenario: Interactive selector chooses named version

- **WHEN** the user selects `creative` from the `/model-prompt` selector while the current model matches `gpt-5.5`
- **THEN** the extension stores `creative` as the selected version for model key `gpt-5.5`

#### Scenario: Interactive selector chooses default version

- **WHEN** the user selects `default` from the `/model-prompt` selector while the current model matches `gpt-5.5`
- **THEN** the extension clears the stored selected version for model key `gpt-5.5`

#### Scenario: Interactive selector is cancelled

- **WHEN** the user cancels the `/model-prompt` selector
- **THEN** the extension leaves the previous selection unchanged

#### Scenario: Interactive selector is unavailable

- **WHEN** the user runs `/model-prompt` with no arguments in a session without interactive UI support
- **THEN** the extension does not attempt to open a selector and reports how to inspect or change variants with explicit command arguments

#### Scenario: Reserved global filename is exact only

- **WHEN** discovery encounters `All.md` or `all@strict.md`
- **THEN** the extension does not treat either file as the reserved global prompt and leaves them unavailable for selection

#### Scenario: No matching model family for selector

- **WHEN** the user runs `/model-prompt` with no arguments and no prompt model key matches the active model
- **THEN** the extension leaves selection state unchanged and reports that no model prompt family matches the active model

#### Scenario: No available versions for selector

- **WHEN** the user runs `/model-prompt` with no arguments and the matched model family has no selectable versions
- **THEN** the extension leaves selection state unchanged and reports that no versions are available

#### Scenario: Command shows status

- **WHEN** the user runs `/model-prompt status`
- **THEN** the extension displays the active model identities, matched model key, active variant, prompt directory, and injected files

#### Scenario: Command selects version

- **WHEN** the user runs `/model-prompt use creative` while the current model matches `gpt-5.5`
- **THEN** the extension stores `creative` as the selected version for model key `gpt-5.5`

#### Scenario: Command resets version

- **WHEN** the user runs `/model-prompt reset` while the current model matches `gpt-5.5`
- **THEN** the extension clears the stored selected version for model key `gpt-5.5`

#### Scenario: Requested version does not exist

- **WHEN** the user requests a version that is not available for the current matched model key
- **THEN** the extension leaves the previous selection unchanged and reports the available versions

### Requirement: Safe Failure Behavior

The extension SHALL fail softly and never block an agent run solely because model prompt resolution fails.

#### Scenario: Prompt file cannot be read

- **WHEN** a resolved prompt file cannot be read due to an filesystem error
- **THEN** the extension skips that file, reports the error in diagnostics, and preserves Pi's existing system prompt

#### Scenario: State file cannot be read

- **WHEN** stored version selection state cannot be read
- **THEN** the extension ignores the stored state for that run and uses default resolution rules

#### Scenario: Extension has no resolved prompt content

- **WHEN** no global or model-specific prompt content is resolved
- **THEN** the extension returns no system prompt modification
