/**
 * thresher-json.ts — payload extraction for Thresher (mcpproxy) tool-call
 * output.
 *
 * `thresher --config CFG call tool-read --tool-name=server:tool -o json`
 * prints an MCP envelope:
 *   { content: [{ text: "...", type: "text" }], isError: false }
 *
 * The upstream tool's JSON payload rides inside content[0].text, wrapped by
 * Thresher's untrusted-spotlight markers and Go's map render:
 *   "[map[text:«untrusted:server/tool»\n{JSON}\n«/untrusted:server/tool» type:text]]"
 *
 * unwrapJson() returns the FIRST balanced {…} / […] slice (scanning every
 * candidate position in order) that actually parses as JSON — Go render text
 * never parses, so this handles object payloads, array payloads (e.g. tab
 * lists, without mistaking one tab object for the whole list), and banner
 * pollution before the envelope.
 */

export function extractBalanced(
  text: string,
  open: string,
  close: string,
): string | undefined {
  const start = text.indexOf(open);
  if (start === -1) return undefined;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return undefined;
}

export function safeParse<T>(s: string | undefined): T | undefined {
  if (!s) return undefined;
  try {
    return JSON.parse(s) as T;
  } catch {
    return undefined;
  }
}

type Envelope = {
  content?: Array<{ text?: string; type?: string }>;
  isError?: boolean;
};

function envelopeText(raw: string): string | undefined {
  const env = safeParse<Envelope>(raw);
  if (env && typeof env.isError === "boolean" && Array.isArray(env.content)) {
    return env.content[0]?.text;
  }
  return undefined;
}

export function unwrapJson<T>(raw: string): T {
  // Envelope first; raw text (banner-polluted or already-payload) falls back.
  // No blind marker stripping: «untrusted…» markers can also appear inside
  // payload strings, and the balanced-parse scan rejects Go render text on
  // its own, so stripping would only corrupt valid payloads.
  const direct = envelopeText(raw);
  if (direct !== undefined) return scanPayload<T>(direct);
  // Banner-polluted stream: the first parseable balanced slice may BE an
  // envelope — descend into it instead of returning it as the payload.
  const text = raw;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== "{" && ch !== "[") continue;
    const close = ch === "{" ? "}" : "]";
    const slice = extractBalanced(text.slice(i), ch, close);
    const parsed = safeParse<unknown>(slice);
    if (parsed === undefined) continue;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      Array.isArray((parsed as Envelope).content)
    ) {
      const inner = (parsed as Envelope).content?.[0]?.text;
      if (typeof inner === "string") return scanPayload<T>(inner);
    }
    return parsed as T;
  }
  throw new Error(`no JSON payload in: ${text.slice(0, 200)}`);
}

function scanPayload<T>(text: string): T {
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== "{" && ch !== "[") continue;
    const close = ch === "{" ? "}" : "]";
    const parsed = safeParse<T>(extractBalanced(text.slice(i), ch, close));
    if (parsed !== undefined) return parsed;
  }
  throw new Error(`no JSON payload in: ${text.slice(0, 200)}`);
}
