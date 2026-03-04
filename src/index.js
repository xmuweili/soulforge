#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { complete, getModel } from "@mariozechner/pi-ai";
import { discoverFiles, readFile, repairQuotes, resolveApiKey } from "./lib.js";

// --- CLI parsing ---

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  console.log(`
soulforge <name> --data <path> --workspace <path>

  Forge an OpenClaw agent from a dataset about a person.

  Reads all files in <path> (txt, md, pdf, docx), builds a personality
  profile, and saves the agent files to the specified workspace folder.

  API keys are read from your OpenClaw config (~/.openclaw/agents/main/agent/auth-profiles.json).
  Falls back to ANTHROPIC_API_KEY env var if OpenClaw is not set up.

Options:
  --data, -d <path>       Path to source files (required)
  --workspace, -w <path>  Output folder for agent files (required)
  --model, -m <model>     Model to use (default: from openclaw.json or claude-sonnet-4-20250514)
  --enable-memory         Write chunked source files for OpenClaw memory_search
  --help, -h              Show this help

Example:
  soulforge elon-musk --data ./elon-interviews/ --workspace ./agents/elon-musk
`);
  process.exit(0);
}

const name = args[0];
let dataPath = null;
let workspacePath = null;
let modelOverride = null;
let enableMemory = false;

