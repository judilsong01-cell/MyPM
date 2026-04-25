import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { BORDER_RADIUS, COLORS, FONTS, SPACING } from '../../constants';

type Tone = 'blue' | 'green' | 'red' | 'amber' | 'gray';

type Props = {
  label: string;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
};

export const Badge = ({ label, tone = 'gray', style }: Props) => (
  <View style={[styles.base, toneStyles[tone], style]}>
    <Text style={[styles.text, textToneStyles[tone]]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semibold,
  },
});

const toneStyles: Record<Tone, ViewStyle> = {
  blue: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primaryLight },
  green: { backgroundColor: '#ECFDF5', borderColor: '#D1FAE5' },
  red: { backgroundColor: '#FEF2F2', borderColor: '#FEE2E2' },
  amber: { backgroundColor: '#FFFBEB', borderColor: '#FEF3C7' },
  gray: { backgroundColor: COLORS.surfaceSecondary, borderColor: COLORS.borderLight },
};

const textToneStyles: Record<Tone, any> = {
  blue: { color: COLORS.primary },
  green: { color: COLORS.income },
  red: { color: COLORS.expense },
  amber: { color: COLORS.debt },
  gray: { color: COLORS.textSecondary },
};

