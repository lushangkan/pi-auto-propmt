import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";

import modelPromptInjectionExtension, {
	selectPromptVariant,
} from "../extensions/model-prompts/index.ts";
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
	type PromptSource,
} from "../extensions/model-prompts/core.ts";

function withTempProject(fn: (cwd: string, home: string) => void) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "model-prompts-test-"));
	const cwd = path.join(root, "project");
	const home = path.join(root, "home");
	fs.mkdirSync(cwd, { recursive: true });
	fs.mkdirSync(home, { recursive: true });
	const previousHome = process.env.HOME;
	const previousUserProfile = process.env.USERPROFILE;
	process.env.HOME = home;
	process.env.USERPROFILE = home;
	try {
		fn(cwd, home);
	} finally {
		if (previousHome === undefined) delete process.env.HOME;
		else process.env.HOME = previousHome;
		if (previousUserProfile === undefined) delete process.env.USERPROFILE;
		else process.env.USERPROFILE = previousUserProfile;
		fs.rmSync(root, { recursive: true, force: true });
	}
}

async function withTempProjectAsync(
	fn: (cwd: string, home: string) => Promise<void>,
) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "model-prompts-test-"));
	const cwd = path.join(root, "project");
	const home = path.join(root, "home");
	fs.mkdirSync(cwd, { recursive: true });
	fs.mkdirSync(home, { recursive: true });
	const previousHome = process.env.HOME;
	const previousUserProfile = process.env.USERPROFILE;
	process.env.HOME = home;
	process.env.USERPROFILE = home;
	try {
		await fn(cwd, home);
	} finally {
		if (previousHome === undefined) delete process.env.HOME;
		else process.env.HOME = previousHome;
		if (previousUserProfile === undefined) delete process.env.USERPROFILE;
		else process.env.USERPROFILE = previousUserProfile;
		fs.rmSync(root, { recursive: true, force: true });
	}
}

function writePrompt(cwd: string, filename: string, content: string) {
	const dir = path.join(cwd, PROMPT_RELATIVE_DIR);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, filename), content, "utf8");
}

function writeGlobalPrompt(home: string, filename: string, content: string) {
	const dir = path.join(home, PROMPT_RELATIVE_DIR);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, filename), content, "utf8");
}

function sourceVariants(cwd: string, modelKey: string, source: PromptSource) {
	return discoverPromptCatalog(cwd).models.get(modelKey)?.[source];
}

function getModelPromptHandler() {
	let handler: ((args: string, ctx: any) => Promise<void>) | undefined;
	modelPromptInjectionExtension({
		on: () => {},
		registerCommand: (name: string, command: { handler: typeof handler }) => {
			if (name === "model-prompt") handler = command.handler;
		},
	} as any);
	assert.ok(handler);
	return handler;
}

function createCommandContext(
	cwd: string,
	overrides: {
		model?: unknown;
		hasUI?: boolean;
		selectResult?: string | string[];
	} = {},
) {
	const notifications: Array<{ message: string; type?: string }> = [];
	const selections: Array<{ title: string; options: string[] }> = [];
	const results = Array.isArray(overrides.selectResult)
		? [...overrides.selectResult]
		: undefined;
	return {
		ctx: {
			cwd,
			model: overrides.model ?? { id: "provider/ikun-gpt-5.5" },
			hasUI: overrides.hasUI ?? true,
			ui: {
				select: async (title: string, options: string[]) => {
					selections.push({ title, options });
					return results ? results.shift() : overrides.selectResult;
				},
				notify: (message: string, type?: string) => {
					notifications.push({ message, type });
				},
			},
		},
		notifications,
		selections,
	};
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
	assert.equal(parsePromptFilename("All.md"), undefined);
	assert.equal(parsePromptFilename("all@strict.md"), undefined);
	assert.equal(parsePromptFilename("bad@@name.md"), undefined);
	assert.equal(parsePromptFilename("notes.txt"), undefined);
});

test("discovers source-scoped direct Markdown children and reports invalid filenames", () => {
	withTempProject((cwd, home) => {
		writePrompt(cwd, "all.md", "project all");
		writePrompt(cwd, "gpt-5.5.md", "project default");
		writeGlobalPrompt(home, "all.md", "global all");
		writeGlobalPrompt(home, "gpt-5.5@strict.md", "global strict");
		writePrompt(cwd, "All.md", "ignored uppercase global");
		writePrompt(cwd, "all@strict.md", "ignored global variant");
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
		assert.equal(catalog.all.global?.content, "global all");
		assert.equal(catalog.all.project?.content, "project all");
		assert.equal(
			sourceVariants(cwd, "gpt-5.5", "project")?.get("default")?.content,
			"project default",
		);
		assert.equal(
			sourceVariants(cwd, "gpt-5.5", "global")?.get("strict")?.content,
			"global strict",
		);
		assert.deepEqual(
			catalog.diagnostics.ignoredFiles.map((file) => file.filename).sort(),
			["All.md", "all@strict.md", "bad@@name.md", "notes.txt"],
		);
		assert.equal(catalog.models.has("all"), false);
		assert.equal(catalog.models.has("gpt"), false);
	});
});

