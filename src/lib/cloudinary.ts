import { Platform } from 'react-native';

/**
 * Photo uploads go straight from the device to Cloudinary using an *unsigned* upload
 * preset (no API secret in the app). The preset should restrict formats, size and folder.
 */

const CLOUD = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export const cloudinaryConfigured = !!(CLOUD && PRESET);

export async function uploadImage(uri: string, folder: 'checkins' | 'avatars'): Promise<string> {
  if (!cloudinaryConfigured) throw new Error('Photo uploads are not configured.');
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    form.append('file', blob, 'photo.jpg');
  } else {
    // React Native's FormData accepts { uri, name, type } file descriptors.
    form.append('file', { uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
  }
  form.append('upload_preset', PRESET!);
  form.append('folder', `ritual/${folder}`);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: 'POST', body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg: string = json?.error?.message ?? `Upload failed (${res.status})`;
    if (/preset/i.test(msg))
      throw new Error('Cloudinary upload preset not found or not unsigned. See README → Cloudinary.');
    throw new Error(msg);
  }
  return json.secure_url as string;
}

/** Cloudinary on-the-fly transformation for thumbnails (saves bandwidth). */
export function thumb(url: string, size = 240): string {
  if (!url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/c_fill,g_auto,w_${size},h_${size},q_auto,f_auto/`);
}
