import {
  MOBILE_TRAILER,
  OUTLOOK_HEADER_BLOCK,
  QUOTE_INTRODUCER,
  RFC_SIG_DELIM,
} from './heuristics';
import type { ParsedMessage, ParsedSegment, ParsedThread } from './types';

type WorkingMessage = {
  visible: string;
  quoted: string | null;
  signature: string | null;
};

const URL_TOKEN = /https?:\/\/\S+/g;

export function parseConversation(raw: string): ParsedThread {
  const normalized = normalize(raw);
  if (!normalized) {
    return { messages: [], isFallback: true, raw };
  }

  const working = splitMessages(normalized)
    .map(extractQuoteChain)
    .map(trimSignature);
  applyFootprintDedup(working);

  const messages = working.map((message, index) => toParsedMessage(message, index));
  const hasVisibleBody = messages.some((message) =>
    message.body.some((segment) => segment.kind === 'text' || segment.kind === 'link'),
  );

  return {
    messages,
    isFallback: messages.length === 0 || !hasVisibleBody,
    raw,
  };
}

function normalize(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitMessages(value: string): string[] {
  const boundaryIndexes = findBoundaryIndexes(value);
  if (boundaryIndexes.length > 0) {
    return splitAtIndexes(value, boundaryIndexes);
  }

  const blankSeparated = value.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  if (blankSeparated.length > 1 && hasRepeatedTailFootprint(blankSeparated)) {
    return blankSeparated;
  }

  return [value];
}

function findBoundaryIndexes(value: string): number[] {
  const indexes = new Set<number>();
  collectRegexIndexes(value, QUOTE_INTRODUCER, indexes);
  collectRegexIndexes(value, OUTLOOK_HEADER_BLOCK, indexes);
  return [...indexes].filter((index) => index > 0).sort((a, b) => a - b);
}

function collectRegexIndexes(value: string, pattern: RegExp, indexes: Set<number>): void {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const regex = new RegExp(pattern.source, flags);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(value)) !== null) {
    indexes.add(match.index);
    if (match[0].length === 0) regex.lastIndex += 1;
  }
}

function splitAtIndexes(value: string, indexes: number[]): string[] {
  const messages: string[] = [];
  let start = 0;
  for (const index of indexes) {
    const part = value.slice(start, index).trim();
    if (part) messages.push(part);
    start = index;
  }
  const last = value.slice(start).trim();
  if (last) messages.push(last);
  return messages;
}

function extractQuoteChain(value: string): WorkingMessage {
  const quoteIndex = findFirstIndex(value, [QUOTE_INTRODUCER, OUTLOOK_HEADER_BLOCK]);
  if (quoteIndex === -1) {
    return { visible: value.trim(), quoted: null, signature: null };
  }

  return {
    visible: value.slice(0, quoteIndex).trim(),
    quoted: value.slice(quoteIndex).trim(),
    signature: null,
  };
}

function findFirstIndex(value: string, patterns: RegExp[]): number {
  const indexes = patterns
    .map((pattern) => {
      const regex = new RegExp(pattern.source, pattern.flags);
      const match = regex.exec(value);
      return match?.index ?? -1;
    })
    .filter((index) => index >= 0);
  return indexes.length === 0 ? -1 : Math.min(...indexes);
}

function trimSignature(message: WorkingMessage): WorkingMessage {
  const rfcMatch = RFC_SIG_DELIM.exec(message.visible) ?? /\n--\n/.exec(message.visible);
  if (rfcMatch?.index !== undefined) {
    return withSignatureCandidate(message, rfcMatch.index + 1);
  }

  const mobileMatch = MOBILE_TRAILER.exec(message.visible);
  if (mobileMatch?.index !== undefined) {
    return withSignatureCandidate(message, mobileMatch.index + 1);
  }

  return message;
}

function withSignatureCandidate(message: WorkingMessage, signatureIndex: number): WorkingMessage {
  const visible = message.visible.slice(0, signatureIndex).trim();
  const signature = message.visible.slice(signatureIndex).trim();
  if (!signature || !canCollapseSignature(message.visible, visible, signature)) {
    return message;
  }
  return { ...message, visible, signature };
}

function applyFootprintDedup(messages: WorkingMessage[]): void {
  const counts = new Map<string, number>();
  const candidates = messages.map((message) => getTailFootprints(message.visible));

  for (const messageCandidates of candidates) {
    for (const candidate of messageCandidates) {
      counts.set(candidate, (counts.get(candidate) ?? 0) + 1);
    }
  }

  const seen = new Set<string>();
  candidates.forEach((messageCandidates, index) => {
    const candidate = messageCandidates.find((item) => (counts.get(item) ?? 0) >= 2);
    if (!candidate || (counts.get(candidate) ?? 0) < 2) return;
    if (!seen.has(candidate)) {
      seen.add(candidate);
      return;
    }

    const message = messages[index];
    if (message.signature) return;
    const signatureIndex = message.visible.lastIndexOf(candidate);
    if (signatureIndex < 0) return;

    const visible = message.visible.slice(0, signatureIndex).trim();
    if (!canCollapseSignature(message.visible, visible, candidate)) return;
    messages[index] = { ...message, visible, signature: candidate };
  });
}

function getTailFootprints(value: string): string[] {
  const lines = value.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 3) return [];

  const footprints: string[] = [];
  for (let size = Math.min(6, lines.length); size >= 3; size -= 1) {
    const candidate = lines.slice(-size).join('\n');
    if (candidate.length >= 24) footprints.push(candidate);
  }

  return footprints;
}

function hasRepeatedTailFootprint(parts: string[]): boolean {
  const counts = new Map<string, number>();
  for (const part of parts) {
    for (const footprint of getTailFootprints(part)) {
      counts.set(footprint, (counts.get(footprint) ?? 0) + 1);
    }
  }
  return [...counts.values()].some((count) => count >= 2);
}

function canCollapseSignature(original: string, visible: string, signature: string): boolean {
  if (signature.length > original.length / 2) return false;
  if (!hasSentence(visible) && hasSentence(signature)) return false;
  return true;
}

function hasSentence(value: string): boolean {
  return /[.!?](?:\s|$)/.test(value);
}

function toParsedMessage(message: WorkingMessage, index: number): ParsedMessage {
  const body: ParsedSegment[] = [
    ...linkifyTokens(message.visible),
    ...(message.quoted ? [{ kind: 'quoted' as const, raw: message.quoted }] : []),
    ...(message.signature ? [{ kind: 'signature' as const, raw: message.signature }] : []),
  ];

  const basis = [message.visible, message.quoted, message.signature].filter(Boolean).join('\n');
  return {
    id: `m-${index}-${hashContent(basis)}`,
    body,
    hasQuoted: Boolean(message.quoted),
    hasSignature: Boolean(message.signature),
  };
}

function linkifyTokens(value: string): ParsedSegment[] {
  if (!value) return [];

  const segments: ParsedSegment[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_TOKEN.exec(value)) !== null) {
    if (match.index > cursor) {
      segments.push({ kind: 'text', value: value.slice(cursor, match.index) });
    }
    segments.push({ kind: 'link', href: match[0], label: match[0] });
    cursor = match.index + match[0].length;
  }

  if (cursor < value.length) {
    segments.push({ kind: 'text', value: value.slice(cursor) });
  }

  return segments;
}

function hashContent(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}
