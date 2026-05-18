import * as fs from "node:fs";
import * as path from "node:path";

export const PROMPT_RELATIVE_DIR = path.join(".pi", "model-prompts", "prompts");
export const STATE_RELATIVE_PATH = path.join(
	".pi",
	"model-prompts",
	"state.json",
);

export type PromptFileKind = "global" | "model";

export type ParsedPromptFilename =
	| {
			kind: "global";
			filename: string;
	  }
	| {
			kind: "model";
			filename: string;
			modelKey: string;
			normalizedModelKey: string;
			version?: string;
	  };

export interface PromptFileRecord {
	parsed: ParsedPromptFilename;
	filename: string;
	path: string;
	content?: string;
}

export interface PromptDiagnostics {
	warnings: string[];
	ignoredFiles: Array<{ filename: string; reason: string }>;
	readErrors: Array<{ filename: string; error: string }>;
	missingDirectory: boolean;
}

export interface PromptCatalog {
	promptDir: string;
	global?: PromptFileRecord;
	models: Map<string, Map<string, PromptFileRecord>>;
	diagnostics: PromptDiagnostics;
}

export interface ModelIdentity {
	id?: string;
	name?: string;
	provider?: string;
}

export interface ResolutionState {
	selectedVersions: Record<string, string>;
}

export interface ResolutionResult {
	promptDir: string;
	identities: string[];
	matchedModelKey?: string;
	selectedVersion?: string;
	activeVariant?: string;
	availableVersions: string[];
	injectedFiles: string[];
	contents: string[];
	diagnostics: PromptDiagnostics;
}

const DEFAULT_VARIANT = "default";

export function normalizeKey(value: string): string {
	return value.trim().toLowerCase();
}

function isSafeSegment(value: string): boolean {
	return (
		value.length > 0 &&
		!value.startsWith("@") &&
		!value.endsWith("@") &&
		!/[\\/\0]/.test(value)
	);
}

export function parsePromptFilename(
	filename: string,
): ParsedPromptFilename | undefined {
	if (filename !== path.basename(filename)) return undefined;
	if (!filename.toLowerCase().endsWith(".md")) return undefined;
	const stem = filename.slice(0, -3);
	const normalizedStem = normalizeKey(stem);
	if (normalizedStem === "all") {
		return filename === "all.md" ? { kind: "global", filename } : undefined;
	}

	const atIndex = stem.indexOf("@");
	if (atIndex === -1) {
		if (!isSafeSegment(stem)) return undefined;
		return {
			kind: "model",
			filename,
			modelKey: stem,
			normalizedModelKey: normalizeKey(stem),
		};
	}

	if (stem.indexOf("@", atIndex + 1) !== -1) return undefined;
	const modelKey = stem.slice(0, atIndex);
	const version = stem.slice(atIndex + 1);
	if (!isSafeSegment(modelKey) || !isSafeSegment(version)) return undefined;
	if (normalizeKey(modelKey) === "all") return undefined;
	return {
		kind: "model",
		filename,
		modelKey,
		normalizedModelKey: normalizeKey(modelKey),
		version,
	};
}

function emptyDiagnostics(): PromptDiagnostics {
	return {
		warnings: [],
		ignoredFiles: [],
		readErrors: [],
		missingDirectory: false,
	};
}

export function discoverPromptCatalog(cwd: string): PromptCatalog {
	const promptDir = path.join(cwd, PROMPT_RELATIVE_DIR);
	const diagnostics = emptyDiagnostics();
	const catalog: PromptCatalog = { promptDir, models: new Map(), diagnostics };

	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(promptDir, { withFileTypes: true });
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code;
		if (code === "ENOENT") {
			diagnostics.missingDirectory = true;
			diagnostics.warnings.push(`Prompt directory not found: ${promptDir}`);
		} else {
			diagnostics.warnings.push(
				`Cannot read prompt directory ${promptDir}: ${(error as Error).message}`,
			);
		}
		return catalog;
	}

	for (const entry of entries) {
		if (!entry.isFile()) continue;
		if (!entry.name.toLowerCase().endsWith(".md")) {
			diagnostics.ignoredFiles.push({
				filename: entry.name,
				reason: "not a Markdown file",
			});
			continue;
		}

		const parsed = parsePromptFilename(entry.name);
		if (!parsed) {
			diagnostics.ignoredFiles.push({
				filename: entry.name,
				reason: "unsupported prompt filename",
			});
			continue;
		}

		const filePath = path.join(promptDir, entry.name);
		let content: string | undefined;
		try {
			content = fs.readFileSync(filePath, "utf8");
		} catch (error) {
			diagnostics.readErrors.push({
				filename: entry.name,
				error: (error as Error).message,
			});
			diagnostics.warnings.push(
				`Cannot read prompt file ${entry.name}: ${(error as Error).message}`,
			);
		}

		const record: PromptFileRecord = {
			parsed,
			filename: entry.name,
			path: filePath,
			content,
		};
		if (parsed.kind === "global") {
			catalog.global = record;
			continue;
		}

		const variants =
			catalog.models.get(parsed.normalizedModelKey) ??
			new Map<string, PromptFileRecord>();
		variants.set(parsed.version ?? DEFAULT_VARIANT, record);
		catalog.models.set(parsed.normalizedModelKey, variants);
	}

	return catalog;
}

export function extractModelIdentities(model: unknown): string[] {
	const identities = new Set<string>();
	const m = (model ?? {}) as Record<string, unknown>;
	for (const key of ["id", "name", "provider"] as const) {
		if (typeof m[key] === "string" && m[key]) identities.add(m[key] as string);
	}
	if (typeof m.provider === "string" && typeof m.id === "string")
		identities.add(`${m.provider}/${m.id}`);
	return [...identities];
}

