/**
 * Strict Semantic Versioning comparison utility.
 * Compares version components numerically (e.g., 1.0.10 > 1.0.9).
 */

/**
 * Parses a semantic version string into numeric segments [major, minor, patch, ...].
 * Strips leading 'v' or 'V', and ignores prerelease/build metadata (e.g. -beta, +build).
 */
export function parseSemver(version: string | null | undefined): number[] {
  if (!version || typeof version !== 'string') {
    return [0, 0, 0];
  }

  // Strip leading 'v' or 'V' and trim whitespace
  let clean = version.trim().replace(/^[vV]/, '');

  // Strip prerelease or build metadata (e.g., "-beta.1", "+20261022")
  const metaIndex = clean.search(/[-+]/);
  if (metaIndex >= 0) {
    clean = clean.substring(0, metaIndex);
  }

  const parts = clean.split('.');
  const numbers: number[] = [];

  for (let i = 0; i < parts.length; i++) {
    const parsed = parseInt(parts[i], 10);
    numbers.push(isNaN(parsed) ? 0 : Math.max(0, parsed));
  }

  // Ensure at least 3 segments [major, minor, patch]
  while (numbers.length < 3) {
    numbers.push(0);
  }

  return numbers;
}

/**
 * Compares two semantic version strings numerically.
 *
 * @param v1 First version string (e.g., latestVersion)
 * @param v2 Second version string (e.g., currentVersion)
 * @returns
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 *
 * Example:
 *   compareVersions("1.0.10", "1.0.9") === 1
 *   compareVersions("1.0.4", "1.0.4") === 0
 *   compareVersions("1.0.4", "1.0.5") === -1
 */
export function compareVersions(
  v1: string | null | undefined,
  v2: string | null | undefined
): number {
  const p1 = parseSemver(v1);
  const p2 = parseSemver(v2);

  const length = Math.max(p1.length, p2.length);

  for (let i = 0; i < length; i++) {
    const a = p1[i] ?? 0;
    const b = p2[i] ?? 0;

    if (a > b) return 1;
    if (a < b) return -1;
  }

  return 0;
}

/**
 * Returns true if a newer update is available (latest > current).
 */
export function isUpdateAvailable(
  latestVersion: string | null | undefined,
  currentVersion: string | null | undefined
): boolean {
  return compareVersions(latestVersion, currentVersion) > 0;
}
