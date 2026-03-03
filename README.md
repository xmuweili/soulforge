<p align="center">
  <img src="assets/hero.svg" alt="soulforge — clone anyone into an AI agent" width="100%">
</p>

<p align="center">
  Drop in a few interviews or transcripts. Get back a digital clone that thinks, talks, and makes decisions like the real person.
  <br>
  Built for <a href="https://github.com/openclaw/openclaw">OpenClaw</a>.
</p>

<br>

## Install

```bash
git clone https://github.com/xmuweili/soulforge.git
cd soulforge
npm install
```

## Clone Someone

```bash
soulforge elon-musk --data ./examples/elon-musk/
```
```
⚒️  soulforge — forging "elon-musk"

Generating personality profile...
Generating knowledge base...
Generating agent behavior instructions...
Generating identity card...

✨ Done! Agent "elon-musk" is ready.
   Chat:  openclaw --agent elon-musk
```

Then talk to the clone:

```bash
openclaw --agent elon-musk
```

Three transcripts in. A digital Elon out. Ask him to review your startup pitch — he'll tear it apart using first principles, just like the real one would.

<br>

## More Examples

```bash
soulforge my-cto --data ./cto-interviews/
soulforge naval --data ./naval-podcast-transcripts/
soulforge grandpa --data ./grandpa-stories/
```

Anyone with enough source material can be cloned. The more raw, unscripted material you feed it, the better the clone.

<br>

## What Gets Generated

```
~/.openclaw/workspace/agents/elon-musk/
├── SOUL.md        # Their mind — how they think, decide, and communicate
├── MEMORY.md      # Their experience — lessons, frameworks, war stories
├── AGENTS.md      # Their playbook — how they'd approach your problems
└── IDENTITY.md    # Their card — strengths, style, what they're best at
```

The result isn't a trivia bot that recites Wikipedia. It's a clone that actually reasons like them — their mental models, their verbal tics, their standards.

<br>

## Source Material

The clone is only as good as what you feed it.

| Source | Why it works |
|---|---|
| Long-form interviews / podcasts | Captures how they *actually* think and talk |
| Q&A sessions / AMAs | Reveals how they handle curveballs |
| Personal essays / blog posts | Shows their written voice |
| Meeting transcripts | Captures working style under pressure |

Raw transcripts beat polished articles — you want the "uh"s, the pauses, the self-corrections. 3-5 sources from different contexts gives a well-rounded clone. Handles up to ~150K characters.

**Supported formats:** `.txt` `.md` `.pdf` `.docx` `.doc`

<br>

## Options

```bash
soulforge <name> --data <path> [options]
```

| Option | Description |
|---|---|
| `--data, -d <path>` | Source files — directory or single file |
| `--model, -m <model>` | Model override |
| `--enable-memory` | Enable semantic search over source material |
| `--help, -h` | Show help |

<br>

## API Keys

Reads your existing OpenClaw credentials automatically. No extra setup needed.

Falls back to `ANTHROPIC_API_KEY` environment variable if OpenClaw isn't configured.

<br>

## License

MIT
