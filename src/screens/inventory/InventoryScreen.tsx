import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { Screen } from '../../components/common/Screen';
import { BORDER_RADIUS, COLORS, FONTS, SPACING } from '../../constants';
import { ProductRepo } from '../../database';

const InventoryScreen = () => {
  const [productCount, setProductCount] = React.useState(0);
  const [lowStockCount, setLowStockCount] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    Promise.all([ProductRepo.getAll(), ProductRepo.getLowStock()])
      .then(([products, lowStock]) => {
        if (!active) return;
        setProductCount(products.length);
        setLowStockCount(lowStock.length);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  return (
    <Screen contentStyle={styles.content}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Produtos e stock</Text>
            <Text style={styles.subtitle}>Operacao preparada para escala e controlo mais fino</Text>
          </View>
          <Badge label="Em expansao" tone="blue" />
        </View>

        <Card style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Camada operacional</Text>
          <Text style={styles.heroTitle}>O modulo de inventario ja esta preparado na base do produto</Text>
          <Text style={styles.heroText}>
            A aplicacao ja suporta estrutura de produtos, quantidade, preco de custo, preco de venda,
            stock minimo e sincronizacao. A proxima iteracao fecha a experiencia visual completa.
          </Text>
        </Card>

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Produtos locais</Text>
            <Text style={styles.statValue}>{productCount}</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Alertas de stock</Text>
            <Text style={[styles.statValue, { color: lowStockCount > 0 ? COLORS.debt : COLORS.text }]}>
              {lowStockCount}
            </Text>
          </Card>
        </View>

        <Text style={styles.section}>Ja preparado</Text>
        <Card>
          <FeatureLine title="Base offline" text="Produtos guardados localmente em SQLite para uso continuo sem internet." />
          <FeatureLine title="Estrutura financeira" text="Preco de custo e preco de venda prontos para margem e analise." />
          <FeatureLine title="Alertas" text="Deteccao de stock baixo pronta para dashboard, notificacoes e sync." />
        </Card>

        <Text style={styles.section}>Evolucao comercial imediata</Text>
        <Card>
          <FeatureLine title="Cadastro rapido" text="Entrada e edicao de produtos diretamente pelo telemovel." />
          <FeatureLine title="Baixa automatica" text="Reduzir stock automaticamente a partir das vendas registadas." />
          <FeatureLine title="Reposicao" text="Priorizar produtos com risco de ruptura e apoiar decisao de compra." />
        </Card>
      </ScrollView>
    </Screen>
  );
};

const FeatureLine = ({ title, text }: { title: string; text: string }) => (
  <View style={styles.featureLine}>
    <View style={styles.featureDot} />
    <View style={styles.featureBody}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  content: { paddingBottom: SPACING.xxl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
    paddingTop: SPACING.sm,
  },
  title: { fontSize: 22, fontWeight: FONTS.weights.bold, color: COLORS.text },
  subtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 4, maxWidth: 240 },
  heroCard: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: FONTS.sizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  heroTitle: { color: COLORS.textOnPrimary, fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold },
  heroText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
    marginTop: SPACING.sm,
  },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  statCard: { flex: 1, padding: SPACING.md },
  statLabel: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm },
  statValue: { color: COLORS.text, fontSize: 26, fontWeight: FONTS.weights.bold, marginTop: 6 },
  section: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.text,
  },
  featureLine: { flexDirection: 'row', gap: SPACING.sm, paddingVertical: SPACING.sm },
  featureDot: {
    width: 10,
    height: 10,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary,
    marginTop: 6,
  },
  featureBody: { flex: 1 },
  featureTitle: { color: COLORS.text, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold },
  featureText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, lineHeight: 20, marginTop: 2 },
});

export default InventoryScreen;
