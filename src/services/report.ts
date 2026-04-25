import Share from 'react-native-share';
import { generatePDF } from 'react-native-html-to-pdf';

import { ANGOLA_CONFIG } from '../constants';
import { DebtRepo, ProductRepo, TransactionRepo } from '../database';
import { CATEGORY_LABELS, type Debt, type Product, type Transaction } from '../types';
import { appwriteAccount } from './appwrite';

type BasicPdfReportResult = {
  filePath: string;
  numberOfPages?: number;
  shared: boolean;
};

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDate = (value?: string | null): string => {
  if (!value) return '-';
  return String(value).slice(0, 10);
};

const buildTransactionRows = (items: Transaction[]): string => {
  if (items.length === 0) {
    return '<tr><td colspan="6" class="empty">Sem transacoes registadas.</td></tr>';
  }

  return items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(formatDate(item.date))}</td>
          <td>${item.type === 'income' ? 'Entrada' : 'Saida'}</td>
          <td>${escapeHtml(CATEGORY_LABELS[item.category] ?? item.category)}</td>
          <td>${escapeHtml(item.description ?? item.clientName ?? '-')}</td>
          <td>${escapeHtml(item.paymentMethod)}</td>
          <td class="amount">${escapeHtml(ANGOLA_CONFIG.formatCurrency(item.amount))}</td>
        </tr>
      `
    )
    .join('');
};

const buildDebtRows = (items: Debt[]): string => {
  if (items.length === 0) {
    return '<tr><td colspan="6" class="empty">Sem fiados registados.</td></tr>';
  }

  return items
    .map((item) => {
      const pending = Math.max(item.amount - item.paidAmount, 0);
      return `
        <tr>
          <td>${escapeHtml(item.clientName)}</td>
          <td>${escapeHtml(item.description)}</td>
          <td>${escapeHtml(ANGOLA_CONFIG.formatCurrency(item.amount))}</td>
          <td>${escapeHtml(ANGOLA_CONFIG.formatCurrency(item.paidAmount))}</td>
          <td>${escapeHtml(ANGOLA_CONFIG.formatCurrency(pending))}</td>
          <td>${escapeHtml(item.status)}</td>
        </tr>
      `;
    })
    .join('');
};

const buildProductRows = (items: Product[]): string => {
  if (items.length === 0) {
    return '<tr><td colspan="6" class="empty">Sem produtos registados.</td></tr>';
  }

  return items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.category || '-')}</td>
          <td>${escapeHtml(item.unit)}</td>
          <td>${escapeHtml(String(item.quantity))}</td>
          <td>${escapeHtml(ANGOLA_CONFIG.formatCurrency(item.costPrice))}</td>
          <td>${escapeHtml(ANGOLA_CONFIG.formatCurrency(item.sellPrice))}</td>
        </tr>
      `
    )
    .join('');
};

