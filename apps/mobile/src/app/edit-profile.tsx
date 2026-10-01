import { defaultRules, displayNameSchema, type MeResponse, type UpdateProfileInput } from '@feedants/shared';
import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { avatarUploadUrl, useUpdateProfile } from '@/api/hooks';
import { useRequireSignIn, useSession } from '@/auth/session';
import { Loading } from '@/design/loading';
import { BackHeader, Input, PersonAvatar, Press, SheetButton } from '@/design/components';
import { Camera, Lock } from '@/design/icons';
import { T } from '@/design/text';
import tw, { color } from '@/design/tw';
import { errorMessage } from '@/lib/format';
import { pickImage, uploadToStorage } from '@/media/media';

/**
 * US-05: name, avatar and bio — the prototype's EditProfile (ProfilePage.tsx) as a page.
 * Handle, city, phone and generated avatar styles are out of scope; email is the sign-in
 * identity and shown read-only. Changes reach hosted competitions via `user.updated`.
 */
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
    <SafeAreaView style={tw`flex-1 bg-canvas`} edges={['top', 'bottom']}>
      <View style={tw`flex-1 w-full max-w-[430px] self-center`}>
        <BackHeader subtitle={t('profileUi.eyebrow')} title={t('profile.edit')} />
        <ScrollView
          contentContainerStyle={tw`px-5 pt-2 pb-8 gap-4`}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar + upload */}
          <View style={tw`items-center gap-3`}>
            <View>
              <PersonAvatar
                uri={preview}
                name={name || initial.email}
                index={0}
                size={96}
                style={[
                  tw`rounded-3xl`,
                  {
                    boxShadow: '0 0 0 2px #fff, 0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
                  },
                ]}
              />
              <Press
                onPress={() => void changeAvatar()}
                disabled={uploading !== null}
                accessibilityLabel={t('profile.avatar')}
                scale={0.95}
                style={[
                  tw`absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-teal items-center justify-center`,
                  {
                    boxShadow:
                      '0 0 0 2px #fff, 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
                  },
                ]}
              >
                <Camera color="#fff" />
              </Press>
            </View>
            {uploading !== null ? (
              <View
                style={tw`w-40 h-1.5 rounded-full bg-mint overflow-hidden`}
                accessibilityLiveRegion="polite"
              >
                <View
                  style={[tw`h-full rounded-full bg-teal`, { width: `${Math.round(uploading * 100)}%` }]}
                />
              </View>
            ) : preview ? (
              <Pressable
                onPress={() => {
                  setAvatarKey(null);
                  setPreview(null);
                }}
                accessibilityRole="button"
                hitSlop={8}
              >
                <T style={tw`text-xs font-semibold text-slate`}>{t('profile.removeAvatar')}</T>
              </Pressable>
            ) : (
              <T style={tw`text-xs font-semibold text-slate`}>{t('profileUi.addPhoto')}</T>
            )}
          </View>

          {error ? (
            <View style={tw`rounded-xl bg-rose-50 px-3.5 py-2.5`} accessibilityLiveRegion="polite">
              <T style={tw`text-xs font-semibold text-rose-500`}>{error}</T>
            </View>
          ) : null}

          <Field
            label={t('profileUi.fullName')}
            error={name && !nameOk ? t('profileUi.nameRule', defaultRules.text) : null}
          >
            <Input
              value={name}
              onChangeText={setName}
              maxLength={defaultRules.text.displayNameMax}
              autoComplete="name"
              accessibilityLabel={t('profileUi.fullName')}
            />
          </Field>

          <Field label={t('profile.bio')}>
            <Input
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={3}
              maxLength={defaultRules.text.bioMax}
              placeholder={t('profileUi.bioPlaceholder')}
              accessibilityLabel={t('profile.bio')}
              style={tw`h-[92px]`}
            />
            <T style={tw`mt-1 text-right text-[11px] text-slate`}>
              {bio.length}/{defaultRules.text.bioMax}
            </T>
          </Field>

          <Field label={t('profileUi.email')}>
            <Input
              value={initial.email}
              editable={false}
              accessibilityLabel={t('profileUi.email')}
              icon={<Lock size={16} color={color('slate')} />}
              style={tw`text-slate`}
            />
            <T style={tw`mt-1 text-[11px] text-slate`}>{t('profileUi.emailNote')}</T>
          </Field>

          <SheetButton
            title={t('profileUi.save')}
            onPress={save}
            loading={update.isPending}
            disabled={!nameOk || uploading !== null}
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

/** EditProfile Field: `text-xs font-semibold text-slate` label, `mt-1`, rose error line. */
function Field({ label, error, children }: { label: string; error?: string | null; children: ReactNode }) {
  return (
    <View>
      <T style={tw`text-xs font-semibold text-slate`}>{label}</T>
      <View style={tw`mt-1`}>{children}</View>
      {error ? <T style={tw`mt-1 text-[11px] font-medium text-rose-500`}>{error}</T> : null}
    </View>
  );
}
