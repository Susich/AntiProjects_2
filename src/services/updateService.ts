import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { DEFAULT_GOOGLE_SCRIPT_URL, getGoogleScriptUrl } from '../api/googleSheets';
import { CURRENT_APP_VERSION } from '../config/version';
import { compareVersions, isUpdateAvailable, parseSemver } from '../utils/semver';

export { CURRENT_APP_VERSION, compareVersions, isUpdateAvailable, parseSemver };
export const DEFAULT_GOOGLE_DRIVE_APK_FILE_ID = '1Xj-OHVMDlsZKlZfOqkJPza-RSejNJH4M';
export const LAST_UPDATE_CHECK_KEY = '@partysplit:last_update_check';
export const DISMISSED_UPDATE_VERSION_KEY = '@partysplit:dismissed_update_version';
export const INSTALLED_APP_VERSION_KEY = '@partysplit:installed_version';

/**
 * Returns current installed app version from the single source of truth configuration.
 */
export async function getCurrentAppVersion(): Promise<string> {
  let highest = CURRENT_APP_VERSION;

  try {
    const saved = await AsyncStorage.getItem(INSTALLED_APP_VERSION_KEY);
    if (saved && typeof saved === 'string' && compareVersions(saved, highest) > 0) {
      highest = saved;
    }
  } catch {
    // Ignore storage errors
  }

  try {
    const nativeVer = Application.nativeApplicationVersion;
    if (nativeVer && typeof nativeVer === 'string' && /^\d+\.\d+/.test(nativeVer)) {
      if (compareVersions(nativeVer, highest) > 0) {
        highest = nativeVer;
      }
    }
  } catch {
    // Ignore in unsupported environments (e.g. web or dev client)
  }

  return highest;
}

export async function markVersionAsInstalled(version: string): Promise<void> {
  try {
    await AsyncStorage.setItem(INSTALLED_APP_VERSION_KEY, version);
  } catch (err) {
    console.warn('[UpdateService] Failed to save installed version:', err);
  }
}

export interface VersionConfig {
  latestVersion: string;
  apkUrl: string;
  googleDriveFileId?: string;
  releaseNotes?: string;
  forceUpdate?: boolean;
  minSupportedVersion?: string;
  publishedAt?: string;
  fileSizeMb?: number;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  apkUrl: string;
  releaseNotes?: string;
  fileSizeMb?: number;
  config: VersionConfig;
}

export type DownloadProgressCallback = (
  progress: number,
  bytesDownloaded: number,
  totalBytes: number
) => void;

/**
 * Converts any Google Drive shareable URL, preview URL or file ID
 * into a direct APK download link that bypasses viewer screens.
 */
