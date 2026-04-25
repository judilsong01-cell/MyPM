// ============================================================
// TIPOS PRINCIPAIS - 002
// Negocio de servicos (cabeleireiro, oficina, etc.)
// ============================================================

// --- Utilizador / Negocio ---
export interface Business {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  address: string;
  businessType: BusinessType;
  nif?: string;
  logoUri?: string;
  currency: 'AOA';
  createdAt: string;
  syncedAt?: string;
}

export type BusinessType =
  | 'cabeleireiro'
  | 'oficina'
  | 'clinica'
  | 'restaurante'
  | 'comercio'
  | 'outro';

// --- Categorias ---
export type TransactionCategory =
  | 'corte_cabelo'
  | 'manicure'
  | 'reparacao_auto'
  | 'lavagem_auto'
  | 'consulta'
  | 'tratamento'
  | 'servico_outro'
  | 'venda_produto'
  | 'material'
  | 'renda'
  | 'agua_luz'
  | 'transporte'
  | 'salario'
  | 'impostos'
  | 'despesa_outro';

export const INCOME_CATEGORIES: TransactionCategory[] = [
  'corte_cabelo',
  'manicure',
  'reparacao_auto',
  'lavagem_auto',
  'consulta',
  'tratamento',
  'servico_outro',
  'venda_produto',
];

export const EXPENSE_CATEGORIES: TransactionCategory[] = [
  'material',
  'renda',
  'agua_luz',
  'transporte',
  'salario',
  'impostos',
  'despesa_outro',
];

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  corte_cabelo: 'Corte de Cabelo',
  manicure: 'Manicure / Pedicure',
  reparacao_auto: 'Reparacao Auto',
  lavagem_auto: 'Lavagem Auto',
  consulta: 'Consulta',
  tratamento: 'Tratamento',
  servico_outro: 'Outro Servico',
  venda_produto: 'Venda de Produto',
  material: 'Material / Consumiveis',
  renda: 'Renda',
  agua_luz: 'Agua e Luz',
  transporte: 'Transporte',
  salario: 'Salario',
  impostos: 'Impostos',
  despesa_outro: 'Outra Despesa',
};

// --- Transacao (Venda ou Despesa) ---
export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: TransactionCategory;
  description?: string;
  clientName?: string;
  paymentMethod: PaymentMethod;
  date: string;
  createdAt: string;
  synced: boolean;
  receiptUri?: string;
}

export type PaymentMethod = 'dinheiro' | 'transferencia' | 'multicaixa' | 'fiado';

// --- Dividas (Fiado / Kwatcha) ---
export interface Debt {
  id: string;
  clientName: string;
  clientPhone?: string;
  amount: number;
  description: string;
  serviceDate: string;
  dueDate?: string;
  status: 'pendente' | 'pago_parcial' | 'pago';
  paidAmount: number;
  notes?: string;
  createdAt: string;
  synced: boolean;
}

// --- Produto / Inventario ---
export interface Product {
  id: string;
  name: string;
  category: string;
  costPrice: number;
  sellPrice: number;
  quantity: number;
  minQuantity: number;
  unit: string;
  barcode?: string;
  photoUri?: string;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

// --- Dashboard / Relatorios ---
export interface MonthSummary {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  profit: number;
  transactionCount: number;
  topCategory: TransactionCategory;
}

export interface DashboardData {
  today: {
    income: number;
    expenses: number;
  };
  thisMonth: MonthSummary;
  last6Months: MonthSummary[];
  pendingDebts: number;
  lowStockCount: number;
}

// --- Conformidade Fiscal Angola ---
export interface TaxInfo {
  regime: 'simplificado' | 'geral';
  industrialTaxRate: number;
  vatRate: number;
  nextPaymentDate: string;
  estimatedTax: number;
}

// --- Navegacao ---
export type RootStackParamList = {
  Onboarding: undefined;
  Auth: undefined;
  Verify: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Sales: undefined;
  Inventory: undefined;
  Debts: undefined;
  More: undefined;
};

export type SalesStackParamList = {
  SalesHome: undefined;
  AddTransaction: { type: 'income' | 'expense' };
  TransactionDetail: { transactionId: string };
  TransactionHistory: undefined;
};
