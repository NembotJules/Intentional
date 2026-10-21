/**
 * TextPromptSheet — an in-app bottom sheet asking for one short line of text.
 * Replaces `Alert.prompt` (iOS-only; a no-op on Android and web).
 */
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Elevation, FontFamily, Radius, Surface, hexToRgba } from '@/constants/design';
import { PrimaryButton } from '@/components/PrimaryButton';
import { sandInputStyle } from '@/components/ui/PillarForm';

export function TextPromptSheet({
  visible,
  title,
  message,
  placeholder = 'One line (optional)',
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  maxLength = 140,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  maxLength?: number;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  useEffect(() => {
    if (visible) setText('');
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          onPress={onCancel}
          accessibilityLabel="Close"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: hexToRgba(Surface.ink, 0.38) }}
        />
        <View
          style={{
            backgroundColor: Surface.canvas,
            borderTopLeftRadius: Radius.xl,
            borderTopRightRadius: Radius.xl,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 28,
            ...Elevation.floating,
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 14 }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: Surface.ruleStrong }} />
          </View>
          <Text accessibilityRole="header" style={{ fontFamily: FontFamily.bodyBold, fontSize: 22, lineHeight: 28, color: Surface.ink }}>
            {title}
          </Text>
          {message ? (
            <Text style={{ fontFamily: FontFamily.body, fontSize: 16, lineHeight: 22, color: Surface.muted, marginTop: 6 }}>{message}</Text>
          ) : null}
          <TextInput
            value={text}
            onChangeText={(t) => setText(t.replace(/\n/g, ' ').slice(0, maxLength))}
            placeholder={placeholder}
            placeholderTextColor={Surface.faint}
            maxLength={maxLength}
            accessibilityLabel={title}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => onConfirm(text.trim())}
            style={[sandInputStyle, { height: 58, marginTop: 16, fontSize: 17 }]}
          />
          <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: Surface.faint, textAlign: 'right', marginTop: 6 }}>
            {text.length} / {maxLength}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton title={cancelLabel} appearance="ghost" color={Surface.muted} size="small" onPress={onCancel} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton title={confirmLabel} size="small" onPress={() => onConfirm(text.trim())} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