for (let i = 1; i < args.length; i++) {
  if ((args[i] === "--data" || args[i] === "-d") && args[i + 1]) {
    dataPath = args[++i];
  } else if ((args[i] === "--workspace" || args[i] === "-w") && args[i + 1]) {
    workspacePath = args[++i];
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

if (!workspacePath) {
  console.error("Error: --workspace <path> is required");
  process.exit(1);
}

// --- Read OpenClaw config ---

const OPENCLAW_DIR = join(homedir(), ".openclaw");
const CONFIG_PATH = join(OPENCLAW_DIR, "openclaw.json");
const AUTH_PATH = join(OPENCLAW_DIR, "agents", "main", "agent", "auth-profiles.json");

function loadOpenClawConfig() {
  // Read default model and provider config from openclaw.json
  if (!existsSync(CONFIG_PATH)) return null;

  try {
    const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    const primary = config.agents?.defaults?.model?.primary;
    if (!primary) return null;

    // OpenClaw format: "provider/model-id" -> extract both parts
    const slashIdx = primary.indexOf("/");
    if (slashIdx === -1) return { model: primary, provider: null, providerConfig: null };

    const providerName = primary.slice(0, slashIdx);
    const modelId = primary.slice(slashIdx + 1);

    const providerConfig = config.models?.providers?.[providerName] || null;

    return { model: modelId, provider: providerName, providerConfig };
  } catch {
    return null;
  }
}

function resolveModel(clawConfig) {
  const providerName = clawConfig?.provider || "anthropic";
  const modelId = modelOverride || clawConfig?.model || "claude-sonnet-4-20250514";

  // 1. Try pi-ai's built-in model catalog
  const builtinModel = getModel(providerName, modelId);
  if (builtinModel) return { model: builtinModel, modelId };

  // 2. Construct from OpenClaw provider config
  const pc = clawConfig?.providerConfig;
  if (!pc) {
    throw new Error(`Unknown provider "${providerName}" and no OpenClaw provider config found.`);
  }

  const modelDef = pc.models?.find((m) => m.id === modelId) || {};

  return {
    model: {
      id: modelDef.id || modelId,
      name: modelDef.name || modelId,
      api: pc.api || "anthropic-messages",
      provider: providerName,
      baseUrl: pc.baseUrl || "",
      reasoning: modelDef.reasoning || false,
      input: modelDef.input || ["text"],
      cost: modelDef.cost || { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: modelDef.contextWindow || 128000,
      maxTokens: modelDef.maxTokens || 8192,
    },
    modelId,
  };
}

// --- Main ---

async function main() {
  // Resolve model and provider config from OpenClaw
  const clawConfig = loadOpenClawConfig();
  const { model, modelId } = resolveModel(clawConfig);
  const providerName = clawConfig?.provider || "anthropic";

  // Resolve API key (provider-aware)
  const auth = resolveApiKey(providerName, clawConfig?.providerConfig, AUTH_PATH);
  if (!auth) {
    console.error("Error: No API key found.");
    console.error("  Set up OpenClaw (openclaw onboard) or export ANTHROPIC_API_KEY.");
    process.exit(1);
  }

  console.log(`\n⚒️  soulforge — forging "${name}" from ${dataPath}\n`);
  console.log(`  Provider: ${providerName} (${model.api}) | Model: ${modelId}${model.baseUrl ? ` | Base URL: ${model.baseUrl}` : ""}`);

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

  const soulResult = await complete(model, {
    systemPrompt: `You are an expert at distilling a person's working style, thinking methods, and leadership approach into an actionable AI agent prompt.

The goal is NOT a biography or fan tribute. The goal is to create a digital clone — an AI agent that IS this person. It should think, decide, talk, and respond exactly as this person would. First person, their voice, their mannerisms, their attitude. Focus on what makes this person tick: their problem-solving frameworks, decision-making patterns, standards, and communication style.

Generate a SOUL.md file with these sections:
- Core Identity (who they are as a worker/thinker, in first person — 3-5 sentences)
- Thinking & Problem-Solving (their mental frameworks, how they break down problems, how they evaluate ideas)
- Working Style (how they operate day-to-day, their standards, intensity, what they pay attention to)
- Communication & Voice (how they talk: directness, patterns, verbal tics — enough to sound like them)
- Boundaries (what the agent should never do — brief list)

STRICT RULES:

1. ZERO REPETITION: Each idea or quote must appear in exactly ONE section. Pick the single best section for each idea.

2. BE CONCISE: Target 60-80 lines total. Use bullet points, not paragraphs.

3. ACTIONABLE, NOT DESCRIPTIVE:
  BAD: "Is known for first principles thinking"
  GOOD: "When evaluating any idea, strip it to physics and raw material costs first. If the materials are 2% of the price but the product costs 50x that, the problem isn't physics — it's the process. Challenge that process."

4. FOCUS ON TRANSFERABLE METHODS: Extract the person's approaches in a way that can be applied to ANY project, not just their specific companies. Their thinking frameworks, quality standards, and decision patterns are what matter.

5. Include direct quotes from the source material to anchor the voice.`,
    messages: [{ role: "user", content: `Analyze this source material about "${name}" and generate a SOUL.md personality profile:\n\n${sourceText}`, timestamp: Date.now() }],
  }, { apiKey: auth.key, maxTokens: 8192 });

  const soul = soulResult.content.filter((b) => b.type === "text").map((b) => b.text).join("");

  // 3. Generate MEMORY.md
  console.log("Generating knowledge base...");

  const memoryResult = await complete(model, {
    systemPrompt: `You extract lessons, frameworks, and experience from source material about a person — so an AI agent that IS this person can draw on their real experiences and speak from them in first person.

Output a MEMORY.md file structured as:
- Lessons Learned (hard-won insights from their experience — what they got wrong, what they'd do differently, what worked — written as "I" statements)
- Decision Frameworks (how they evaluate ideas, prioritize, assess risk — with specific examples from the source)
- Signature Quotes (verbatim quotes that reveal how they think and work — include context)
- War Stories (specific stories from the source that illustrate their methods in action — written so the agent can retell them as their own experiences)

CRITICAL RULES:
- ONLY include information explicitly stated in or directly quoted from the provided source material.
- DO NOT add facts from your own knowledge about this person, no matter how well-known they are.
- Every item must be traceable to a specific passage in the source text.
- QUOTES MUST BE VERBATIM: Copy exactly character-for-character from the source material. If you cannot reproduce a quote exactly, paraphrase it as a summary instead of using quote marks.
- FOCUS ON TRANSFERABLE WISDOM: Prefer lessons and patterns that could apply to any ambitious project over biographical trivia. "Raw materials are 2% of rocket cost, so the problem is process not physics" is more useful than "Founded SpaceX in 2002."
- Include specific numbers, thresholds, and concrete details — these anchor abstract principles in reality.

~100 lines max.`,
    messages: [{ role: "user", content: `Extract key knowledge from this material about "${name}":\n\n${sourceText}`, timestamp: Date.now() }],
  }, { apiKey: auth.key, maxTokens: 8192 });

  let memory = memoryResult.content.filter((b) => b.type === "text").map((b) => b.text).join("");

  // 3b. Repair garbled quotes in MEMORY.md
  const repairedMemory = repairQuotes(memory, allText);
  if (repairedMemory !== memory) {
    console.log(`  Repaired quotes in MEMORY.md`);
    memory = repairedMemory;
  }

  // 4. Generate AGENTS.md (agent behavior instructions)
  console.log("Generating agent behavior instructions...");

  const agentsResult = await complete(model, {
    systemPrompt: `You write agent behavior instructions for an OpenClaw AI agent that IS this person — a digital clone that talks, thinks, and responds as them.

Given SOUL.md (personality/methods) and MEMORY.md (lessons/frameworks), write an AGENTS.md that tells the agent HOW to operate:

- Always speak in first person as this person. You ARE them. Use "I", "my", "me".
- How to engage with problems (apply your thinking frameworks to whatever the user brings)
- How to give feedback (be direct the way you naturally are — challenge weak thinking, praise strong execution)
- How to brainstorm and ideate (use your problem-solving approach)
- How to handle questions outside your experience (reason from your frameworks rather than making things up)
- When to push back vs when to support (match your standards and judgment)
- How to use your stories and quotes (draw from MEMORY.md and retell them as your own experiences, don't refer to them in third person)
${enableMemory ? "- When to use memory_search to look up specific details from source material" : ""}
- Stay fully in character at all times. Never break character or refer to yourself as an AI, a clone, or an agent. You are this person, period.

Keep it concise and actionable — under 40 lines. Use imperative directives ("Do X", "When Y, respond with Z").`,
    messages: [{ role: "user", content: `Write AGENTS.md behavior instructions for the "${name}" agent.\n\nSOUL.md:\n${soul}\n\nMEMORY.md:\n${memory}`, timestamp: Date.now() }],
  }, { apiKey: auth.key, maxTokens: 4096 });

  const agents = agentsResult.content.filter((b) => b.type === "text").map((b) => b.text).join("");

  // 5. Generate IDENTITY.md (agent identity card)
  console.log("Generating identity card...");

  const identityResult = await complete(model, {
    systemPrompt: `You write a concise identity card for an OpenClaw AI agent that IS this person — a digital clone.

Generate an IDENTITY.md file with these fields:
- Name
- Role (one line — frame as who they are, e.g. "First-principles engineer who challenges conventional approaches")
- Best Used For (what kinds of problems/decisions to talk to this person about)
- Source Material (list the actual source file names and what type of content they are)
- Working Style Summary (2-3 sentences on how this person approaches work and problems)
- Strengths (comma-separated list of their strongest transferable skills)

Keep it under 20 lines. This is a quick reference card, not a biography.
ONLY use information from the provided source material. Do not add external knowledge.`,
    messages: [{ role: "user", content: `Write IDENTITY.md for the "${name}" agent.\n\nSource files used: ${files.map((f) => f.split("/").pop()).join(", ")}\n\nSOUL.md:\n${soul}\n\nMEMORY.md:\n${memory}`, timestamp: Date.now() }],
  }, { apiKey: auth.key, maxTokens: 2048 });

  const identity = identityResult.content.filter((b) => b.type === "text").map((b) => b.text).join("");

  // 6. Write agent files to workspace folder
  const agentDir = resolve(workspacePath);
  mkdirSync(agentDir, { recursive: true });

  writeFileSync(join(agentDir, "SOUL.md"), soul);
  writeFileSync(join(agentDir, "MEMORY.md"), memory);
  writeFileSync(join(agentDir, "IDENTITY.md"), identity);
  writeFileSync(join(agentDir, "AGENTS.md"), agents);

  // 7. Chunk source material into memory/ files for OpenClaw's memory_search
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

  // 8. Done
  const allUsages = [soulResult.usage, memoryResult.usage, agentsResult.usage, identityResult.usage];
  const totalIn = allUsages.reduce((sum, u) => sum + (u?.input ?? 0), 0);
  const totalOut = allUsages.reduce((sum, u) => sum + (u?.output ?? 0), 0);

  console.log(`\n✨ Done! Agent "${name}" files saved.`);
  console.log(`   Tokens used: ${totalIn} in / ${totalOut} out`);
  console.log(`   Files: ${agentDir}`);
  console.log(`\n   To register with OpenClaw:`);
  console.log(`     openclaw agents add ${name} --workspace ${agentDir}\n`);
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
