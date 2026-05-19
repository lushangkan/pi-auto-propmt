import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import {
	assembleSystemPrompt,
	formatResolutionStatus,
	resolvePrompts,
	setSelectedVersion,
	type PromptSource,
	type ResolutionResult,
} from "./core.js";

const EXPLICIT_USAGE =
	"Use /model-prompt status, /model-prompt use <version>, /model-prompt use <global|project> <version>, /model-prompt reset, or /model-prompt reset <global|project>.";

const SOURCES: PromptSource[] = ["global", "project"];

function sourceLabel(source: PromptSource): string {
	return source === "global" ? "Global" : "Project";
}

function selectorSources(result: ResolutionResult): PromptSource[] {
	return SOURCES.filter(
		(source) => result.sources[source].availableVersions.length >= 2,
	);
}

function parseSourceAndVersion(rest: string[]): {
	source: PromptSource;
	version: string;
} {
	const [first, ...tail] = rest;
	if (first === "global" || first === "--global") {
		return { source: "global", version: tail.join(" ").trim() };
	}
	if (first === "project" || first === "--project") {
		return { source: "project", version: tail.join(" ").trim() };
	}
	return { source: "project", version: rest.join(" ").trim() };
}

function parseResetSource(rest: string[]): PromptSource | undefined {
	const [first] = rest;
	if (!first) return "project";
	if (first === "global" || first === "--global") return "global";
	if (first === "project" || first === "--project") return "project";
	return undefined;
}

export async function selectPromptVariant(
	ctx: ExtensionCommandContext,
	result: ResolutionResult,
): Promise<void> {
	if (!result.matchedModelKey) {
		ctx.ui.notify(
			`No model prompt family matches the active model. ${EXPLICIT_USAGE}`,
			"warning",
		);
		return;
	}

	if (!ctx.hasUI) {
		ctx.ui.notify(
			`Interactive model prompt selection is unavailable in this session. ${EXPLICIT_USAGE}`,
			"warning",
		);
		return;
	}

	const sources = selectorSources(result);
	if (!sources.length) {
		ctx.ui.notify(
			`No prompt sources have two or more selectable versions for '${result.matchedModelKey}'. ${EXPLICIT_USAGE}`,
			"warning",
		);
		return;
	}

	for (const source of sources) {
		const selected = await ctx.ui.select(
			`Select ${sourceLabel(source)} prompt variant for '${result.matchedModelKey}':`,
			result.sources[source].availableVersions,
		);
		if (!selected) {
			ctx.ui.notify(
				"Model prompt selection cancelled; previous selections unchanged.",
				"info",
			);
			return;
		}

		if (selected === "default") {
			setSelectedVersion(ctx.cwd, result.matchedModelKey, undefined, source);
			ctx.ui.notify(
				`Selected ${sourceLabel(source)} 'default' for '${result.matchedModelKey}' and cleared persisted ${source} selection.`,
				"info",
			);
			continue;
		}

		setSelectedVersion(ctx.cwd, result.matchedModelKey, selected, source);
		ctx.ui.notify(
			`Selected ${sourceLabel(source)} '${selected}' for '${result.matchedModelKey}'.`,
			"info",
		);
	}
}

export default function modelPromptInjectionExtension(pi: ExtensionAPI) {
	pi.on("before_agent_start", async (event, ctx) => {
		try {
			const result = resolvePrompts(ctx.cwd, ctx.model);
			const systemPrompt = assembleSystemPrompt(
				result.contents,
				event.systemPrompt ?? "",
			);
			if (!systemPrompt) return;
			return { systemPrompt };
		} catch (error) {
			ctx.ui.notify(
				`Model prompt injection skipped: ${(error as Error).message}`,
				"warning",
			);
			return;
		}
	});

	pi.registerCommand("model-prompt", {
		description: "Inspect or switch model-specific prompt variants",
		getArgumentCompletions: (prefix) => {
			const items = [
				"status",
				"use ",
				"use global ",
				"use project ",
				"reset",
				"reset global",
				"reset project",
			];
			const filtered = items.filter((item) => item.startsWith(prefix));
			return filtered.length
				? filtered.map((value) => ({ value, label: value }))
				: null;
		},
		handler: async (args, ctx) => {
			const trimmed = args.trim();
			const [action, ...rest] = trimmed.split(/\s+/).filter(Boolean);
			const result = resolvePrompts(ctx.cwd, ctx.model);

			if (!action) {
				await selectPromptVariant(ctx, result);
				return;
			}

			if (action === "status") {
				ctx.ui.notify(formatResolutionStatus(result), "info");
				return;
			}

			if (action === "use") {
				const { source, version } = parseSourceAndVersion(rest);
				if (!result.matchedModelKey) {
					ctx.ui.notify(
						"No model prompt family matches the active model.",
						"warning",
					);
					return;
				}
				const availableVersions = result.sources[source].availableVersions;
				if (!version) {
					ctx.ui.notify(
						`Usage: /model-prompt use [global|project] <version>\nAvailable ${source} versions: ${availableVersions.join(", ") || "(none)"}`,
						"warning",
					);
					return;
				}
				if (!availableVersions.includes(version)) {
					ctx.ui.notify(
						`${sourceLabel(source)} variant '${version}' is not available for '${result.matchedModelKey}'. Available ${source} versions: ${availableVersions.join(", ") || "(none)"}`,
						"warning",
					);
					return;
				}
				if (version === "default") {
					setSelectedVersion(
						ctx.cwd,
						result.matchedModelKey,
						undefined,
						source,
					);
					ctx.ui.notify(
						`Reset ${source} '${result.matchedModelKey}' to default prompt variant.`,
						"info",
					);
					return;
				}
				setSelectedVersion(ctx.cwd, result.matchedModelKey, version, source);
				ctx.ui.notify(
					`Selected ${sourceLabel(source)} '${version}' for '${result.matchedModelKey}'.`,
					"info",
				);
				return;
			}

			if (action === "reset") {
				if (!result.matchedModelKey) {
					ctx.ui.notify(
						"No model prompt family matches the active model.",
						"warning",
					);
					return;
				}
				const source = parseResetSource(rest);
				if (!source) {
					ctx.ui.notify(
						"Usage: /model-prompt reset [global|project]",
						"warning",
					);
					return;
				}
				setSelectedVersion(ctx.cwd, result.matchedModelKey, undefined, source);
				ctx.ui.notify(
					`Cleared selected ${source} model prompt variant for '${result.matchedModelKey}'.`,
					"info",
				);
				return;
			}

			ctx.ui.notify(
				`Unknown /model-prompt action '${action}'. ${EXPLICIT_USAGE}`,
				"warning",
			);
		},
	});
}
