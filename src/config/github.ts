/**
 * GitHub Releases updater configuration.
 *
 * The app checks
 *   https://api.github.com/repos/{owner}/{repo}/releases/latest
 * and installs the first `.apk` asset of the latest release.
 *
 * Set the real values either here or, preferably, through the Expo public
 * environment variables (they are inlined at build time):
 *   EXPO_PUBLIC_GITHUB_OWNER=Susich
 *   EXPO_PUBLIC_GITHUB_REPO=AntiProjects_2
 *
 * Without a configured owner the update check fails gracefully with a clear
 * message instead of silently downloading a stale APK.
 */

const ENV_OWNER = (process.env.EXPO_PUBLIC_GITHUB_OWNER || '').trim();
const ENV_REPO = (process.env.EXPO_PUBLIC_GITHUB_REPO || '').trim();

export const GITHUB_OWNER = ENV_OWNER || 'Susich';
export const GITHUB_REPO = ENV_REPO || 'AntiProjects_2';

export const IS_GITHUB_REPO_CONFIGURED =
  GITHUB_OWNER !== 'YOUR_GITHUB_OWNER' && GITHUB_REPO !== 'YOUR_GITHUB_REPO';

export const GITHUB_RELEASES_URL = IS_GITHUB_REPO_CONFIGURED
  ? `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`
  : 'https://github.com';

export const GITHUB_LATEST_RELEASE_URL = IS_GITHUB_REPO_CONFIGURED
  ? `${GITHUB_RELEASES_URL}/latest`
  : GITHUB_RELEASES_URL;

export const GITHUB_LATEST_RELEASE_API_URL = IS_GITHUB_REPO_CONFIGURED
  ? `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`
  : '';

/** Public download page shared from the app (replaces the old Drive link). */
export const APP_DOWNLOAD_URL = GITHUB_LATEST_RELEASE_URL;
