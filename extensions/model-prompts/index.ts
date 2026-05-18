import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	assembleSystemPrompt,
	formatResolutionStatus,
	resolvePrompts,
	setSelectedVersion,
} from "./core.js";

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

			if (!action || action === "status") {
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
				`Unknown /model-prompt action '${action}'. Use: /model-prompt status, /model-prompt use <version>, or /model-prompt reset.`,
				"warning",
			);
		},
	});
}
