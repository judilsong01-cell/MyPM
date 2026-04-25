import React from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Screen } from '../../components/common/Screen';
import { DebtRepo, ProductRepo, TransactionRepo } from '../../database';
import {
  ANGOLA_CONFIG,
  BORDER_RADIUS,
  COLORS,
  FONTS,
  MONTHS_PT,
  SPACING,
} from '../../constants';
import { generateBasicPdfReport } from '../../services/report';
import type { DashboardData, MonthSummary } from '../../types';

const DashboardScreen = () => {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const sub = NetInfo.addEventListener((state) => setIsOnline(!!state.isConnected));
    return () => sub();
  }, []);

  const loadData = React.useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const thisMonth = today.slice(0, 7);

      const [todayData, monthData, last6Months, pendingDebts, lowStock] = await Promise.all([
        TransactionRepo.getByDateRange(today, today),
        TransactionRepo.getMonthSummary(thisMonth),
        TransactionRepo.getLast6MonthsSummary(),
        DebtRepo.getTotalPending(),
        ProductRepo.getLowStock(),
      ]);

      const todayIncome = todayData
        .filter((item) => item.type === 'income')
        .reduce((sum, item) => sum + item.amount, 0);
      const todayExpenses = todayData
        .filter((item) => item.type === 'expense')
        .reduce((sum, item) => sum + item.amount, 0);

      setData({
        today: { income: todayIncome, expenses: todayExpenses },
        thisMonth: {
          month: thisMonth,
          totalIncome: monthData.income,
          totalExpenses: monthData.expenses,
          profit: monthData.income - monthData.expenses,
          transactionCount: todayData.length,
          topCategory: 'servico_outro',
        },
        last6Months,
        pendingDebts,
        lowStockCount: lowStock.length,
      });
    } catch (error) {
      console.error('[Dashboard] load error:', error);
      Alert.alert('Erro', 'Nao foi possivel carregar o dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const onExportPdf = async () => {
    try {
      setExporting(true);
      const result = await generateBasicPdfReport();
      Alert.alert(
        'PDF criado',
        result.shared
          ? 'O relatorio foi gerado e a folha de partilha foi aberta.'
          : `Relatorio criado em:\n${result.filePath}`
      );
    } catch (error: any) {
      Alert.alert('Falha ao gerar PDF', error?.message ?? 'Erro desconhecido.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>A preparar o painel financeiro...</Text>
        </View>
      </Screen>
    );
  }

  const monthIndex = Number(data?.thisMonth.month?.slice(5) ?? new Date().getMonth() + 1) - 1;
  const monthName = MONTHS_PT[Math.max(0, monthIndex)] ?? MONTHS_PT[new Date().getMonth()];
  const profit = data?.thisMonth.profit ?? 0;
  const fmt = ANGOLA_CONFIG.formatCurrency;
  const healthTone = isOnline === false ? 'red' : isOnline ? 'green' : 'gray';

  return (
    <Screen contentStyle={styles.content}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerBody}>
            <Text style={styles.h1}>Inicio</Text>
            <Text style={styles.subtitle}>Resumo financeiro e operacional do MyPME</Text>
          </View>
          <Badge
            label={isOnline === null ? 'A verificar' : isOnline ? 'Online' : 'Offline'}
            tone={healthTone}
          />
        </View>

        <View
          style={[
            styles.heroCard,
            { backgroundColor: profit >= 0 ? COLORS.primaryDark : '#7F1D1D' },
          ]}
        >
          <Text style={styles.heroEyebrow}>Centro financeiro</Text>
          <Text style={styles.heroTitle}>Saldo do mes de {monthName}</Text>
          <Text style={styles.heroValue}>{fmt(profit)}</Text>
          <Text style={styles.heroText}>
            Entradas, saidas e alertas principais preparados para consulta rapida antes da operacao
            diaria.
          </Text>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Entradas</Text>
              <Text style={styles.heroStatValue}>{fmt(data?.thisMonth.totalIncome ?? 0)}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Saidas</Text>
              <Text style={styles.heroStatValue}>{fmt(data?.thisMonth.totalExpenses ?? 0)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Button
            title={exporting ? 'A gerar PDF...' : 'Exportar PDF'}
            onPress={onExportPdf}
            loading={exporting}
            style={styles.actionButton}
          />
          <Button
            title="Atualizar"
            onPress={onRefresh}
            variant="secondary"
            style={styles.actionButton}
          />
        </View>

        <View style={styles.highlightsRow}>
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Entradas hoje</Text>
            <Text style={[styles.summaryValue, { color: COLORS.income }]}>
              {fmt(data?.today.income ?? 0)}
            </Text>
          </Card>
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Saidas hoje</Text>
            <Text style={[styles.summaryValue, { color: COLORS.expense }]}>
              {fmt(data?.today.expenses ?? 0)}
            </Text>
          </Card>
        </View>

        <View style={styles.signalRow}>
          <SignalCard
            tone={(data?.pendingDebts ?? 0) > 0 ? 'amber' : 'green'}
            title="Fiado"
            text={
              (data?.pendingDebts ?? 0) > 0
                ? `Pendente: ${fmt(data?.pendingDebts ?? 0)}`
                : 'Sem fiado pendente'
            }
          />
          <SignalCard
            tone={(data?.lowStockCount ?? 0) > 0 ? 'red' : 'green'}
            title="Stock"
            text={
              (data?.lowStockCount ?? 0) > 0
                ? `${data?.lowStockCount ?? 0} produto(s) com alerta`
                : 'Stock sob controlo'
            }
          />
        </View>

        <Text style={styles.sectionTitle}>Ultimos 6 meses</Text>
        <Card style={styles.chartCard}>
          <Text style={styles.cardTitle}>Tendencia de entradas e saidas</Text>
          <Text style={styles.cardCopy}>
            Comparacao simples da evolucao financeira recente para apoiar leitura rapida.
          </Text>
          <SimpleBarChart months={data?.last6Months ?? []} />
        </Card>

        <Text style={styles.sectionTitle}>Pronto para lancamento</Text>
        <Card>
          <View style={styles.bulletLine}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>Fluxo offline ativo com sincronizacao por conta.</Text>
          </View>
          <View style={styles.bulletLine}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>Exportacao basica de PDF com transactions, debts e products.</Text>
          </View>
          <View style={styles.bulletLine}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>Alertas de stock e fiado visiveis no painel principal.</Text>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
};

const SignalCard = ({
  tone,
  title,
  text,
}: {
  tone: 'green' | 'amber' | 'red';
  title: string;
  text: string;
}) => {
  const backgroundColor =
    tone === 'green' ? '#ECFDF5' : tone === 'amber' ? '#FFFBEB' : '#FEF2F2';
  const borderColor = tone === 'green' ? '#D1FAE5' : tone === 'amber' ? '#FEF3C7' : '#FECACA';
  const color = tone === 'green' ? COLORS.income : tone === 'amber' ? COLORS.debt : COLORS.expense;

  return (
    <View style={[styles.signalCard, { backgroundColor, borderColor }]}>
      <Text style={[styles.signalTitle, { color }]}>{title}</Text>
      <Text style={styles.signalText}>{text}</Text>
    </View>
  );
};

const SimpleBarChart = ({ months }: { months: MonthSummary[] }) => {
  const maxValue = Math.max(...months.flatMap((item) => [item.totalIncome, item.totalExpenses]), 1);
  if (months.length === 0) {
    return <Text style={styles.emptyChart}>Sem dados suficientes para o grafico.</Text>;
  }

  return (
    <View style={styles.chart}>
      {[...months].reverse().map((item) => {
        const incomeHeight = (item.totalIncome / maxValue) * 88;
        const expenseHeight = (item.totalExpenses / maxValue) * 88;
        const label = item.month?.slice(5) ?? '--';

        return (
          <View key={item.month} style={styles.chartBar}>
            <View style={styles.chartBars}>
              <View
                style={[
                  styles.bar,
                  styles.incomeBar,
                  { height: Math.max(incomeHeight, 6) },
                ]}
              />
              <View
                style={[
                  styles.bar,
                  styles.expenseBar,
                  { height: Math.max(expenseHeight, 6) },
                ]}
              />
            </View>
            <Text style={styles.chartLabel}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  content: { paddingBottom: SPACING.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: {
    marginTop: SPACING.sm,
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
    paddingTop: SPACING.sm,
  },
  headerBody: { flex: 1, paddingRight: SPACING.md },
  h1: { fontSize: 24, fontWeight: FONTS.weights.bold, color: COLORS.text },
  subtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 4, lineHeight: 20 },
  heroCard: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
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
    fontWeight: FONTS.weights.semibold,
  },
  heroValue: {
    color: COLORS.textOnPrimary,
    fontSize: 36,
    fontWeight: FONTS.weights.bold,
    marginTop: SPACING.xs,
  },
  heroText: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
    marginTop: SPACING.sm,
  },
  heroStatsRow: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: SPACING.md,
  },
  heroStat: { flex: 1 },
  heroDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: SPACING.sm },
  heroStatLabel: { color: 'rgba(255,255,255,0.68)', fontSize: FONTS.sizes.xs },
  heroStatValue: {
    color: COLORS.textOnPrimary,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    marginTop: 4,
  },
  actionRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  actionButton: { flex: 1 },
  highlightsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  summaryCard: { flex: 1, padding: SPACING.md },
  summaryLabel: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm },
  summaryValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: FONTS.weights.bold,
  },
  signalRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  signalCard: {
    flex: 1,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
  },
  signalTitle: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold },
  signalText: {
    marginTop: 6,
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
  },
  sectionTitle: {
    marginBottom: SPACING.sm,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.text,
  },
  chartCard: { marginBottom: SPACING.lg },
  cardTitle: { color: COLORS.text, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold },
  cardCopy: {
    marginTop: 4,
    marginBottom: SPACING.md,
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 132,
    paddingTop: SPACING.sm,
  },
  chartBar: { alignItems: 'center', flex: 1 },
  chartBars: {
    height: 96,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  bar: {
    width: 14,
    borderRadius: BORDER_RADIUS.full,
  },
  incomeBar: { backgroundColor: COLORS.income },
  expenseBar: { backgroundColor: COLORS.expense },
  chartLabel: {
    marginTop: SPACING.sm,
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.xs,
  },
  emptyChart: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
  },
  bulletLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  bulletDot: {
    width: 10,
    height: 10,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary,
    marginTop: 5,
  },
  bulletText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
  },
});

export default DashboardScreen;
