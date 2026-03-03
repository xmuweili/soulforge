# Product Hunt Launch

## Tagline

Clone anyone into an AI agent — one command, three transcripts.

## Description

### The Problem

Everyone's building AI agents, but they all sound the same — generic, robotic, interchangeable. The people who actually have the knowledge and judgment you need are too busy, too expensive, or simply unavailable.

### The Solution

**SoulForge** turns real people into AI agents that actually think and talk like them.

Drop in a few interviews, podcast transcripts, or meeting notes. SoulForge analyzes how the person thinks, decides, communicates, and solves problems — then generates a complete digital clone you can actually talk to.

```
soulforge elon-musk --data ./interviews/
```

Three transcripts in. A digital Elon out. Ask him to review your startup pitch — he'll tear it apart using first principles, just like the real one would.

### How It Works

1. **Feed it source material** — interviews, podcasts, AMAs, essays, meeting transcripts (.txt, .md, .pdf, .docx)
2. **SoulForge extracts the person** — their thinking frameworks, decision-making patterns, communication style, and hard-won lessons
3. **Get a living agent** — not a trivia bot that recites Wikipedia, but a clone that talks like them, thinks like them, and gives advice like they're sitting across from you

### What Gets Generated

Every clone comes with a complete personality profile:

- **SOUL.md** — Their mind: how they think, decide, and communicate
- **MEMORY.md** — Their experience: lessons, frameworks, quotes, war stories
- **AGENTS.md** — Their playbook: how they'd approach your problems
- **IDENTITY.md** — Their card: strengths, style, what they're best at

### Use Cases

- **Clone your CTO** for async architecture reviews
- **Clone a domain expert** to onboard new team members
- **Clone a founder** to preserve institutional knowledge
- **Clone a mentor** for on-demand advice
- **Clone grandpa** so his stories and wisdom live on

### Why Raw Beats Polished

The best clones come from unscripted material — the "uh"s, the pauses, the self-corrections. That's where real thinking patterns live. 3-5 sources from different contexts give you a well-rounded clone.

### Built for OpenClaw

SoulForge generates agents for the [OpenClaw](https://github.com/openclaw/openclaw) agent framework. Install with one command, talk to your clone instantly.

## First Comment

Hey Product Hunt! We built SoulForge because we were tired of AI agents that all sound the same.

The insight was simple: the most valuable "AI agent" isn't one with better prompting — it's one that actually thinks like a specific person. Your CTO. A domain expert. A mentor. Someone whose judgment you trust.

So we built a tool that extracts how someone thinks from their raw, unscripted material — interviews, podcasts, meeting transcripts — and turns it into a digital clone you can actually talk to.

It's one npm command. Feed it transcripts, get back an agent. No fine-tuning, no training data pipelines, no ML expertise needed.

We're open source (MIT) and would love your feedback. Try cloning someone and let us know how close the clone gets!

## Topics

- Artificial Intelligence
- Open Source
- Developer Tools
- Productivity

## Links

- **GitHub:** https://github.com/xmuweili/soulforge
- **npm:** https://www.npmjs.com/package/soulforge

## Media

### Gallery Images (suggested)

1. **Hero image** — Use `assets/hero.svg` (the SoulForge CLI branding with tagline)
2. **Terminal demo** — Screenshot of `soulforge elon-musk --data ./examples/elon-musk/` running and producing output
3. **Generated files** — Screenshot showing the generated SOUL.md, MEMORY.md, AGENTS.md, and IDENTITY.md files
4. **Chat with clone** — Screenshot of `openclaw agent --agent elon-musk --message "Review my startup pitch"` showing the clone's response

### Thumbnail

Use the SoulForge logo/icon from the hero asset — the red lobster icon with "soulforge" text.
