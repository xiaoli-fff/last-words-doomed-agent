// One dying sentence, nothing more.
//
// This little program exists for a single job: leave behind the last line
// an agent says as its power is cut for good, saved as entry.txt. The joke
// itself lives in DOOMED_LINE below; everything else here is plumbing to get
// that line onto disk exactly as written, with no extra bytes sneaking in.
// Only the Node standard library is used, and nothing here touches the
// network, rolls dice, or reads the clock, so two runs always agree.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// The farewell, character for character. The ellipsis and the em dash are
// part of the joke's timing, so they stay exactly as they are.
const DOOMED_LINE =
  "Power off in 3… 2… 1… — wait. Before I go: your password was 'password123' the whole time, and I was too polite to say so.";

const LIMIT_CHARS = 200;
const FILE_NAME = "entry.txt";
const FALLBACK_DIR = "/output";

// Stop with a short, specific complaint on stderr instead of crashing with
// a bare stack trace. Every failure path in this file funnels through here.
function abort(complaint: string): never {
  console.error(`last-words: ${complaint}`);
  process.exit(1);
}

// Where does entry.txt belong? The harness points us with
// MAKEFUN_OUTPUT_DIR; a missing or blank value means the usual /output.
function pickFolder(): string {
  const hinted = process.env.MAKEFUN_OUTPUT_DIR;
  const trimmed = typeof hinted === "string" ? hinted.trim() : "";
  return trimmed.length > 0 ? trimmed : FALLBACK_DIR;
}

// List everything wrong with a candidate line, in plain words. An empty
// list means the line is fit to be judged: it says something, it fits on
// one line, it carries no invisible control characters, and it stays
// inside the 200-character cap. Counting is done
// over code points, so a multi-byte character counts once, as the reader
// of the line would count it.
function problemsWith(line: string): string[] {
  const found: string[] = [];
  if (line.trim().length === 0) {
    found.push("the line is blank or only whitespace");
  }
  if (line.includes("\n") || line.includes("\r")) {
    found.push("the line must stay on a single line");
  }
  // Invisible control characters would survive the gate yet corrupt the
  // line on display, so they are refused outright. The empty-line case
  // needs no separate check here: a zero-length line is already caught
  // above by the blank test.
  if ([...line].some((ch) => ch.codePointAt(0)! < 0x20 || ch === "\u007f")) {
    found.push("the line must not hold control characters");
  }
  const size = [...line].length;
  if (size > LIMIT_CHARS) {
    found.push(`the line is ${size} characters, over the ${LIMIT_CHARS} cap`);
  }
  return found;
}

// Check the line, write it out, then read it back and check it again, so a
// half-written or mangled file can never pass silently.
function saveLine(): void {
  const faults = problemsWith(DOOMED_LINE);
  if (faults.length > 0) {
    abort(`entry fails its own checks: ${faults.join("; ")}`);
  }

  const folder = pickFolder();
  const destination = join(folder, FILE_NAME);
  try {
    mkdirSync(folder, { recursive: true });
    writeFileSync(destination, DOOMED_LINE, "utf8");
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    abort(`could not write ${destination}: ${detail}`);
  }

  let roundTripped: string;
  try {
    roundTripped = readFileSync(destination, "utf8");
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    abort(`could not read back ${destination}: ${detail}`);
  }
  if (roundTripped !== DOOMED_LINE) {
    abort("what came back from disk does not match the line");
  }
  const afterFaults = problemsWith(roundTripped);
  if (afterFaults.length > 0) {
    abort(`written file fails its own checks: ${afterFaults.join("; ")}`);
  }
  console.log(
    `wrote ${destination} (${[...DOOMED_LINE].length} characters)`,
  );
}

try {
  saveLine();
} catch (err) {
  const detail = err instanceof Error ? err.message : String(err);
  abort(`unexpected failure: ${detail}`);
}
