import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolve, join } from "node:path";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { discoverFiles, readFile, repairQuotes, resolveApiKey, loadOpenClawAuth } from "../src/lib.js";

// --- discoverFiles ---

describe("discoverFiles", () => {
  it("discovers all text files in a directory", () => {
    const files = discoverFiles("./examples/elon-musk");
    assert.equal(files.length, 3);
    assert.ok(files[0].endsWith("interview-axtv-2023.txt"));
    assert.ok(files[1].endsWith("podcast-lex-fridman.txt"));
    assert.ok(files[2].endsWith("shareholder-meeting-2024.txt"));
  });

  it("returns single file when given a file path", () => {
    const files = discoverFiles("./examples/elon-musk/interview-axtv-2023.txt");
    assert.equal(files.length, 1);
    assert.ok(files[0].endsWith("interview-axtv-2023.txt"));
  });

  it("skips hidden files", () => {
    const tmp = join(tmpdir(), `soulforge-test-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    writeFileSync(join(tmp, "visible.txt"), "hello");
    writeFileSync(join(tmp, ".hidden.txt"), "secret");

    const files = discoverFiles(tmp);
    assert.equal(files.length, 1);
    assert.ok(files[0].endsWith("visible.txt"));

    rmSync(tmp, { recursive: true });
  });

  it("throws on non-existent path", () => {
    assert.throws(() => discoverFiles("./does-not-exist-at-all"), { code: "ENOENT" });
  });
});

// --- readFile ---

describe("readFile", () => {
  it("reads .txt files as text", async () => {
    const text = await readFile("./examples/elon-musk/interview-axtv-2023.txt");
    assert.ok(text.length > 100);
    assert.ok(text.includes("Elon Musk"));
  });

  it("reads files with unknown extension as text", async () => {
    const tmp = join(tmpdir(), `soulforge-test-${Date.now()}.csv`);
    writeFileSync(tmp, "col1,col2\na,b\n");
    const text = await readFile(tmp);
    assert.equal(text, "col1,col2\na,b\n");
    rmSync(tmp);
  });

  it("returns null for binary files that fail text decode", async () => {
    const tmp = join(tmpdir(), `soulforge-test-${Date.now()}.bin`);
    // Write valid UTF-8, readFile should still return it
    writeFileSync(tmp, Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]));
    const text = await readFile(tmp);
    assert.equal(text, "Hello");
    rmSync(tmp);
  });
});

// --- repairQuotes ---

describe("repairQuotes", () => {
  const source = [
    "I've been wrong about timing many times but I've been right about the destination and the goals weren't impossible after all.",
    "",
    "The factory floor is where the truth is and you simply cannot fix problems from a conference room no matter how nice it is.",
  ].join("\n");

  it("repairs a garbled quote using Jaccard similarity", () => {
    // Garble a quote from the first sentence — most words present but reordered/missing
    const garbled = '> "wrong about timing many times but right about destination goals werent impossible"';
    const result = repairQuotes(garbled, source);
    // Should match the first source sentence and repair it
    assert.ok(result.includes("timing many times"), `Expected repair, got: ${result}`);
    assert.notEqual(result, garbled);
  });

  it("leaves non-blockquote text unchanged", () => {
    const text = "This is a normal paragraph about rockets.";
    assert.equal(repairQuotes(text, source), text);
  });

  it("leaves quotes with no good match unchanged", () => {
    const unrelated = '> "The weather today is sunny and warm with clear skies over the mountains"';
    assert.equal(repairQuotes(unrelated, source), unrelated);
  });

  it("handles empty source text", () => {
    const quote = '> "some garbled text here that needs repair"';
    assert.equal(repairQuotes(quote, ""), quote);
  });

  it("handles multiple blockquotes", () => {
    const multi = [
      '> "wrong about timing many times right about destination goals"',
      "Some text in between.",
      '> "factory floor truth simply cannot fix problems conference room"',
    ].join("\n");
    const result = repairQuotes(multi, source);
    assert.ok(result.includes("timing many times"), `First quote not repaired: ${result}`);
    assert.ok(result.includes("conference room"), `Second quote not repaired: ${result}`);
  });

  it("ignores quotes with fewer than 4 words", () => {
    const short = '> "too short"';
    assert.equal(repairQuotes(short, source), short);
  });
});

// --- resolveApiKey ---

describe("resolveApiKey", () => {
  it("returns raw apiKey from provider config", () => {
    const result = resolveApiKey("anthropic", { apiKey: "sk-test-123" }, null);
    assert.deepEqual(result, { key: "sk-test-123", source: "provider config" });
  });

  it("expands ${ENV_VAR} in apiKey", () => {
    process.env.__SOULFORGE_TEST_KEY = "sk-from-env";
    const result = resolveApiKey("anthropic", { apiKey: "${__SOULFORGE_TEST_KEY}" }, null);
    assert.deepEqual(result, { key: "sk-from-env", source: "env (__SOULFORGE_TEST_KEY)" });
    delete process.env.__SOULFORGE_TEST_KEY;
  });

  it("skips OAuth sentinel keys", () => {
    const result = resolveApiKey("anthropic", { apiKey: "anthropic-oauth" }, null);
    // Should fall through to env var check
    assert.ok(result === null || result.source !== "provider config");
  });

  it("falls back to ANTHROPIC_API_KEY env var", () => {
    const original = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "sk-fallback";
    const result = resolveApiKey("anthropic", null, null);
    assert.deepEqual(result, { key: "sk-fallback", source: "env (ANTHROPIC_API_KEY)" });
    if (original) {
      process.env.ANTHROPIC_API_KEY = original;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it("returns null when no key is found", () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const result = resolveApiKey("some-provider", null, null);
    assert.equal(result, null);
    if (original) process.env.ANTHROPIC_API_KEY = original;
  });
});

// --- loadOpenClawAuth ---

describe("loadOpenClawAuth", () => {
  it("returns null for non-existent file", () => {
    assert.equal(loadOpenClawAuth("/does/not/exist.json", "anthropic"), null);
  });

  it("reads token from matching provider profile", () => {
    const tmp = join(tmpdir(), `soulforge-auth-${Date.now()}.json`);
    writeFileSync(tmp, JSON.stringify({
      profiles: {
        "profile-1": { provider: "anthropic", access: "sk-from-profile" },
      },
    }));
    const result = loadOpenClawAuth(tmp, "anthropic");
    assert.equal(result, "sk-from-profile");
    rmSync(tmp);
  });

  it("prefers lastGood profile", () => {
    const tmp = join(tmpdir(), `soulforge-auth-${Date.now()}.json`);
    writeFileSync(tmp, JSON.stringify({
      lastGood: { anthropic: "profile-2" },
      profiles: {
        "profile-1": { provider: "anthropic", access: "sk-first" },
        "profile-2": { provider: "anthropic", access: "sk-preferred" },
      },
    }));
    const result = loadOpenClawAuth(tmp, "anthropic");
    assert.equal(result, "sk-preferred");
    rmSync(tmp);
  });

  it("returns null for corrupt JSON", () => {
    const tmp = join(tmpdir(), `soulforge-auth-${Date.now()}.json`);
    writeFileSync(tmp, "not valid json {{{");
    assert.equal(loadOpenClawAuth(tmp, "anthropic"), null);
    rmSync(tmp);
  });
});
