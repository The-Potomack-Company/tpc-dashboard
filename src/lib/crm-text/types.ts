export type ParsedSegment =
  | { kind: 'text'; value: string }
  | { kind: 'link'; href: string; label: string }
  | { kind: 'quoted'; raw: string }
  | { kind: 'signature'; raw: string };

export type ParsedMessage = {
  id: string;
  body: ParsedSegment[];
  hasQuoted: boolean;
  hasSignature: boolean;
};

export type ParsedThread = {
  messages: ParsedMessage[];
  isFallback: boolean;
  raw: string;
};
