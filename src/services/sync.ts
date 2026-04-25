import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { STORAGE_KEYS } from '../constants/storage';
import { DebtRepo, ProductRepo, TransactionRepo } from '../database';
import { appwriteAccount, appwriteDatabases, Permission, Query, Role } from './appwrite';
import { APPWRITE_COLLECTIONS, APPWRITE_DATABASE_ID } from './appwrite.secrets';

const makeUuid = (): string => {
  // Prefer a real UUID when available (Hermes/JS runtime), fallback to a pseudo-UUID.
  const g: any = globalThis as any;
  const uuid = g?.crypto?.randomUUID?.();
  if (uuid) return String(uuid);
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
};

export type SyncSummary = {
  pushed: { transactions: number; debts: number; products: number };
  pulled: { transactions: number; debts: number; products: number };
  at: string;
};

export type SyncDiagnostics = {
  isOnline: boolean;
  userId: string | null;
  localUnsynced: { transactions: number; debts: number; products: number };
  remoteChecks: {
    transactions: 'ok' | string;
    debts: 'ok' | string;
    products: 'ok' | string;
  };
};

let syncInFlight: Promise<SyncSummary> | null = null;

const toDateOnly = (value: any): string => {
  if (!value) return new Date().toISOString().slice(0, 10);
  const s = String(value);
  // Accept both YYYY-MM-DD and full ISO strings.
  return s.length >= 10 ? s.slice(0, 10) : new Date().toISOString().slice(0, 10);
};

const getLastSyncAt = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.lastSyncAt);
  } catch {
    return null;
  }
};

const setLastSyncAt = async (iso: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.lastSyncAt, iso);
  } catch {
    // ignore
  }
};

const toErrorMessage = (error: any): string => {
  if (!error) return 'Erro desconhecido.';
  if (typeof error === 'string') return error;

  const message = String(error.message ?? 'Erro desconhecido.');
  const code = error.code ? ` [${error.code}]` : '';
  const details = error.details ? ` | details: ${String(error.details)}` : '';
  const hint = error.hint ? ` | hint: ${String(error.hint)}` : '';
  return `${message}${code}${details}${hint}`;
};

const checkRemoteTable = async (
  table: 'transactions' | 'debts' | 'products'
): Promise<'ok' | string> => {
  try {
    const collectionId = (APPWRITE_COLLECTIONS as any)?.[table];
    if (!collectionId || String(collectionId).includes('<')) return 'Config incompleta';

    await appwriteDatabases.listDocuments({
      databaseId: APPWRITE_DATABASE_ID,
      collectionId,
      queries: [Query.limit(1)],
    });
    return 'ok';
  } catch (error: any) {
    return toErrorMessage(error);
  }
};

const assertRemoteTablesReady = async (): Promise<void> => {
  const tx = await checkRemoteTable('transactions');
  if (tx !== 'ok') throw new Error(`[Appwrite.transactions] ${tx}`);

  const debts = await checkRemoteTable('debts');
  if (debts !== 'ok') throw new Error(`[Appwrite.debts] ${debts}`);

  const products = await checkRemoteTable('products');
  if (products !== 'ok') throw new Error(`[Appwrite.products] ${products}`);
};

export const getSyncDiagnostics = async (): Promise<SyncDiagnostics> => {
  const net = await NetInfo.fetch();
  const isOnline = !!net.isConnected;

  const user = await appwriteAccount.get().catch(() => null);
  const userId = user?.$id ? String(user.$id) : null;

  const [transactions, debts, products] = await Promise.all([
    TransactionRepo.getUnsynced().then((rows) => rows.length).catch(() => 0),
    DebtRepo.getUnsynced().then((rows) => rows.length).catch(() => 0),
    ProductRepo.getUnsynced().then((rows) => rows.length).catch(() => 0),
  ]);

  const remoteChecks = isOnline
    ? {
        transactions: await checkRemoteTable('transactions'),
        debts: await checkRemoteTable('debts'),
        products: await checkRemoteTable('products'),
      }
    : {
        transactions: 'Sem internet',
        debts: 'Sem internet',
        products: 'Sem internet',
      };

  return {
    isOnline,
    userId,
    localUnsynced: { transactions, debts, products },
    remoteChecks,
  };
};

