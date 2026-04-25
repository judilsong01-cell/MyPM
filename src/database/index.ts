// ============================================================
// BASE DE DADOS LOCAL — SQLite
// Funciona 100% offline. Sincroniza com backend quando online.
// ============================================================

import SQLite, { SQLiteDatabase } from 'react-native-sqlite-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/storage';

SQLite.enablePromise(true);
SQLite.DEBUG(__DEV__);

let db: SQLiteDatabase | null = null;
let dbPromise: Promise<SQLiteDatabase> | null = null;

const getActiveUserId = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.activeUserId);
  } catch {
    return null;
  }
};

const requireActiveUserId = async (): Promise<string> => {
  const fromStorage = await getActiveUserId();
  if (fromStorage) return fromStorage;

  throw new Error('Sem utilizador ativo. Faca login novamente.');
};

export const getDatabase = async (): Promise<SQLiteDatabase> => {
  if (db) return db;
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    const opened = await SQLite.openDatabase({
      name: 'mypme.db',
      location: 'default',
    });
    db = opened;
    await runMigrations(opened);
    return opened;
  })();

  return dbPromise;
};

// SECURITY: this app stores data offline in SQLite.
// If the user logs out or switches account on the same device, we must wipe local rows
// so one account cannot see another account's offline data.
export const wipeLocalData = async (): Promise<void> => {
  const database = await getDatabase();
  const statements = [
    'DELETE FROM transactions',
    'DELETE FROM debts',
    'DELETE FROM products',
    'DELETE FROM business',
    'DELETE FROM sync_queue',
  ];
  for (const sql of statements) {
    try {
      await database.executeSql(sql);
    } catch {
      // ignore missing tables
    }
  }
};

