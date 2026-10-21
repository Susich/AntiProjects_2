import * as Clipboard from 'expo-clipboard';

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch (error) {
    console.warn('[Clipboard] Failed to copy text:', error);
    return false;
  }
}
