import React from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Screen } from '../../components/common/Screen';
import { ANGOLA_CONFIG, BORDER_RADIUS, COLORS, FONTS, SPACING } from '../../constants';
import { TransactionRepo } from '../../database';
import {
  CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type PaymentMethod,
  type Transaction,
  type TransactionCategory,
} from '../../types';
import { syncNow } from '../../services/sync';

const genId = () => 'tx_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const CALCULATOR_KEYS: string[][] = [
  ['7', '8', '9', '/'],
  ['4', '5', '6', '*'],
  ['1', '2', '3', '-'],
  ['0', '.', '=', '+'],
];

const CALCULATOR_OPERATORS = ['+', '-', '*', '/'];

const PAYMENT: { value: PaymentMethod; label: string; tone: 'blue' | 'green' | 'amber' | 'gray' }[] = [
  { value: 'dinheiro', label: 'Dinheiro', tone: 'green' },
  { value: 'multicaixa', label: 'Multicaixa', tone: 'gray' },
  { value: 'transferencia', label: 'Transferencia', tone: 'blue' },
  { value: 'fiado', label: 'Fiado', tone: 'amber' },
];

const sanitizeExpression = (value: string) => {
  const normalized = value.replace(/,/g, '.').replace(/[xX]/g, '*');
  return normalized.replace(/[^0-9+\-*/.]/g, '');
};

const formatExpressionResult = (value: number) => {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
};

const evaluateAmount = (value: string): number => {
  const expression = sanitizeExpression(value).trim();
  if (!expression) return 0;
  if (!/^[0-9+\-*/.]+$/.test(expression)) return 0;

  const endsWithOperator = CALCULATOR_OPERATORS.includes(expression.slice(-1));
  if (endsWithOperator) {
    const fallback = Number.parseFloat(expression.slice(0, -1));
    return Number.isFinite(fallback) ? fallback : 0;
  }

  const parsedNumber = Number.parseFloat(expression);
  if (!Number.isNaN(parsedNumber) && !/[+\-*/]/.test(expression)) return parsedNumber;

  try {
    const result = Number(Function(`"use strict"; return (${expression});`)());
    return Number.isFinite(result) ? result : 0;
  } catch {
    return 0;
  }
};

