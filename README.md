# pi-auto-prompt

`pi-auto-prompt` is a Pi extension package that automatically prepends project-local Markdown prompts to Pi's system prompt based on the active model.

It is packaged as a standard Pi package for GitHub/npm distribution and can be installed with `pi install`.

## Install

From npm, after publishing:

```bash
pi install npm:pi-auto-prompt
```

From GitHub:

```bash
pi install git:github.com/zara/pi-auto-prompt
```

For local development:

```bash
pi install /absolute/path/to/pi-auto-prompt
# or try it for one run
pi -e /absolute/path/to/pi-auto-prompt
```

## Prompt files

In any project where the extension is installed, create:

```text
.pi/model-prompts/prompts/
```

Then add Markdown files:

```text
.pi/model-prompts/prompts/all.md              # injected for every model
.pi/model-prompts/prompts/gpt-5.5.md          # default prompt for matched model family
.pi/model-prompts/prompts/gpt-5.5@strict.md   # named variant for that model family
```

Resolution order:

1. `all.md`, when present and non-empty.
2. One model-specific prompt for the active model family.
3. Pi's original system prompt.

`all.md` is an exact reserved filename. Variants such as `All.md` or `all@strict.md` are ignored rather than treated as global or model-specific prompts.

The extension preserves Pi's existing system prompt; it only prepends resolved prompt content during `before_agent_start`.

## Model matching

The extension reads the active model's available `id`, `name`, and `provider` identities, normalizes them, and fuzzy-matches prompt filenames against those identities.

When several prompt model keys match, the longest key wins. For example, `gpt-5.5-mini` beats `gpt-5.5`, which beats `gpt`.

## Command

The extension registers `/model-prompt`:

```text
/model-prompt status
/model-prompt use <version>
/model-prompt reset
```

- `status` shows model identities, matched family, active variant, available versions, injected files, prompt directory, and diagnostics.
- `use <version>` persists a named variant for the current matched model family.
- `reset` clears the persisted variant and returns to the default prompt when available.

Selection state is stored in the consuming project at:

```text
.pi/model-prompts/state.json
```

## Package structure

```text
extensions/model-prompts/index.ts   # Pi extension entry point
extensions/model-prompts/core.ts    # prompt discovery/resolution/assembly logic
examples/model-prompts/prompts/     # sample prompt files
tests/model-prompts.test.ts         # node:test coverage
```

The package declares its Pi resources in `package.json`:

```json
{
  "pi": {
    "extensions": ["./extensions/model-prompts"]
  }
}
```

## Development

```bash
npm install
npm test
npm run typecheck
npm run pack:dry-run
```

## Publishing checklist

1. Replace the placeholder GitHub metadata in `package.json` (`homepage`, `repository`, `bugs`, and optionally `author`).
2. Commit the package files.
3. Push to GitHub.
4. Publish to npm:

```bash
npm publish --access public
```

5. Verify installation:

```bash
pi -e npm:pi-auto-prompt
# or
pi install npm:pi-auto-prompt
```