const buildHtml = (params: {
  owner: string;
  createdAt: string;
  transactions: Transaction[];
  debts: Debt[];
  products: Product[];
}): string => {
  const { owner, createdAt, transactions, debts, products } = params;

  const totalIncome = transactions
    .filter((item) => item.type === 'income')
    .reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = transactions
    .filter((item) => item.type === 'expense')
    .reduce((sum, item) => sum + item.amount, 0);
  const totalProfit = totalIncome - totalExpenses;
  const totalDebtPending = debts.reduce(
    (sum, item) => sum + Math.max(item.amount - item.paidAmount, 0),
    0
  );
  const lowStockCount = products.filter((item) => item.quantity <= item.minQuantity).length;

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #0f172a;
            padding: 18px;
            background: #f8fafc;
          }
          .hero {
            background: #0f172a;
            color: white;
            padding: 24px;
            border-radius: 18px;
            margin-bottom: 18px;
          }
          .eyebrow {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
            opacity: 0.72;
            margin-bottom: 8px;
          }
          .title {
            font-size: 28px;
            font-weight: bold;
            margin: 0 0 6px 0;
          }
          .subtitle {
            font-size: 13px;
            line-height: 1.5;
            opacity: 0.84;
            margin: 0;
          }
          .meta {
            margin-top: 14px;
            font-size: 12px;
            opacity: 0.8;
          }
          .grid {
            margin: 18px 0 20px 0;
            width: 100%;
          }
          .grid td {
            width: 50%;
            vertical-align: top;
            padding: 0 8px 12px 0;
          }
          .metric {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 16px;
          }
          .metric-label {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 8px;
          }
          .metric-value {
            font-size: 22px;
            font-weight: bold;
            color: #0f172a;
          }
          .section {
            margin-top: 22px;
          }
          .section-title {
            font-size: 18px;
            font-weight: bold;
            margin: 0 0 10px 0;
          }
          .section-copy {
            margin: 0 0 10px 0;
            color: #475569;
            font-size: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 16px;
            overflow: hidden;
          }
          th {
            text-align: left;
            background: #e2e8f0;
            color: #0f172a;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            padding: 10px;
          }
          td {
            padding: 10px;
            font-size: 12px;
            border-bottom: 1px solid #e2e8f0;
            color: #334155;
          }
          tr:last-child td {
            border-bottom: none;
          }
          .amount {
            text-align: right;
            font-weight: bold;
          }
          .empty {
            text-align: center;
            color: #64748b;
            padding: 18px;
          }
        </style>
      </head>
      <body>
        <div class="hero">
          <div class="eyebrow">MyPME - Relatorio basico</div>
          <h1 class="title">Resumo operacional e financeiro</h1>
          <p class="subtitle">
            Documento basico gerado a partir da app com os dados locais das tabelas
            transactions, debts e products.
          </p>
          <div class="meta">Conta: ${escapeHtml(owner)} | Gerado em: ${escapeHtml(createdAt)}</div>
        </div>

        <table class="grid" role="presentation">
          <tr>
            <td>
              <div class="metric">
                <div class="metric-label">Entradas registadas</div>
                <div class="metric-value">${escapeHtml(ANGOLA_CONFIG.formatCurrency(totalIncome))}</div>
              </div>
            </td>
            <td>
              <div class="metric">
                <div class="metric-label">Saidas registadas</div>
                <div class="metric-value">${escapeHtml(ANGOLA_CONFIG.formatCurrency(totalExpenses))}</div>
              </div>
            </td>
          </tr>
          <tr>
            <td>
              <div class="metric">
                <div class="metric-label">Saldo operacional</div>
                <div class="metric-value">${escapeHtml(ANGOLA_CONFIG.formatCurrency(totalProfit))}</div>
              </div>
            </td>
            <td>
              <div class="metric">
                <div class="metric-label">Fiado pendente</div>
                <div class="metric-value">${escapeHtml(ANGOLA_CONFIG.formatCurrency(totalDebtPending))}</div>
              </div>
            </td>
          </tr>
          <tr>
            <td>
              <div class="metric">
                <div class="metric-label">Transacoes</div>
                <div class="metric-value">${escapeHtml(String(transactions.length))}</div>
              </div>
            </td>
            <td>
              <div class="metric">
                <div class="metric-label">Produtos com alerta de stock</div>
                <div class="metric-value">${escapeHtml(String(lowStockCount))}</div>
              </div>
            </td>
          </tr>
        </table>

        <div class="section">
          <h2 class="section-title">Transactions</h2>
          <p class="section-copy">Entradas e saidas registadas localmente.</p>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Categoria</th>
                <th>Descricao</th>
                <th>Pagamento</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              ${buildTransactionRows(transactions)}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2 class="section-title">Debts</h2>
          <p class="section-copy">Situacao atual do fiado registado na app.</p>
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Descricao</th>
                <th>Total</th>
                <th>Pago</th>
                <th>Pendente</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${buildDebtRows(debts)}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2 class="section-title">Products</h2>
          <p class="section-copy">Base atual de produtos e quantidades locais.</p>
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Unidade</th>
                <th>Qtd</th>
                <th>Custo</th>
                <th>Venda</th>
              </tr>
            </thead>
            <tbody>
              ${buildProductRows(products)}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `;
};

export const generateBasicPdfReport = async (): Promise<BasicPdfReportResult> => {
  const [user, transactions, debts, products] = await Promise.all([
    appwriteAccount.get().catch(() => null),
    TransactionRepo.getAll(),
    DebtRepo.getAll(),
    ProductRepo.getAll(),
  ]);

  const owner = user?.email ?? 'Conta ativa';
  const createdAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const html = buildHtml({ owner, createdAt, transactions, debts, products });
  const fileName = `mypme-relatorio-${new Date().toISOString().slice(0, 10)}`;

  const pdf = await generatePDF({
    html,
    fileName,
    directory: 'Documents',
    width: 612,
    height: 792,
  });

  let shared = false;
  try {
    await Share.open({
      url: `file://${pdf.filePath}`,
      type: 'application/pdf',
      filename: fileName,
      failOnCancel: false,
      title: 'Exportar relatorio MyPME',
      subject: 'Relatorio basico MyPME',
    });
    shared = true;
  } catch (error: any) {
    const message = String(error?.message ?? '');
    const wasCancelled =
      message.toLowerCase().includes('cancel') || message.toLowerCase().includes('dismissed');
    if (!wasCancelled) throw error;
  }

  return {
    filePath: pdf.filePath,
    numberOfPages: pdf.numberOfPages,
    shared,
  };
};

export type { BasicPdfReportResult };