const runSync = async (): Promise<SyncSummary> => {
  console.log('[SYNC] start');
  const net = await NetInfo.fetch();
  if (!net.isConnected) {
    console.log('[SYNC] offline');
    throw new Error('Sem internet. Conecte-se para sincronizar.');
  }

  const user = await appwriteAccount.get().catch(() => null);
  if (!user?.$id) throw new Error('Sem sessao. Faca login para sincronizar.');

  const isVerified = !!user.emailVerification || !!user.phoneVerification;
  if (!isVerified) throw new Error('Conta nao verificada. Confirme email ou telefone para sincronizar.');

  const userId = String(user.$id);
  console.log('[SYNC] user', userId);

  await assertRemoteTablesReady();

  const at = new Date().toISOString();
  const lastSyncAt = (await getLastSyncAt()) ?? '1970-01-01T00:00:00.000Z';

  let pushedTransactions = 0;
  let pushedDebts = 0;
  let pushedProducts = 0;

  let pulledTransactions = 0;
  let pulledDebts = 0;
  let pulledProducts = 0;

  // --------------------
  // PUSH local -> remote
  // --------------------
  const txRows = await TransactionRepo.getUnsynced();
  console.log('[SYNC] push transactions', txRows.length);
  for (const row of txRows) {
    const remoteId = row.remote_id ? String(row.remote_id) : makeUuid();

    const payload: any = {
      userId,
      type: row.type,
      amount: row.amount,
      category: row.category,
      description: row.description ?? null,
      clientName: row.client_name ?? null,
      paymentMethod: row.payment_method ?? 'dinheiro',
      date: toDateOnly(row.date),
      receiptUri: row.receipt_uri ?? null,
      createdAt: row.created_at ?? at,
      updatedAt: at,
    };

    const permissions = [
      Permission.read(Role.user(userId, 'verified')),
      Permission.update(Role.user(userId, 'verified')),
      Permission.delete(Role.user(userId, 'verified')),
    ];

    const saved = await appwriteDatabases.upsertDocument({
      databaseId: APPWRITE_DATABASE_ID,
      collectionId: APPWRITE_COLLECTIONS.transactions,
      documentId: remoteId,
      data: payload,
      permissions,
    });

    const savedId = (saved as any)?.$id ? String((saved as any).$id) : remoteId;
    await TransactionRepo.setRemoteIdAndSynced(row.id, savedId, userId);
    pushedTransactions += 1;
  }

  const debtRows = await DebtRepo.getUnsynced();
  console.log('[SYNC] push debts', debtRows.length);
  for (const row of debtRows) {
    const remoteId = row.remote_id ? String(row.remote_id) : makeUuid();
    const payload: any = {
      userId,
      clientName: row.client_name,
      clientPhone: row.client_phone ?? null,
      amount: row.amount,
      description: row.description,
      serviceDate: toDateOnly(row.service_date),
      dueDate: row.due_date ? toDateOnly(row.due_date) : null,
      status: row.status ?? 'pendente',
      paidAmount: row.paid_amount ?? 0,
      notes: row.notes ?? null,
      createdAt: row.created_at ?? at,
      updatedAt: at,
    };

    const permissions = [
      Permission.read(Role.user(userId, 'verified')),
      Permission.update(Role.user(userId, 'verified')),
      Permission.delete(Role.user(userId, 'verified')),
    ];

    const saved = await appwriteDatabases.upsertDocument({
      databaseId: APPWRITE_DATABASE_ID,
      collectionId: APPWRITE_COLLECTIONS.debts,
      documentId: remoteId,
      data: payload,
      permissions,
    });

    const savedId = (saved as any)?.$id ? String((saved as any).$id) : remoteId;
    await DebtRepo.setRemoteIdAndSynced(row.id, savedId, userId);
    pushedDebts += 1;
  }

  const productRows = await ProductRepo.getUnsynced();
  console.log('[SYNC] push products', productRows.length);
  for (const row of productRows) {
    const remoteId = row.remote_id ? String(row.remote_id) : makeUuid();
    const payload: any = {
      userId,
      name: row.name,
      category: row.category ?? null,
      costPrice: row.cost_price ?? 0,
      sellPrice: row.sell_price ?? 0,
      quantity: row.quantity ?? 0,
      minQuantity: row.min_quantity ?? 1,
      unit: row.unit ?? 'unidade',
      barcode: row.barcode ?? null,
      photoUri: row.photo_uri ?? null,
      createdAt: row.created_at ?? at,
      updatedAt: at,
    };

    const permissions = [
      Permission.read(Role.user(userId, 'verified')),
      Permission.update(Role.user(userId, 'verified')),
      Permission.delete(Role.user(userId, 'verified')),
    ];

    const saved = await appwriteDatabases.upsertDocument({
      databaseId: APPWRITE_DATABASE_ID,
      collectionId: APPWRITE_COLLECTIONS.products,
      documentId: remoteId,
      data: payload,
      permissions,
    });

    const savedId = (saved as any)?.$id ? String((saved as any).$id) : remoteId;
    await ProductRepo.setRemoteIdAndSynced(row.id, savedId, userId);
    pushedProducts += 1;
  }

  // --------------------
  // PULL remote -> local
  // --------------------
  const txPull = await appwriteDatabases.listDocuments({
    databaseId: APPWRITE_DATABASE_ID,
    collectionId: APPWRITE_COLLECTIONS.transactions,
    queries: [Query.greaterThan('$updatedAt', lastSyncAt), Query.orderAsc('$updatedAt'), Query.limit(500)],
  });
  const txDocs = (txPull as any)?.documents ?? [];

  console.log('[SYNC] pull transactions', txDocs.length);
  for (const r of txDocs) {
    await TransactionRepo.upsertFromRemote(r, userId);
    pulledTransactions += 1;
  }

  const debtPull = await appwriteDatabases.listDocuments({
    databaseId: APPWRITE_DATABASE_ID,
    collectionId: APPWRITE_COLLECTIONS.debts,
    queries: [Query.greaterThan('$updatedAt', lastSyncAt), Query.orderAsc('$updatedAt'), Query.limit(500)],
  });
  const debtDocs = (debtPull as any)?.documents ?? [];

  console.log('[SYNC] pull debts', debtDocs.length);
  for (const r of debtDocs) {
    await DebtRepo.upsertFromRemote(r, userId);
    pulledDebts += 1;
  }

  const productPull = await appwriteDatabases.listDocuments({
    databaseId: APPWRITE_DATABASE_ID,
    collectionId: APPWRITE_COLLECTIONS.products,
    queries: [Query.greaterThan('$updatedAt', lastSyncAt), Query.orderAsc('$updatedAt'), Query.limit(500)],
  });
  const productDocs = (productPull as any)?.documents ?? [];

  console.log('[SYNC] pull products', productDocs.length);
  for (const r of productDocs) {
    await ProductRepo.upsertFromRemote(r, userId);
    pulledProducts += 1;
  }

  await setLastSyncAt(at);
  console.log('[SYNC] done', at);

  return {
    pushed: { transactions: pushedTransactions, debts: pushedDebts, products: pushedProducts },
    pulled: { transactions: pulledTransactions, debts: pulledDebts, products: pulledProducts },
    at,
  };
};

// Offline-first sync:
// 1) Requires an authenticated + verified Appwrite user.
// 2) Pushes local unsynced rows to Appwrite Databases (upsert).
// 3) Pulls remote changes since last sync and upserts into SQLite.
export const syncNow = async (): Promise<SyncSummary> => {
  if (syncInFlight) return syncInFlight;

  syncInFlight = runSync()
    .catch((error) => {
      throw new Error(toErrorMessage(error));
    })
    .finally(() => {
      syncInFlight = null;
    });

  return syncInFlight;
};