// ---- MIGRATIONS ----
const runMigrations = async (database: SQLiteDatabase): Promise<void> => {
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    )
  `);

  // Some SQLite bindings can be inconsistent with aggregate aliases in `rows.item(0)`.
  // Use an explicit ORDER BY query instead.
  const [result] = await database.executeSql(
    'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
  );
  const currentVersion =
    result.rows.length > 0 ? (result.rows.item(0)?.version ?? 0) : 0;

  if (currentVersion < 1) await migration_v1(database);
  if (currentVersion < 2) await migration_v2(database);
};

// Migration 1 — Estrutura inicial
const migration_v1 = async (database: SQLiteDatabase): Promise<void> => {
  // Negócio
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS business (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT,
      business_type TEXT DEFAULT 'outro',
      nif TEXT,
      logo_uri TEXT,
      currency TEXT DEFAULT 'AOA',
      created_at TEXT NOT NULL,
      synced_at TEXT
    )
  `);

  // Transacções (vendas e despesas)
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      remote_id TEXT,
      user_id TEXT,
      type TEXT NOT NULL CHECK(type IN ('income','expense')),
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      client_name TEXT,
      payment_method TEXT NOT NULL DEFAULT 'dinheiro',
      date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      synced INTEGER DEFAULT 0,
      receipt_uri TEXT
    )
  `);
  await database.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_transactions_date
    ON transactions(date DESC)
  `);
  await database.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_transactions_type
    ON transactions(type)
  `);

  // Dívidas (fiado / kwatcha)
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS debts (
      id TEXT PRIMARY KEY,
      remote_id TEXT,
      user_id TEXT,
      client_name TEXT NOT NULL,
      client_phone TEXT,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      service_date TEXT NOT NULL,
      due_date TEXT,
      status TEXT DEFAULT 'pendente' CHECK(status IN ('pendente','pago_parcial','pago')),
      paid_amount REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      synced INTEGER DEFAULT 0
    )
  `);

  // Inventário / Produtos
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      remote_id TEXT,
      user_id TEXT,
      name TEXT NOT NULL,
      category TEXT,
      cost_price REAL NOT NULL DEFAULT 0,
      sell_price REAL NOT NULL DEFAULT 0,
      quantity REAL NOT NULL DEFAULT 0,
      min_quantity REAL NOT NULL DEFAULT 1,
      unit TEXT DEFAULT 'unidade',
      barcode TEXT,
      photo_uri TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced INTEGER DEFAULT 0
    )
  `);
  await database.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_products_low_stock
    ON products(quantity, min_quantity)
  `);

  // Fila de sincronização (operações offline a enviar)
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('create','update','delete')),
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      attempts INTEGER DEFAULT 0
    )
  `);

  // Idempotent: avoid UNIQUE constraint errors if the row already exists.
  await database.executeSql('INSERT OR IGNORE INTO schema_version (version) VALUES (1)');
  console.log('[DB] Migration v1 aplicada com sucesso');
};

// Migration 2 — colunas para sync remoto (idempotente por ALTER TABLE)
const migration_v2 = async (database: SQLiteDatabase): Promise<void> => {
  // Avoid noisy "duplicate column name" logs by checking schema first.
  const ensureColumn = async (table: string, column: string, type: string) => {
    const [info] = await database.executeSql(`PRAGMA table_info(${table})`);
    const exists = Array.from({ length: info.rows.length }, (_, i) => info.rows.item(i))
      .some((r: any) => r?.name === column);
    if (exists) return;
    await database.executeSql(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  };

  await ensureColumn('transactions', 'remote_id', 'TEXT');
  await ensureColumn('transactions', 'user_id', 'TEXT');
  await ensureColumn('transactions', 'updated_at', 'TEXT');

  await ensureColumn('debts', 'remote_id', 'TEXT');
  await ensureColumn('debts', 'user_id', 'TEXT');
  await ensureColumn('debts', 'updated_at', 'TEXT');

  await ensureColumn('products', 'remote_id', 'TEXT');
  await ensureColumn('products', 'user_id', 'TEXT');

  await database.executeSql('INSERT OR IGNORE INTO schema_version (version) VALUES (2)');
  console.log('[DB] Migration v2 aplicada com sucesso');
};

// ---- REPOSITÓRIO DE TRANSACÇÕES ----
export const TransactionRepo = {
  async insert(t: import('../types').Transaction): Promise<void> {
    const database = await getDatabase();
    const userId = await requireActiveUserId();
    const now = new Date().toISOString();
    await database.executeSql(
      `INSERT INTO transactions
        (id, remote_id, user_id, type, amount, category, description, client_name,
         payment_method, date, created_at, updated_at, synced, receipt_uri)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        t.id, null, userId, t.type, t.amount, t.category, t.description ?? null,
        t.clientName ?? null, t.paymentMethod, t.date,
        t.createdAt, now, t.synced ? 1 : 0, t.receiptUri ?? null,
      ]
    );
  },

  async getAll(): Promise<import('../types').Transaction[]> {
    const database = await getDatabase();
    const userId = await requireActiveUserId();
    const [result] = await database.executeSql(
      `SELECT * FROM transactions
       WHERE (user_id IS NULL OR user_id = ?)
       ORDER BY date DESC, created_at DESC`,
      [userId]
    );
    return Array.from({ length: result.rows.length }, (_, i) =>
      rowToTransaction(result.rows.item(i))
    );
  },

  async getByDateRange(
    startDate: string,
    endDate: string
  ): Promise<import('../types').Transaction[]> {
    const database = await getDatabase();
    const userId = await requireActiveUserId();
    const [result] = await database.executeSql(
      `SELECT * FROM transactions
       WHERE (user_id IS NULL OR user_id = ?) AND date >= ? AND date <= ?
       ORDER BY date DESC, created_at DESC`,
      [userId, startDate, endDate]
    );
    return Array.from({ length: result.rows.length }, (_, i) =>
      rowToTransaction(result.rows.item(i))
    );
  },

  async getMonthSummary(yearMonth: string): Promise<{ income: number; expenses: number }> {
    const database = await getDatabase();
    const userId = await requireActiveUserId();
    const [result] = await database.executeSql(
      `SELECT
        SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as total_expenses
       FROM transactions
       WHERE (user_id IS NULL OR user_id = ?) AND strftime('%Y-%m', date) = ?`,
      [userId, yearMonth]
    );
    const row = result.rows.item(0);
    return {
      income: row?.total_income ?? 0,
      expenses: row?.total_expenses ?? 0,
    };
  },

  async getLast6MonthsSummary(): Promise<import('../types').MonthSummary[]> {
    const database = await getDatabase();
    const userId = await requireActiveUserId();
    const [result] = await database.executeSql(
      `SELECT
        strftime('%Y-%m', date) as month,
        SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as total_expenses,
        COUNT(*) as transaction_count
       FROM transactions
       WHERE (user_id IS NULL OR user_id = ?) AND date >= date('now', '-6 months')
       GROUP BY strftime('%Y-%m', date)
       ORDER BY month DESC
       LIMIT 6`,
      [userId]
    );
    return Array.from({ length: result.rows.length }, (_, i) => {
      const r = result.rows.item(i);
      return {
        month: r.month,
        totalIncome: r.total_income ?? 0,
        totalExpenses: r.total_expenses ?? 0,
        profit: (r.total_income ?? 0) - (r.total_expenses ?? 0),
        transactionCount: r.transaction_count,
        topCategory: 'servico_outro' as any,
      };
    });
  },

  async getUnsyncedCount(): Promise<number> {
    const database = await getDatabase();
    const userId = await requireActiveUserId();
    const [result] = await database.executeSql(
      'SELECT COUNT(*) as c FROM transactions WHERE synced = 0 AND (user_id IS NULL OR user_id = ?)',
      [userId]
    );
    return result.rows.item(0)?.c ?? 0;
  },

  async markSynced(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const database = await getDatabase();
    const userId = await requireActiveUserId();
    const placeholders = ids.map(() => '?').join(',');
    await database.executeSql(
      `UPDATE transactions SET synced = 1 WHERE id IN (${placeholders}) AND (user_id IS NULL OR user_id = ?)`,
      [...ids, userId]
    );
  },

  async getUnsynced(): Promise<any[]> {
    const database = await getDatabase();
    const userId = await requireActiveUserId();
    const [result] = await database.executeSql(
      'SELECT * FROM transactions WHERE synced = 0 AND (user_id IS NULL OR user_id = ?) ORDER BY created_at ASC',
      [userId]
    );
    return Array.from({ length: result.rows.length }, (_, i) => result.rows.item(i));
  },

  async setRemoteIdAndSynced(localId: string, remoteId: string, userId: string): Promise<void> {
    const database = await getDatabase();
    const now = new Date().toISOString();
    await database.executeSql(
      'UPDATE transactions SET remote_id=?, user_id=?, updated_at=?, synced=1 WHERE id=? AND (user_id IS NULL OR user_id = ?)',
      [remoteId, userId, now, localId, userId]
    );
  },

  // Upsert using Appwrite document shape (best-effort; accepts legacy snake_case too).
  // We store the remote document id in both `id` (local) and `remote_id` when the row came from server.
  async upsertFromRemote(remote: any, userId: string): Promise<void> {
    const database = await getDatabase();
    const remoteId = String(remote?.$id ?? remote?.id);

    const type = remote.type;
    const amount = Number(remote.amount ?? 0);
    const category = remote.category;
    const description = remote.description ?? null;
    const clientName = remote.clientName ?? remote.client_name ?? null;
    const paymentMethod = remote.paymentMethod ?? remote.payment_method ?? 'dinheiro';
    const date = remote.date ? String(remote.date) : new Date().toISOString().slice(0, 10);
    const createdAt = remote.createdAt ? String(remote.createdAt) : String(remote?.$createdAt ?? new Date().toISOString());
    const updatedAt = remote.updatedAt ? String(remote.updatedAt) : String(remote?.$updatedAt ?? new Date().toISOString());
    const receiptUri = remote.receiptUri ?? remote.receipt_uri ?? null;

    const [res] = await database.executeSql(
      `UPDATE transactions SET
        remote_id=?,
        user_id=?,
        type=?,
        amount=?,
        category=?,
        description=?,
        client_name=?,
        payment_method=?,
        date=?,
        created_at=?,
        updated_at=?,
        receipt_uri=?,
        synced=1
       WHERE (remote_id=? OR id=?) AND (user_id IS NULL OR user_id=?)`,
      [
        remoteId,
        userId,
        type,
        amount,
        category,
        description,
        clientName,
        paymentMethod,
        date,
        createdAt,
        updatedAt,
        receiptUri,
        remoteId,
        remoteId,
        userId,
      ]
    );

    if ((res as any).rowsAffected > 0) return;

    await database.executeSql(
      `INSERT INTO transactions
        (id, remote_id, user_id, type, amount, category, description, client_name,
         payment_method, date, created_at, updated_at, synced, receipt_uri)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        remoteId,
        remoteId,
        userId,
        type,
        amount,
        category,
        description,
        clientName,
        paymentMethod,
        date,
        createdAt,
        updatedAt,
        1,
        receiptUri,
      ]
    );
  },
};

// ---- REPOSITÓRIO DE DÍVIDAS ----
export const DebtRepo = {
  async insert(d: import('../types').Debt): Promise<void> {
    const database = await getDatabase();
    const userId = await requireActiveUserId();
    const now = new Date().toISOString();
    await database.executeSql(
      `INSERT INTO debts
        (id, remote_id, user_id, client_name, client_phone, amount, description,
         service_date, due_date, status, paid_amount, notes, created_at, updated_at, synced)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        d.id, null, userId, d.clientName, d.clientPhone ?? null, d.amount,
        d.description, d.serviceDate, d.dueDate ?? null,
        d.status, d.paidAmount, d.notes ?? null,
        d.createdAt, now, d.synced ? 1 : 0,
      ]
    );
  },

  async getAll(): Promise<import('../types').Debt[]> {
    const database = await getDatabase();
    const userId = await requireActiveUserId();
    const [result] = await database.executeSql(
      `SELECT * FROM debts
       WHERE (user_id IS NULL OR user_id = ?)
       ORDER BY service_date DESC, created_at DESC`,
      [userId]
    );
    return Array.from({ length: result.rows.length }, (_, i) =>
      rowToDebt(result.rows.item(i))
    );
  },

  async getPending(): Promise<import('../types').Debt[]> {
    const database = await getDatabase();
    const userId = await requireActiveUserId();
    const [result] = await database.executeSql(
      `SELECT * FROM debts
       WHERE (user_id IS NULL OR user_id = ?) AND status != 'pago'
       ORDER BY service_date DESC`,
      [userId]
    );
    return Array.from({ length: result.rows.length }, (_, i) =>
      rowToDebt(result.rows.item(i))
    );
  },

  async getTotalPending(): Promise<number> {
    const database = await getDatabase();
    const userId = await requireActiveUserId();
    const [result] = await database.executeSql(
      `SELECT SUM(amount - paid_amount) as total
       FROM debts WHERE (user_id IS NULL OR user_id = ?) AND status != 'pago'`,
      [userId]
    );
    return result.rows.item(0)?.total ?? 0;
  },

  async markPaid(id: string): Promise<void> {
    const database = await getDatabase();
    const userId = await requireActiveUserId();
    const now = new Date().toISOString();
    await database.executeSql(
      `UPDATE debts SET status='pago', paid_amount=amount, updated_at=?, synced=0 WHERE id=? AND (user_id IS NULL OR user_id=?)`,
      [now, id, userId]
    );
  },

  async getUnsynced(): Promise<any[]> {
    const database = await getDatabase();
    const userId = await requireActiveUserId();
    const [result] = await database.executeSql(
      'SELECT * FROM debts WHERE synced = 0 AND (user_id IS NULL OR user_id = ?) ORDER BY created_at ASC',
      [userId]
    );
    return Array.from({ length: result.rows.length }, (_, i) => result.rows.item(i));
  },

  async setRemoteIdAndSynced(localId: string, remoteId: string, userId: string): Promise<void> {
    const database = await getDatabase();
    const now = new Date().toISOString();
    await database.executeSql(
      'UPDATE debts SET remote_id=?, user_id=?, updated_at=?, synced=1 WHERE id=? AND (user_id IS NULL OR user_id = ?)',
      [remoteId, userId, now, localId, userId]
    );
  },

  async upsertFromRemote(remote: any, userId: string): Promise<void> {
    const database = await getDatabase();
    const remoteId = String(remote?.$id ?? remote?.id);

    const clientName = remote.clientName ?? remote.client_name;
    const clientPhone = remote.clientPhone ?? remote.client_phone ?? null;
    const amount = Number(remote.amount ?? 0);
    const description = remote.description;
    const serviceDate = remote.serviceDate
      ? String(remote.serviceDate)
      : remote.service_date
        ? String(remote.service_date)
        : new Date().toISOString().slice(0, 10);
    const dueDate = remote.dueDate ? String(remote.dueDate) : remote.due_date ? String(remote.due_date) : null;
    const status = remote.status ?? 'pendente';
    const paidAmount = Number(remote.paidAmount ?? remote.paid_amount ?? 0);
    const notes = remote.notes ?? null;
    const createdAt = remote.createdAt ? String(remote.createdAt) : String(remote?.$createdAt ?? new Date().toISOString());
    const updatedAt = remote.updatedAt ? String(remote.updatedAt) : String(remote?.$updatedAt ?? new Date().toISOString());

    const [res] = await database.executeSql(
      `UPDATE debts SET
        remote_id=?,
        user_id=?,
        client_name=?,
        client_phone=?,
        amount=?,
        description=?,
        service_date=?,
        due_date=?,
        status=?,
        paid_amount=?,
        notes=?,
        created_at=?,
        updated_at=?,
        synced=1
       WHERE (remote_id=? OR id=?) AND (user_id IS NULL OR user_id=?)`,
      [
        remoteId,
        userId,
        clientName,
        clientPhone,
        amount,
        description,
        serviceDate,
        dueDate,
        status,
        paidAmount,
        notes,
        createdAt,
        updatedAt,
        remoteId,
        remoteId,
        userId,
      ]
    );
    if ((res as any).rowsAffected > 0) return;

    await database.executeSql(
      `INSERT INTO debts
        (id, remote_id, user_id, client_name, client_phone, amount, description,
         service_date, due_date, status, paid_amount, notes, created_at, updated_at, synced)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        remoteId,
        remoteId,
        userId,
        clientName,
        clientPhone,
        amount,
        description,
        serviceDate,
        dueDate,
        status,
        paidAmount,
        notes,
        createdAt,
        updatedAt,
        1,
      ]
    );
  },
};

// ---- REPOSITÓRIO DE PRODUTOS ----
export const ProductRepo = {
  async getAll(): Promise<import('../types').Product[]> {
    const database = await getDatabase();
    const userId = await requireActiveUserId();
    const [result] = await database.executeSql(
      'SELECT * FROM products WHERE (user_id IS NULL OR user_id = ?) ORDER BY name ASC',
      [userId]
    );
    return Array.from({ length: result.rows.length }, (_, i) =>
      rowToProduct(result.rows.item(i))
    );
  },

  async getLowStock(): Promise<import('../types').Product[]> {
    const database = await getDatabase();
    const userId = await requireActiveUserId();
    const [result] = await database.executeSql(
      'SELECT * FROM products WHERE (user_id IS NULL OR user_id = ?) AND quantity <= min_quantity ORDER BY quantity ASC',
      [userId]
    );
    return Array.from({ length: result.rows.length }, (_, i) =>
      rowToProduct(result.rows.item(i))
    );
  },

  async insert(p: import('../types').Product): Promise<void> {
    const database = await getDatabase();
    const userId = await requireActiveUserId();
    await database.executeSql(
      `INSERT INTO products
        (id, remote_id, user_id, name, category, cost_price, sell_price, quantity,
         min_quantity, unit, barcode, photo_uri, created_at, updated_at, synced)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        p.id, null, userId, p.name, p.category, p.costPrice, p.sellPrice,
        p.quantity, p.minQuantity, p.unit, p.barcode ?? null,
        p.photoUri ?? null, p.createdAt, p.updatedAt, p.synced ? 1 : 0,
      ]
    );
  },

  async updateQuantity(id: string, newQuantity: number): Promise<void> {
    const database = await getDatabase();
    const userId = await requireActiveUserId();
    const now = new Date().toISOString();
    await database.executeSql(
      'UPDATE products SET quantity=?, updated_at=?, synced=0 WHERE id=? AND (user_id IS NULL OR user_id=?)',
      [newQuantity, now, id, userId]
    );
  },

  async getUnsynced(): Promise<any[]> {
    const database = await getDatabase();
    const userId = await requireActiveUserId();
    const [result] = await database.executeSql(
      'SELECT * FROM products WHERE synced = 0 AND (user_id IS NULL OR user_id = ?) ORDER BY updated_at DESC',
      [userId]
    );
    return Array.from({ length: result.rows.length }, (_, i) => result.rows.item(i));
  },

  async setRemoteIdAndSynced(localId: string, remoteId: string, userId: string): Promise<void> {
    const database = await getDatabase();
    const now = new Date().toISOString();
    await database.executeSql(
      'UPDATE products SET remote_id=?, user_id=?, updated_at=?, synced=1 WHERE id=? AND (user_id IS NULL OR user_id = ?)',
      [remoteId, userId, now, localId, userId]
    );
  },

  async upsertFromRemote(remote: any, userId: string): Promise<void> {
    const database = await getDatabase();
    const remoteId = String(remote?.$id ?? remote?.id);

    const name = remote.name;
    const category = remote.category ?? null;
    const costPrice = Number(remote.costPrice ?? remote.cost_price ?? 0);
    const sellPrice = Number(remote.sellPrice ?? remote.sell_price ?? 0);
    const quantity = Number(remote.quantity ?? 0);
    const minQuantity = Number(remote.minQuantity ?? remote.min_quantity ?? 1);
    const unit = remote.unit ?? 'unidade';
    const barcode = remote.barcode ?? null;
    const photoUri = remote.photoUri ?? remote.photo_url ?? null;
    const createdAt = remote.createdAt ? String(remote.createdAt) : String(remote?.$createdAt ?? new Date().toISOString());
    const updatedAt = remote.updatedAt ? String(remote.updatedAt) : String(remote?.$updatedAt ?? new Date().toISOString());

    const [res] = await database.executeSql(
      `UPDATE products SET
        remote_id=?,
        user_id=?,
        name=?,
        category=?,
        cost_price=?,
        sell_price=?,
        quantity=?,
        min_quantity=?,
        unit=?,
        barcode=?,
        photo_uri=?,
        created_at=?,
        updated_at=?,
        synced=1
       WHERE (remote_id=? OR id=?) AND (user_id IS NULL OR user_id=?)`,
      [
        remoteId,
        userId,
        name,
        category,
        costPrice,
        sellPrice,
        quantity,
        minQuantity,
        unit,
        barcode,
        photoUri,
        createdAt,
        updatedAt,
        remoteId,
        remoteId,
        userId,
      ]
    );
    if ((res as any).rowsAffected > 0) return;

    await database.executeSql(
      `INSERT INTO products
        (id, remote_id, user_id, name, category, cost_price, sell_price, quantity,
         min_quantity, unit, barcode, photo_uri, created_at, updated_at, synced)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        remoteId,
        remoteId,
        userId,
        name,
        category,
        costPrice,
        sellPrice,
        quantity,
        minQuantity,
        unit,
        barcode,
        photoUri,
        createdAt,
        updatedAt,
        1,
      ]
    );
  },
};

// ---- HELPERS ----
const rowToTransaction = (row: any): import('../types').Transaction => ({
  id: row.id,
  type: row.type,
  amount: row.amount,
  category: row.category,
  description: row.description,
  clientName: row.client_name,
  paymentMethod: row.payment_method,
  date: row.date,
  createdAt: row.created_at,
  synced: row.synced === 1,
  receiptUri: row.receipt_uri,
});

const rowToDebt = (row: any): import('../types').Debt => ({
  id: row.id,
  clientName: row.client_name,
  clientPhone: row.client_phone,
  amount: row.amount,
  description: row.description,
  serviceDate: row.service_date,
  dueDate: row.due_date,
  status: row.status,
  paidAmount: row.paid_amount,
  notes: row.notes,
  createdAt: row.created_at,
  synced: row.synced === 1,
});

const rowToProduct = (row: any): import('../types').Product => ({
  id: row.id,
  name: row.name,
  category: row.category,
  costPrice: row.cost_price,
  sellPrice: row.sell_price,
  quantity: row.quantity,
  minQuantity: row.min_quantity,
  unit: row.unit,
  barcode: row.barcode,
  photoUri: row.photo_uri,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  synced: row.synced === 1,
});
