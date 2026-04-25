import React from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { BORDER_RADIUS, COLORS, FONTS, SPACING } from '../../constants';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Screen } from '../../components/common/Screen';
import { Segmented } from '../../components/common/Segmented';
import { useAuth } from '../../auth/AuthContext';
import { appwriteAccount, ID } from '../../services/appwrite';
import { APPWRITE_AUTH_REDIRECT_URL, APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from '../../services/appwrite.secrets';

type Mode = 'login' | 'signup' | 'phone';

const AuthScreen = () => {
  const auth = useAuth();
  const [mode, setMode] = React.useState<Mode>('login');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [phoneUserId, setPhoneUserId] = React.useState<string | null>(null);
  const [phoneCode, setPhoneCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState<boolean | null>(null);
  const [failCount, setFailCount] = React.useState(0);
  const [cooldownUntil, setCooldownUntil] = React.useState(0);

  React.useEffect(() => {
    const sub = NetInfo.addEventListener((state) => setIsOnline(!!state.isConnected));
    return () => sub();
  }, []);

  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone.trim().replace(/\s+/g, '');

  const canSubmit =
    mode === 'phone'
      ? cleanPhone.length >= 8 && (!phoneUserId || phoneCode.trim().length >= 3)
      : cleanEmail.length > 3 && password.length >= 8;

  const onSubmit = async () => {
    if (!canSubmit) return;
    if (cooldownUntil && Date.now() < cooldownUntil) {
      Alert.alert('Aguarde', 'Muitas tentativas. Tenta novamente em alguns segundos.');
      return;
    }
    if (isOnline === false) {
      Alert.alert('Sem internet', 'Ligue dados ou Wi-Fi para autenticar.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await appwriteAccount.createEmailPasswordSession({ email: cleanEmail, password });
        await auth.refresh();
        setFailCount(0);
        return;
      }

      if (mode === 'signup') {
        await appwriteAccount.create({ userId: ID.unique(), email: cleanEmail, password, name: cleanEmail });
        await appwriteAccount.createEmailPasswordSession({ email: cleanEmail, password });
        await appwriteAccount.createEmailVerification({ url: APPWRITE_AUTH_REDIRECT_URL });
        await auth.refresh();
        setFailCount(0);
        Alert.alert('Confirme o email', 'Enviamos um email de verificacao. Abre o link neste dispositivo.');
        return;
      }

      // Phone OTP flow (2 steps)
      if (!phoneUserId) {
        const token = await appwriteAccount.createPhoneToken({ userId: ID.unique(), phone: cleanPhone });
        const nextUserId = String((token as any)?.userId ?? '');
        if (!nextUserId) throw new Error('Falha ao iniciar OTP. (sem userId)');
        setPhoneUserId(nextUserId);
        Alert.alert('SMS enviado', 'Insere o codigo (OTP) que recebeste por SMS.');
        return;
      }

      await appwriteAccount.updatePhoneSession({ userId: phoneUserId, secret: phoneCode.trim() });
      await auth.refresh();
      setFailCount(0);
    } catch (e: any) {
      const code = e?.code ? Number(e.code) : null;
      const message = e?.message ? String(e.message) : 'Falha na autenticacao.';

      const nextFails = failCount + 1;
      setFailCount(nextFails);
      if (nextFails >= 5) {
        setFailCount(0);
        setCooldownUntil(Date.now() + 30_000); // 30s
      }

      if (code === 409) {
        Alert.alert('Conta existente', 'Ja existe uma conta com estes dados. Tenta fazer login.');
        return;
      }

      const suffix = code ? ` [${String(code)}]` : '';
      Alert.alert('Erro', `${message}${suffix}`);
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    try {
      if (isOnline === false) throw new Error('Sem internet. Ligue dados ou Wi-Fi.');

      // Token-based OAuth: Appwrite redirects back with `userId` and `secret` query params.
      // The AuthProvider listens for the incoming URL and exchanges it for a session.
      const url =
        `${APPWRITE_ENDPOINT}/account/tokens/oauth2/google` +
        `?project=${encodeURIComponent(APPWRITE_PROJECT_ID)}` +
        `&success=${encodeURIComponent(APPWRITE_AUTH_REDIRECT_URL)}` +
        `&failure=${encodeURIComponent(APPWRITE_AUTH_REDIRECT_URL)}`;

      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert('Falha', e?.message ?? 'Nao foi possivel iniciar Google login.');
    }
  };

  return (
    <Screen safe style={styles.root} contentStyle={styles.content}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={styles.brand}>MyPME</Text>
        <Text style={styles.h1}>Entrar</Text>
        <Text style={styles.p}>
          Login seguro com Appwrite. Precisas verificar email ou telefone antes de aceder ao dashboard.
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            Rede: {isOnline === null ? 'a verificar' : isOnline ? 'online' : 'offline'}
          </Text>
        </View>

        <Card style={styles.card}>
          <Segmented
            value={mode}
            options={[
              { key: 'login', label: 'Login' },
              { key: 'signup', label: 'Criar conta' },
              { key: 'phone', label: 'Telefone' },
            ]}
            onChange={(v) => {
              setMode(v);
              setLoading(false);
              setPhoneUserId(null);
              setPhoneCode('');
              setFailCount(0);
              setCooldownUntil(0);
            }}
          />

          <View style={{ height: SPACING.md }} />

          {mode === 'phone' ? (
            <>
              <Input
                placeholder="Telefone (+244...)"
                autoCapitalize="none"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
              {phoneUserId ? (
                <>
                  <View style={{ height: SPACING.sm }} />
                  <Input
                    placeholder="Codigo (OTP)"
                    keyboardType="number-pad"
                    value={phoneCode}
                    onChangeText={setPhoneCode}
                  />
                </>
              ) : null}
            </>
          ) : (
            <>
              <Input
                placeholder="Email"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <View style={{ height: SPACING.sm }} />
              <Input
                placeholder="Senha (min 8)"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </>
          )}

          <View style={{ height: SPACING.md }} />

          <Button
            title={
              mode === 'login'
                ? 'Entrar'
                : mode === 'signup'
                  ? 'Criar conta'
                  : phoneUserId
                    ? 'Confirmar codigo'
                    : 'Enviar codigo'
            }
            onPress={onSubmit}
            disabled={!canSubmit}
            loading={loading}
          />

          <View style={{ height: SPACING.sm }} />
          <Button title="Entrar com Google" onPress={onGoogle} variant="outline" />
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  root: { backgroundColor: COLORS.background },
  content: { justifyContent: 'center' },
  brand: {
    fontSize: 28,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primaryDark,
    marginBottom: 8,
  },
  h1: {
    fontSize: 22,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
  },
  p: { marginTop: 6, fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 20 },
  metaRow: { marginTop: SPACING.sm },
  metaText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  card: {
    marginTop: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
  },
});

export default AuthScreen;
