import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { COLORS, FONTS, SPACING, BORDER_RADIUS, STORAGE_KEYS } from '../../constants';

type OnboardingScreenProps = {
  navigation: any;
  onDone?: () => void;
};

const OnboardingScreen = ({ navigation, onDone }: OnboardingScreenProps) => {
  const onStart = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.onboarded, '1');
    } finally {
      if (onDone) {
        onDone();
        return;
      }
      navigation.replace('Auth');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>MyPME</Text>
      <Text style={styles.title}>Controle simples do teu negocio</Text>
      <Text style={styles.subtitle}>
        Vendas, despesas, fiado e stock.{'\n'}
        Funciona offline e sincroniza quando tiver internet.
      </Text>
      <TouchableOpacity style={styles.btn} onPress={onStart}>
        <Text style={styles.btnText}>Comecar agora</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  brand: {
    fontSize: 36,
    fontWeight: FONTS.weights.bold,
    color: '#fff',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 24,
    fontWeight: FONTS.weights.bold,
    color: '#fff',
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONTS.sizes.md,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: SPACING.xxl,
  },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxl,
  },
  btnText: { color: '#fff', fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold },
});

export default OnboardingScreen;