const SalesScreen = () => {
  const insets = useSafeAreaInsets();
  const [amountInput, setAmountInput] = React.useState('0');
  const [clientName, setClientName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('dinheiro');
  const [saving, setSaving] = React.useState(false);
  const [savingType, setSavingType] = React.useState<'income' | 'expense' | null>(null);
  const [keyboardInset, setKeyboardInset] = React.useState(0);

  const [selectedCategory, setSelectedCategory] = React.useState<TransactionCategory | null>(null);
  const [showCategoryModal, setShowCategoryModal] = React.useState(false);
  const [pendingType, setPendingType] = React.useState<'income' | 'expense' | null>(null);

  React.useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(showEvent, (event) => {
      setKeyboardInset(event.endCoordinates?.height ?? 0);
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  const amount = React.useMemo(() => evaluateAmount(amountInput), [amountInput]);
  const formatted = amount > 0 ? ANGOLA_CONFIG.formatCurrency(amount) : '0 Kz';

  const onAmountChanged = (text: string) => {
    const sanitized = sanitizeExpression(text);
    setAmountInput(sanitized.length > 0 ? sanitized : '0');
  };

  const onCalculatorKey = (key: string) => {
    setAmountInput((current) => {
      const previous = current === '0' ? '' : current;

      if (key === '=') {
        return formatExpressionResult(evaluateAmount(previous || '0'));
      }

      if (CALCULATOR_OPERATORS.includes(key)) {
        if (previous.length === 0) return current;
        if (CALCULATOR_OPERATORS.includes(previous.slice(-1))) {
          return previous.slice(0, -1) + key;
        }
        return previous + key;
      }

      if (key === '.') {
        const tail = previous.split(/[+\-*/]/).pop() ?? '';
        if (tail.includes('.')) return current;
        return previous.length === 0 ? '0.' : previous + '.';
      }

      const next = previous + key;
      return next.replace(/^0+(?=\d)/, '');
    });
  };

  const onDel = () => setAmountInput((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));

  const onClear = () => {
    setAmountInput('0');
    setClientName('');
    setDescription('');
    setSelectedCategory(null);
    setPendingType(null);
    setPaymentMethod('dinheiro');
  };

  const doSave = async (type: 'income' | 'expense', forcedCategory?: TransactionCategory) => {
    const categoryToUse = forcedCategory ?? selectedCategory;
    if (!amount || amount <= 0) {
      Alert.alert('Valor invalido', 'Introduza um valor maior que zero.');
      return;
    }
    if (!categoryToUse) {
      setPendingType(type);
      setShowCategoryModal(true);
      return;
    }

    setSaving(true);
    setSavingType(type);
    try {
      const now = new Date().toISOString();
      const tx: Transaction = {
        id: genId(),
        type,
        amount,
        category: categoryToUse,
        description: description.trim() ? description.trim() : undefined,
        clientName: clientName.trim() ? clientName.trim() : undefined,
        paymentMethod,
        date: now.slice(0, 10),
        createdAt: now,
        synced: false,
      };
      await TransactionRepo.insert(tx);
      Alert.alert('Guardado', `${ANGOLA_CONFIG.formatCurrency(amount)} - ${CATEGORY_LABELS[categoryToUse]}`);
      onClear();
      // Try to push immediately when online/session is available.
      syncNow().catch((error) => {
        console.log('[SYNC][AUTO][sales]', error?.message ?? error);
      });
    } catch (error) {
      console.error('[Sales] save error:', error);
      Alert.alert('Erro', 'Nao foi possivel guardar. Tente novamente.');
    } finally {
      setSaving(false);
      setSavingType(null);
    }
  };

  const onCategorySelected = (category: TransactionCategory) => {
    setSelectedCategory(category);
    setShowCategoryModal(false);
    if (pendingType) {
      const type = pendingType;
      setPendingType(null);
      doSave(type, category);
    }
  };

  const openCategory = () => {
    setPendingType(null);
    setShowCategoryModal(true);
  };

  const categoryLabel = selectedCategory ? CATEGORY_LABELS[selectedCategory] : 'Selecionar categoria';
  const dynamicBottomPadding =
    Math.max(0, keyboardInset - insets.bottom) + SPACING.xl + insets.bottom;

  return (
    <Screen contentStyle={styles.content}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: dynamicBottomPadding }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.h1}>Registar</Text>
              <Text style={styles.subtitle}>Venda e despesa em segundos</Text>
            </View>
            <Badge label="MyPME" tone="blue" />
          </View>

          <Card style={styles.displayCard}>
            <Input
              placeholder="0"
              value={amountInput}
              onChangeText={onAmountChanged}
              keyboardType="decimal-pad"
              inputStyle={styles.amountInput}
            />
            <Text style={styles.amountPreview}>{formatted}</Text>
            <Pressable onPress={openCategory} style={styles.categoryRow}>
              <Text style={styles.categoryText}>{categoryLabel}</Text>
              <Text style={styles.categoryHint}>Alterar</Text>
            </Pressable>
          </Card>

          <View style={{ height: SPACING.sm }} />

          <Card>
            <Text style={styles.section}>Detalhes (opcional)</Text>
            <View style={{ height: SPACING.sm }} />
            <Input placeholder="Nome do cliente" value={clientName} onChangeText={setClientName} />
            <View style={{ height: SPACING.sm }} />
            <Input placeholder="Descricao" value={description} onChangeText={setDescription} />
          </Card>

          <View style={{ height: SPACING.sm }} />

          <Card>
            <Text style={styles.section}>Metodo de pagamento</Text>
            <View style={{ height: SPACING.sm }} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.paymentRow}>
                {PAYMENT.map((payment) => {
                  const active = paymentMethod === payment.value;
                  return (
                    <Pressable
                      key={payment.value}
                      onPress={() => setPaymentMethod(payment.value)}
                      style={[styles.paymentChip, active && styles.paymentChipActive]}
                    >
                      <Badge label={payment.label} tone={active ? payment.tone : 'gray'} />
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </Card>

          <View style={{ height: SPACING.sm }} />

          <Card style={styles.calculatorCard}>
            <View style={styles.keypadTopRow}>
              <Pressable onPress={onClear} style={[styles.keyTop, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                <Text style={[styles.keyTopText, { color: COLORS.expense }]}>C</Text>
              </Pressable>
              <Pressable onPress={openCategory} style={styles.keyTop}>
                <Text style={styles.keyTopText}>Categoria</Text>
              </Pressable>
            </View>

            <View style={{ height: SPACING.sm }} />

            {CALCULATOR_KEYS.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.keyRow}>
                {row.map((key) => (
                  <Pressable
                    key={key}
                    onPress={() => onCalculatorKey(key)}
                    style={[
                      styles.key,
                      CALCULATOR_OPERATORS.includes(key) && styles.operatorKey,
                      key === '=' && styles.equalKey,
                    ]}
                  >
                    <Text
                      style={[
                        styles.keyText,
                        CALCULATOR_OPERATORS.includes(key) && styles.operatorText,
                        key === '=' && styles.equalText,
                      ]}
                    >
                      {key}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}

            <View style={{ height: SPACING.sm }} />

            <View style={styles.keyRow}>
              <Pressable onPress={onDel} style={styles.key}>
                <Text style={styles.keyText}>DEL</Text>
              </Pressable>
            </View>

            <View style={{ height: SPACING.sm }} />

            <View style={styles.actions}>
              <Button
                title="Venda"
                variant="success"
                onPress={() => doSave('income')}
                loading={saving && savingType === 'income'}
                style={{ flex: 1 }}
              />
              <View style={{ width: SPACING.sm }} />
              <Button
                title="Despesa"
                variant="danger"
                onPress={() => doSave('expense')}
                loading={saving && savingType === 'expense'}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      <CategoryModal
        visible={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onSelect={onCategorySelected}
        type={pendingType ?? 'income'}
      />
    </Screen>
  );
};

const CategoryModal = ({
  visible,
  onClose,
  onSelect,
  type,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (c: TransactionCategory) => void;
  type: 'income' | 'expense';
}) => {
  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          <Text style={styles.modalTitle}>{type === 'income' ? 'Categoria (Venda)' : 'Categoria (Despesa)'}</Text>
          <View style={styles.grid}>
            {list.map((cat) => (
              <Pressable key={cat} style={styles.catBtn} onPress={() => onSelect(cat)}>
                <Text style={styles.catText}>{CATEGORY_LABELS[cat]}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  content: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingTop: SPACING.sm,
  },
  h1: { fontSize: 22, fontWeight: FONTS.weights.bold, color: COLORS.text },
  subtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 2 },

  displayCard: { paddingVertical: SPACING.lg },
  amountInput: {
    height: 64,
    fontSize: 32,
    fontWeight: FONTS.weights.bold,
    textAlign: 'center',
    color: COLORS.primaryDark,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSecondary,
  },
  amountPreview: {
    marginTop: SPACING.sm,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  categoryRow: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  categoryText: { color: COLORS.text, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold },
  categoryHint: { color: COLORS.primary, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold },

  section: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, fontWeight: FONTS.weights.semibold },
  paymentRow: { flexDirection: 'row', gap: SPACING.sm },
  paymentChip: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  paymentChipActive: {},

  calculatorCard: { padding: SPACING.md },
  keypadTopRow: { flexDirection: 'row', gap: SPACING.sm },
  keyTop: {
    flex: 1,
    height: 44,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyTopText: { color: COLORS.text, fontWeight: FONTS.weights.bold },
  keyRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm, alignItems: 'stretch' },
  key: {
    flex: 1,
    height: 52,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorKey: {
    backgroundColor: COLORS.primaryLight,
    borderColor: '#BFDBFE',
  },
  equalKey: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  keyText: { fontSize: 18, fontWeight: FONTS.weights.bold, color: COLORS.text },
  operatorText: { color: COLORS.primaryDark },
  equalText: { color: COLORS.textOnPrimary },
  actions: { flexDirection: 'row', marginTop: SPACING.sm },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
  },
  modalTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.text, marginBottom: SPACING.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  catBtn: {
    width: '48%',
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  catText: { color: COLORS.text, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold },
});

export default SalesScreen;
