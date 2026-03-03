<p align="center">
  <h1 align="center">soulforge</h1>
  <p align="center"><b>Turn interviews, transcripts, and notes about anyone into an AI working partner that thinks like them.</b></p>
</p>

<p align="center">
  Feed it text &rarr; Get an <a href="https://github.com/openclaw/openclaw">OpenClaw</a> agent that works like them
</p>

<br>

> **Not a chatbot. A coworker.**
> Soulforge doesn't build biography bots that recite facts. It extracts how a person *thinks, decides, and solves problems* — then creates an AI agent you can hire onto your project.

<br>

## Quick Start

```bash
git clone https://github.com/xmuweili/soulforge.git
cd soulforge
npm install
node src/index.js elon-musk --data ./examples/elon-musk/
```

```
⚒️  soulforge — forging "elon-musk" from ./examples/elon-musk/

Found 3 file(s)
  Reading interview-axtv-2023.txt...     2498 chars
  Reading podcast-lex-fridman.txt...      3671 chars
  Reading shareholder-meeting-2024.txt... 3424 chars

Generating personality profile...
Generating knowledge base...
Generating agent behavior instructions...
Generating identity card...

✨ Done! Agent "elon-musk" is ready.

   Chat:  openclaw --agent elon-musk
```

That's it. Three interview transcripts in, one working partner out.

<br>

## What Makes This Different

Most "digital twin" tools create fan tributes — chatbots that parrot quotes and recite Wikipedia.

Soulforge extracts **transferable working methods**:

| What it generates | What it captures |
|---|---|
| `SOUL.md` | Thinking frameworks, problem-solving style, communication patterns |
| `MEMORY.md` | Lessons learned, decision frameworks, war stories with real examples |
| `AGENTS.md` | How to apply their methods to *your* problems |
| `IDENTITY.md` | Quick reference — strengths, best used for, working style |

The agent doesn't just *sound* like the person — it **works** like them. It challenges your assumptions the way they would. It breaks down problems using their mental models. It gives feedback at their standards.

<br>

## Usage

```bash
node src/index.js <name> --data <path> [options]
```

| Option | Description |
|---|---|
| `--data, -d <path>` | Path to source files — directory or single file (required) |
| `--model, -m <model>` | Model override (default: from your `openclaw.json`) |
| `--enable-memory` | Chunk source material for OpenClaw's `memory_search` |
| `--help, -h` | Show help |

### Supported formats

`.txt` `.md` `.pdf` `.docx` `.doc` — or any text-based file.

<br>

## What Gets Generated

```
~/.openclaw/workspace/agents/<name>/
├── SOUL.md        # How they think, work, and communicate
├── MEMORY.md      # Lessons, frameworks, quotes, war stories
├── AGENTS.md      # How to apply their approach to your problems
├── IDENTITY.md    # Quick-reference card (strengths, best used for)
└── memory/        # (--enable-memory) chunked source for semantic search
```

### Example Output

Here's what `SOUL.md` looks like for the included Elon Musk example (generated from 3 interview transcripts):

```markdown
## Thinking & Problem-Solving

First principles is physics applied to everyday problems. I strip things
down to the most fundamental truths, then reason up from there. When
people said rockets were expensive, I looked at raw materials — aluminum,
carbon fiber, fuel — and they were maybe 2% of the price. The problem
wasn't physics; it was how the industry worked. So I rebuilt the process.

## Working Style

I work, then work some more. Most of my time is engineering reviews,
design meetings, manufacturing problems — the unsexy stuff that actually
moves things forward. You can't fix problems from a conference room.
The factory floor is where the truth is.
```

And `MEMORY.md` captures transferable wisdom, not Wikipedia facts:

```markdown
## Decision Frameworks

**First Principles Thinking:**
"You boil things down to the most fundamental truths you can identify,
and then reason up from there. Most people think by analogy — 'we do it
this way because that's how it's always been done.' That's fine for
incremental improvement, but if you want to do something fundamentally
new, you have to start from scratch."

## War Stories

**SpaceX Near-Death Experience:**
First three launches failed. Had enough money for three, maybe four.
"If the fourth one had failed, that was it — SpaceX was done.
But the fourth one worked. Sometimes you just have to keep going."
```

<br>

## Source Material Tips

The better your source material, the better your agent. Here's what works:

| Source type | Quality |
|---|---|
| Long-form interviews / podcasts | Best — captures how they actually think and talk |
| Conference talks / Q&A sessions | Great — reveals how they handle live questions |
| Personal essays / blog posts | Good — shows their written voice |
| Meeting transcripts / internal notes | Good — captures working style |
| News articles / third-party bios | Weak — outsider perspective, not their voice |

**Tips:**
- Raw transcripts beat polished articles — you want verbal tics, pauses, self-corrections
- 3-5 sources from different contexts gives the best range
- Longer is better — soulforge handles up to ~150K characters

<br>

## API Keys

Soulforge reads your existing OpenClaw credentials automatically.

**Lookup order:**
1. Provider config in `~/.openclaw/openclaw.json` (supports `${ENV_VAR}` expansion)
2. OAuth tokens from `~/.openclaw/agents/main/agent/auth-profiles.json`
3. `ANTHROPIC_API_KEY` environment variable

No extra setup needed if you already have OpenClaw running.

<br>

## Memory Mode

By default, soulforge generates four LLM-curated files. With `--enable-memory`, it also chunks your raw source material into `memory/source-001.md`, `memory/source-002.md`, etc.

OpenClaw's `memory_search` indexes these automatically, so the agent can look up specific details during conversation — useful when you have large amounts of source material and want the agent to reference exact passages.

<br>

## Development

```bash
npm test          # Run test suite (22 tests)
npm start         # Run soulforge
```

<br>

## License

MIT
