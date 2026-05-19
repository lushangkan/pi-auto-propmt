## MODIFIED Requirements

### Requirement: Prompt Directory Discovery

The extension SHALL discover prompt Markdown files from both the global `~/.pi/model-prompts/prompts/` directory and the project-local `.pi/model-prompts/prompts/` directory.

#### Scenario: Project prompt directory exists

- **WHEN** the project contains `.pi/model-prompts/prompts/`
- **THEN** the extension scans Markdown files directly inside that directory as project prompt files

#### Scenario: Global prompt directory exists

- **WHEN** the current user home contains `~/.pi/model-prompts/prompts/`
- **THEN** the extension scans Markdown files directly inside that directory as global prompt files

#### Scenario: One prompt directory is missing

- **WHEN** either the global prompt directory or the project prompt directory is missing
- **THEN** the extension continues resolving prompts from the directory that exists and exposes the missing directory in status output

#### Scenario: Both prompt directories are missing

- **WHEN** neither `~/.pi/model-prompts/prompts/` nor `.pi/model-prompts/prompts/` exists
- **THEN** the extension continues without injecting model prompts and exposes both missing directories in status output

#### Scenario: Nested project prompt file exists

- **WHEN** a Markdown file exists in a nested subdirectory below `.pi/model-prompts/prompts/`
- **THEN** the extension ignores that nested file during project prompt discovery

#### Scenario: Nested global prompt file exists

- **WHEN** a Markdown file exists in a nested subdirectory below `~/.pi/model-prompts/prompts/`
- **THEN** the extension ignores that nested file during global prompt discovery

### Requirement: Prompt Injection Order

The extension SHALL prepend resolved prompt content to Pi's existing system prompt in a stable source-aware order.

#### Scenario: Global and project all prompts and model prompts are resolved

- **WHEN** global `all.md`, project `all.md`, a selected global model-specific prompt, and a selected project model-specific prompt contain non-empty content
- **THEN** the extension assembles the system prompt as global `all.md`, then project `all.md`, then the selected global model-specific prompt, then the selected project model-specific prompt, then Pi's existing system prompt

#### Scenario: Only all prompts are resolved

- **WHEN** global `all.md` and project `all.md` exist and no model-specific prompt is resolved from either source
- **THEN** the extension assembles the system prompt as global `all.md`, then project `all.md`, then Pi's existing system prompt

#### Scenario: Only global prompts are resolved

- **WHEN** global `all.md` and the selected global model-specific prompt contain non-empty content and no project prompt content is resolved
- **THEN** the extension assembles the system prompt as global `all.md`, then the selected global model-specific prompt, then Pi's existing system prompt

#### Scenario: Only project prompts are resolved

- **WHEN** project `all.md` and the selected project model-specific prompt contain non-empty content and no global prompt content is resolved
- **THEN** the extension assembles the system prompt as project `all.md`, then the selected project model-specific prompt, then Pi's existing system prompt

#### Scenario: Prompt file is empty

- **WHEN** a resolved prompt file contains only whitespace
- **THEN** the extension omits that prompt from the injected prefix and avoids adding empty separators for it

#### Scenario: Existing system prompt is present

- **WHEN** Pi provides an existing system prompt to the extension
- **THEN** the extension MUST NOT discard or rebuild that existing system prompt

### Requirement: Prompt Variant Selection

The extension SHALL support selecting one prompt variant per matched model family per prompt source.

#### Scenario: No version is selected and default exists in a source

- **WHEN** a matched model key has `gpt-5.5.md` in a prompt source and no selected version is stored for that model key and source
- **THEN** the extension injects that source's `gpt-5.5.md` as that source's model-specific prompt

#### Scenario: Selected global version exists

- **WHEN** the matched model key has selected global version `strict` and global `gpt-5.5@strict.md` exists
- **THEN** the extension injects global `gpt-5.5@strict.md` as the global model-specific prompt

#### Scenario: Selected project version exists

- **WHEN** the matched model key has selected project version `creative` and project `gpt-5.5@creative.md` exists
- **THEN** the extension injects project `gpt-5.5@creative.md` as the project model-specific prompt

#### Scenario: Selected version is missing from a source

- **WHEN** the stored selected version for a source no longer exists on disk
- **THEN** the extension falls back to that source's default unversioned prompt when available and reports the missing selected version and source in diagnostics

#### Scenario: Only named variants exist in a source with no selection

- **WHEN** the matched model key has only named variant files in a source and no selected version is stored for that model key and source
- **THEN** the extension injects no model-specific prompt from that source and reports that the user must select a version for that source

#### Scenario: Legacy selection state exists

