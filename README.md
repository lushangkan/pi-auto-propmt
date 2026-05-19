# pi-auto-prompt

`pi-auto-prompt` is a Pi extension package that automatically prepends global and project-local Markdown prompts to Pi's system prompt based on the active model.

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

Create reusable global prompts in:

```text
~/.pi/model-prompts/prompts/
```

Create project-specific prompts in any consuming project at:

```text
.pi/model-prompts/prompts/
```

Then add Markdown files to either directory:

```text
all.md              # injected for every model from that source
gpt-5.5.md          # default prompt for matched model family
gpt-5.5@strict.md   # named variant for that model family
```

Resolution order:

1. Global `all.md`, when present and non-empty.
2. Project `all.md`, when present and non-empty.
3. One global model-specific prompt for the active model family.
4. One project model-specific prompt for the active model family.
5. Pi's original system prompt.

`all.md` is an exact reserved filename in each source. Variants such as `All.md` or `all@strict.md` are ignored rather than treated as global or model-specific prompts. Discovery is non-recursive; nested Markdown files are ignored.

The extension preserves Pi's existing system prompt; it only prepends resolved prompt content during `before_agent_start`.

## Model matching

The extension reads the active model's available `id`, `name`, and `provider` identities, normalizes them, and fuzzy-matches prompt filenames against those identities.

When several prompt model keys match, the longest key wins. For example, `gpt-5.5-mini` beats `gpt-5.5`, which beats `gpt`.

## Command

The extension registers `/model-prompt`:

```text
/model-prompt status
/model-prompt use <version>
/model-prompt use global <version>
/model-prompt use project <version>
/model-prompt reset
/model-prompt reset global
/model-prompt reset project
```

- `status` shows model identities, matched family, global/project directories, active global/project variants, available versions, injected files by source, and diagnostics.
- `use <version>` persists a project variant for the current matched model family (backward-compatible default).
- `use global <version>` and `use project <version>` persist variants for a specific prompt source.
- `reset` clears the project persisted variant and returns to the default project prompt when available.
- `reset global` and `reset project` clear the selected variant for a specific source.
- Running `/model-prompt` with no arguments opens source-specific selectors in UI-capable sessions when global and/or project sources have two or more versions for the current model family.

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
