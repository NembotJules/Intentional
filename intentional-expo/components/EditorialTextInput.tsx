import { useState } from 'react';
import {
  TextInput,
  type TextInputProps,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { Colors, Surface, ghostBorder, Radius } from '@/constants/design';

type Variant = 'underline' | 'contained';

type EditorialTextInputProps = Omit<TextInputProps, 'style'> & {
  variant?: Variant;
  style?: StyleProp<TextStyle>;
};

/**
 * v1.1 addendum §3 — underline: bottom border only, transparent bg.
 * §9 exception — contained: multi-line Why uses surface + ghost border.
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
        className="px-3 py-3 text-[12px] text-text-primary"
        style={[
          {
            fontFamily: 'SpaceMono',
            lineHeight: 20,
            backgroundColor: Surface.container,
            borderWidth: 0.5,
            borderColor: focused ? Colors.textPrimary : ghostBorder,
            borderRadius: Radius.sm,
            minHeight: multiline ? 80 : undefined,
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
          borderBottomColor: focused ? Colors.textPrimary : Colors.textDim,
          borderRadius: 0,
          paddingVertical: isMulti ? 12 : 14,
          paddingHorizontal: 0,
          fontSize: isMulti ? 12 : 22,
          fontWeight: isMulti ? undefined : '700',
          letterSpacing: isMulti ? 0.3 : -0.5,
          color: Colors.textPrimary,
          fontFamily: isMulti ? 'SpaceMono' : undefined,
        },
        style,
      ]}
    />
  );
}
