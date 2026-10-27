import { Linking, Platform } from 'react-native';
import {
  APP_DOWNLOAD_URL,
  GITHUB_LATEST_RELEASE_API_URL,
  GITHUB_LATEST_RELEASE_URL,
  GITHUB_OWNER,
  GITHUB_REPO,
  IS_GITHUB_REPO_CONFIGURED,
} from '../config/github';
import { CURRENT_APP_VERSION } from '../config/version';
import { isUpdateAvailable } from '../utils/semver';

export { CURRENT_APP_VERSION, APP_DOWNLOAD_URL, GITHUB_LATEST_RELEASE_URL };

export type DownloadProgressCallback = (
  progress: number,
  bytesDownloaded: number,
  totalBytes: number
) => void;

export interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size?: number;
  content_type?: string;
}

export interface GitHubRelease {
  tag_name: string;
  name?: string;
  body?: string;
  html_url?: string;
  published_at?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: GitHubReleaseAsset[];
}

export interface LatestReleaseInfo {
  /** Version without the leading `v`, e.g. "1.0.6". */
  version: string;
  releaseName?: string;
  notes: string;
  apkUrl: string;
  apkName: string;
  apkSize: number;
  releaseUrl: string;
  publishedAt?: string;
}

export type UpdateCheckResult =
  | {
      status: 'update';
      currentVersion: string;
      latest: LatestReleaseInfo;
    }
  | {
      status: 'latest';
      currentVersion: string;
      latest: LatestReleaseInfo;
    }
  | {
      status: 'error';
      currentVersion: string;
      error: string;
    };

function normalizeVersion(tag: string): string {
  return String(tag || '').trim().replace(/^[vV]/, '');
}

function findApkAsset(
  assets: GitHubReleaseAsset[] | undefined
): GitHubReleaseAsset | undefined {
  if (!Array.isArray(assets)) return undefined;
  return assets.find((asset) => {
    const name = String(asset?.name || '').toLowerCase();
    return Boolean(asset?.browser_download_url) && name.endsWith('.apk');
  });
}

/**
 * Loads the latest published release from GitHub. Drafts and prereleases are
 * ignored by the `releases/latest` endpoint itself.
 */
