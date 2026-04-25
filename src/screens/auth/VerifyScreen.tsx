import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { BORDER_RADIUS, COLORS, FONTS, SPACING } from '../../constants';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Screen } from '../../components/common/Screen';
import { useAuth } from '../../auth/AuthContext';
import { appwriteAccount } from '../../services/appwrite';
import { APPWRITE_AUTH_REDIRECT_URL } from '../../services/appwrite.secrets';

const toErrorMessage = (error: any): string => {
  if (!error) return 'Erro desconhecido.';
  if (typeof error === 'string') return error;
  const message = String(error?.message ?? 'Erro desconhecido.');
  const code = error?.code ? ` [${String(error.code)}]` : '';
  return `${message}${code}`;
};

const VerifyScreen = () => {
  const auth = useAuth();
  const user = auth.user;

  const [sendingEmail, setSendingEmail] = React.useState(false);
  const [confirmingEmail, setConfirmingEmail] = React.useState(false);
  const [sendingPhone, setSendingPhone] = React.useState(false);
  const [confirmingPhone, setConfirmingPhone] = React.useState(false);

  const [manualUserId, setManualUserId] = React.useState('');
  const [manualSecret, setManualSecret] = React.useState('');
  const [phoneCode, setPhoneCode] = React.useState('');

  const emailVerified = !!user?.emailVerification;
  const phoneVerified = !!user?.phoneVerification;

  const onRefresh = async () => {
    try {
      await auth.refresh();
    } catch {
      // ignore
    }
  };

  const onSendEmailVerification = async () => {
    setSendingEmail(true);
    try {
      await appwriteAccount.createEmailVerification({ url: APPWRITE_AUTH_REDIRECT_URL });
      Alert.alert('Enviado', 'Enviamos um email de verificacao. Abre o link neste dispositivo.');
    } catch (error: any) {
      Alert.alert('Falha', toErrorMessage(error));
    } finally {
      setSendingEmail(false);
    }
  };

  const onConfirmEmailVerification = async () => {
    if (!manualUserId.trim() || !manualSecret.trim()) return;
    setConfirmingEmail(true);
    try {
      await appwriteAccount.updateEmailVerification({
        userId: manualUserId.trim(),
        secret: manualSecret.trim(),
      });
      await auth.refresh();
      Alert.alert('Conta verificada', 'Email confirmado com sucesso.');
    } catch (error: any) {
      Alert.alert('Falha ao confirmar', toErrorMessage(error));
    } finally {
      setConfirmingEmail(false);
    }
  };

  const onSendPhoneVerification = async () => {
    setSendingPhone(true);
    try {
      await appwriteAccount.createPhoneVerification();
      Alert.alert('SMS enviado', 'Recebeste um codigo por SMS. Insere abaixo para confirmar.');
    } catch (error: any) {
      Alert.alert('Falha', toErrorMessage(error));
    } finally {
      setSendingPhone(false);
    }
  };

  const onConfirmPhoneVerification = async () => {
    if (!user?.$id || phoneCode.trim().length < 3) return;
    setConfirmingPhone(true);
    try {
      await appwriteAccount.updatePhoneVerification({ userId: String(user.$id), secret: phoneCode.trim() });
      await auth.refresh();
      Alert.alert('Conta verificada', 'Telefone confirmado com sucesso.');
    } catch (error: any) {
      Alert.alert('Falha ao confirmar', toErrorMessage(error));
    } finally {
      setConfirmingPhone(false);
    }
  };

  const onSignOut = async () => {
    Alert.alert('Sair', 'Quer terminar a sessao?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => auth.signOut() },
    ]);
  };

  return (
    <Screen safe style={styles.root} contentStyle={styles.content}>
      <Text style={styles.brand}>MyPME</Text>
      <Text style={styles.h1}>Confirmar conta</Text>
      <Text style={styles.p}>
        Por seguranca, so podes entrar no dashboard quando o email ou o telefone estiver verificado.
      </Text>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Estado atual</Text>
        <View style={{ height: SPACING.sm }} />
        <Text style={styles.meta}>Email: {user?.email ?? '-'}</Text>
        <Text style={styles.meta}>Email verificado: {emailVerified ? 'sim' : 'nao'}</Text>
        <Text style={styles.meta}>Telefone: {user?.phone ?? '-'}</Text>
        <Text style={styles.meta}>Telefone verificado: {phoneVerified ? 'sim' : 'nao'}</Text>

        <View style={{ height: SPACING.md }} />
        <Button title="Atualizar estado" onPress={onRefresh} variant="secondary" />
      </Card>

      <View style={{ height: SPACING.md }} />

      <Card>
        <Text style={styles.cardTitle}>Verificar email</Text>
        <Text style={styles.help}>
          Envia um email de verificacao e abre o link no mesmo telemovel. Se o link nao abrir a app,
          podes colar manualmente o `userId` e `secret` aqui.
        </Text>
        <View style={{ height: SPACING.md }} />
        <Button
          title={sendingEmail ? 'A enviar...' : 'Enviar email de verificacao'}
          onPress={onSendEmailVerification}
          loading={sendingEmail}
        />

        <View style={{ height: SPACING.md }} />
        <Input placeholder="userId" autoCapitalize="none" value={manualUserId} onChangeText={setManualUserId} />
        <View style={{ height: SPACING.sm }} />
        <Input placeholder="secret" autoCapitalize="none" value={manualSecret} onChangeText={setManualSecret} />
        <View style={{ height: SPACING.md }} />
        <Button
          title={confirmingEmail ? 'A confirmar...' : 'Confirmar email (manual)'}
          onPress={onConfirmEmailVerification}
          loading={confirmingEmail}
          variant="outline"
          disabled={!manualUserId.trim() || !manualSecret.trim()}
        />
      </Card>

      <View style={{ height: SPACING.md }} />

      <Card>
        <Text style={styles.cardTitle}>Verificar telefone</Text>
        <Text style={styles.help}>
          Se a tua conta tem um telefone associado, podes confirmar por SMS. Caso tenhas feito login
          via OTP, isto pode ficar verificado automaticamente.
        </Text>
        <View style={{ height: SPACING.md }} />
        <Button
          title={sendingPhone ? 'A enviar...' : 'Enviar codigo SMS'}
          onPress={onSendPhoneVerification}
          loading={sendingPhone}
          variant="secondary"
        />
        <View style={{ height: SPACING.sm }} />
        <Input
          placeholder="Codigo SMS"
          keyboardType="number-pad"
          value={phoneCode}
          onChangeText={setPhoneCode}
        />
        <View style={{ height: SPACING.md }} />
        <Button
          title={confirmingPhone ? 'A confirmar...' : 'Confirmar telefone'}
          onPress={onConfirmPhoneVerification}
          loading={confirmingPhone}
          variant="outline"
          disabled={!user?.$id || phoneCode.trim().length < 3}
        />
      </Card>

      <View style={{ height: SPACING.md }} />
      <Button title="Sair" onPress={onSignOut} variant="danger" />
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
  card: {
    marginTop: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
  },
  cardTitle: { color: COLORS.text, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold },
  help: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, lineHeight: 20, marginTop: 6 },
  meta: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 20 },
});

export default VerifyScreen;

