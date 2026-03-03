import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, join, extname } from "node:path";

// --- File discovery ---

export function discoverFiles(dirPath) {
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

// --- File reading ---

export async function readFile(filePath) {
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
    const text = await officeparser.parseOfficeAsync(filePath);
    return typeof text === "string" ? text : String(text);
  }

  // Try reading as text
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

// --- Quote repair ---

export function repairQuotes(generated, sourceText) {
  // Extract sentences from source for matching
  const sourceSentences = sourceText
    .split(/[.!?"]\s+|[.!?"]\n|\n\n+/)
    .map((s) => s.replace(/^[>":\s]+/, "").trim())
    .filter((s) => s.length > 20);

  // Tokenize into lowercase words for comparison
  const words = (str) => str.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);

  // Find best matching source sentence for a garbled quote
  function findBestMatch(quote) {
    const quoteWords = new Set(words(quote));
    if (quoteWords.size < 4) return null;

    let bestScore = 0;
    let bestIdx = -1;

    for (let i = 0; i < sourceSentences.length; i++) {
      const srcWords = new Set(words(sourceSentences[i]));
      // Compute Jaccard similarity
      let overlap = 0;
      for (const w of quoteWords) if (srcWords.has(w)) overlap++;
      const union = new Set([...quoteWords, ...srcWords]).size;
      const score = overlap / union;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestScore < 0.4 || bestIdx === -1) return null;

    // Try to find the full quote span in the original source text
    // by locating the matched sentence and expanding to nearby sentence boundaries
    const matched = sourceSentences[bestIdx];
    const pos = sourceText.indexOf(matched);
    if (pos === -1) return matched;

    // Expand to capture the full quoted passage (look for the surrounding context)
    // Find the start: go back to previous newline or quote marker
    let start = pos;
    while (start > 0 && sourceText[start - 1] !== "\n") start--;
    // Find the end: go forward to next double-newline or end
    let end = pos + matched.length;
    while (end < sourceText.length && sourceText[end] !== "\n") end++;

    const expanded = sourceText.slice(start, end).replace(/^[A-Z]+:\s*/, "").trim();
    // Only use expanded if it's reasonably close in length to original quote
    if (expanded.length > 0 && expanded.length < matched.length * 3) {
      return expanded;
    }
    return matched;
  }

  // Replace garbled blockquotes (> "...") with repaired versions
  return generated.replace(/^>\s*"([^"]+)"/gm, (match, quoteContent) => {
    const repaired = findBestMatch(quoteContent);
    if (repaired) {
      return `> "${repaired}"`;
    }
    return match;
  });
}

// --- OpenClaw config ---

export function loadOpenClawAuth(authPath, providerName) {
  if (!existsSync(authPath)) return null;

  try {
    const auth = JSON.parse(readFileSync(authPath, "utf-8"));
    const profiles = auth.profiles || {};

    // If a specific provider is requested, look for it first
    if (providerName) {
      const preferred = auth.lastGood?.[providerName];
      if (preferred && profiles[preferred]) {
        const p = profiles[preferred];
        return p.access || p.token || null;
      }

      for (const profile of Object.values(profiles)) {
        if (profile.provider === providerName) {
          return profile.access || profile.token || null;
        }
      }
    }

    // Fallback: look for an anthropic profile
    for (const [id, profile] of Object.entries(profiles)) {
      if (profile.provider === "anthropic") {
        const preferred = auth.lastGood?.anthropic;
        if (preferred && preferred !== id) continue;
        return profile.access || profile.token || null;
      }
    }

    // Last resort: first anthropic token
    for (const profile of Object.values(profiles)) {
      if (profile.provider === "anthropic") {
        return profile.access || profile.token || null;
      }
    }
  } catch {
    // corrupt file, ignore
  }

  return null;
}

export function resolveApiKey(providerName, providerConfig, authPath) {
  // 1. Provider config apiKey with ${ENV_VAR} expansion (skip OAuth sentinels)
  if (providerConfig?.apiKey) {
    const raw = providerConfig.apiKey;
    if (!raw.endsWith("-oauth")) {
      const envMatch = raw.match(/^\$\{(.+)\}$/);
      if (envMatch) {
        const val = process.env[envMatch[1]];
        if (val) return { key: val, source: `env (${envMatch[1]})` };
      } else {
        return { key: raw, source: "provider config" };
      }
    }
  }

  // 2. OpenClaw auth-profiles OAuth token
  if (authPath) {
    const clawKey = loadOpenClawAuth(authPath, providerName);
    if (clawKey) return { key: clawKey, source: "openclaw" };
  }

  // 3. ANTHROPIC_API_KEY legacy fallback
  if (process.env.ANTHROPIC_API_KEY) {
    return { key: process.env.ANTHROPIC_API_KEY, source: "env (ANTHROPIC_API_KEY)" };
  }

  return null;
}
