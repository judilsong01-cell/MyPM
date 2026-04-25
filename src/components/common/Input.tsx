import React from 'react';
import { StyleProp, StyleSheet, TextInput, TextInputProps, TextStyle } from 'react-native';

import { BORDER_RADIUS, COLORS, FONTS, SPACING } from '../../constants';

type Props = TextInputProps & {
  inputStyle?: StyleProp<TextStyle>;
};

export const Input = ({ inputStyle, ...props }: Props) => (
  <TextInput
    placeholderTextColor={COLORS.textMuted}
    {...props}
    style={[styles.input, inputStyle]}
  />
);

const styles = StyleSheet.create({
  input: {
    height: 52,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
});