export function formatGoogleDriveDirectUrl(urlOrId: string): string {
  if (!urlOrId) {
    return `https://drive.usercontent.google.com/download?id=${DEFAULT_GOOGLE_DRIVE_APK_FILE_ID}&export=download&confirm=t`;
  }

  // Already a direct usercontent link
  if (urlOrId.includes('drive.usercontent.google.com/download')) {
    return urlOrId.includes('confirm=t') ? urlOrId : `${urlOrId}&confirm=t`;
  }

  // Already a google drive export download link
  if (urlOrId.includes('drive.google.com/uc?export=download')) {
    return urlOrId;
  }

  // Extract ID from various formats
  let fileId = '';
  const idParamMatch = urlOrId.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  const fileDMatch = urlOrId.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const dMatch = urlOrId.match(/\/d\/([a-zA-Z0-9_-]+)/);

  if (idParamMatch && idParamMatch[1]) {
    fileId = idParamMatch[1];
  } else if (fileDMatch && fileDMatch[1]) {
    fileId = fileDMatch[1];
  } else if (dMatch && dMatch[1]) {
    fileId = dMatch[1];
  } else if (/^[a-zA-Z0-9_-]{20,}$/.test(urlOrId.trim())) {
    fileId = urlOrId.trim();
  }

  if (fileId) {
    return `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
  }

  return urlOrId;
}

/**
 * Checks for updates by querying the version config from Google Apps Script / Google Sheets.
 */
export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = await getCurrentAppVersion();
  const scriptUrl = (await getGoogleScriptUrl()) || DEFAULT_GOOGLE_SCRIPT_URL;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const queryUrl = `${scriptUrl}${
      scriptUrl.includes('?') ? '&' : '?'
    }action=getLatestVersion&_ts=${Date.now()}`;

    const res = await fetch(queryUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.latestVersion) {
        const config: VersionConfig = {
          latestVersion: data.latestVersion,
          apkUrl: formatGoogleDriveDirectUrl(data.apkUrl || data.googleDriveFileId),
          googleDriveFileId: data.googleDriveFileId || DEFAULT_GOOGLE_DRIVE_APK_FILE_ID,
          releaseNotes:
            data.releaseNotes ||
            'Исправление синхронизации и багов верстки',
          minSupportedVersion: data.minSupportedVersion || '1.0.0',
          fileSizeMb: data.fileSizeMb || 42,
          publishedAt: data.publishedAt,
        };

        const hasUpdate = isUpdateAvailable(config.latestVersion, currentVersion);
        await AsyncStorage.setItem(LAST_UPDATE_CHECK_KEY, Date.now().toString());

        return {
          hasUpdate,
          currentVersion,
          latestVersion: config.latestVersion,
          apkUrl: config.apkUrl,
          releaseNotes: config.releaseNotes,
          fileSizeMb: config.fileSizeMb,
          config,
        };
      }
    }
  } catch (err) {
    console.warn('[UpdateService] Version check network warning:', err);
  }

  // Safe fallback default config
  const fallbackConfig: VersionConfig = {
    latestVersion: '1.0.5',
    apkUrl: formatGoogleDriveDirectUrl(DEFAULT_GOOGLE_DRIVE_APK_FILE_ID),
    googleDriveFileId: DEFAULT_GOOGLE_DRIVE_APK_FILE_ID,
    releaseNotes: 'Исправление синхронизации и багов верстки',
    fileSizeMb: 42,
  };

  const hasUpdate = isUpdateAvailable(fallbackConfig.latestVersion, currentVersion);

  return {
    hasUpdate,
    currentVersion,
    latestVersion: fallbackConfig.latestVersion,
    apkUrl: fallbackConfig.apkUrl,
    releaseNotes: fallbackConfig.releaseNotes,
    fileSizeMb: fallbackConfig.fileSizeMb,
    config: fallbackConfig,
  };
}

/**
 * Downloads the APK with progress reporting and initiates the native Android installer.
 */
export async function downloadAndInstallApk(
  apkUrl: string,
  onProgress?: DownloadProgressCallback,
  targetVersion?: string
): Promise<{ success: boolean; error?: string }> {
  const directUrl = formatGoogleDriveDirectUrl(apkUrl);

  // Web fallback: triggers native browser download
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.open(directUrl, '_blank');
      return { success: true };
    }
    return { success: false, error: 'Не удалось запустить загрузку в браузере' };
  }

  if (Platform.OS !== 'android') {
    await Linking.openURL(directUrl);
    return { success: true };
  }

  try {
    // Dynamic import to support Expo SDK 58
    const FileSystem = await import('expo-file-system/legacy');
    const IntentLauncher = await import('expo-intent-launcher');

    const downloadDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (!downloadDir) {
      throw new Error('Локальное хранилище недоступно');
    }

    const localApkPath = `${downloadDir}partysplit_update_${Date.now()}.apk`;

    const downloadResumable = FileSystem.createDownloadResumable(
      directUrl,
      localApkPath,
      {},
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
      throw new Error('Файл не был успешно сохранен на устройство');
    }

    if (onProgress) {
      onProgress(1, 100, 100);
    }

    // Convert file:// to content:// URI using Expo's FileProvider
    const contentUri = await FileSystem.getContentUriAsync(downloadResult.uri);

    // Launch Android Package Installer via VIEW Intent
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1, // Intent.FLAG_GRANT_READ_URI_PERMISSION
      type: 'application/vnd.android.package-archive',
    });

    if (targetVersion) {
      await markVersionAsInstalled(targetVersion);
    }

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
