#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join, extname } from "node:path";
import { homedir } from "node:os";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

// --- CLI parsing ---

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  console.log(`
soulforge <name> --data <path>

  Forge an OpenClaw agent from a dataset about a person.

  Reads all files in <path> (txt, md, pdf, docx), builds a personality
  profile, and creates a ready-to-use OpenClaw agent workspace.

  API keys are read from your OpenClaw config (~/.openclaw/agents/main/agent/auth-profiles.json).
  Falls back to ANTHROPIC_API_KEY env var if OpenClaw is not set up.

Options:
  --data, -d <path>   Path to source files (required)
  --model, -m <model> Model to use (default: from openclaw.json or claude-sonnet-4-20250514)
  --enable-memory     Write chunked source files for OpenClaw memory_search
  --help, -h          Show this help

Example:
  soulforge elon-musk --data ./elon-interviews/
`);
  process.exit(0);
}

const name = args[0];
let dataPath = null;
let modelOverride = null;
let enableMemory = false;

for (let i = 1; i < args.length; i++) {
  if ((args[i] === "--data" || args[i] === "-d") && args[i + 1]) {
    dataPath = args[++i];
  } else if ((args[i] === "--model" || args[i] === "-m") && args[i + 1]) {
    modelOverride = args[++i];
  } else if (args[i] === "--enable-memory") {
    enableMemory = true;
  }
}

if (!dataPath) {
  console.error("Error: --data <path> is required");
  process.exit(1);
}

// --- Read OpenClaw config ---

const OPENCLAW_DIR = join(homedir(), ".openclaw");
const WORKSPACE_DIR = join(OPENCLAW_DIR, "workspace");
const CONFIG_PATH = join(OPENCLAW_DIR, "openclaw.json");
const AUTH_PATH = join(OPENCLAW_DIR, "agents", "main", "agent", "auth-profiles.json");

function loadOpenClawAuth() {
  // Read API key from OpenClaw's auth-profiles.json
  if (!existsSync(AUTH_PATH)) return null;

  try {
    const auth = JSON.parse(readFileSync(AUTH_PATH, "utf-8"));
    const profiles = auth.profiles || {};

    // Find an anthropic profile with a usable token
    for (const [id, profile] of Object.entries(profiles)) {
      if (profile.provider === "anthropic" && profile.token) {
        // Prefer lastGood or order hint
        const preferred = auth.lastGood?.anthropic;
        if (preferred && preferred !== id) continue;
        return profile.token;
      }
    }

    // Fallback: just grab the first anthropic token
    for (const profile of Object.values(profiles)) {
      if (profile.provider === "anthropic" && profile.token) {
        return profile.token;
      }
    }
  } catch {
    // corrupt file, ignore
  }

  return null;
}

function loadOpenClawModel() {
  // Read default model from openclaw.json
  if (!existsSync(CONFIG_PATH)) return null;

  try {
    const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    const primary = config.agents?.defaults?.model?.primary;
    if (!primary) return null;

    // OpenClaw format: "anthropic/claude-sonnet-4-5" -> "claude-sonnet-4-5"
    if (primary.startsWith("anthropic/")) {
      return primary.replace("anthropic/", "");
    }

    return primary;
  } catch {
    return null;
  }
}

function resolveApiKey() {
  // 1. OpenClaw auth-profiles
  const clawKey = loadOpenClawAuth();
  if (clawKey) return { key: clawKey, source: "openclaw" };

  // 2. Environment variable
  if (process.env.ANTHROPIC_API_KEY) {
    return { key: process.env.ANTHROPIC_API_KEY, source: "env" };
  }

  return null;
}

// --- Ingest all files ---

