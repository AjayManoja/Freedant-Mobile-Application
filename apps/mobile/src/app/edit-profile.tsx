import { defaultRules, displayNameSchema, type MeResponse, type UpdateProfileInput } from '@feedants/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { avatarUploadUrl, useUpdateProfile } from '@/api/hooks';
import { useRequireSignIn, useSession } from '@/auth/session';
import {
  AppText,
  Avatar,
  Button,
  Field,
  Header,
  Loading,
  Notice,
  ProgressBar,
  Row,
  Screen,
} from '@/components/ui';
import { errorMessage } from '@/lib/format';
import { pickImage, uploadToStorage } from '@/media/media';
import { space } from '@/theme/tokens';

/** US-05: name, avatar and bio. Changes reach hosted competitions via `user.updated`. */
export default function EditProfile() {
  const signedIn = useRequireSignIn('/edit-profile');
  const user = useSession((s) => s.user);
  if (!signedIn || !user) return <Loading />;
  return <Form initial={user} />;
}

function Form({ initial }: { initial: MeResponse }) {
  const { t } = useTranslation();
  const router = useRouter();
  const update = useUpdateProfile();
  const [name, setName] = useState(initial.displayName ?? '');
  const [bio, setBio] = useState(initial.bio ?? '');
  // undefined = unchanged, null = remove, string = newly uploaded object key.
  const [avatarKey, setAvatarKey] = useState<string | null | undefined>(undefined);
  const [preview, setPreview] = useState<string | null>(initial.avatarUrl);
  const [uploading, setUploading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameOk = displayNameSchema.safeParse(name).success;

  const changeAvatar = async () => {
    setError(null);
    try {
      const file = await pickImage(defaultRules.media.IMAGE.maxBytes);
      setUploading(0);
      const target = await avatarUploadUrl(file.contentType, file.sizeBytes);
      await uploadToStorage(target, file, setUploading);
      setAvatarKey(target.key);
      setPreview(file.uri);
    } catch (e) {
      if ((e as { reason?: string }).reason !== 'cancelled') setError(errorMessage(e, t));
    } finally {
      setUploading(null);
    }
  };

  const save = () => {
    setError(null);
    const input: UpdateProfileInput = {};
    if (name.trim() !== (initial.displayName ?? '')) input.displayName = name.trim();
    if (bio.trim() !== (initial.bio ?? '')) input.bio = bio.trim() || null;
    if (avatarKey !== undefined) input.avatarKey = avatarKey;
    if (Object.keys(input).length === 0) return router.back();
    update.mutate(input, {
      onSuccess: () => router.back(),
      onError: (e) => setError(errorMessage(e, t)),
    });
  };

  return (
    <Screen
      edges={['top', 'bottom']}
      footer={
        <Button
          title={t('common.save')}
          onPress={save}
          loading={update.isPending}
          disabled={!nameOk || uploading !== null}
        />
      }
    >
      <Header title={t('profile.edit')} onBack={() => router.back()} />
      <View style={styles.avatar}>
        <Avatar uri={preview} name={name || initial.email} size={96} />
        {uploading !== null ? (
          <View style={styles.progress}>
            <ProgressBar value={uploading} />
          </View>
        ) : null}
        <Row>
          <Button
            title={t('profile.avatar')}
            kind="secondary"
            icon="camera-outline"
            onPress={() => void changeAvatar()}
            disabled={uploading !== null}
          />
          {preview ? (
            <Button
              title={t('profile.removeAvatar')}
              kind="ghost"
              onPress={() => {
                setAvatarKey(null);
                setPreview(null);
              }}
              disabled={uploading !== null}
            />
          ) : null}
        </Row>
      </View>
      {error ? <Notice tone="danger" icon="alert-circle-outline" text={error} /> : null}
      <Field
        label={t('profile.nameLabel')}
        value={name}
        onChangeText={setName}
        maxLength={defaultRules.text.displayNameMax}
        autoComplete="name"
        error={name && !nameOk ? t('errors.VALIDATION_FAILED') : null}
        hint={`${defaultRules.text.displayNameMin}–${defaultRules.text.displayNameMax}`}
      />
      <Field
        label={t('profile.bio')}
        value={bio}
        onChangeText={setBio}
        multiline
        maxLength={defaultRules.text.bioMax}
        hint={`${bio.trim().length}/${defaultRules.text.bioMax}`}
      />
      <AppText variant="caption">{initial.email}</AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', gap: space.md },
  progress: { alignSelf: 'stretch' },
});