- **WHEN** stored selection state exists without a prompt source dimension
- **THEN** the extension treats that selection as the project source selection for the matched model key

### Requirement: Version Switching Command

The extension SHALL provide a slash command for inspecting and changing the current model family's prompt variants by prompt source, including an interactive selector when the command is invoked without arguments in a UI-capable session.

#### Scenario: Command opens global and project selector pages

- **WHEN** the user runs `/model-prompt` with no arguments while the current model matches `gpt-5.5`, the global source has at least two available versions, and the project source has at least two available versions
- **THEN** the extension presents a `ctx.ui` selector with separate Global and Project pages for model key `gpt-5.5`

#### Scenario: Command opens only global selector page

- **WHEN** the user runs `/model-prompt` with no arguments while the current model matches `gpt-5.5`, the global source has at least two available versions, and the project source has fewer than two available versions
- **THEN** the extension presents only the Global selector page or list for model key `gpt-5.5`

#### Scenario: Command opens only project selector page

- **WHEN** the user runs `/model-prompt` with no arguments while the current model matches `gpt-5.5`, the project source has at least two available versions, and the global source has fewer than two available versions
- **THEN** the extension presents only the Project selector page or list for model key `gpt-5.5`

#### Scenario: Interactive selector chooses named global version

- **WHEN** the user selects `creative` from the Global page of the `/model-prompt` selector while the current model matches `gpt-5.5`
- **THEN** the extension stores `creative` as the selected global version for model key `gpt-5.5`

#### Scenario: Interactive selector chooses named project version

- **WHEN** the user selects `strict` from the Project page of the `/model-prompt` selector while the current model matches `gpt-5.5`
- **THEN** the extension stores `strict` as the selected project version for model key `gpt-5.5`

#### Scenario: Interactive selector chooses global default version

- **WHEN** the user selects `default` from the Global page of the `/model-prompt` selector while the current model matches `gpt-5.5`
- **THEN** the extension clears the stored selected global version for model key `gpt-5.5`

#### Scenario: Interactive selector chooses project default version

- **WHEN** the user selects `default` from the Project page of the `/model-prompt` selector while the current model matches `gpt-5.5`
- **THEN** the extension clears the stored selected project version for model key `gpt-5.5`

#### Scenario: Interactive selector is cancelled

- **WHEN** the user cancels the `/model-prompt` selector
- **THEN** the extension leaves the previous global and project selections unchanged

#### Scenario: Interactive selector is unavailable

- **WHEN** the user runs `/model-prompt` with no arguments in a session without interactive UI support
- **THEN** the extension does not attempt to open a selector and reports how to inspect or change variants with explicit command arguments

#### Scenario: Reserved global filename is exact only

- **WHEN** discovery encounters `All.md` or `all@strict.md` in either prompt source
- **THEN** the extension does not treat either file as the reserved `all.md` prompt and leaves them unavailable for selection

#### Scenario: No matching model family for selector

- **WHEN** the user runs `/model-prompt` with no arguments and no prompt model key from either source matches the active model
- **THEN** the extension leaves selection state unchanged and reports that no model prompt family matches the active model

#### Scenario: No available versions for selector

- **WHEN** the user runs `/model-prompt` with no arguments and the matched model family has no selectable versions in either source
- **THEN** the extension leaves selection state unchanged and reports that no versions are available

#### Scenario: Command shows status

- **WHEN** the user runs `/model-prompt status`
- **THEN** the extension displays the active model identities, matched model key, active global variant, active project variant, global prompt directory, project prompt directory, and injected files by source

#### Scenario: Command selects project version by default

- **WHEN** the user runs `/model-prompt use creative` while the current model matches `gpt-5.5`
- **THEN** the extension stores `creative` as the selected project version for model key `gpt-5.5`

#### Scenario: Command selects source-qualified version

- **WHEN** the user runs a source-qualified command to use global version `creative` while the current model matches `gpt-5.5`
- **THEN** the extension stores `creative` as the selected global version for model key `gpt-5.5`

#### Scenario: Command resets project version by default

- **WHEN** the user runs `/model-prompt reset` while the current model matches `gpt-5.5`
- **THEN** the extension clears the stored selected project version for model key `gpt-5.5`

#### Scenario: Command resets source-qualified version

- **WHEN** the user runs a source-qualified reset command for global prompts while the current model matches `gpt-5.5`
- **THEN** the extension clears the stored selected global version for model key `gpt-5.5`

#### Scenario: Requested version does not exist in source

- **WHEN** the user requests a version that is not available for the requested or default prompt source and current matched model key
- **THEN** the extension leaves the previous selection unchanged and reports the available versions for that source
