import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Screen } from '../../components/common/Screen';
import { DebtRepo } from '../../database';
import { syncNow } from '../../services/sync';
import { ANGOLA_CONFIG, BORDER_RADIUS, COLORS, FONTS, SPACING } from '../../constants';
import type { Debt } from '../../types';

const genId = () => `debt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const DebtsScreen = () => {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadDebts = useCallback(async () => {
    try {
      const [list, total] = await Promise.all([DebtRepo.getPending(), DebtRepo.getTotalPending()]);
      setDebts(list);
      setTotalPending(total);
    } catch (error) {
      console.error('[Debts]', error);
      Alert.alert('Erro', 'Nao foi possivel carregar os fiados.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDebts();
  }, [loadDebts]);

  const handleMarkPaid = (debt: Debt) => {
    Alert.alert('Marcar como pago?', `${debt.clientName} - ${ANGOLA_CONFIG.formatCurrency(debt.amount)}`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar pagamento',
        onPress: async () => {
          await DebtRepo.markPaid(debt.id);
          syncNow().catch((error) => {
            console.log('[SYNC][AUTO][debts:markPaid]', error?.message ?? error);
          });
          loadDebts();
        },
      },
    ]);
  };

  const handleSendReminder = (debt: Debt) => {
    Alert.alert('Lembrete', `Acao preparada para enviar contacto a ${debt.clientPhone ?? 'cliente'}.`);
  };

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerBody}>
          <Text style={styles.title}>Fiado</Text>
          <Text style={styles.subtitle}>Controlo de clientes com valores ainda por receber</Text>
        </View>
        <Pressable style={styles.addBtn} onPress={() => setShowAddModal(true)}>
          <Text style={styles.addBtnText}>Adicionar</Text>
        </Pressable>
      </View>

      <Card style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total pendente</Text>
        <Text style={styles.totalAmount}>{ANGOLA_CONFIG.formatCurrency(totalPending)}</Text>
        <Text style={styles.totalCount}>
          {debts.length} cliente(s) com fiado em aberto
        </Text>
      </Card>

      <FlatList
        style={styles.list}
        data={debts}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadDebts();
            }}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          debts.length === 0 && !loading ? styles.listContentEmpty : null,
        ]}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Sem fiado pendente</Text>
              <Text style={styles.emptySubtitle}>
                Quando existirem clientes com dividas, vao aparecer aqui para acompanhamento.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <DebtCard
            debt={item}
            onMarkPaid={() => handleMarkPaid(item)}
            onReminder={() => handleSendReminder(item)}
          />
        )}
      />

      <AddDebtModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={loadDebts}
      />
    </Screen>
  );
};

const DebtCard = ({
  debt,
  onMarkPaid,
  onReminder,
}: {
  debt: Debt;
  onMarkPaid: () => void;
  onReminder: () => void;
}) => {
  const pending = Math.max(debt.amount - debt.paidAmount, 0);
  const daysAgo = Math.max(
    0,
    Math.floor((Date.now() - new Date(debt.serviceDate).getTime()) / 86_400_000)
  );
  const isOverdue = !!debt.dueDate && new Date(debt.dueDate) < new Date();

  return (
    <Card style={[styles.debtCard, isOverdue && styles.debtCardOverdue]}>
      <View style={styles.debtHeader}>
        <View style={styles.clientMeta}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{debt.clientName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.clientBody}>
            <Text style={styles.clientName}>{debt.clientName}</Text>
            <Text style={styles.clientDescription}>{debt.description}</Text>
          </View>
        </View>
        <View style={styles.valueWrap}>
          <Text style={styles.debtAmount}>{ANGOLA_CONFIG.formatCurrency(pending)}</Text>
          <Text style={[styles.statusTag, isOverdue ? styles.statusDanger : styles.statusNeutral]}>
            {isOverdue ? 'Vencido' : 'Pendente'}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          Registado {daysAgo === 0 ? 'hoje' : `ha ${daysAgo} dia(s)`}
        </Text>
        <Text style={styles.metaText}>
          Pago: {ANGOLA_CONFIG.formatCurrency(debt.paidAmount)}
        </Text>
      </View>

      {debt.clientPhone ? (
        <Text style={styles.phoneText}>Contacto: {debt.clientPhone}</Text>
      ) : null}

      <View style={styles.actionsRow}>
        {debt.clientPhone ? (
          <Button title="Lembrar" onPress={onReminder} variant="outline" style={styles.actionBtn} />
        ) : null}
        <Button title="Marcar pago" onPress={onMarkPaid} variant="success" style={styles.actionBtn} />
      </View>
    </Card>
  );
};

const AddDebtModal = ({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setClientName('');
    setClientPhone('');
    setAmount('');
    setDescription('');
  };

  const handleSave = async () => {
    if (!clientName.trim()) {
      Alert.alert('Nome obrigatorio');
      return;
    }
    if (!amount || Number.parseFloat(amount) <= 0) {
      Alert.alert('Valor invalido');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Descricao obrigatoria');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      await DebtRepo.insert({
        id: genId(),
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim() || undefined,
        amount: Number.parseFloat(amount),
        description: description.trim(),
        serviceDate: now.slice(0, 10),
        status: 'pendente',
        paidAmount: 0,
        createdAt: now,
        synced: false,
      });
      syncNow().catch((error) => {
        console.log('[SYNC][AUTO][debts:insert]', error?.message ?? error);
      });
      reset();
      onSaved();
      onClose();
    } catch (error) {
      console.error('[Debts][save]', error);
      Alert.alert('Erro', 'Nao foi possivel guardar o fiado.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Novo fiado</Text>
          <Text style={styles.sheetSubtitle}>Registo simples para guardar cliente, valor e descricao.</Text>
          <View style={styles.spaceMd} />
          <Input placeholder="Nome do cliente *" value={clientName} onChangeText={setClientName} />
          <View style={styles.spaceSm} />
          <Input
            placeholder="Telefone (+244...)"
            value={clientPhone}
            onChangeText={setClientPhone}
            keyboardType="phone-pad"
          />
          <View style={styles.spaceSm} />
          <Input
            placeholder="Valor em Kz *"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />
          <View style={styles.spaceSm} />
          <Input placeholder="Descricao *" value={description} onChangeText={setDescription} />
          <View style={styles.spaceMd} />
          <Button title={saving ? 'A guardar...' : 'Guardar fiado'} onPress={handleSave} loading={saving} />
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  content: { paddingBottom: 0 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
    paddingTop: SPACING.sm,
  },
  headerBody: { flex: 1, paddingRight: SPACING.md },
  title: { fontSize: 24, fontWeight: FONTS.weights.bold, color: COLORS.text },
  subtitle: { marginTop: 4, fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 20 },
  addBtn: {
    backgroundColor: COLORS.debt,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  addBtnText: { color: '#fff', fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold },
  totalCard: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primaryDark,
    marginBottom: SPACING.md,
  },
  totalLabel: { color: 'rgba(255,255,255,0.72)', fontSize: FONTS.sizes.sm },
  totalAmount: {
    marginTop: 6,
    color: COLORS.textOnPrimary,
    fontSize: 32,
    fontWeight: FONTS.weights.bold,
  },
  totalCount: { marginTop: 4, color: 'rgba(255,255,255,0.78)', fontSize: FONTS.sizes.sm },
  list: { flex: 1 },
  listContent: { paddingBottom: SPACING.xxl, gap: SPACING.sm },
  listContentEmpty: { flexGrow: 1, justifyContent: 'center' },
  debtCard: { padding: SPACING.md },
  debtCardOverdue: { borderColor: '#FECACA', backgroundColor: '#FFF7F7' },
  debtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  clientMeta: { flexDirection: 'row', flex: 1, paddingRight: SPACING.sm },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  avatarText: { color: COLORS.primary, fontSize: 18, fontWeight: FONTS.weights.bold },
  clientBody: { flex: 1 },
  clientName: { color: COLORS.text, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold },
  clientDescription: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    marginTop: 2,
    lineHeight: 19,
  },
  valueWrap: { alignItems: 'flex-end' },
  debtAmount: { color: COLORS.debt, fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold },
  statusTag: {
    marginTop: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    fontSize: FONTS.sizes.xs,
    overflow: 'hidden',
  },
  statusNeutral: { backgroundColor: '#FFFBEB', color: COLORS.debt },
  statusDanger: { backgroundColor: '#FEF2F2', color: COLORS.expense },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  metaText: { color: COLORS.textMuted, fontSize: FONTS.sizes.xs },
  phoneText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, marginTop: SPACING.sm },
  actionsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  actionBtn: { flex: 1 },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  emptyTitle: { color: COLORS.text, fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold },
  emptySubtitle: {
    marginTop: SPACING.sm,
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 280,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
  },
  sheetHandle: {
    width: 52,
    height: 5,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  sheetTitle: { color: COLORS.text, fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold },
  sheetSubtitle: {
    marginTop: 4,
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
  },
  spaceSm: { height: SPACING.sm },
  spaceMd: { height: SPACING.md },
});

export default DebtsScreen;
