import { Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { copyToClipboard } from './clipboard';
import { triggerImpact } from './haptics';

export interface SharePartyInviteParams {
  partyCode: string;
  partyTitle: string;
  partyId?: string;
}

/**
 * Builds friendly invitation message text with room code and instructions.
 */
export function generatePartyInviteText(title: string, code: string): string {
  const titlePart = title ? `«${title}»` : 'тусовку';
  return `🎉 Приглашаю на ${titlePart} в PartySplit!\n🔑 Код комнаты: ${code || '—'}\n\nОтсканируй QR-код камерой в приложении PartySplit или введи код вручную, чтобы подключиться! ✨`;
}

/**
 * Shares QR code PNG image along with copying friendly invitation text to clipboard
 * and invoking system share sheet with invitation title.
 */
export async function sharePartyInvite({
  partyCode,
  partyTitle,
  partyId,
}: SharePartyInviteParams): Promise<boolean> {
  void triggerImpact();

  const inviteText = generatePartyInviteText(partyTitle, partyCode);
  const cleanCode = partyCode || partyId || 'party';
  const qrPayload = `partysplit://join/${cleanCode}`;
  const fileUri = `${FileSystem.cacheDirectory}PartySplit_QR_${cleanCode}.png`;

  let hasFile = false;
  try {
    const encodedPayload = encodeURIComponent(qrPayload);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodedPayload}&margin=20&bgcolor=FFFFFF&color=0B0E14`;
    const dlResult = await FileSystem.downloadAsync(qrUrl, fileUri);
    if (dlResult.status === 200) {
      hasFile = true;
    }
  } catch {
    hasFile = false;
  }

  const isSharingAvailable = await Sharing.isAvailableAsync();

  if (hasFile && isSharingAvailable) {
    await copyToClipboard(inviteText);
    await Sharing.shareAsync(fileUri, {
      mimeType: 'image/png',
      dialogTitle: `🎉 Приглашаю на тусовку «${partyTitle || 'PartySplit'}» (Код: ${partyCode})`,
      UTI: 'public.png',
    });
    return true;
  } else {
    await Share.share({ message: inviteText });
    return true;
  }
}
