import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { BORDER_RADIUS, COLORS, FONTS, SPACING } from '../../constants';

type Variant = 'primary' | 'secondary' | 'outline' | 'success' | 'danger' | 'ghost';

type Props = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
  left?: React.ReactNode;
};

export const Button = ({
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  style,
  left,
}: Props) => {
  const isDisabled = !!disabled || !!loading;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? COLORS.primary : '#fff'} />
      ) : (
        <View style={styles.row}>
          {left ? <View style={styles.left}>{left}</View> : null}
          <Text style={[styles.text, textVariantStyles[variant]]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  left: { marginRight: SPACING.sm },
  text: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
  },
  pressed: { transform: [{ scale: 0.99 }], opacity: 0.95 },
  disabled: { opacity: 0.6 },
});

const variantStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: COLORS.primary },
  secondary: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.primary },
  // Success uses the same semantic color as "income"
  // (used for "Venda" and positive actions).
  success: { backgroundColor: COLORS.income },
  danger: { backgroundColor: COLORS.expense },
  ghost: { backgroundColor: 'transparent' },
};

const textVariantStyles: Record<Variant, any> = {
  primary: { color: '#fff' },
  secondary: { color: COLORS.text },
  outline: { color: COLORS.primary },
  success: { color: '#fff' },
  danger: { color: '#fff' },
  ghost: { color: COLORS.primary },
};
