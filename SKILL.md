# soulforge

Forge an OpenClaw agent from text about a person. Feed it interviews, transcripts, notes, PDFs — get a digital twin agent with a full personality profile.

## Usage

```bash
npx soulforge <name> --data <path>
```

## What it does

1. Ingests all files (txt, md, pdf, docx)
2. Generates SOUL.md (personality profile) and MEMORY.md (key facts/quotes) via Claude
3. Writes a complete agent workspace to `~/.openclaw/workspace/agents/<name>/`
4. Registers the agent in openclaw.json

## Options

- `--data, -d <path>` — Source files (required)
- `--model, -m <model>` — Model override
- `--enable-memory` — Chunk source material for memory_search

## Requirements

- Node.js 18+
- OpenClaw with Anthropic auth configured (or ANTHROPIC_API_KEY env var)

## Links

- GitHub: https://github.com/xmuweili/soulforge
- npm: https://www.npmjs.com/package/soulforge