export async function fetchLatestGitHubRelease(): Promise<{
  success: boolean;
  release?: LatestReleaseInfo;
  error?: string;
}> {
  if (!IS_GITHUB_REPO_CONFIGURED || !GITHUB_LATEST_RELEASE_API_URL) {
    return {
      success: false,
      error:
        'Не настроен репозиторий GitHub. Укажите владельца и название репозитория в src/config/github.ts (или в EXPO_PUBLIC_GITHUB_OWNER / EXPO_PUBLIC_GITHUB_REPO).',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(GITHUB_LATEST_RELEASE_API_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.status === 404) {
      return {
        success: false,
        error: `В репозитории ${GITHUB_OWNER}/${GITHUB_REPO} пока нет опубликованных релизов.`,
      };
    }
    if (response.status === 403 || response.status === 429) {
      return {
        success: false,
        error: 'GitHub временно ограничил количество запросов. Попробуйте позже.',
      };
    }
    if (!response.ok) {
      return {
        success: false,
        error: `GitHub вернул ошибку ${response.status}. Попробуйте позже.`,
      };
    }

    const raw = (await response.json()) as GitHubRelease;
    const version = normalizeVersion(raw.tag_name);
    if (!version) {
      return { success: false, error: 'В последнем релизе GitHub не указана версия (tag).' };
    }

    const apkAsset = findApkAsset(raw.assets);

    return {
      success: true,
      release: {
        version,
        releaseName: raw.name ? String(raw.name) : undefined,
        notes: raw.body ? String(raw.body) : '',
        apkUrl: apkAsset ? apkAsset.browser_download_url : '',
        apkName: apkAsset ? apkAsset.name : '',
        apkSize: apkAsset ? Number(apkAsset.size) || 0 : 0,
        releaseUrl:
          raw.html_url ||
          `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/${raw.tag_name}`,
        publishedAt: raw.published_at ? String(raw.published_at) : undefined,
      },
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      return { success: false, error: 'Превышено время ожидания ответа GitHub (12s)' };
    }
    return {
      success: false,
      error: err?.message
        ? `Не удалось проверить обновления: ${err.message}`
        : 'Не удалось проверить обновления на GitHub',
    };
  }
}

/**
 * Compares the latest GitHub release with the installed app version using
 * strict semantic versioning.
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const result = await fetchLatestGitHubRelease();
  if (!result.success || !result.release) {
    return {
      status: 'error',
      currentVersion: CURRENT_APP_VERSION,
      error: result.error || 'Не удалось проверить обновления',
    };
  }

  const needsUpdate = isUpdateAvailable(
    result.release.version,
    CURRENT_APP_VERSION
  );

  if (needsUpdate && !result.release.apkUrl) {
    return {
      status: 'error',
      currentVersion: CURRENT_APP_VERSION,
      error: `В релизе v${result.release.version} нет APK-файла. Прикрепите .apk к релизу на GitHub.`,
    };
  }

  return {
    status: needsUpdate ? 'update' : 'latest',
    currentVersion: CURRENT_APP_VERSION,
    latest: result.release,
  };
}

/**
 * Downloads an APK with progress reporting and opens the native Android
 * package installer. GitHub asset URLs redirect to a CDN; the downloader
 * follows redirects automatically.
 */
export async function downloadAndInstallApk(
  apkUrl: string,
  onProgress?: DownloadProgressCallback,
  fileName?: string
): Promise<{ success: boolean; error?: string }> {
  if (!apkUrl) {
    return { success: false, error: 'Ссылка на APK не найдена' };
  }

  // Web/iOS fallback: let the system browser handle the download.
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.open(apkUrl, '_blank');
      return { success: true };
    }
    return { success: false, error: 'Не удалось запустить загрузку в браузере' };
  }

  if (Platform.OS !== 'android') {
    await Linking.openURL(apkUrl);
    return { success: true };
  }

  try {
    const FileSystem = await import('expo-file-system/legacy');
    const IntentLauncher = await import('expo-intent-launcher');

    const downloadDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (!downloadDir) {
      throw new Error('Локальное хранилище недоступно');
    }

    const safeName = String(fileName || `partysplit_${CURRENT_APP_VERSION}.apk`)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.apk$/i, '');
    const localApkPath = `${downloadDir}${safeName}_${Date.now()}.apk`;

    const downloadResumable = FileSystem.createDownloadResumable(
      apkUrl,
      localApkPath,
      {
        headers: {
          Accept: 'application/octet-stream',
        },
      },
      (downloadProgress) => {
        const total = downloadProgress.totalBytesExpectedToWrite;
        const written = downloadProgress.totalBytesWritten;
        const ratio = total > 0 ? written / total : 0;
        if (onProgress) {
          onProgress(ratio, written, total);
        }
      }
    );

    const downloadResult = await downloadResumable.downloadAsync();
    if (!downloadResult || !downloadResult.uri) {
      throw new Error('Файл не был успешно сохранён на устройство');
    }

    if (onProgress) {
      onProgress(1, 100, 100);
    }

    // Convert file:// to content:// URI using Expo's FileProvider.
    const contentUri = await FileSystem.getContentUriAsync(downloadResult.uri);

    // Launch Android Package Installer via VIEW Intent.
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1, // Intent.FLAG_GRANT_READ_URI_PERMISSION
      type: 'application/vnd.android.package-archive',
    });

    return { success: true };
  } catch (err: any) {
    console.error('[UpdateService] APK installation error:', err);
    return {
      success: false,
      error: err?.message || 'Не удалось запустить установку APK',
    };
  }
}

/**
 * Direct shortcut to Android Unknown App Sources permission screen
 * (android.settings.MANAGE_UNKNOWN_APP_SOURCES) for PartySplit.
 */
export async function openUnknownAppSourcesPermission(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      const IntentLauncher = await import('expo-intent-launcher');
      await IntentLauncher.startActivityAsync(
        'android.settings.MANAGE_UNKNOWN_APP_SOURCES',
        {
          data: 'package:com.partysplit.app',
        }
      );
      return;
    } catch {
      // Fallback to app info settings
    }
  }

  try {
    await Linking.openSettings();
  } catch (err) {
    console.warn('[UpdateService] Could not open settings:', err);
  }
}
