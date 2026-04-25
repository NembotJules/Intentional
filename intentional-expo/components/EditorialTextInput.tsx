import { useState } from 'react';
import {
  TextInput,
  type TextInputProps,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { Colors, FontFamily, Surface, ghostBorder, Radius } from '@/constants/design';

type Variant = 'underline' | 'contained';

type EditorialTextInputProps = Omit<TextInputProps, 'style'> & {
  variant?: Variant;
  style?: StyleProp<TextStyle>;
};

/**
 * Quiet Ledger inputs should feel like writing on paper, not SaaS chrome.
 */
export function EditorialTextInput({
  variant = 'underline',
  style,
  multiline,
  onFocus,
  onBlur,
  placeholderTextColor,
  textAlignVertical,
  ...rest
}: EditorialTextInputProps) {
  const [focused, setFocused] = useState(false);

  if (variant === 'contained') {
    return (
      <TextInput
        {...rest}
        multiline={multiline}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        placeholderTextColor={placeholderTextColor ?? Colors.textGhost}
        textAlignVertical={multiline ? 'top' : textAlignVertical}
        className="px-4 py-3 text-text-primary"
        style={[
          {
            fontFamily: FontFamily.body,
            fontSize: 17,
            lineHeight: 24,
            backgroundColor: Surface.surface,
            borderWidth: 1,
            borderColor: focused ? Surface.ruleStrong : ghostBorder,
            borderRadius: Radius.md,
            minHeight: multiline ? 112 : undefined,
            color: Colors.textPrimary,
          },
          style,
        ]}
      />
    );
  }

  const isMulti = !!multiline;
  return (
    <TextInput
      {...rest}
      multiline={multiline}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      placeholderTextColor={placeholderTextColor ?? Colors.textGhost}
      textAlignVertical={isMulti ? 'top' : textAlignVertical}
      style={[
        {
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderBottomWidth: 1,
          borderBottomColor: focused ? Surface.ruleStrong : Surface.rule,
          borderRadius: 0,
          paddingVertical: isMulti ? 12 : 14,
          paddingHorizontal: 0,
          fontSize: isMulti ? 17 : 24,
          lineHeight: isMulti ? 24 : 30,
          letterSpacing: isMulti ? 0 : -0.2,
          color: Colors.textPrimary,
          fontFamily: isMulti ? FontFamily.body : FontFamily.bodySemiBold,
        },
        style,
      ]}
    />
  );
}
