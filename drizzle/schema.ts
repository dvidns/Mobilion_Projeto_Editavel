import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  /** Identificador do assinante: openid:<id> ou device:<id> */
  subjectKey: varchar("subjectKey", { length: 96 }).notNull().unique(),
  plan: mysqlEnum("plan", ["free", "pro", "annual"]).default("free").notNull(),
  status: mysqlEnum("status", ["active", "canceled", "expired"]).default("active").notNull(),
  store: mysqlEnum("store", ["manual", "revenuecat", "googleplay"]).default("manual").notNull(),
  externalCustomerId: varchar("externalCustomerId", { length: 128 }),
  externalSubscriptionId: varchar("externalSubscriptionId", { length: 128 }),
  expiresAt: timestamp("expiresAt"),
  subscribedAt: timestamp("subscribedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

export const licenses = mysqlTable("licenses", {
  id: int("id").autoincrement().primaryKey(),
  codeHash: varchar("codeHash", { length: 64 }).notNull().unique(),
  codeHint: varchar("codeHint", { length: 16 }).notNull(),
  plan: mysqlEnum("plan", ["pro", "annual"]).notNull(),
  status: mysqlEnum("status", ["active", "revoked", "expired"]).default("active").notNull(),
  maxActivations: int("maxActivations").default(1).notNull(),
  usedCount: int("usedCount").default(0).notNull(),
  expiresAt: timestamp("expiresAt"),
  createdByOpenId: varchar("createdByOpenId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const licenseActivations = mysqlTable("licenseActivations", {
  id: int("id").autoincrement().primaryKey(),
  licenseId: int("licenseId").notNull(),
  subjectKey: varchar("subjectKey", { length: 96 }).notNull(),
  activatedAt: timestamp("activatedAt").defaultNow().notNull(),
});

export type License = typeof licenses.$inferSelect;
export type InsertLicense = typeof licenses.$inferInsert;
export type LicenseActivation = typeof licenseActivations.$inferSelect;
export type InsertLicenseActivation = typeof licenseActivations.$inferInsert;

export const despesas = mysqlTable("despesas", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userOpenId: varchar("userOpenId", { length: 64 }),
  tipoPessoa: mysqlEnum("tipoPessoa", ["PF", "PJ"]).notNull(),
  clienteId: varchar("clienteId", { length: 64 }),
  fornecedorNome: varchar("fornecedorNome", { length: 255 }).notNull(),
  fornecedorCnpj: varchar("fornecedorCnpj", { length: 18 }),
  dataEmissao: varchar("dataEmissao", { length: 10 }),
  valorTotal: decimal("valorTotal", { precision: 12, scale: 2 }).notNull(),
  imageUrl: text("imageUrl").notNull(),
  imageStorageKey: varchar("imageStorageKey", { length: 255 }),
  conferidoIR: int("conferidoIR").default(0).notNull(),
  dadosExtraidosJson: text("dadosExtraidosJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const despesaItens = mysqlTable("despesaItens", {
  id: int("id").autoincrement().primaryKey(),
  despesaId: varchar("despesaId", { length: 36 }).notNull(),
  nome: varchar("nome", { length: 255 }).notNull(),
  quantidade: decimal("quantidade", { precision: 12, scale: 3 }).default("1.000").notNull(),
  valorUnitario: decimal("valorUnitario", { precision: 12, scale: 2 }).default("0.00").notNull(),
  valorTotal: decimal("valorTotal", { precision: 12, scale: 2 }).default("0.00").notNull(),
});

export type Despesa = typeof despesas.$inferSelect;
export type InsertDespesa = typeof despesas.$inferInsert;
export type DespesaItem = typeof despesaItens.$inferSelect;
export type InsertDespesaItem = typeof despesaItens.$inferInsert;
