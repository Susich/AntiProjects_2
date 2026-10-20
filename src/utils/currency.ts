/**
 * Currency and phone number formatting utilities.
 */

/**
 * Formats a number into Russian rubles (e.g. "1 450 ₽" or "250.50 ₽").
 */
export function formatRubles(
  amount: number | string | null | undefined,
  forceDecimals = false
): string {
  const numericAmount = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(numericAmount)) {
    return '0 ₽';
  }

  const rounded = Math.round(numericAmount * 100) / 100;
  const hasDecimals = rounded % 1 !== 0;

  const parts = (hasDecimals || forceDecimals ? rounded.toFixed(2) : rounded.toFixed(0)).split('.');
  // Add space separator for thousands
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  return `${parts.join('.')} ₽`;
}

/**
 * Formats an input string into a standard Russian phone mask: +7 (XXX) XXX-XX-XX
 */
export function formatPhone(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return '';

  // Google Sheets may return phone numbers as numeric cells, so normalize
  // the value to a string before applying the mask.
  const normalizedRaw = String(raw).trim();
  if (!normalizedRaw) return '';

  // Extract all digits
  const digits = normalizedRaw.replace(/\D/g, '');

  if (digits.length === 0) return '';

  // Normalize first digit if 8 or 7
  let normalized = digits;
  if (digits[0] === '8' || digits[0] === '7') {
    normalized = digits.substring(1);
  }

  let result = '+7 ';
  if (normalized.length > 0) {
    result += '(' + normalized.substring(0, 3);
  }
  if (normalized.length >= 3) {
    result += ') ' + normalized.substring(3, 6);
  }
  if (normalized.length >= 6) {
    result += '-' + normalized.substring(6, 8);
  }
  if (normalized.length >= 8) {
    result += '-' + normalized.substring(8, 10);
  }

  return result;
}

/**
 * Strips all non-digit characters from a phone number, keeping standard +7 prefix.
 */
export function cleanPhone(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return '';

  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.length === 11 && (digits[0] === '8' || digits[0] === '7')) {
    return '7' + digits.substring(1);
  }
  if (digits.length === 10) {
    return '7' + digits;
  }
  return digits;
}

/**
 * Distinct vibrant avatar colors for friends/participants.
 */
const AVATAR_PALETTE = [
  '#00F5A0', // Neon Emerald
  '#00D2FF', // Cyber Cyan
  '#8B5CF6', // Neon Violet
  '#EC4899', // Hot Pink
  '#F59E0B', // Amber
  '#10B981', // Forest Emerald
  '#3B82F6', // Royal Blue
  '#F97316', // Bright Orange
  '#14B8A6', // Teal
  '#A855F7', // Purple
];

export function getAvatarColor(nameOrIndex: string | number): string {
  if (typeof nameOrIndex === 'number') {
    return AVATAR_PALETTE[Math.abs(nameOrIndex) % AVATAR_PALETTE.length];
  }
  const value = String(nameOrIndex || '');
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

/**
 * Gets 1-2 letter initials for a participant.
 */
export function getInitials(name: string | number | null | undefined): string {
  if (name === null || name === undefined) return '?';
  const value = String(name).trim();
  if (!value) return '?';
  const parts = value.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
