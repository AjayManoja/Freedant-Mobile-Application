import { defaultRules, type MediaKind, mediaKindOf, type UploadUrlResponse } from '@feedants/shared';
import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export interface PickedFile {
  uri: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  kind: MediaKind;
}

export class MediaError extends Error {
  constructor(
    readonly reason: 'unsupported' | 'too-large' | 'cancelled',
    readonly maxBytes?: number,
  ) {
    super(reason);
  }
}

const IMAGE_MAX_EDGE = 1600;

/** NFR-PF-05: images are resized and re-encoded on the device before upload. */
async function compressImage(uri: string): Promise<{ uri: string; sizeBytes: number }> {
  const context = ImageManipulator.manipulate(uri).resize({ width: IMAGE_MAX_EDGE });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return { uri: saved.uri, sizeBytes: await sizeOf(saved.uri) };
}

async function sizeOf(uri: string): Promise<number> {
  const blob = await (await fetch(uri)).blob();
  return blob.size;
}

/** US-24: rejected before any upload starts when the type or size is wrong (A-23). */
function validate(contentType: string, sizeBytes: number, allowed: MediaKind[]): MediaKind {
  const kind = mediaKindOf(contentType);
  if (!kind || !allowed.includes(kind)) throw new MediaError('unsupported');
  const max = defaultRules.media[kind].maxBytes;
  if (sizeBytes > max) throw new MediaError('too-large', max);
  return kind;
}

export async function pickImage(maxBytes?: number): Promise<PickedFile> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (res.canceled || !res.assets[0]) throw new MediaError('cancelled');
  const compressed = await compressImage(res.assets[0].uri);
  if (maxBytes && compressed.sizeBytes > maxBytes) throw new MediaError('too-large', maxBytes);
  validate('image/jpeg', compressed.sizeBytes, ['IMAGE']);
  return {
    uri: compressed.uri,
    name: 'image.jpg',
    contentType: 'image/jpeg',
    sizeBytes: compressed.sizeBytes,
    kind: 'IMAGE',
  };
}

export async function pickVideo(): Promise<PickedFile> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], videoQuality: 1 });
  const a = res.canceled ? undefined : res.assets[0];
  if (!a) throw new MediaError('cancelled');
  const contentType = a.mimeType ?? 'video/mp4';
  const sizeBytes = a.fileSize ?? (await sizeOf(a.uri));
  const kind = validate(contentType, sizeBytes, ['VIDEO']);
  return { uri: a.uri, name: a.fileName ?? 'video.mp4', contentType, sizeBytes, kind };
}

export async function pickAudio(): Promise<PickedFile> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['audio/mpeg', 'audio/mp4', 'audio/x-m4a'] });
  const a = res.canceled ? undefined : res.assets[0];
  if (!a) throw new MediaError('cancelled');
  const contentType = a.mimeType === 'audio/m4a' ? 'audio/mp4' : (a.mimeType ?? 'audio/mpeg');
  const sizeBytes = a.size ?? (await sizeOf(a.uri));
  const kind = validate(contentType, sizeBytes, ['AUDIO']);
  return { uri: a.uri, name: a.name, contentType, sizeBytes, kind };
}

/**
 * Presigned POST straight to object storage (NFR-PF-05): the API never proxies media.
 * XMLHttpRequest is used because fetch has no upload progress events.
 */
export async function uploadToStorage(
  target: UploadUrlResponse,
  file: PickedFile,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const form = new FormData();
  for (const [k, v] of Object.entries(target.fields)) form.append(k, v);
  if (Platform.OS === 'web') {
    form.append('file', await (await fetch(file.uri)).blob(), file.name);
  } else {
    // React Native's FormData accepts a { uri, name, type } descriptor for files.
    form.append('file', { uri: file.uri, name: file.name, type: file.contentType } as unknown as Blob);
  }
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', target.url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload ${xhr.status}`));
    xhr.onerror = () => reject(new Error('upload failed'));
    xhr.send(form);
  });
  onProgress?.(1);
}
