## MODIFIED Requirements

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
