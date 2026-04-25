import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { COLORS, FONTS, SPACING } from '../../constants';
import { STORAGE_KEYS } from '../../constants/storage';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Screen } from '../../components/common/Screen';
import { Badge } from '../../components/common/Badge';
import { generateBasicPdfReport } from '../../services/report';
import { getSyncDiagnostics, syncNow } from '../../services/sync';
import { useAuth } from '../../auth/AuthContext';

const MoreScreen = () => {
  const auth = useAuth();
  const [email, setEmail] = React.useState<string | null>(null);
  const [syncing, setSyncing] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [lastSyncAt, setLastSyncAt] = React.useState<string | null>(null);

  React.useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.lastSyncAt).then((value) => setLastSyncAt(value));
  }, []);

  React.useEffect(() => {
    setEmail(auth.user?.email ?? null);
  }, [auth.user?.email]);

  const onSyncNow = async () => {
    try {
      setSyncing(true);
      const summary = await syncNow();
      setLastSyncAt(summary.at);
      Alert.alert(
        'Sincronizado',
        `Enviados: T=${summary.pushed.transactions}, D=${summary.pushed.debts}, P=${summary.pushed.products}\n` +
          `Recebidos: T=${summary.pulled.transactions}, D=${summary.pulled.debts}, P=${summary.pulled.products}`
      );
    } catch (error: any) {
      Alert.alert('Falha ao sincronizar', error?.message ?? 'Erro desconhecido.');
    } finally {
      setSyncing(false);
    }
  };

  const onSyncDiagnostics = async () => {
    try {
      const diag = await getSyncDiagnostics();
      Alert.alert(
        'Diagnostico de sync',
        `Online: ${diag.isOnline ? 'sim' : 'nao'}\n` +
          `User: ${diag.userId ?? '-'}\n` +
          `Locais pendentes -> T:${diag.localUnsynced.transactions} D:${diag.localUnsynced.debts} P:${diag.localUnsynced.products}\n\n` +
          `Appwrite collections:\n` +
          `transactions: ${diag.remoteChecks.transactions}\n` +
          `debts: ${diag.remoteChecks.debts}\n` +
          `products: ${diag.remoteChecks.products}`
      );
    } catch (error: any) {
      Alert.alert('Diagnostico falhou', error?.message ?? 'Erro desconhecido.');
    }
  };

  const onExportPdf = async () => {
    try {
      setExporting(true);
      const result = await generateBasicPdfReport();
      Alert.alert(
        'PDF criado',
        result.shared
          ? 'O relatorio foi gerado e a partilha foi aberta.'
          : `Relatorio criado em:\n${result.filePath}`
      );
    } catch (error: any) {
      Alert.alert('Falha ao gerar PDF', error?.message ?? 'Erro desconhecido.');
    } finally {
      setExporting(false);
    }
  };

  const onSignOut = () => {
    Alert.alert('Sair', 'Quer terminar a sessao?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await auth.signOut();
        },
      },
    ]);
  };

  return (
    <Screen contentStyle={styles.content}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerBody}>
            <Text style={styles.h1}>Mais</Text>
            <Text style={styles.subtitle}>Conta, sincronizacao, exportacao e seguranca</Text>
          </View>
          <Badge label="MyPME" tone="blue" />
        </View>

        <Card style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Conta ativa</Text>
          <Text style={styles.heroTitle}>{email ?? 'Sem conta'}</Text>
          <Text style={styles.heroCopy}>
            A aplicacao funciona localmente e sincroniza por utilizador quando a sessao esta valida.
          </Text>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMeta}>
              <Text style={styles.heroMetaLabel}>Ultima sync</Text>
              <Text style={styles.heroMetaValue}>{lastSyncAt ?? '-'}</Text>
            </View>
            <View style={styles.heroMetaDivider} />
            <View style={styles.heroMeta}>
              <Text style={styles.heroMetaLabel}>Modo de trabalho</Text>
              <Text style={styles.heroMetaValue}>Offline first</Text>
            </View>
          </View>
        </Card>

        <Text style={styles.sectionTitle}>Operacao</Text>
        <Card>
          <Text style={styles.cardTitle}>Sincronizacao</Text>
          <Text style={styles.help}>
            Envia e recebe dados quando existir internet. Cada conta ve apenas os proprios registos.
          </Text>
          <View style={styles.spaceMd} />
          <Button
            title={syncing ? 'A sincronizar...' : 'Sincronizar agora'}
            onPress={onSyncNow}
            loading={syncing}
          />
          <View style={styles.spaceSm} />
          <Button title="Diagnostico de sync" onPress={onSyncDiagnostics} variant="outline" />
        </Card>

        <View style={styles.spaceMd} />

        <Card>
          <Text style={styles.cardTitle}>Exportacao</Text>
          <Text style={styles.help}>
            Gera um PDF basico com os dados atuais de transactions, debts e products.
          </Text>
          <View style={styles.spaceMd} />
          <Button
            title={exporting ? 'A gerar PDF...' : 'Exportar relatorio PDF'}
            onPress={onExportPdf}
            loading={exporting}
            variant="secondary"
          />
        </Card>

        <View style={styles.spaceMd} />

        <Card>
          <Text style={styles.cardTitle}>Sessao e seguranca</Text>
          <Text style={styles.help}>
            Ao sair, a app limpa os dados offline deste aparelho para evitar mistura entre contas.
          </Text>
          <View style={styles.spaceMd} />
          <Button title="Sair" onPress={onSignOut} variant="danger" />
        </Card>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { paddingBottom: SPACING.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    paddingTop: SPACING.sm,
  },
  headerBody: { flex: 1, paddingRight: SPACING.md },
  h1: { fontSize: 24, fontWeight: FONTS.weights.bold, color: COLORS.text },
  subtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 4, lineHeight: 20 },
  heroCard: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primaryDark,
    marginBottom: SPACING.lg,
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: FONTS.sizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  heroTitle: {
    color: COLORS.textOnPrimary,
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
  },
  heroCopy: {
    marginTop: SPACING.sm,
    color: 'rgba(255,255,255,0.86)',
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
  },
  heroMetaRow: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
    paddingTop: SPACING.md,
  },
  heroMeta: { flex: 1 },
  heroMetaDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginHorizontal: SPACING.sm,
  },
  heroMetaLabel: {
    color: 'rgba(255,255,255,0.66)',
    fontSize: FONTS.sizes.xs,
  },
  heroMetaValue: {
    color: COLORS.textOnPrimary,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    marginTop: 4,
  },
  sectionTitle: {
    marginBottom: SPACING.sm,
    color: COLORS.text,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semibold,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
  },
  help: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
    marginTop: 6,
  },
  spaceSm: { height: SPACING.sm },
  spaceMd: { height: SPACING.md },
});

export default MoreScreen;
