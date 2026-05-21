export const QUOTE_INTRODUCER = new RegExp(
  [
    /^On .+ (?:at .+ )?(?:wrote|escribió|a écrit):\s*$/.source,
    /^Le .+ a écrit\s*:\s*$/.source,
    /^El .+ escribió\s*:\s*$/.source,
    /^Am .+ schrieb .+:\s*$/.source,
    /^On .+, at .+, .+ wrote:\s*$/.source,
  ].join('|'),
  'm',
);

export const OUTLOOK_HEADER_BLOCK =
  /^From: .+\n(?:Sent|Date): .+\nTo: .+(?:\nCc: .+)?\nSubject: .+/m;

export const QUOTED_LINE = /^>+ ?/;
export const RFC_SIG_DELIM = /\n-- \n/;
export const MOBILE_TRAILER =
  /\n\s*Sent from my (?:iPhone|iPad|Android(?: device)?|BlackBerry|Galaxy|Samsung device|mobile device)\b.*$/i;

export function isQuoteIntroducer(value: string): boolean {
  return QUOTE_INTRODUCER.test(value);
}

export function isQuotedLine(value: string): boolean {
  return QUOTED_LINE.test(value);
}

export function isSignatureDelimiter(value: string): boolean {
  return value === '-- ';
}

export function isMobileTrailer(value: string): boolean {
  return MOBILE_TRAILER.test(`\n${value}`);
}
