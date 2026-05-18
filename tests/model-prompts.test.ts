import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";

import {
	PROMPT_RELATIVE_DIR,
	STATE_RELATIVE_PATH,
	assembleSystemPrompt,
	discoverPromptCatalog,
	formatResolutionStatus,
	matchModelKey,
	parsePromptFilename,
	resolvePrompts,
	setSelectedVersion,
} from "../extensions/model-prompts/core.ts";

function withTempProject(fn: (cwd: string) => void) {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "model-prompts-test-"));
	try {
		fn(cwd);
	} finally {
		fs.rmSync(cwd, { recursive: true, force: true });
	}
}

function writePrompt(cwd: string, filename: string, content: string) {
	const dir = path.join(cwd, PROMPT_RELATIVE_DIR);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, filename), content, "utf8");
}

test("parses global, default, variant, and invalid prompt filenames", () => {
	assert.deepEqual(parsePromptFilename("all.md"), {
		kind: "global",
		filename: "all.md",
	});
	assert.deepEqual(parsePromptFilename("gpt-5.5.md"), {
		kind: "model",
		filename: "gpt-5.5.md",
		modelKey: "gpt-5.5",
		normalizedModelKey: "gpt-5.5",
	});
	assert.deepEqual(parsePromptFilename("GPT-5.5@strict.md"), {
		kind: "model",
		filename: "GPT-5.5@strict.md",
		modelKey: "GPT-5.5",
		normalizedModelKey: "gpt-5.5",
		version: "strict",
	});
	assert.equal(parsePromptFilename("bad@@name.md"), undefined);
	assert.equal(parsePromptFilename("notes.txt"), undefined);
});

test("discovers only direct Markdown children and reports invalid filenames", () => {
	withTempProject((cwd) => {
		writePrompt(cwd, "all.md", "global");
		writePrompt(cwd, "gpt-5.5.md", "default");
		writePrompt(cwd, "bad@@name.md", "ignored");
		fs.writeFileSync(
			path.join(cwd, PROMPT_RELATIVE_DIR, "notes.txt"),
			"ignored",
			"utf8",
		);
		fs.mkdirSync(path.join(cwd, PROMPT_RELATIVE_DIR, "nested"));
		fs.writeFileSync(
			path.join(cwd, PROMPT_RELATIVE_DIR, "nested", "gpt.md"),
			"nested",
			"utf8",
		);

		const catalog = discoverPromptCatalog(cwd);
		assert.equal(catalog.global?.filename, "all.md");
		assert.equal(
			catalog.models.get("gpt-5.5")?.get("default")?.content,
			"default",
		);
		assert.deepEqual(
			catalog.diagnostics.ignoredFiles.map((file) => file.filename).sort(),
			["bad@@name.md", "notes.txt"],
		);
		assert.equal(catalog.models.has("gpt"), false);
	});
});

test("missing prompt directory fails softly", () => {
	withTempProject((cwd) => {
		const result = resolvePrompts(cwd, { id: "ikun-gpt-5.5", name: "GPT" });
		assert.equal(result.diagnostics.missingDirectory, true);
		assert.deepEqual(result.contents, []);
		assert.equal(assembleSystemPrompt(result.contents, "base"), undefined);
	});
});

test("matches models by normalized fuzzy longest-key precedence", () => {
	assert.equal(
		matchModelKey(["ikun-gpt-5.5-mini"], ["gpt", "gpt-5.5", "gpt-5.5-mini"]),
		"gpt-5.5-mini",
	);
	assert.equal(
		matchModelKey(["anthropic/claude-sonnet"], ["gpt", "gpt-5.5"]),
		undefined,
	);
});

test("resolves variants, selected state, fallback, empty omission, and injection order", () => {
	withTempProject((cwd) => {
		writePrompt(cwd, "all.md", "global");
		writePrompt(cwd, "gpt-5.5.md", "default");
		writePrompt(cwd, "gpt-5.5@strict.md", "strict");
		writePrompt(cwd, "gpt-5.5@empty.md", "   \n");

		let result = resolvePrompts(cwd, {
			id: "provider/ikun-gpt-5.5",
			name: "GPT 5.5",
		});
		assert.equal(result.activeVariant, "default");
		assert.deepEqual(result.injectedFiles, ["all.md", "gpt-5.5.md"]);
		assert.equal(
			assembleSystemPrompt(result.contents, "base"),
			"global\n\ndefault\n\nbase",
		);

		setSelectedVersion(cwd, "gpt-5.5", "strict");
		result = resolvePrompts(cwd, { id: "ikun-gpt-5.5" });
		assert.equal(result.activeVariant, "strict");
		assert.deepEqual(result.injectedFiles, ["all.md", "gpt-5.5@strict.md"]);

		setSelectedVersion(cwd, "gpt-5.5", "missing");
		result = resolvePrompts(cwd, { id: "ikun-gpt-5.5" });
		assert.equal(result.activeVariant, "default");
		assert.match(result.diagnostics.warnings.join("\n"), /missing/);

		setSelectedVersion(cwd, "gpt-5.5", "empty");
		result = resolvePrompts(cwd, { id: "ikun-gpt-5.5" });
		assert.deepEqual(result.injectedFiles, ["all.md"]);
		assert.match(result.diagnostics.warnings.join("\n"), /empty/);
	});
});

test("only named variants do not guess without selection", () => {
	withTempProject((cwd) => {
		writePrompt(cwd, "all.md", "global");
		writePrompt(cwd, "gpt-5.5@strict.md", "strict");
		const result = resolvePrompts(cwd, { id: "ikun-gpt-5.5" });
		assert.equal(result.activeVariant, undefined);
		assert.deepEqual(result.injectedFiles, ["all.md"]);
		assert.match(result.diagnostics.warnings.join("\n"), /only named variants/);
	});
});

test("status output includes command smoke-test fields and state file can reset", () => {
	withTempProject((cwd) => {
		writePrompt(cwd, "all.md", "global");
		writePrompt(cwd, "gpt-5.5@strict.md", "strict");
		setSelectedVersion(cwd, "gpt-5.5", "strict");
		let result = resolvePrompts(cwd, { id: "ikun-gpt-5.5" });
		const status = formatResolutionStatus(result);
		assert.match(status, /Active model identities:/);
		assert.match(status, /Matched model family: gpt-5.5/);
		assert.match(status, /Active variant: strict/);
		assert.match(status, /Injected files: all.md, gpt-5.5@strict.md/);

		setSelectedVersion(cwd, "gpt-5.5", undefined);
		result = resolvePrompts(cwd, { id: "ikun-gpt-5.5" });
		assert.equal(result.selectedVersion, undefined);
		assert.equal(fs.existsSync(path.join(cwd, STATE_RELATIVE_PATH)), true);
	});
});
