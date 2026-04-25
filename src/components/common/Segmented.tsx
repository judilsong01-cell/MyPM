import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BORDER_RADIUS, COLORS, FONTS, SPACING } from '../../constants';

export type SegmentOption<T extends string> = { key: T; label: string };

type Props<T extends string> = {
  value: T;
  options: SegmentOption<T>[];
  onChange: (next: T) => void;
};

export const Segmented = <T extends string>({ value, options, onChange }: Props<T>) => (
  <View style={styles.wrap}>
    {options.map((o) => {
      const active = o.key === value;
      return (
        <Pressable
          key={o.key}
          style={[styles.btn, active && styles.btnActive]}
          onPress={() => onChange(o.key)}
        >
          <Text style={[styles.text, active && styles.textActive]}>{o.label}</Text>
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: BORDER_RADIUS.full,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  text: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.medium,
  },
  textActive: {
    color: COLORS.text,
    fontWeight: FONTS.weights.semibold,
  },
});