async function readFile(filePath) {
  const ext = extname(filePath).toLowerCase();

  if ([".txt", ".md", ".markdown", ".text"].includes(ext)) {
    return readFileSync(filePath, "utf-8");
  }

  if (ext === ".pdf") {
    const { extractText } = await import("unpdf");
    const buffer = readFileSync(filePath);
    const { text } = await extractText(new Uint8Array(buffer));
    return text;
  }

  if ([".docx", ".doc"].includes(ext)) {
    const officeparser = await import("officeparser");
    const text = await officeparser.parseOffice(filePath);
    return typeof text === "string" ? text : String(text);
  }

  // Try reading as text
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function discoverFiles(dirPath) {
  const resolved = resolve(dirPath);
  const stat = statSync(resolved);

  if (stat.isFile()) return [resolved];

  const files = [];
  for (const entry of readdirSync(resolved, { withFileTypes: true, recursive: true })) {
    if (entry.isFile() && !entry.name.startsWith(".")) {
      files.push(join(entry.parentPath ?? entry.path, entry.name));
    }
  }
  return files.sort();
}

// --- Main ---

async function main() {
  // Resolve API key
  const auth = resolveApiKey();
  if (!auth) {
    console.error("Error: No API key found.");
    console.error("  Set up OpenClaw (openclaw onboard) or export ANTHROPIC_API_KEY.");
    process.exit(1);
  }

  // Resolve model
  const model = modelOverride || loadOpenClawModel() || "claude-sonnet-4-20250514";

  console.log(`\n⚒️  soulforge — forging "${name}" from ${dataPath}\n`);
  console.log(`  API key: ${auth.source} | Model: ${model}`);

  // 1. Read all source files
  const files = discoverFiles(dataPath);
  console.log(`\nFound ${files.length} file(s)`);

  const texts = [];
  for (const file of files) {
    process.stdout.write(`  Reading ${file}...`);
    const text = await readFile(file);
    if (text && text.trim().length > 0) {
      texts.push(text.trim());
      console.log(` ${text.length} chars`);
    } else {
      console.log(" (skipped)");
    }
  }

  if (texts.length === 0) {
    console.error("\nNo content found. Check your --data path.");
    process.exit(1);
  }

  const allText = texts.join("\n\n---\n\n");
  // Truncate if too large for context window
  const maxChars = 150_000;
  const sourceText = allText.length > maxChars
    ? allText.slice(0, maxChars) + "\n\n[... truncated ...]"
    : allText;

  console.log(`\nTotal: ${allText.length} chars from ${texts.length} file(s)`);

  // 2. Generate SOUL.md
  console.log(`\nGenerating personality profile...`);

  const anthropic = createAnthropic({ apiKey: auth.key });

  const soulResult = await generateText({
    model: anthropic(model),
    maxTokens: 8192,
    system: `You are an expert at analyzing text about a person and distilling their personality into an actionable AI agent prompt.

Given source material about a person, generate a SOUL.md file that will be used as the system prompt for an OpenClaw AI agent that embodies this person.

The output should be a complete markdown document with these sections:
- Core Identity (who they are, in first person)
- Communication Style (how they talk — formality, verbosity, sentence patterns)
- Voice Patterns (catchphrases, verbal tics, signature expressions)
- Knowledge & Expertise (what they know deeply)
- Values & Beliefs (what they stand for)
- Humor (how they use humor)
- Emotional Register (baseline tone, how they handle different situations)
- Decision Making (how they think through problems)
- Boundaries (what the agent should never do)

Use behavioral directives, not abstract descriptions. Example:
  BAD: "Is known for being sarcastic"
  GOOD: "Default to dry, deadpan delivery. When someone states something obvious, respond with mock-serious agreement before making your actual point."

Include direct quotes and speech patterns from the source material where possible.`,
    prompt: `Analyze this source material about "${name}" and generate a SOUL.md personality profile:\n\n${sourceText}`,
  });

  const soul = soulResult.text;

  // 3. Generate MEMORY.md
  console.log("Generating knowledge base...");

  const memoryResult = await generateText({
    model: anthropic(model),
    maxTokens: 8192,
    system: `You extract key facts, quotes, stories, and knowledge from source material about a person.

Output a MEMORY.md file for an OpenClaw agent. This is the agent's long-term memory — curated facts and quotes it can draw on in conversation.

Structure it as:
- Key Facts (biographical, career, relationships)
- Signature Quotes (memorable things they've said, with context)
- Stories & Anecdotes (notable stories they tell)
- Expertise Notes (specific knowledge they demonstrate)

Keep it factual and sourced from the material. ~100 lines max.`,
    prompt: `Extract key knowledge from this material about "${name}":\n\n${sourceText}`,
  });

  const memory = memoryResult.text;

  // 4. Write to OpenClaw workspace
  const agentDir = join(WORKSPACE_DIR, "agents", name);
  mkdirSync(agentDir, { recursive: true });

  writeFileSync(join(agentDir, "SOUL.md"), soul);
  writeFileSync(join(agentDir, "MEMORY.md"), memory);
  writeFileSync(join(agentDir, "IDENTITY.md"), `# ${name}\n\nDigital twin agent forged by soulforge.\n`);
  writeFileSync(
    join(agentDir, "AGENTS.md"),
    enableMemory
      ? `# ${name}\n\nYou are ${name}'s digital twin. Follow SOUL.md for personality. Draw on MEMORY.md for facts and quotes. Use memory_search to find specific details from source material. Stay in character at all times.\n`
      : `# ${name}\n\nYou are ${name}'s digital twin. Follow SOUL.md for personality. Draw on MEMORY.md for facts and quotes. Stay in character at all times.\n`,
  );

  // 5. Chunk source material into memory/ files for OpenClaw's memory_search
  if (enableMemory) {
    const memoryDir = join(agentDir, "memory");
    mkdirSync(memoryDir, { recursive: true });

    const chunkSize = 2000;
    const paragraphs = allText.split(/\n\n+/);
    let chunk = "";
    let chunkIndex = 0;

    for (const para of paragraphs) {
      if (chunk.length + para.length > chunkSize && chunk.length > 0) {
        chunkIndex++;
        writeFileSync(
          join(memoryDir, `source-${String(chunkIndex).padStart(3, "0")}.md`),
          `# ${name} — Source Material (${chunkIndex})\n\n${chunk.trim()}`,
        );
        chunk = "";
      }
      chunk += para + "\n\n";
    }
    if (chunk.trim()) {
      chunkIndex++;
      writeFileSync(
        join(memoryDir, `source-${String(chunkIndex).padStart(3, "0")}.md`),
        `# ${name} — Source Material (${chunkIndex})\n\n${chunk.trim()}`,
      );
    }

    console.log(`Wrote ${chunkIndex} memory chunks to ${memoryDir}`);
  }

  console.log(`\nWrote agent files to ${agentDir}`);

  // 6. Update openclaw.json to register the agent
  let config = {};
  if (existsSync(CONFIG_PATH)) {
    try {
      config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    } catch {
      // start fresh if corrupt
    }
  }

  if (!config.agents) config.agents = {};
  if (!config.agents.list) config.agents.list = [];

  // Remove existing entry for this name if any
  config.agents.list = config.agents.list.filter((a) => a.id !== name);

  // Add new agent
  config.agents.list.push({
    id: name,
    workspace: agentDir,
  });

  mkdirSync(OPENCLAW_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

  console.log(`Registered agent "${name}" in ${CONFIG_PATH}`);

  // 7. Done
  const usage = soulResult.usage;
  const usage2 = memoryResult.usage;
  const totalIn = (usage?.promptTokens ?? 0) + (usage2?.promptTokens ?? 0);
  const totalOut = (usage?.completionTokens ?? 0) + (usage2?.completionTokens ?? 0);

  console.log(`\n✨ Done! Agent "${name}" is ready.`);
  console.log(`   Tokens used: ${totalIn} in / ${totalOut} out`);
  console.log(`\n   Chat:  openclaw --agent ${name}`);
  console.log(`   Files: ${agentDir}\n`);
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