test("missing prompt directories fail softly", () => {
	withTempProject((cwd) => {
		const result = resolvePrompts(cwd, { id: "ikun-gpt-5.5", name: "GPT" });
		assert.equal(result.diagnostics.missingDirectory, true);
		assert.deepEqual(result.diagnostics.missingDirectories.sort(), [
			"global",
			"project",
		]);
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

test("preserves project-only behavior with source-qualified files", () => {
	withTempProject((cwd) => {
		writePrompt(cwd, "all.md", "project all");
		writePrompt(cwd, "gpt-5.5.md", "project default");
		writePrompt(cwd, "gpt-5.5@strict.md", "project strict");
		let result = resolvePrompts(cwd, { id: "provider/ikun-gpt-5.5" });
		assert.equal(result.activeVariant, "default");
		assert.deepEqual(result.injectedFiles, [
			"project:all.md",
			"project:gpt-5.5.md",
		]);
		assert.equal(
			assembleSystemPrompt(result.contents, "base"),
			"project all\n\nproject default\n\nbase",
		);

		setSelectedVersion(cwd, "gpt-5.5", "strict");
		result = resolvePrompts(cwd, { id: "ikun-gpt-5.5" });
		assert.equal(result.activeVariant, "strict");
		assert.deepEqual(result.injectedFiles, [
			"project:all.md",
			"project:gpt-5.5@strict.md",
		]);
	});
});

test("resolves global-only prompts", () => {
	withTempProject((cwd, home) => {
		writeGlobalPrompt(home, "all.md", "global all");
		writeGlobalPrompt(home, "gpt-5.5.md", "global default");
		const result = resolvePrompts(cwd, { id: "ikun-gpt-5.5" });
		assert.equal(result.sources.global.activeVariant, "default");
		assert.deepEqual(result.injectedFiles, [
			"global:all.md",
			"global:gpt-5.5.md",
		]);
		assert.equal(
			assembleSystemPrompt(result.contents, "base"),
			"global all\n\nglobal default\n\nbase",
		);
	});
});

test("resolves combined global/project injection order", () => {
	withTempProject((cwd, home) => {
		writeGlobalPrompt(home, "all.md", "global all");
		writePrompt(cwd, "all.md", "project all");
		writeGlobalPrompt(home, "gpt-5.5.md", "global default");
		writePrompt(cwd, "gpt-5.5.md", "project default");
		const result = resolvePrompts(cwd, { id: "ikun-gpt-5.5" });
		assert.deepEqual(result.injectedFiles, [
			"global:all.md",
			"project:all.md",
			"global:gpt-5.5.md",
			"project:gpt-5.5.md",
		]);
		assert.equal(
			assembleSystemPrompt(result.contents, "base"),
			"global all\n\nproject all\n\nglobal default\n\nproject default\n\nbase",
		);
	});
});

test("supports independent source variants, legacy project fallback, missing fallback, and empty omission", () => {
	withTempProject((cwd, home) => {
		writePrompt(cwd, "all.md", "project all");
		writePrompt(cwd, "gpt-5.5.md", "project default");
		writePrompt(cwd, "gpt-5.5@creative.md", "project creative");
		writePrompt(cwd, "gpt-5.5@empty.md", "   \n");
		writeGlobalPrompt(home, "gpt-5.5.md", "global default");
		writeGlobalPrompt(home, "gpt-5.5@strict.md", "global strict");

		setSelectedVersion(cwd, "gpt-5.5", "strict", "global");
		setSelectedVersion(cwd, "gpt-5.5", "creative", "project");
		let result = resolvePrompts(cwd, { id: "ikun-gpt-5.5" });
		assert.equal(result.sources.global.activeVariant, "strict");
		assert.equal(result.sources.project.activeVariant, "creative");
		assert.deepEqual(result.injectedFiles, [
			"project:all.md",
			"global:gpt-5.5@strict.md",
			"project:gpt-5.5@creative.md",
		]);

		fs.writeFileSync(
			path.join(cwd, STATE_RELATIVE_PATH),
			JSON.stringify({ selectedVersions: { "gpt-5.5": "creative" } }),
			"utf8",
		);
		result = resolvePrompts(cwd, { id: "ikun-gpt-5.5" });
		assert.equal(result.sources.global.activeVariant, "default");
		assert.equal(result.sources.project.activeVariant, "creative");

		setSelectedVersion(cwd, "gpt-5.5", "missing", "project");
		result = resolvePrompts(cwd, { id: "ikun-gpt-5.5" });
		assert.equal(result.sources.project.activeVariant, "default");
		assert.match(result.diagnostics.warnings.join("\n"), /missing/);

		setSelectedVersion(cwd, "gpt-5.5", "empty", "project");
		result = resolvePrompts(cwd, { id: "ikun-gpt-5.5" });
		assert.equal(result.sources.project.activeVariant, "empty");
		assert.equal(
			result.injectedFiles.includes("project:gpt-5.5@empty.md"),
			false,
		);
		assert.match(result.diagnostics.warnings.join("\n"), /empty/);
	});
});

test("only named variants do not guess without selection", () => {
	withTempProject((cwd) => {
		writePrompt(cwd, "all.md", "project all");
		writePrompt(cwd, "gpt-5.5@strict.md", "strict");
		const result = resolvePrompts(cwd, { id: "ikun-gpt-5.5" });
		assert.equal(result.activeVariant, undefined);
		assert.deepEqual(result.injectedFiles, ["project:all.md"]);
		assert.match(
			result.diagnostics.warnings.join("\n"),
			/only named project variants/,
		);
	});
});

test("status output includes source fields and state file can reset", () => {
	withTempProject((cwd, home) => {
		writeGlobalPrompt(home, "gpt-5.5@strict.md", "strict");
		writePrompt(cwd, "all.md", "project all");
		writePrompt(cwd, "gpt-5.5@creative.md", "creative");
		setSelectedVersion(cwd, "gpt-5.5", "strict", "global");
		setSelectedVersion(cwd, "gpt-5.5", "creative");
		let result = resolvePrompts(cwd, { id: "ikun-gpt-5.5" });
		const status = formatResolutionStatus(result);
		assert.match(status, /Global prompt directory:/);
		assert.match(status, /Project prompt directory:/);
		assert.match(status, /Matched model family: gpt-5.5/);
		assert.match(status, /Active global variant: strict/);
		assert.match(status, /Active project variant: creative/);
		assert.match(
			status,
			/Injected files: project:all.md, global:gpt-5.5@strict.md, project:gpt-5.5@creative.md/,
		);

		setSelectedVersion(cwd, "gpt-5.5", undefined);
		result = resolvePrompts(cwd, { id: "ikun-gpt-5.5" });
		assert.equal(result.selectedVersion, undefined);
		assert.equal(fs.existsSync(path.join(cwd, STATE_RELATIVE_PATH)), true);
	});
});

test("bare command opens only useful source selector and persists a named variant", async () => {
	await withTempProjectAsync(async (cwd) => {
		writePrompt(cwd, "gpt-5.5.md", "default");
		writePrompt(cwd, "gpt-5.5@creative.md", "creative");
		const handler = getModelPromptHandler();
		const { ctx, notifications, selections } = createCommandContext(cwd, {
			selectResult: "creative",
		});

		await handler("", ctx);

		assert.deepEqual(selections, [
			{
				title: "Select Project prompt variant for 'gpt-5.5':",
				options: ["creative", "default"],
			},
		]);
		assert.match(
			notifications.at(-1)?.message ?? "",
			/Selected Project 'creative'/,
		);
		const result = resolvePrompts(cwd, { id: "ikun-gpt-5.5" });
		assert.equal(result.selectedVersion, "creative");
		assert.equal(result.activeVariant, "creative");
	});
});

test("bare command opens global and project selectors when both are useful", async () => {
	await withTempProjectAsync(async (cwd, home) => {
		writeGlobalPrompt(home, "gpt-5.5.md", "global default");
		writeGlobalPrompt(home, "gpt-5.5@strict.md", "global strict");
		writePrompt(cwd, "gpt-5.5.md", "project default");
		writePrompt(cwd, "gpt-5.5@creative.md", "project creative");
		const handler = getModelPromptHandler();
		const { ctx, selections } = createCommandContext(cwd, {
			selectResult: ["strict", "creative"],
		});

		await handler("", ctx);

		assert.deepEqual(
			selections.map((selection) => selection.title),
			[
				"Select Global prompt variant for 'gpt-5.5':",
				"Select Project prompt variant for 'gpt-5.5':",
			],
		);
		const result = resolvePrompts(cwd, { id: "ikun-gpt-5.5" });
		assert.equal(result.sources.global.selectedVersion, "strict");
		assert.equal(result.sources.project.selectedVersion, "creative");
	});
});

test("bare command selecting default clears persisted project selection", async () => {
	await withTempProjectAsync(async (cwd) => {
		writePrompt(cwd, "gpt-5.5.md", "default");
		writePrompt(cwd, "gpt-5.5@strict.md", "strict");
		setSelectedVersion(cwd, "gpt-5.5", "strict");
		const handler = getModelPromptHandler();
		const { ctx, notifications } = createCommandContext(cwd, {
			selectResult: "default",
		});

		await handler("", ctx);

		assert.match(
			notifications.at(-1)?.message ?? "",
			/Selected Project 'default'/,
		);
		const result = resolvePrompts(cwd, { id: "ikun-gpt-5.5" });
		assert.equal(result.selectedVersion, undefined);
		assert.equal(result.activeVariant, "default");
	});
});

test("bare command cancellation leaves previous selection unchanged", async () => {
	await withTempProjectAsync(async (cwd) => {
		writePrompt(cwd, "gpt-5.5.md", "default");
		writePrompt(cwd, "gpt-5.5@strict.md", "strict");
		setSelectedVersion(cwd, "gpt-5.5", "strict");
		const handler = getModelPromptHandler();
		const { ctx, notifications } = createCommandContext(cwd);

		await handler("", ctx);

		assert.match(notifications.at(-1)?.message ?? "", /cancelled/);
		const result = resolvePrompts(cwd, { id: "ikun-gpt-5.5" });
		assert.equal(result.selectedVersion, "strict");
		assert.equal(result.activeVariant, "strict");
	});
});

test("bare command reports fallback paths without UI or matched model family", async () => {
	await withTempProjectAsync(async (cwd) => {
		writePrompt(cwd, "gpt-5.5.md", "default");
		const handler = getModelPromptHandler();
		const noUi = createCommandContext(cwd, { hasUI: false });
		await handler("", noUi.ctx);
		assert.deepEqual(noUi.selections, []);
		assert.match(noUi.notifications.at(-1)?.message ?? "", /unavailable/);
		assert.match(
			noUi.notifications.at(-1)?.message ?? "",
			/\/model-prompt status/,
		);

		const noMatch = createCommandContext(cwd, {
			model: { id: "anthropic/claude-sonnet" },
		});
		await handler("", noMatch.ctx);
		assert.deepEqual(noMatch.selections, []);
		assert.match(
			noMatch.notifications.at(-1)?.message ?? "",
			/No model prompt family/,
		);
	});
});

test("source-qualified commands select and reset global variants", async () => {
	await withTempProjectAsync(async (cwd, home) => {
		writeGlobalPrompt(home, "gpt-5.5.md", "global default");
		writeGlobalPrompt(home, "gpt-5.5@strict.md", "global strict");
		const handler = getModelPromptHandler();
		const { ctx, notifications } = createCommandContext(cwd);

		await handler("use global strict", ctx);
		let result = resolvePrompts(cwd, { id: "ikun-gpt-5.5" });
		assert.equal(result.sources.global.selectedVersion, "strict");
		assert.match(
			notifications.at(-1)?.message ?? "",
			/Selected Global 'strict'/,
		);

		await handler("reset global", ctx);
		result = resolvePrompts(cwd, { id: "ikun-gpt-5.5" });
		assert.equal(result.sources.global.selectedVersion, undefined);
		assert.match(
			notifications.at(-1)?.message ?? "",
			/Cleared selected global/,
		);
	});
});

test("selector helper reports when matched family has no source with two versions", async () => {
	await withTempProjectAsync(async (cwd) => {
		const { ctx, notifications, selections } = createCommandContext(cwd);
		await selectPromptVariant(ctx as any, {
			promptDir: path.join(cwd, PROMPT_RELATIVE_DIR),
			promptDirs: {
				global: path.join(os.homedir(), PROMPT_RELATIVE_DIR),
				project: path.join(cwd, PROMPT_RELATIVE_DIR),
			},
			identities: ["ikun-gpt-5.5"],
			matchedModelKey: "gpt-5.5",
			availableVersions: [],
			sources: {
				global: { availableVersions: [], injectedFiles: [] },
				project: { availableVersions: [], injectedFiles: [] },
			},
			injectedFiles: [],
			injectedFileRecords: [],
			contents: [],
			diagnostics: {
				warnings: [],
				ignoredFiles: [],
				readErrors: [],
				missingDirectory: false,
				missingDirectories: [],
				unreadableDirectories: [],
			},
		});
		assert.deepEqual(selections, []);
		assert.match(notifications.at(-1)?.message ?? "", /No prompt sources/);
	});
});
