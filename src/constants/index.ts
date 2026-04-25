// ============================================================
// CONSTANTES - 002
// ============================================================

export const COLORS = {
  primaryDark: '#0F172A',
  primary: '#2563EB',
  primaryLight: '#DBEAFE',
  secondary: '#0F172A',
  secondaryLight: '#E2E8F0',

  income: '#16A34A',
  expense: '#DC2626',
  debt: '#F59E0B',
  warning: '#F59E0B',

  background: '#F1F5F9',
  surface: '#FFFFFF',
  surfaceSecondary: '#E2E8F0',

  text: '#334155',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textOnPrimary: '#FFFFFF',

  border: '#CBD5E1',
  borderLight: '#E2E8F0',

  success: '#16A34A',
  error: '#DC2626',
  info: '#2563EB',

  dinheiro: '#16A34A',
  transferencia: '#2563EB',
  multicaixa: '#0F172A',
  fiado: '#F59E0B',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FONTS = {
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 28,
    title: 34,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export const BORDER_RADIUS = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 999,
};

const formatKz = (amount: number): string => {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  const negative = safe < 0 ? '-' : '';
  const digits = Math.abs(safe).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative}${grouped} Kz`;
};

export const ANGOLA_CONFIG = {
  currency: 'AOA',
  currencySymbol: 'Kz',
  formatCurrency: formatKz,
  taxRateSimplificado: 0.035,
  vatRate: 0.14,
  taxPaymentMonths: [3, 6, 9, 12],
  phonePrefix: '+244',
};

export const API_CONFIG = {
  baseUrl: __DEV__ ? 'http://10.0.2.2:3000/api' : 'https://api.example.com/api',
  timeout: 10000,
  syncIntervalMs: 5 * 60 * 1000,
};

export const CATEGORY_ICONS: Record<string, string> = {
  corte_cabelo: 'content-cut',
  manicure: 'spa',
  reparacao_auto: 'build',
  lavagem_auto: 'local-car-wash',
  consulta: 'medical-services',
  tratamento: 'healing',
  servico_outro: 'miscellaneous-services',
  venda_produto: 'shopping-bag',
  material: 'inventory',
  renda: 'home',
  agua_luz: 'bolt',
  transporte: 'directions-car',
  salario: 'people',
  impostos: 'account-balance',
  despesa_outro: 'money-off',
};

export const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Marco',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export * from './storage';
