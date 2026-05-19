import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export const PROMPT_RELATIVE_DIR = path.join(".pi", "model-prompts", "prompts");
export const STATE_RELATIVE_PATH = path.join(
	".pi",
	"model-prompts",
	"state.json",
);

export type PromptSource = "global" | "project";
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
	source: PromptSource;
	content?: string;
}

export interface PromptDiagnostics {
	warnings: string[];
	ignoredFiles: Array<{
		filename: string;
		reason: string;
		source?: PromptSource;
	}>;
	readErrors: Array<{ filename: string; error: string; source?: PromptSource }>;
	missingDirectory: boolean;
	missingDirectories: PromptSource[];
	unreadableDirectories: Array<{
		source: PromptSource;
		path: string;
		error: string;
	}>;
}

export interface PromptCatalog {
	promptDir: string;
	promptDirs: Record<PromptSource, string>;
	global?: PromptFileRecord;
	all: Partial<Record<PromptSource, PromptFileRecord>>;
	models: Map<
		string,
		Partial<Record<PromptSource, Map<string, PromptFileRecord>>>
	>;
	diagnostics: PromptDiagnostics;
}

export interface ModelIdentity {
	id?: string;
	name?: string;
	provider?: string;
}

export interface ResolutionState {
	selectedVersions: Record<string, string>;
	sourceSelectedVersions: Record<string, Partial<Record<PromptSource, string>>>;
}

export interface InjectedFile {
	source: PromptSource;
	filename: string;
	path: string;
	kind: "all" | "model";
}

export interface SourceResolution {
	selectedVersion?: string;
	activeVariant?: string;
	availableVersions: string[];
	injectedFiles: InjectedFile[];
}

export interface ResolutionResult {
	promptDir: string;
	promptDirs: Record<PromptSource, string>;
	identities: string[];
	matchedModelKey?: string;
	selectedVersion?: string;
	activeVariant?: string;
	availableVersions: string[];
	sources: Record<PromptSource, SourceResolution>;
	injectedFiles: string[];
	injectedFileRecords: InjectedFile[];
	contents: string[];
	diagnostics: PromptDiagnostics;
}

const DEFAULT_VARIANT = "default";
const SOURCES: PromptSource[] = ["global", "project"];

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
		missingDirectories: [],
		unreadableDirectories: [],
	};
}

export function getPromptDirs(cwd: string): Record<PromptSource, string> {
	return {
		global: path.join(os.homedir(), PROMPT_RELATIVE_DIR),
		project: path.join(cwd, PROMPT_RELATIVE_DIR),
	};
}

function discoverPromptSource(
	catalog: PromptCatalog,
	source: PromptSource,
	promptDir: string,
): void {
	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(promptDir, { withFileTypes: true });
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code;
		if (code === "ENOENT") {
			catalog.diagnostics.missingDirectory = true;
			catalog.diagnostics.missingDirectories.push(source);
			catalog.diagnostics.warnings.push(
				`${source} prompt directory not found: ${promptDir}`,
			);
		} else {
			const message = (error as Error).message;
			catalog.diagnostics.unreadableDirectories.push({
				source,
				path: promptDir,
				error: message,
			});
			catalog.diagnostics.warnings.push(
				`Cannot read ${source} prompt directory ${promptDir}: ${message}`,
			);
		}
		return;
	}

	for (const entry of entries) {
		if (!entry.isFile()) continue;
		if (!entry.name.toLowerCase().endsWith(".md")) {
			catalog.diagnostics.ignoredFiles.push({
				filename: entry.name,
				reason: "not a Markdown file",
				source,
			});
			continue;
		}

		const parsed = parsePromptFilename(entry.name);
		if (!parsed) {
			catalog.diagnostics.ignoredFiles.push({
				filename: entry.name,
				reason: "unsupported prompt filename",
				source,
			});
			continue;
		}

		const filePath = path.join(promptDir, entry.name);
		let content: string | undefined;
		try {
			content = fs.readFileSync(filePath, "utf8");
		} catch (error) {
			const message = (error as Error).message;
			catalog.diagnostics.readErrors.push({
				filename: entry.name,
				error: message,
				source,
			});
			catalog.diagnostics.warnings.push(
				`Cannot read ${source} prompt file ${entry.name}: ${message}`,
			);
		}

		const record: PromptFileRecord = {
			parsed,
			filename: entry.name,
			path: filePath,
			source,
			content,
		};
		if (parsed.kind === "global") {
			catalog.all[source] = record;
			if (source === "project") catalog.global = record;
			continue;
		}

		const sourceModels = catalog.models.get(parsed.normalizedModelKey) ?? {};
		const variants =
			sourceModels[source] ?? new Map<string, PromptFileRecord>();
		variants.set(parsed.version ?? DEFAULT_VARIANT, record);
		sourceModels[source] = variants;
		catalog.models.set(parsed.normalizedModelKey, sourceModels);
	}
}

