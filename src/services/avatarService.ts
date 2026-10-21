import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export interface PickedAvatarResult {
  uri: string;
  base64?: string;
}

/**
 * Requests gallery permission and opens image picker with square crop.
 */
export async function pickAvatarFromGallery(): Promise<PickedAvatarResult | null> {
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
    return {
      uri: asset.uri,
      base64: asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : undefined,
    };
  } catch (err) {
    console.warn('[AvatarService] Failed to pick avatar from gallery:', err);
    return null;
  }
}

/**
 * Requests camera permission and takes square photo.
 */
export async function takeAvatarWithCamera(): Promise<PickedAvatarResult | null> {
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
    return {
      uri: asset.uri,
      base64: asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : undefined,
    };
  } catch (err) {
    console.warn('[AvatarService] Failed to take photo with camera:', err);
    return null;
  }
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
