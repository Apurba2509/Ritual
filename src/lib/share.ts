import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';
import { toast } from '@/data/ui';

/**
 * Share text everywhere: the native share sheet on phones, the Web Share API where browsers
 * support it, and copy-to-clipboard otherwise (desktop browsers).
 */
export async function shareText(message: string, opts: { title?: string } = {}) {
  try {
    if (Platform.OS !== 'web') {
      await Share.share({ message, title: opts.title });
      return;
    }
    const nav =
      typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }) : null;
    if (nav?.share) {
      await nav.share({ text: message, title: opts.title });
      return;
    }
    await Clipboard.setStringAsync(message);
    toast('Copied. Paste it anywhere to share', { icon: 'copy', tone: 'success' });
  } catch {
    // dismissed share sheet — nothing to do
  }
}