export function matchModelKey(
	identities: string[],
	modelKeys: Iterable<string>,
): string | undefined {
	const normalizedIdentities = identities.map(normalizeKey).filter(Boolean);
	const matches = [...modelKeys].filter((key) =>
		normalizedIdentities.some((identity) => identity.includes(key)),
	);
	matches.sort((a, b) => b.length - a.length || a.localeCompare(b));
	return matches[0];
}

export function readState(cwd: string): {
	state: ResolutionState;
	warning?: string;
} {
	const statePath = path.join(cwd, STATE_RELATIVE_PATH);
	try {
		const raw = fs.readFileSync(statePath, "utf8");
		const parsed = JSON.parse(raw) as Partial<ResolutionState>;
		return { state: { selectedVersions: parsed.selectedVersions ?? {} } };
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code;
		if (code === "ENOENT") return { state: { selectedVersions: {} } };
		return {
			state: { selectedVersions: {} },
			warning: `Cannot read model prompt state: ${(error as Error).message}`,
		};
	}
}

export function writeState(cwd: string, state: ResolutionState): void {
	const statePath = path.join(cwd, STATE_RELATIVE_PATH);
	fs.mkdirSync(path.dirname(statePath), { recursive: true });
	fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function resolvePrompts(cwd: string, model: unknown): ResolutionResult {
	const catalog = discoverPromptCatalog(cwd);
	const { state, warning } = readState(cwd);
	if (warning) catalog.diagnostics.warnings.push(warning);

	const identities = extractModelIdentities(model);
	const matchedModelKey = matchModelKey(identities, catalog.models.keys());
	const contents: string[] = [];
	const injectedFiles: string[] = [];

	if (catalog.global?.content?.trim()) {
		contents.push(catalog.global.content.trim());
		injectedFiles.push(catalog.global.filename);
	}

	let selectedVersion: string | undefined;
	let activeVariant: string | undefined;
	let availableVersions: string[] = [];

	if (matchedModelKey) {
		const variants = catalog.models.get(matchedModelKey)!;
		availableVersions = [...variants.keys()]
			.map((version) => (version === DEFAULT_VARIANT ? "default" : version))
			.sort();
		selectedVersion = state.selectedVersions[matchedModelKey];
		const selectedRecord = selectedVersion
			? variants.get(selectedVersion)
			: undefined;
		const defaultRecord = variants.get(DEFAULT_VARIANT);

		let modelRecord: PromptFileRecord | undefined;
		if (selectedVersion && selectedRecord) {
			modelRecord = selectedRecord;
			activeVariant = selectedVersion;
		} else if (selectedVersion && !selectedRecord) {
			catalog.diagnostics.warnings.push(
				`Selected variant '${selectedVersion}' for '${matchedModelKey}' is missing; falling back to default if available.`,
			);
			modelRecord = defaultRecord;
			activeVariant = defaultRecord ? "default" : undefined;
		} else if (defaultRecord) {
			modelRecord = defaultRecord;
			activeVariant = "default";
		} else if (variants.size > 0) {
			catalog.diagnostics.warnings.push(
				`Model '${matchedModelKey}' has only named variants; select one with /model-prompt use <version>.`,
			);
		}

		if (modelRecord?.content?.trim()) {
			contents.push(modelRecord.content.trim());
			injectedFiles.push(modelRecord.filename);
		} else if (modelRecord) {
			catalog.diagnostics.warnings.push(
				`Prompt file ${modelRecord.filename} is empty and was omitted.`,
			);
		}
	}

	return {
		promptDir: catalog.promptDir,
		identities,
		matchedModelKey,
		selectedVersion,
		activeVariant,
		availableVersions,
		injectedFiles,
		contents,
		diagnostics: catalog.diagnostics,
	};
}

export function assembleSystemPrompt(
	injectedContents: string[],
	existingSystemPrompt: string,
): string | undefined {
	const nonEmpty = injectedContents.map((part) => part.trim()).filter(Boolean);
	if (nonEmpty.length === 0) return undefined;
	return [...nonEmpty, existingSystemPrompt]
		.filter((part) => part.length > 0)
		.join("\n\n");
}

export function formatResolutionStatus(result: ResolutionResult): string {
	const lines = [
		`Prompt directory: ${result.promptDir}`,
		`Active model identities: ${result.identities.length ? result.identities.join(", ") : "(none)"}`,
		`Matched model family: ${result.matchedModelKey ?? "(none)"}`,
		`Selected variant: ${result.selectedVersion ?? "(none)"}`,
		`Active variant: ${result.activeVariant ?? "(none)"}`,
		`Available versions: ${result.availableVersions.length ? result.availableVersions.join(", ") : "(none)"}`,
		`Injected files: ${result.injectedFiles.length ? result.injectedFiles.join(", ") : "(none)"}`,
	];
	if (result.diagnostics.ignoredFiles.length) {
		lines.push(
			`Ignored files: ${result.diagnostics.ignoredFiles.map((file) => `${file.filename} (${file.reason})`).join(", ")}`,
		);
	}
	if (result.diagnostics.warnings.length)
		lines.push(`Warnings: ${result.diagnostics.warnings.join("; ")}`);
	return lines.join("\n");
}

export function setSelectedVersion(
	cwd: string,
	modelKey: string,
	version: string | undefined,
): void {
	const { state } = readState(cwd);
	if (version) state.selectedVersions[modelKey] = version;
	else delete state.selectedVersions[modelKey];
	writeState(cwd, state);
}
