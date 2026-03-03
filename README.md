# ⚒️ soulforge

One command. Feed it text about a person. Get an [OpenClaw](https://github.com/openclaw/openclaw) agent that talks like them.

<!-- TODO: Replace with actual terminal recording -->
<!-- ![demo](./demo.gif) -->

## Try it now

```bash
npx soulforge elon-musk --data ./examples/elon-musk/
```

That's it. It reads your interviews/transcripts/notes, generates a personality profile, and registers a ready-to-use OpenClaw agent.

## Install

```bash
npm install -g soulforge
```

Or just use `npx soulforge` — no install needed.

## Usage

```bash
soulforge <name> --data <path>
```

**What it does:**
1. Reads all files in `<path>` (txt, md, pdf, docx)
2. Sends them to Claude to generate `SOUL.md` (personality) and `MEMORY.md` (key facts/quotes)
3. Writes agent files to `~/.openclaw/workspace/agents/<name>/`
4. Registers the agent in `~/.openclaw/openclaw.json`
5. Done — run `openclaw --agent <name>` to chat

**Options:**
```
--data, -d <path>    Path to source files (file or directory)
--model, -m <model>  Model override (default: from your openclaw.json)
--enable-memory      Chunk source material into memory/ for semantic search
--help, -h           Show help
```

## API Keys

Soulforge reads your existing OpenClaw credentials — no extra setup if you already have OpenClaw running.

**Lookup order:**
1. `~/.openclaw/agents/main/agent/auth-profiles.json` (OpenClaw's auth store)
2. `ANTHROPIC_API_KEY` environment variable

## Memory Mode

By default, soulforge generates two LLM-curated files: `SOUL.md` and `MEMORY.md`.

With `--enable-memory`, it also chunks your raw source material into `memory/source-001.md`, `memory/source-002.md`, etc. OpenClaw's `memory_search` indexes these automatically, so the agent can look up specific details during conversation.

## What gets generated

```
~/.openclaw/workspace/agents/<name>/
├── SOUL.md        # Personality — how the agent talks, thinks, decides
├── MEMORY.md      # Curated facts, quotes, stories
├── AGENTS.md      # Agent behavior instructions
├── IDENTITY.md    # Identity card
└── memory/        # (with --enable-memory) chunked source material
```

## Examples

The repo includes sample interview/transcript data:

```bash
git clone https://github.com/xmuweili/soulforge.git
cd soulforge
npm install
node src/index.js elon-musk --data ./examples/elon-musk/
```

## License

MIT
