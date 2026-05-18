import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import {
	assembleSystemPrompt,
	formatResolutionStatus,
	resolvePrompts,
	setSelectedVersion,
	type ResolutionResult,
} from "./core.js";

const EXPLICIT_USAGE =
	"Use /model-prompt status, /model-prompt use <version>, or /model-prompt reset.";

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

	if (!result.availableVersions.length) {
		ctx.ui.notify(
			`No prompt variants are available for '${result.matchedModelKey}'. ${EXPLICIT_USAGE}`,
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

	const selected = await ctx.ui.select(
		`Select prompt variant for '${result.matchedModelKey}':`,
		result.availableVersions,
	);
	if (!selected) {
		ctx.ui.notify(
			"Model prompt selection cancelled; previous selection unchanged.",
			"info",
		);
		return;
	}

	if (selected === "default") {
		setSelectedVersion(ctx.cwd, result.matchedModelKey, undefined);
		ctx.ui.notify(
			`Selected 'default' for '${result.matchedModelKey}' and cleared persisted selection.`,
			"info",
		);
		return;
	}

	setSelectedVersion(ctx.cwd, result.matchedModelKey, selected);
	ctx.ui.notify(
		`Selected '${selected}' for '${result.matchedModelKey}'.`,
		"info",
	);
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
			const items = ["status", "use ", "reset"];
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
				const version = rest.join(" ").trim();
				if (!result.matchedModelKey) {
					ctx.ui.notify(
						"No model prompt family matches the active model.",
						"warning",
					);
					return;
				}
				if (!version) {
					ctx.ui.notify(
						`Usage: /model-prompt use <version>\nAvailable versions: ${result.availableVersions.join(", ") || "(none)"}`,
						"warning",
					);
					return;
				}
				if (!result.availableVersions.includes(version)) {
					ctx.ui.notify(
						`Variant '${version}' is not available for '${result.matchedModelKey}'. Available versions: ${result.availableVersions.join(", ") || "(none)"}`,
						"warning",
					);
					return;
				}
				if (version === "default") {
					setSelectedVersion(ctx.cwd, result.matchedModelKey, undefined);
					ctx.ui.notify(
						`Reset '${result.matchedModelKey}' to default prompt variant.`,
						"info",
					);
					return;
				}
				setSelectedVersion(ctx.cwd, result.matchedModelKey, version);
				ctx.ui.notify(
					`Selected '${version}' for '${result.matchedModelKey}'.`,
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
				setSelectedVersion(ctx.cwd, result.matchedModelKey, undefined);
				ctx.ui.notify(
					`Cleared selected model prompt variant for '${result.matchedModelKey}'.`,
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