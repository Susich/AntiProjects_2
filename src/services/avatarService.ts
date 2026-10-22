import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export interface PickedAvatarResult {
  uri: string;
  dataUrl: string;
}

/**
 * Persists avatar to local permanent storage so it survives cache cleanup.
 */
export async function saveAvatarLocally(uri: string, userId: string): Promise<string> {
  if (Platform.OS === 'web' || !uri || !uri.startsWith('file://')) {
    return uri;
  }

  try {
    const FileSystem = await import('expo-file-system/legacy');
    const docDir = FileSystem.documentDirectory;
    if (!docDir) return uri;

    const targetPath = `${docDir}avatar_${userId}_${Date.now()}.jpg`;
    await FileSystem.copyAsync({
      from: uri,
      to: targetPath,
    });

    return targetPath;
  } catch (err) {
    console.warn('[AvatarService] Could not persist avatar locally, fallback to original uri:', err);
    return uri;
  }
}

/**
 * Resizes the picked image to a square 120x120 thumbnail and creates
 * a compact base64 data URL that can be synced across devices via Google Sheets.
 */
export async function processAndSaveAvatar(
  rawUri: string,
  userId: string
): Promise<PickedAvatarResult> {
  try {
    const manipulated = await manipulateAsync(
      rawUri,
      [{ resize: { width: 120, height: 120 } }],
      { compress: 0.6, format: SaveFormat.JPEG, base64: true }
    );

    const localUri = await saveAvatarLocally(manipulated.uri, userId);
    let dataUrl: string;

    if (manipulated.base64) {
      dataUrl = `data:image/jpeg;base64,${manipulated.base64}`;
    } else {
      try {
        const FileSystem = await import('expo-file-system/legacy');
        const b64 = await FileSystem.readAsStringAsync(localUri, {
          encoding: 'base64',
        });
        dataUrl = `data:image/jpeg;base64,${b64}`;
      } catch {
        dataUrl = localUri;
      }
    }

    return {
      uri: localUri,
      dataUrl,
    };
  } catch (err) {
    console.warn('[AvatarService] Image resize error, fallback to direct save:', err);
    const localUri = await saveAvatarLocally(rawUri, userId);
    let dataUrl = localUri;
    try {
      const FileSystem = await import('expo-file-system/legacy');
      const b64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: 'base64',
      });
      dataUrl = `data:image/jpeg;base64,${b64}`;
    } catch {
      // fallback to localUri
    }
    return {
      uri: localUri,
      dataUrl,
    };
  }
}

/**
 * Requests gallery permission, opens image picker with 1:1 crop,
 * and produces a compact cross-device syncable avatar.
 */
export async function pickAvatarFromGallery(userId: string): Promise<PickedAvatarResult | null> {
  try {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    return await processAndSaveAvatar(asset.uri, userId);
  } catch (err) {
    console.warn('[AvatarService] Failed to pick avatar from gallery:', err);
    return null;
  }
}

/**
 * Requests camera permission, takes a square photo,
 * and produces a compact cross-device syncable avatar.
 */
export async function takeAvatarWithCamera(userId: string): Promise<PickedAvatarResult | null> {
  try {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    return await processAndSaveAvatar(asset.uri, userId);
  } catch (err) {
    console.warn('[AvatarService] Failed to take photo with camera:', err);
    return null;
  }
}