export function discoverPromptCatalog(cwd: string): PromptCatalog {
	const promptDirs = getPromptDirs(cwd);
	const diagnostics = emptyDiagnostics();
	const catalog: PromptCatalog = {
		promptDir: promptDirs.project,
		promptDirs,
		all: {},
		models: new Map(),
		diagnostics,
	};

	for (const source of SOURCES) {
		discoverPromptSource(catalog, source, promptDirs[source]);
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

function normalizeState(parsed: Partial<ResolutionState>): ResolutionState {
	return {
		selectedVersions: parsed.selectedVersions ?? {},
		sourceSelectedVersions: parsed.sourceSelectedVersions ?? {},
	};
}

export function readState(cwd: string): {
	state: ResolutionState;
	warning?: string;
} {
	const statePath = path.join(cwd, STATE_RELATIVE_PATH);
	try {
		const raw = fs.readFileSync(statePath, "utf8");
		return {
			state: normalizeState(JSON.parse(raw) as Partial<ResolutionState>),
		};
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code;
		if (code === "ENOENT") {
			return { state: { selectedVersions: {}, sourceSelectedVersions: {} } };
		}
		return {
			state: { selectedVersions: {}, sourceSelectedVersions: {} },
			warning: `Cannot read model prompt state: ${(error as Error).message}`,
		};
	}
}

export function writeState(cwd: string, state: ResolutionState): void {
	const statePath = path.join(cwd, STATE_RELATIVE_PATH);
	fs.mkdirSync(path.dirname(statePath), { recursive: true });
	fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function availableVersions(
	variants: Map<string, PromptFileRecord> | undefined,
): string[] {
	return [...(variants?.keys() ?? [])]
		.map((version) => (version === DEFAULT_VARIANT ? "default" : version))
		.sort();
}

function selectedVersionFor(
	state: ResolutionState,
	modelKey: string,
	source: PromptSource,
): string | undefined {
	return (
		state.sourceSelectedVersions[modelKey]?.[source] ??
		(source === "project" ? state.selectedVersions[modelKey] : undefined)
	);
}

function appendPrompt(
	result: Pick<
		ResolutionResult,
		"contents" | "injectedFiles" | "injectedFileRecords"
	>,
	record: PromptFileRecord,
	kind: "all" | "model",
	diagnostics: PromptDiagnostics,
): void {
	const content = record.content?.trim();
	if (!content) {
		diagnostics.warnings.push(
			`Prompt file ${record.source}:${record.filename} is empty and was omitted.`,
		);
		return;
	}
	result.contents.push(content);
	result.injectedFiles.push(`${record.source}:${record.filename}`);
	result.injectedFileRecords.push({
		source: record.source,
		filename: record.filename,
		path: record.path,
		kind,
	});
}

function resolveSourceModelPrompt(
	source: PromptSource,
	matchedModelKey: string,
	variants: Map<string, PromptFileRecord> | undefined,
	state: ResolutionState,
	diagnostics: PromptDiagnostics,
): { record?: PromptFileRecord; resolution: SourceResolution } {
	const versions = availableVersions(variants);
	const selectedVersion = selectedVersionFor(state, matchedModelKey, source);
	const selectedRecord = selectedVersion
		? variants?.get(selectedVersion)
		: undefined;
	const defaultRecord = variants?.get(DEFAULT_VARIANT);
	let record: PromptFileRecord | undefined;
	let activeVariant: string | undefined;

	if (selectedVersion && selectedRecord) {
		record = selectedRecord;
		activeVariant = selectedVersion;
	} else if (selectedVersion && !selectedRecord) {
		diagnostics.warnings.push(
			`Selected ${source} variant '${selectedVersion}' for '${matchedModelKey}' is missing; falling back to default if available.`,
		);
		record = defaultRecord;
		activeVariant = defaultRecord ? "default" : undefined;
	} else if (defaultRecord) {
		record = defaultRecord;
		activeVariant = "default";
	} else if ((variants?.size ?? 0) > 0) {
		diagnostics.warnings.push(
			`Model '${matchedModelKey}' has only named ${source} variants; select one with /model-prompt use ${source} <version>.`,
		);
	}

	return {
		record,
		resolution: {
			selectedVersion,
			activeVariant,
			availableVersions: versions,
			injectedFiles: [],
		},
	};
}

export function resolvePrompts(cwd: string, model: unknown): ResolutionResult {
	const catalog = discoverPromptCatalog(cwd);
	const { state, warning } = readState(cwd);
	if (warning) catalog.diagnostics.warnings.push(warning);

	const identities = extractModelIdentities(model);
	const matchedModelKey = matchModelKey(identities, catalog.models.keys());
	const result: ResolutionResult = {
		promptDir: catalog.promptDir,
		promptDirs: catalog.promptDirs,
		identities,
		matchedModelKey,
		availableVersions: [],
		sources: {
			global: { availableVersions: [], injectedFiles: [] },
			project: { availableVersions: [], injectedFiles: [] },
		},
		injectedFiles: [],
		injectedFileRecords: [],
		contents: [],
		diagnostics: catalog.diagnostics,
	};

	for (const source of SOURCES) {
		const allRecord = catalog.all[source];
		if (allRecord) appendPrompt(result, allRecord, "all", catalog.diagnostics);
	}

	if (matchedModelKey) {
		const sourceModels = catalog.models.get(matchedModelKey) ?? {};
		for (const source of SOURCES) {
			const { record, resolution } = resolveSourceModelPrompt(
				source,
				matchedModelKey,
				sourceModels[source],
				state,
				catalog.diagnostics,
			);
			result.sources[source] = resolution;
			if (record) {
				const before = result.injectedFileRecords.length;
				appendPrompt(result, record, "model", catalog.diagnostics);
				result.sources[source].injectedFiles =
					result.injectedFileRecords.slice(before);
			}
		}
	}

	result.selectedVersion = result.sources.project.selectedVersion;
	result.activeVariant = result.sources.project.activeVariant;
	result.availableVersions = result.sources.project.availableVersions;
	return result;
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

function formatSourceResolution(
	source: PromptSource,
	result: ResolutionResult,
): string[] {
	const sourceResult = result.sources[source];
	const injected = result.injectedFileRecords
		.filter((file) => file.source === source)
		.map((file) => `${file.kind}:${file.filename}`);
	return [
		`${source[0].toUpperCase()}${source.slice(1)} prompt directory: ${result.promptDirs[source]}`,
		`Active ${source} variant: ${sourceResult.activeVariant ?? "(none)"}`,
		`Selected ${source} variant: ${sourceResult.selectedVersion ?? "(none)"}`,
		`Available ${source} versions: ${sourceResult.availableVersions.length ? sourceResult.availableVersions.join(", ") : "(none)"}`,
		`Injected ${source} files: ${injected.length ? injected.join(", ") : "(none)"}`,
	];
}

export function formatResolutionStatus(result: ResolutionResult): string {
	const lines = [
		`Global prompt directory: ${result.promptDirs.global}`,
		`Project prompt directory: ${result.promptDirs.project}`,
		`Active model identities: ${result.identities.length ? result.identities.join(", ") : "(none)"}`,
		`Matched model family: ${result.matchedModelKey ?? "(none)"}`,
		...formatSourceResolution("global", result),
		...formatSourceResolution("project", result),
		`Injected files: ${result.injectedFiles.length ? result.injectedFiles.join(", ") : "(none)"}`,
	];
	if (result.diagnostics.missingDirectories.length) {
		lines.push(
			`Missing prompt directories: ${result.diagnostics.missingDirectories.join(", ")}`,
		);
	}
	if (result.diagnostics.ignoredFiles.length) {
		lines.push(
			`Ignored files: ${result.diagnostics.ignoredFiles
				.map(
					(file) =>
						`${file.source ?? "unknown"}:${file.filename} (${file.reason})`,
				)
				.join(", ")}`,
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
	source: PromptSource = "project",
): void {
	const { state } = readState(cwd);
	const next: ResolutionState = normalizeState(state);
	next.sourceSelectedVersions[modelKey] =
		next.sourceSelectedVersions[modelKey] ?? {};
	if (version) next.sourceSelectedVersions[modelKey]![source] = version;
	else delete next.sourceSelectedVersions[modelKey]![source];
	if (Object.keys(next.sourceSelectedVersions[modelKey]!).length === 0) {
		delete next.sourceSelectedVersions[modelKey];
	}

	if (source === "project") {
		if (version) next.selectedVersions[modelKey] = version;
		else delete next.selectedVersions[modelKey];
	}
	writeState(cwd, next);
}
