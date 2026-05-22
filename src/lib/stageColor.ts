const STAGE_PALETTE = [
  '#6f7f95',
  '#8a6f7d',
  '#7a765a',
  '#5f7f73',
  '#8a6f5d',
  '#6b7f63',
  '#7a6f92',
  '#8b6f6f',
  '#5f7885',
  '#7f755f',
  '#687d8d',
  '#806f86',
] as const;

function hashStageName(stageName: string | null): number {
  const input = (stageName ?? '').trim().toLowerCase() || 'unknown';
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function normalizeHex(value: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  if (/^[0-9a-f]{6}$/i.test(trimmed)) return `#${trimmed}`;
  return trimmed;
}

function relativeLuminance(hex: string): number {
  const normalized = normalizeHex(hex);
  if (!normalized || !/^#[0-9a-f]{6}$/i.test(normalized)) return 1;

  const channels = [1, 3, 5].map((start) => {
    const value = Number.parseInt(normalized.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function stageColorFor(stageName: string | null, override: string | null): string {
  const normalizedOverride = normalizeHex(override);
  if (normalizedOverride) return normalizedOverride;

  return STAGE_PALETTE[hashStageName(stageName) % STAGE_PALETTE.length];
}

export function stageBannerStyle(hex: string): { backgroundColor: string; color: string } {
  const backgroundColor = normalizeHex(hex) ?? '#6f7f95';
  const luminance = relativeLuminance(backgroundColor);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;

  return {
    backgroundColor,
    color: whiteContrast >= blackContrast ? '#ffffff' : '#000000',
  };
}
