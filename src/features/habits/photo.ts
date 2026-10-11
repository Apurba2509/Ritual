import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';
import { uploadImage } from '@/lib/cloudinary';

/** Ask camera vs library (native), pick, compress and upload. Returns the hosted URL or null if cancelled. */
export async function pickAndUpload(folder: 'checkins' | 'avatars', square = false): Promise<string | null> {
  const source = await chooseSource();
  if (!source) return null;
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.7,
    allowsEditing: true,
    aspect: square ? [1, 1] : [4, 3],
  };
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Camera permission is needed to take a photo.');
    result = await ImagePicker.launchCameraAsync(opts);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(opts);
  }
  if (result.canceled || !result.assets[0]) return null;
  return uploadImage(result.assets[0].uri, folder);
}

function chooseSource(): Promise<'camera' | 'library' | null> {
  if (Platform.OS === 'web') return Promise.resolve('library');
  return new Promise((resolve) =>
    Alert.alert('Add a photo', undefined, [
      { text: 'Take photo', onPress: () => resolve('camera') },
      { text: 'Choose from library', onPress: () => resolve('library') },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ]),
  );
}
