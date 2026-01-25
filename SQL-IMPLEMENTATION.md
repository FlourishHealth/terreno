# SQL Database Adapter Implementation Plan

## Path A: Adapter Wrapper Pattern

This document outlines the complete implementation plan for adding SQL database support to `@terreno/api` using an adapter wrapper pattern inspired by Django's database backend architecture.

---

## Table of Contents

1. [Overview](#overview)
2. [Design Decisions](#design-decisions)
3. [Architecture](#architecture)
4. [File Structure](#file-structure)
5. [Phase 1: Core Interfaces](#phase-1-core-interfaces)
6. [Phase 2: Mongoose Adapter](#phase-2-mongoose-adapter)
7. [Phase 3: SQL Adapter Core](#phase-3-sql-adapter-core)
8. [Phase 4: Query Builder & JOINs](#phase-4-query-builder--joins)
9. [Phase 5: Hooks & Plugins](#phase-5-hooks--plugins)
10. [Phase 6: Transactions](#phase-6-transactions)
11. [Phase 7: Migration System](#phase-7-migration-system)
12. [Phase 8: Testing Strategy](#phase-8-testing-strategy)
13. [Phase 9: Integration](#phase-9-integration)

---

## Overview

### Current State

`@terreno/api` is tightly coupled to Mongoose/MongoDB:

```typescript
// Current usage - Mongoose only
const router = modelRouter(FoodModel, options);
```

### Target State

Support both MongoDB and SQL with identical API:

```typescript
// Works with Mongoose model (unchanged)
const router = modelRouter(FoodMongooseModel, options);

// Works with SQL model (new)
const router = modelRouter(FoodSQLModel, options);
```

### Supported Databases

| Database | Driver | Use Case |
|----------|--------|----------|
| MongoDB | Mongoose | Existing users, document-oriented data |
| SQLite | bun:sqlite | Development, testing, small apps |
| PostgreSQL | Bun.SQL | Production |
| MySQL/MariaDB | Bun.SQL | Production |

---

## Design Decisions

All decisions finalized based on requirements:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **SQL Databases** | All via Bun.SQL | Maximum flexibility |
| **Schema DSL** | Mongoose-compatible | Zero learning curve |
| **Migrations** | Numbered SQL files | Simple, explicit, version-controlled |
| **Primary Keys** | MongoDB ObjectId strings | URL-compatible, familiar format |
| **Population** | SQL JOINs | Efficient, no N+1 queries |
| **Array Fields** | Configurable (JSON or table) | Flexibility per use case |
| **Transactions** | Unified API | Same code works on both backends |
| **Virtual Fields** | Getter functions | Same syntax as Mongoose |
| **Indexes** | Full support in schema | Composite, unique, partial |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Application Layer                          │
│  modelRouter(model, options) - unchanged API                    │
├─────────────────────────────────────────────────────────────────┤
│                    TerrenoModel Interface                       │
│  Unified interface for all database operations                  │
│  ├── create(), find(), findById(), countDocuments()             │
│  ├── save(), deleteOne()                                        │
│  ├── populate() / JOIN builder                                  │
│  ├── transaction()                                              │
│  └── schema introspection                                       │
├─────────────────────────────────────────────────────────────────┤
│                      Adapter Layer                              │
│  ┌─────────────────────┐    ┌─────────────────────┐             │
│  │  MongooseAdapter    │    │    SQLAdapter       │             │
│  │  - Wraps existing   │    │  - SQLite           │             │
│  │    Mongoose models  │    │  - PostgreSQL       │             │
│  │  - Zero changes     │    │  - MySQL            │             │
│  └─────────────────────┘    └─────────────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│                    Connection Layer                             │
│  mongoose.connect()          Bun.SQL / bun:sqlite               │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
api/src/
├── adapters/
│   ├── index.ts                    # Public exports
│   ├── types.ts                    # TerrenoModel, TerrenoDocument, etc.
│   ├── config.ts                   # Database backend configuration
│   ├── transactions.ts             # Unified transaction API
│   │
│   ├── mongoose/
│   │   ├── index.ts                # MongooseAdapter exports
│   │   ├── adapter.ts              # Wraps Mongoose models
│   │   └── adapter.test.ts         # Backwards compatibility tests
│   │
│   └── sql/
│       ├── index.ts                # SQLAdapter exports
│       ├── connection.ts           # Database connection manager
│       ├── objectId.ts             # MongoDB-compatible ObjectId generation
│       ├── schema.ts               # SQLSchema class
│       ├── model.ts                # SQLModel class
│       ├── document.ts             # SQLDocument class
│       ├── query.ts                # SQLQuery builder with JOINs
│       ├── plugins.ts              # SQL-compatible plugins
│       ├── migrations.ts           # Migration runner
│       ├── arrayStorage.ts         # JSON vs junction table handling
│       │
│       └── tests/
│           ├── model.test.ts
│           ├── query.test.ts
│           ├── joins.test.ts
│           ├── transactions.test.ts
│           └── migrations.test.ts
│
├── api.ts                          # Modified to use TerrenoModel
├── permissions.ts                  # Modified to use TerrenoModel
├── populate.ts                     # Modified for SQL JOINs
└── ...
```

---

## Phase 1: Core Interfaces

### 1.1 TerrenoDocument Interface

```typescript
// api/src/adapters/types.ts

export interface TerrenoDocument<T> {
  /** MongoDB-style ObjectId string */
  _id: string;

  /** Alias for _id */
  readonly id: string;

  /** Convert to plain object */
  toObject(): T & { _id: string; id: string };

  /** Convert to JSON (same as toObject) */
  toJSON(): T & { _id: string; id: string };

  /** Set field(s) - queues changes for save() */
  set(path: string, value: any): this;
  set(values: Partial<T>): this;

  /** Persist changes to database */
  save(): Promise<this>;

  /** Delete this document */
  deleteOne(): Promise<void>;

  /** Mark document as modified (forces save to persist) */
  markModified(path: string): void;

  /** Check if path has been modified */
  isModified(path?: string): boolean;

  /** Access to parent model */
  $model(): TerrenoModel<T>;

  /** Dynamic field access */
  [key: string]: any;
}
```

### 1.2 TerrenoQuery Interface

```typescript
// api/src/adapters/types.ts

export interface PopulateOptions {
  path: string;
  select?: string | string[];
  model?: string;
  match?: Record<string, any>;
}

export interface TerrenoQuery<T, ResultType = TerrenoDocument<T>[]> {
  /** Execute query and return results */
  exec(): Promise<ResultType>;

  /** Add WHERE conditions */
  where(conditions: Record<string, any>): this;

  /** Limit number of results */
  limit(n: number): this;

  /** Skip n results (for pagination) */
  skip(n: number): this;

  /** Sort results */
  sort(spec: string | Record<string, 'ascending' | 'descending' | 1 | -1>): this;

  /** Select specific fields */
  select(fields: string | string[] | Record<string, 0 | 1>): this;

  /** Populate references (JOIN for SQL) */
  populate(options: string | PopulateOptions | PopulateOptions[]): this;

  /** Lean query - return plain objects instead of documents */
  lean(): TerrenoQuery<T, (T & { _id: string })[]>;

  /** Count matching documents */
  countDocuments(): Promise<number>;
}
```

### 1.3 TerrenoSchema Interface

```typescript
// api/src/adapters/types.ts

export type SchemaFieldType =
  | 'String'
  | 'Number'
  | 'Boolean'
  | 'Date'
  | 'ObjectId'
  | 'Array'
  | 'Mixed'
  | 'Buffer';

export interface SchemaPathOptions {
  type: SchemaFieldType | SchemaFieldType[];
  required?: boolean;
  default?: any;
  ref?: string;
  unique?: boolean;
  index?: boolean | 'text' | 'hashed';
  enum?: any[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  match?: RegExp;
  validate?: (value: any) => boolean | Promise<boolean>;
  // SQL-specific
  sqlStorage?: 'json' | 'table';  // For arrays
}

export interface SchemaPath {
  instance: SchemaFieldType;
  options: SchemaPathOptions;
}

export interface SchemaIndex {
  fields: Record<string, 1 | -1 | 'text'>;
  options?: {
    unique?: boolean;
    sparse?: boolean;
    partial?: Record<string, any>;
    name?: string;
  };
}

export interface TerrenoSchema<T> {
  /** Field definitions */
  paths: Record<string, SchemaPath>;

  /** Get path definition */
  path(name: string): SchemaPath | undefined;

  /** Virtual field definitions */
  virtuals: Record<string, VirtualDefinition>;

  /** Child/embedded schemas */
  childSchemas: Array<{ model: { path: string }; schema: TerrenoSchema<any> }>;

  /** Defined indexes */
  indexes: SchemaIndex[];

  /** Register pre-hook */
  pre(event: SchemaHookEvent, fn: HookFunction): void;

  /** Register post-hook */
  post(event: SchemaHookEvent, fn: HookFunction): void;

  /** Add a virtual field */
  virtual(name: string): VirtualBuilder;

  /** Add an index */
  index(fields: Record<string, 1 | -1>, options?: SchemaIndex['options']): void;
}

export type SchemaHookEvent =
  | 'save'
  | 'remove'
  | 'updateOne'
  | 'deleteOne'
  | 'find'
  | 'findOne';

export type HookFunction = (this: any, next?: () => void) => void | Promise<void>;

export interface VirtualDefinition {
  get?: () => any;
  set?: (value: any) => void;
}

export interface VirtualBuilder {
  get(fn: () => any): this;
  set(fn: (value: any) => void): this;
}
```

### 1.4 TerrenoModel Interface

```typescript
// api/src/adapters/types.ts

export interface TerrenoModel<T> {
  /** Model name (e.g., 'Food') */
  readonly modelName: string;

  /** Collection/table info */
  readonly collection: {
    name: string;
    collectionName: string;
  };

  /** Schema definition */
  readonly schema: TerrenoSchema<T>;

  /** Access to database connection for cross-model lookups */
  readonly db: {
    model<U>(name: string): TerrenoModel<U>;
  };

  /** Create a new document */
  create(data: Partial<T>): Promise<TerrenoDocument<T>>;
  create(data: Partial<T>[]): Promise<TerrenoDocument<T>[]>;

  /** Find documents matching conditions */
  find(conditions?: Record<string, any>): TerrenoQuery<T>;

  /** Find document by ID */
  findById(id: string): TerrenoQuery<T, TerrenoDocument<T> | null>;

  /** Find single document */
  findOne(conditions: Record<string, any>): TerrenoQuery<T, TerrenoDocument<T> | null>;

  /** Count documents */
  countDocuments(conditions?: Record<string, any>): Promise<number>;

  /** Update documents */
  updateOne(
    conditions: Record<string, any>,
    update: Record<string, any>
  ): Promise<{ modifiedCount: number }>;

  updateMany(
    conditions: Record<string, any>,
    update: Record<string, any>
  ): Promise<{ modifiedCount: number }>;

  /** Delete documents */
  deleteOne(conditions: Record<string, any>): Promise<{ deletedCount: number }>;
  deleteMany(conditions: Record<string, any>): Promise<{ deletedCount: number }>;

  /** Aggregate (MongoDB-style, limited SQL support) */
  aggregate?(pipeline: any[]): Promise<any[]>;

  /** Check if value is valid ObjectId */
  isValidObjectId?(id: any): boolean;
}
```

### 1.5 Database Configuration

```typescript
// api/src/adapters/config.ts

export type DatabaseBackend = 'mongoose' | 'sqlite' | 'postgresql' | 'mysql';

export interface DatabaseConfig {
  backend: DatabaseBackend;

  // MongoDB/Mongoose
  mongoUri?: string;
  mongoOptions?: Record<string, any>;

  // SQLite
  sqliteFilename?: string;  // ':memory:' for in-memory

  // PostgreSQL/MySQL
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;

  // Connection pool (PostgreSQL/MySQL)
  poolMin?: number;
  poolMax?: number;

  // Migrations
  migrationsDir?: string;
  runMigrations?: boolean;
}

// Global configuration
let config: DatabaseConfig | null = null;

export function configureTerrenoDatabase(cfg: DatabaseConfig): void {
  config = cfg;

  // Initialize appropriate backend
  if (cfg.backend === 'mongoose') {
    // Mongoose initializes via mongoose.connect() elsewhere
  } else {
    const { initializeSQLConnection } = require('./sql/connection');
    initializeSQLConnection(cfg);
  }
}

export function getTerrenoDatabaseConfig(): DatabaseConfig {
  if (!config) {
    // Default to mongoose for backwards compatibility
    return { backend: 'mongoose' };
  }
  return config;
}

export function getDatabaseBackend(): DatabaseBackend {
  // Environment variable override
  const envBackend = process.env.TERRENO_DB_BACKEND as DatabaseBackend | undefined;
  if (envBackend) {
    return envBackend;
  }
  return config?.backend ?? 'mongoose';
}
```

---

## Phase 2: Mongoose Adapter

### 2.1 Mongoose Model Detection

```typescript
// api/src/adapters/mongoose/adapter.ts

import mongoose, { Model, Document } from 'mongoose';
import type { TerrenoModel, TerrenoDocument, TerrenoSchema } from '../types';

/**
 * Check if a value is a Mongoose model
 */
export function isMongooseModel(model: any): model is Model<any> {
  if (!model) return false;

  // Check for Mongoose Model characteristics
  return (
    typeof model === 'function' &&
    model.prototype instanceof mongoose.Model
  ) || (
    model.modelName &&
    model.schema &&
    typeof model.create === 'function' &&
    typeof model.find === 'function'
  );
}

/**
 * Check if a value is a Mongoose document
 */
export function isMongooseDocument(doc: any): doc is Document {
  return doc instanceof mongoose.Document;
}
```

### 2.2 Mongoose Adapter Wrapper

```typescript
// api/src/adapters/mongoose/adapter.ts (continued)

/**
 * Wrap a Mongoose model to conform to TerrenoModel interface.
 *
 * Since Mongoose models already implement most of the interface,
 * this is mostly a type assertion with minimal runtime overhead.
 */
export function wrapMongooseModel<T>(model: Model<T>): TerrenoModel<T> {
  // Mongoose models are already compatible - just ensure type safety
  const wrapped = model as unknown as TerrenoModel<T>;

  // Add any missing methods or normalize behavior
  if (!wrapped.db) {
    (wrapped as any).db = {
      model: (name: string) => mongoose.model(name)
    };
  }

  return wrapped;
}

/**
 * Automatically detect and wrap models for modelRouter
 */
export function ensureTerrenoModel<T>(
  model: Model<T> | TerrenoModel<T>
): TerrenoModel<T> {
  if (isMongooseModel(model)) {
    return wrapMongooseModel(model);
  }
  return model as TerrenoModel<T>;
}
```

### 2.3 Backwards Compatibility Tests

```typescript
// api/src/adapters/mongoose/adapter.test.ts

import { describe, it, expect, beforeEach } from 'bun:test';
import express from 'express';
import supertest from 'supertest';
import { modelRouter } from '../../api';
import { Permissions } from '../../permissions';
import {
  setupDb,
  FoodModel,
  UserModel,
  getBaseServer,
  authAsUser
} from '../../tests';

describe('Mongoose Backwards Compatibility', () => {
  beforeEach(async () => {
    await setupDb();
  });

  describe('modelRouter with Mongoose models', () => {
    it('should work identically to before', async () => {
      const app = getBaseServer();
      app.use('/food', modelRouter(FoodModel, {
        permissions: {
          create: [Permissions.IsAny],
          list: [Permissions.IsAny],
          read: [Permissions.IsAny],
          update: [Permissions.IsAny],
          delete: [Permissions.IsAny],
        },
      }));

      const agent = supertest(app);

      // Create
      const createRes = await agent
        .post('/food')
        .send({ name: 'Apple', calories: 95 })
        .expect(201);

      expect(createRes.body.data.name).toBe('Apple');
      expect(createRes.body.data._id).toBeDefined();

      // List
      const listRes = await agent.get('/food').expect(200);
      expect(listRes.body.data.length).toBeGreaterThan(0);

      // Read
      const readRes = await agent
        .get(`/food/${createRes.body.data._id}`)
        .expect(200);
      expect(readRes.body.data.name).toBe('Apple');

      // Update
      const updateRes = await agent
        .patch(`/food/${createRes.body.data._id}`)
        .send({ calories: 100 })
        .expect(200);
      expect(updateRes.body.data.calories).toBe(100);

      // Delete
      await agent
        .delete(`/food/${createRes.body.data._id}`)
        .expect(204);
    });

    it('should support all existing hooks', async () => {
      const hookCalls: string[] = [];

      const app = getBaseServer();
      app.use('/food', modelRouter(FoodModel, {
        permissions: {
          create: [Permissions.IsAny],
          list: [Permissions.IsAny],
          read: [Permissions.IsAny],
          update: [Permissions.IsAny],
          delete: [Permissions.IsAny],
        },
        preCreate: (value) => {
          hookCalls.push('preCreate');
          return value;
        },
        postCreate: () => {
          hookCalls.push('postCreate');
        },
        preUpdate: (value) => {
          hookCalls.push('preUpdate');
          return value;
        },
        postUpdate: () => {
          hookCalls.push('postUpdate');
        },
        preDelete: (value) => {
          hookCalls.push('preDelete');
          return value;
        },
        postDelete: () => {
          hookCalls.push('postDelete');
        },
      }));

      const agent = supertest(app);

      // Create
      const res = await agent
        .post('/food')
        .send({ name: 'Banana' })
        .expect(201);

      expect(hookCalls).toContain('preCreate');
      expect(hookCalls).toContain('postCreate');

      // Update
      await agent
        .patch(`/food/${res.body.data._id}`)
        .send({ calories: 89 })
        .expect(200);

      expect(hookCalls).toContain('preUpdate');
      expect(hookCalls).toContain('postUpdate');

      // Delete
      await agent
        .delete(`/food/${res.body.data._id}`)
        .expect(204);

      expect(hookCalls).toContain('preDelete');
      expect(hookCalls).toContain('postDelete');
    });

    it('should support populate paths', async () => {
      const [admin] = await setupDb();

      const app = getBaseServer();
      app.use('/food', modelRouter(FoodModel, {
        permissions: {
          create: [Permissions.IsAny],
          list: [Permissions.IsAny],
          read: [Permissions.IsAny],
          update: [Permissions.IsAny],
          delete: [Permissions.IsAny],
        },
        populatePaths: [{ path: 'ownerId', fields: ['email'] }],
      }));

      const agent = supertest(app);

      await agent
        .post('/food')
        .send({ name: 'Carrot', ownerId: admin._id })
        .expect(201);

      const listRes = await agent.get('/food').expect(200);
      expect(listRes.body.data[0].ownerId.email).toBeDefined();
      expect(listRes.body.data[0].ownerId.password).toBeUndefined();
    });

    it('should support query filters', async () => {
      const [admin, notAdmin] = await setupDb();

      await FoodModel.create({ name: 'AdminFood', ownerId: admin._id });
      await FoodModel.create({ name: 'UserFood', ownerId: notAdmin._id });

      const app = getBaseServer();
      setupAuth(app, UserModel);
      app.use('/food', modelRouter(FoodModel, {
        permissions: {
          list: [Permissions.IsAuthenticated],
          // ... other permissions
        },
        queryFilter: (user) => user ? { ownerId: user.id } : null,
      }));

      const agent = await authAsUser(app, 'notAdmin');
      const res = await agent.get('/food').expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('UserFood');
    });
  });
});
```

---

## Phase 3: SQL Adapter Core

### 3.1 ObjectId Generation

```typescript
// api/src/adapters/sql/objectId.ts

/**
 * Generate MongoDB-compatible ObjectId strings.
 *
 * ObjectId is a 12-byte (24 hex character) value:
 * - Bytes 0-3: Unix timestamp in seconds (big-endian)
 * - Bytes 4-8: Random value unique to machine/process
 * - Bytes 9-11: Incrementing counter (big-endian)
 */

// Random machine/process identifier (generated once at startup)
const MACHINE_ID = crypto.getRandomValues(new Uint8Array(5));

// Counter with random start
let counter = Math.floor(Math.random() * 0xffffff);

/**
 * Generate a new ObjectId string
 */
export function generateObjectId(): string {
  const timestamp = Math.floor(Date.now() / 1000);
  counter = (counter + 1) % 0xffffff;

  const buffer = new Uint8Array(12);

  // 4-byte timestamp (big-endian)
  buffer[0] = (timestamp >> 24) & 0xff;
  buffer[1] = (timestamp >> 16) & 0xff;
  buffer[2] = (timestamp >> 8) & 0xff;
  buffer[3] = timestamp & 0xff;

  // 5-byte machine/process id
  buffer.set(MACHINE_ID, 4);

  // 3-byte counter (big-endian)
  buffer[9] = (counter >> 16) & 0xff;
  buffer[10] = (counter >> 8) & 0xff;
  buffer[11] = counter & 0xff;

  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validate ObjectId format
 */
export function isValidObjectId(id: any): boolean {
  if (typeof id !== 'string') return false;
  return /^[a-f0-9]{24}$/i.test(id);
}

/**
 * Extract timestamp from ObjectId
 */
export function getTimestampFromObjectId(id: string): Date {
  if (!isValidObjectId(id)) {
    throw new Error(`Invalid ObjectId: ${id}`);
  }
  const timestamp = parseInt(id.substring(0, 8), 16);
  return new Date(timestamp * 1000);
}

/**
 * Create ObjectId from timestamp (for range queries)
 */
export function objectIdFromTimestamp(date: Date): string {
  const timestamp = Math.floor(date.getTime() / 1000);
  const buffer = new Uint8Array(12);

  buffer[0] = (timestamp >> 24) & 0xff;
  buffer[1] = (timestamp >> 16) & 0xff;
  buffer[2] = (timestamp >> 8) & 0xff;
  buffer[3] = timestamp & 0xff;
  // Rest is zeros

  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

### 3.2 SQL Connection Manager

```typescript
// api/src/adapters/sql/connection.ts

import { Database as SQLiteDatabase } from 'bun:sqlite';
import type { DatabaseConfig } from '../config';

type SQLConnection = SQLiteDatabase; // Extend for Bun.SQL later

let connection: SQLConnection | null = null;
let currentConfig: DatabaseConfig | null = null;

/**
 * Initialize SQL connection based on configuration
 */
export function initializeSQLConnection(config: DatabaseConfig): void {
  currentConfig = config;

  // Close existing connection if any
  if (connection) {
    closeSQLConnection();
  }

  switch (config.backend) {
    case 'sqlite':
      connection = new SQLiteDatabase(config.sqliteFilename || ':memory:');
      // Enable WAL mode for better concurrency
      connection.run('PRAGMA journal_mode = WAL;');
      // Enable foreign keys
      connection.run('PRAGMA foreign_keys = ON;');
      break;

    case 'postgresql':
    case 'mysql':
      // TODO: Implement Bun.SQL connection
      // const { SQL } = require('bun');
      // connection = new SQL({ ... });
      throw new Error(`${config.backend} support coming soon via Bun.SQL`);

    default:
      throw new Error(`Unknown database backend: ${config.backend}`);
  }
}

/**
 * Get the current SQL connection
 */
export function getSQLConnection(): SQLConnection {
  if (!connection) {
    throw new Error(
      'SQL connection not initialized. Call configureTerrenoDatabase() first.'
    );
  }
  return connection;
}

/**
 * Close the SQL connection
 */
export function closeSQLConnection(): void {
  if (connection) {
    connection.close();
    connection = null;
  }
}

/**
 * Execute raw SQL (for migrations and advanced use)
 */
export function executeSQL(sql: string, params: any[] = []): void {
  getSQLConnection().run(sql, params);
}

/**
 * Query raw SQL
 */
export function querySQL<T = any>(sql: string, params: any[] = []): T[] {
  return getSQLConnection().query(sql).all(...params) as T[];
}

/**
 * Get a single result
 */
export function querySQLOne<T = any>(sql: string, params: any[] = []): T | null {
  const result = getSQLConnection().query(sql).get(...params);
  return (result as T) ?? null;
}
```

### 3.3 SQL Schema Class

```typescript
// api/src/adapters/sql/schema.ts

import type {
  TerrenoSchema,
  SchemaPath,
  SchemaPathOptions,
  SchemaIndex,
  SchemaHookEvent,
  HookFunction,
  VirtualDefinition,
  VirtualBuilder,
  SchemaFieldType
} from '../types';

export interface SQLSchemaDefinition {
  [field: string]: SchemaPathOptions | SchemaFieldType;
}

/**
 * SQL-compatible schema that mirrors Mongoose schema API
 */
export class SQLSchema<T> implements TerrenoSchema<T> {
  paths: Record<string, SchemaPath> = {};
  virtuals: Record<string, VirtualDefinition> = {};
  childSchemas: Array<{ model: { path: string }; schema: TerrenoSchema<any> }> = [];
  indexes: SchemaIndex[] = [];

  private preHooks: Map<SchemaHookEvent, HookFunction[]> = new Map();
  private postHooks: Map<SchemaHookEvent, HookFunction[]> = new Map();

  constructor(definition: SQLSchemaDefinition, options?: { timestamps?: boolean }) {
    // Always add _id as primary key
    this.paths._id = {
      instance: 'ObjectId',
      options: { type: 'ObjectId', required: true }
    };

    // Process field definitions
    for (const [field, fieldDef] of Object.entries(definition)) {
      this.paths[field] = this.normalizeFieldDefinition(fieldDef);
    }

    // Add timestamp fields if requested
    if (options?.timestamps) {
      this.paths.createdAt = { instance: 'Date', options: { type: 'Date' } };
      this.paths.updatedAt = { instance: 'Date', options: { type: 'Date' } };
    }
  }

  private normalizeFieldDefinition(def: SchemaPathOptions | SchemaFieldType): SchemaPath {
    // Handle shorthand: { name: 'String' }
    if (typeof def === 'string') {
      return {
        instance: def as SchemaFieldType,
        options: { type: def as SchemaFieldType }
      };
    }

    // Handle array shorthand: { tags: ['String'] }
    if (Array.isArray(def)) {
      return {
        instance: 'Array',
        options: { type: def }
      };
    }

    // Full definition
    const options = def as SchemaPathOptions;
    let instance: SchemaFieldType;

    if (Array.isArray(options.type)) {
      instance = 'Array';
    } else {
      instance = options.type;
    }

    return { instance, options };
  }

  path(name: string): SchemaPath | undefined {
    return this.paths[name];
  }

  pre(event: SchemaHookEvent, fn: HookFunction): void {
    if (!this.preHooks.has(event)) {
      this.preHooks.set(event, []);
    }
    this.preHooks.get(event)!.push(fn);
  }

  post(event: SchemaHookEvent, fn: HookFunction): void {
    if (!this.postHooks.has(event)) {
      this.postHooks.set(event, []);
    }
    this.postHooks.get(event)!.push(fn);
  }

  /**
   * Run pre-hooks for an event
   */
  async runPreHooks(event: SchemaHookEvent, context: any): Promise<void> {
    const hooks = this.preHooks.get(event) || [];
    for (const hook of hooks) {
      await new Promise<void>((resolve, reject) => {
        try {
          const result = hook.call(context, resolve);
          // If hook doesn't call next(), resolve immediately
          if (result instanceof Promise) {
            result.then(() => resolve()).catch(reject);
          } else if (hook.length === 0) {
            resolve();
          }
        } catch (err) {
          reject(err);
        }
      });
    }
  }

  /**
   * Run post-hooks for an event
   */
  async runPostHooks(event: SchemaHookEvent, context: any): Promise<void> {
    const hooks = this.postHooks.get(event) || [];
    for (const hook of hooks) {
      await hook.call(context);
    }
  }

  /**
   * Define a virtual field
   */
  virtual(name: string): VirtualBuilder {
    const definition: VirtualDefinition = {};
    this.virtuals[name] = definition;

    return {
      get(fn: () => any) {
        definition.get = fn;
        return this;
      },
      set(fn: (value: any) => void) {
        definition.set = fn;
        return this;
      }
    };
  }

  /**
   * Define an index
   */
  index(fields: Record<string, 1 | -1>, options?: SchemaIndex['options']): void {
    this.indexes.push({ fields, options });
  }

  /**
   * Generate CREATE TABLE SQL
   */
  toCreateTableSQL(tableName: string): string {
    const columns: string[] = [];
    const foreignKeys: string[] = [];

    for (const [field, path] of Object.entries(this.paths)) {
      const { sqlType, constraints } = this.fieldToSQL(field, path);
      columns.push(`"${field}" ${sqlType}${constraints}`);

      // Foreign key constraints
      if (path.options.ref) {
        const refTable = path.options.ref.toLowerCase() + 's';
        foreignKeys.push(
          `FOREIGN KEY ("${field}") REFERENCES "${refTable}"("_id")`
        );
      }
    }

    let sql = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
    sql += '  ' + columns.join(',\n  ');

    if (foreignKeys.length > 0) {
      sql += ',\n  ' + foreignKeys.join(',\n  ');
    }

    sql += '\n);';

    // Add index statements
    const indexStatements = this.toCreateIndexSQL(tableName);
    if (indexStatements) {
      sql += '\n' + indexStatements;
    }

    return sql;
  }

  /**
   * Generate CREATE INDEX SQL
   */
  toCreateIndexSQL(tableName: string): string {
    const statements: string[] = [];

    // Indexes from field definitions
    for (const [field, path] of Object.entries(this.paths)) {
      if (path.options.index === true) {
        statements.push(
          `CREATE INDEX IF NOT EXISTS "idx_${tableName}_${field}" ON "${tableName}"("${field}");`
        );
      } else if (path.options.unique) {
        statements.push(
          `CREATE UNIQUE INDEX IF NOT EXISTS "idx_${tableName}_${field}_unique" ON "${tableName}"("${field}");`
        );
      }
    }

    // Composite indexes
    for (const idx of this.indexes) {
      const fields = Object.entries(idx.fields)
        .map(([f, dir]) => `"${f}" ${dir === -1 ? 'DESC' : 'ASC'}`)
        .join(', ');

      const name = idx.options?.name ||
        `idx_${tableName}_${Object.keys(idx.fields).join('_')}`;

      let stmt = `CREATE`;
      if (idx.options?.unique) stmt += ' UNIQUE';
      stmt += ` INDEX IF NOT EXISTS "${name}" ON "${tableName}"(${fields})`;

      if (idx.options?.partial) {
        const where = Object.entries(idx.options.partial)
          .map(([k, v]) => `"${k}" = ${typeof v === 'string' ? `'${v}'` : v}`)
          .join(' AND ');
        stmt += ` WHERE ${where}`;
      }

      stmt += ';';
      statements.push(stmt);
    }

    return statements.join('\n');
  }

  private fieldToSQL(field: string, path: SchemaPath): { sqlType: string; constraints: string } {
    let sqlType: string;
    let constraints = '';

    switch (path.instance) {
      case 'String':
      case 'ObjectId':
        sqlType = 'TEXT';
        break;
      case 'Number':
        sqlType = 'REAL';
        break;
      case 'Boolean':
        sqlType = 'INTEGER'; // SQLite: 0 or 1
        break;
      case 'Date':
        sqlType = 'TEXT'; // ISO 8601 string
        break;
      case 'Buffer':
        sqlType = 'BLOB';
        break;
      case 'Array':
      case 'Mixed':
        sqlType = 'TEXT'; // JSON
        break;
      default:
        sqlType = 'TEXT';
    }

    // Primary key
    if (field === '_id') {
      constraints += ' PRIMARY KEY';
    }

    // NOT NULL
    if (path.options.required && field !== '_id') {
      constraints += ' NOT NULL';
    }

    // UNIQUE (handled via index, but can be inline)
    if (path.options.unique && field !== '_id') {
      constraints += ' UNIQUE';
    }

    // DEFAULT
    if (path.options.default !== undefined && typeof path.options.default !== 'function') {
      const defaultVal = this.valueToSQL(path.options.default, path.instance);
      constraints += ` DEFAULT ${defaultVal}`;
    }

    return { sqlType, constraints };
  }

  private valueToSQL(value: any, type: SchemaFieldType): string {
    if (value === null) return 'NULL';
    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (typeof value === 'number') return String(value);
    if (value instanceof Date) return `'${value.toISOString()}'`;
    if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
    return String(value);
  }
}

/**
 * Create a schema (Mongoose-compatible API)
 */
export function createSQLSchema<T>(
  definition: SQLSchemaDefinition,
  options?: { timestamps?: boolean }
): SQLSchema<T> {
  return new SQLSchema<T>(definition, options);
}
```

### 3.4 SQL Document Class

```typescript
// api/src/adapters/sql/document.ts

import type { TerrenoDocument, TerrenoModel } from '../types';
import type { SQLModel } from './model';
import { getSQLConnection } from './connection';

/**
 * SQL document that mirrors Mongoose document API
 */
export class SQLDocument<T> implements TerrenoDocument<T> {
  _id: string;

  private _model: SQLModel<T>;
  private _data: Record<string, any>;
  private _changes: Map<string, any> = new Map();
  private _isNew: boolean;
  private _isModified: Set<string> = new Set();

  constructor(
    model: SQLModel<T>,
    data: Record<string, any>,
    options: { isNew?: boolean } = {}
  ) {
    this._model = model;
    this._data = { ...data };
    this._id = data._id;
    this._isNew = options.isNew ?? true;

    // Return a proxy for dynamic field access
    return new Proxy(this, {
      get(target, prop: string | symbol) {
        if (typeof prop === 'symbol') return undefined;

        // Instance properties/methods first
        if (prop in target) {
          const value = (target as any)[prop];
          if (typeof value === 'function') {
            return value.bind(target);
          }
          return value;
        }

        // Virtual fields
        const virtual = target._model.schema.virtuals[prop];
        if (virtual?.get) {
          return virtual.get.call(target);
        }

        // Data fields
        return target._data[prop];
      },

      set(target, prop: string | symbol, value) {
        if (typeof prop === 'symbol') return false;

        // Virtual setters
        const virtual = target._model.schema.virtuals[prop];
        if (virtual?.set) {
          virtual.set.call(target, value);
          return true;
        }

        // Regular fields
        target._data[prop] = value;
        target._changes.set(prop, value);
        target._isModified.add(prop);
        return true;
      }
    });
  }

  get id(): string {
    return this._id;
  }

  toObject(): T & { _id: string; id: string } {
    const result: any = { ...this._data, id: this._id };

    // Include virtuals
    for (const [name, virtual] of Object.entries(this._model.schema.virtuals)) {
      if (virtual.get) {
        result[name] = virtual.get.call(this);
      }
    }

    return result;
  }

  toJSON(): T & { _id: string; id: string } {
    return this.toObject();
  }

  set(path: string | Partial<T>, value?: any): this {
    if (typeof path === 'string') {
      this._data[path] = value;
      this._changes.set(path, value);
      this._isModified.add(path);
    } else {
      for (const [key, val] of Object.entries(path)) {
        this._data[key] = val;
        this._changes.set(key, val);
        this._isModified.add(key);
      }
    }
    return this;
  }

  markModified(path: string): void {
    this._isModified.add(path);
    this._changes.set(path, this._data[path]);
  }

  isModified(path?: string): boolean {
    if (path) {
      return this._isModified.has(path);
    }
    return this._isModified.size > 0 || this._isNew;
  }

  $model(): TerrenoModel<T> {
    return this._model;
  }

  async save(): Promise<this> {
    const tableName = this._model.collection.collectionName;
    const schema = this._model.schema;

    // Run pre-save hooks
    await schema.runPreHooks('save', this);

    if (this._isNew) {
      // INSERT
      const fields: string[] = [];
      const placeholders: string[] = [];
      const values: any[] = [];

      for (const [field, path] of Object.entries(schema.paths)) {
        if (field === 'id') continue; // Skip virtual id

        const value = this._data[field];
        if (value !== undefined) {
          fields.push(`"${field}"`);
          placeholders.push('?');
          values.push(this.serializeValue(value, path.instance));
        }
      }

      // Handle auto-generated defaults
      if (!this._data.createdAt && schema.paths.createdAt) {
        fields.push('"createdAt"');
        placeholders.push('?');
        values.push(new Date().toISOString());
        this._data.createdAt = new Date();
      }
      if (schema.paths.updatedAt) {
        fields.push('"updatedAt"');
        placeholders.push('?');
        values.push(new Date().toISOString());
        this._data.updatedAt = new Date();
      }

      const sql = `INSERT INTO "${tableName}" (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`;
      getSQLConnection().run(sql, values);

      this._isNew = false;
    } else if (this._changes.size > 0) {
      // UPDATE
      const setClauses: string[] = [];
      const values: any[] = [];

      for (const [field, value] of this._changes) {
        const path = schema.paths[field];
        if (path) {
          setClauses.push(`"${field}" = ?`);
          values.push(this.serializeValue(value, path.instance));
        }
      }

      // Always update updatedAt if present
      if (schema.paths.updatedAt) {
        setClauses.push('"updatedAt" = ?');
        values.push(new Date().toISOString());
        this._data.updatedAt = new Date();
      }

      if (setClauses.length > 0) {
        values.push(this._id);
        const sql = `UPDATE "${tableName}" SET ${setClauses.join(', ')} WHERE "_id" = ?`;
        getSQLConnection().run(sql, values);
      }
    }

    // Clear changes tracking
    this._changes.clear();
    this._isModified.clear();

    // Run post-save hooks
    await schema.runPostHooks('save', this);

    return this;
  }

  async deleteOne(): Promise<void> {
    const tableName = this._model.collection.collectionName;
    const schema = this._model.schema;

    // Run pre-remove hooks
    await schema.runPreHooks('remove', this);

    const sql = `DELETE FROM "${tableName}" WHERE "_id" = ?`;
    getSQLConnection().run(sql, [this._id]);

    // Run post-remove hooks
    await schema.runPostHooks('remove', this);
  }

  private serializeValue(value: any, type: string): any {
    if (value === null || value === undefined) return null;

    switch (type) {
      case 'Boolean':
        return value ? 1 : 0;
      case 'Date':
        return value instanceof Date ? value.toISOString() : value;
      case 'Array':
      case 'Mixed':
        return JSON.stringify(value);
      default:
        return value;
    }
  }

  // Allow array-like access
  [key: string]: any;
}
```

### 3.5 SQL Model Class

```typescript
// api/src/adapters/sql/model.ts

import type { TerrenoModel, TerrenoDocument, TerrenoQuery } from '../types';
import { SQLSchema, type SQLSchemaDefinition } from './schema';
import { SQLQuery } from './query';
import { SQLDocument } from './document';
import { getSQLConnection } from './connection';
import { generateObjectId, isValidObjectId } from './objectId';

// Global model registry for cross-model lookups (populate/JOINs)
const modelRegistry = new Map<string, SQLModel<any>>();

/**
 * SQL Model that mirrors Mongoose Model API
 */
export class SQLModel<T> implements TerrenoModel<T> {
  readonly modelName: string;
  readonly collection: { name: string; collectionName: string };
  readonly schema: SQLSchema<T>;

  private tableName: string;
  private tableCreated = false;

  constructor(name: string, schema: SQLSchema<T>) {
    this.modelName = name;
    this.schema = schema;
    this.tableName = name.toLowerCase() + 's'; // Pluralize
    this.collection = { name: this.tableName, collectionName: this.tableName };

    // Register for cross-model lookups
    modelRegistry.set(name, this);
  }

  // Database accessor for populate
  db = {
    model: <U>(name: string): TerrenoModel<U> => {
      const model = modelRegistry.get(name);
      if (!model) {
        throw new Error(`Model '${name}' not found. Available: ${[...modelRegistry.keys()].join(', ')}`);
      }
      return model as TerrenoModel<U>;
    }
  };

  /**
   * Ensure database table exists
   */
  async ensureTable(): Promise<void> {
    if (this.tableCreated) return;

    const sql = this.schema.toCreateTableSQL(this.tableName);
    const statements = sql.split(';').filter(s => s.trim());

    for (const stmt of statements) {
      getSQLConnection().run(stmt);
    }

    this.tableCreated = true;
  }

  /**
   * Create one or more documents
   */
  async create(data: Partial<T>): Promise<TerrenoDocument<T>>;
  async create(data: Partial<T>[]): Promise<TerrenoDocument<T>[]>;
  async create(data: Partial<T> | Partial<T>[]): Promise<TerrenoDocument<T> | TerrenoDocument<T>[]> {
    await this.ensureTable();

    if (Array.isArray(data)) {
      const docs: TerrenoDocument<T>[] = [];
      for (const item of data) {
        docs.push(await this.createOne(item));
      }
      return docs;
    }

    return this.createOne(data);
  }

  private async createOne(data: Partial<T>): Promise<TerrenoDocument<T>> {
    // Generate _id if not provided
    const docData = {
      _id: generateObjectId(),
      ...data
    };

    // Apply defaults from schema
    for (const [field, path] of Object.entries(this.schema.paths)) {
      if (docData[field] === undefined && path.options.default !== undefined) {
        docData[field] = typeof path.options.default === 'function'
          ? path.options.default()
          : path.options.default;
      }
    }

    const doc = new SQLDocument<T>(this, docData, { isNew: true });
    await doc.save();
    return doc;
  }

  /**
   * Find documents
   */
  find(conditions?: Record<string, any>): TerrenoQuery<T> {
    return new SQLQuery<T>(this, this.tableName, conditions || {});
  }

  /**
   * Find by ID
   */
  findById(id: string): TerrenoQuery<T, TerrenoDocument<T> | null> {
    return new SQLQuery<T>(this, this.tableName, { _id: id }, { single: true });
  }

  /**
   * Find one document
   */
  findOne(conditions: Record<string, any>): TerrenoQuery<T, TerrenoDocument<T> | null> {
    return new SQLQuery<T>(this, this.tableName, conditions, { single: true });
  }

  /**
   * Count documents
   */
  async countDocuments(conditions?: Record<string, any>): Promise<number> {
    await this.ensureTable();

    let sql = `SELECT COUNT(*) as count FROM "${this.tableName}"`;
    const params: any[] = [];

    if (conditions && Object.keys(conditions).length > 0) {
      const { whereClause, whereParams } = this.buildWhereClause(conditions);
      sql += ` WHERE ${whereClause}`;
      params.push(...whereParams);
    }

    const result = getSQLConnection().query(sql).get(...params) as { count: number };
    return result?.count ?? 0;
  }

  /**
   * Update one document
   */
  async updateOne(
    conditions: Record<string, any>,
    update: Record<string, any>
  ): Promise<{ modifiedCount: number }> {
    await this.ensureTable();

    const { whereClause, whereParams } = this.buildWhereClause(conditions);
    const { setClause, setParams } = this.buildSetClause(update);

    const sql = `UPDATE "${this.tableName}" SET ${setClause} WHERE ${whereClause}`;
    const result = getSQLConnection().run(sql, [...setParams, ...whereParams]);

    return { modifiedCount: result.changes };
  }

  /**
   * Update many documents
   */
  async updateMany(
    conditions: Record<string, any>,
    update: Record<string, any>
  ): Promise<{ modifiedCount: number }> {
    return this.updateOne(conditions, update);
  }

  /**
   * Delete one document
   */
  async deleteOne(conditions: Record<string, any>): Promise<{ deletedCount: number }> {
    await this.ensureTable();

    const { whereClause, whereParams } = this.buildWhereClause(conditions);
    const sql = `DELETE FROM "${this.tableName}" WHERE ${whereClause} LIMIT 1`;

    // SQLite doesn't support LIMIT in DELETE, use subquery
    const sqlSafe = `DELETE FROM "${this.tableName}" WHERE "_id" IN (SELECT "_id" FROM "${this.tableName}" WHERE ${whereClause} LIMIT 1)`;
    const result = getSQLConnection().run(sqlSafe, whereParams);

    return { deletedCount: result.changes };
  }

  /**
   * Delete many documents
   */
  async deleteMany(conditions: Record<string, any>): Promise<{ deletedCount: number }> {
    await this.ensureTable();

    const { whereClause, whereParams } = this.buildWhereClause(conditions);
    const sql = `DELETE FROM "${this.tableName}" WHERE ${whereClause}`;
    const result = getSQLConnection().run(sql, whereParams);

    return { deletedCount: result.changes };
  }

  /**
   * Check if value is valid ObjectId
   */
  isValidObjectId(id: any): boolean {
    return isValidObjectId(id);
  }

  private buildWhereClause(conditions: Record<string, any>): { whereClause: string; whereParams: any[] } {
    const clauses: string[] = [];
    const params: any[] = [];

    for (const [key, value] of Object.entries(conditions)) {
      if (value === null || value === undefined) {
        clauses.push(`"${key}" IS NULL`);
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // Handle operators: { $ne: true }, { $gt: 5 }, etc.
        for (const [op, opVal] of Object.entries(value)) {
          const { clause, param } = this.buildOperator(key, op, opVal);
          clauses.push(clause);
          if (param !== undefined) params.push(param);
        }
      } else {
        clauses.push(`"${key}" = ?`);
        params.push(this.serializeQueryValue(value));
      }
    }

    return {
      whereClause: clauses.length > 0 ? clauses.join(' AND ') : '1=1',
      whereParams: params
    };
  }

  private buildOperator(field: string, op: string, value: any): { clause: string; param?: any } {
    switch (op) {
      case '$eq':
        return { clause: `"${field}" = ?`, param: this.serializeQueryValue(value) };
      case '$ne':
        return { clause: `"${field}" != ?`, param: this.serializeQueryValue(value) };
      case '$gt':
        return { clause: `"${field}" > ?`, param: this.serializeQueryValue(value) };
      case '$gte':
        return { clause: `"${field}" >= ?`, param: this.serializeQueryValue(value) };
      case '$lt':
        return { clause: `"${field}" < ?`, param: this.serializeQueryValue(value) };
      case '$lte':
        return { clause: `"${field}" <= ?`, param: this.serializeQueryValue(value) };
      case '$in':
        const placeholders = (value as any[]).map(() => '?').join(', ');
        return {
          clause: `"${field}" IN (${placeholders})`,
          param: (value as any[]).map(v => this.serializeQueryValue(v))
        };
      case '$nin':
        const ninPlaceholders = (value as any[]).map(() => '?').join(', ');
        return {
          clause: `"${field}" NOT IN (${ninPlaceholders})`,
          param: (value as any[]).map(v => this.serializeQueryValue(v))
        };
      case '$exists':
        return { clause: value ? `"${field}" IS NOT NULL` : `"${field}" IS NULL` };
      case '$regex':
        // SQLite LIKE pattern (basic support)
        return { clause: `"${field}" LIKE ?`, param: `%${value}%` };
      default:
        throw new Error(`Unsupported operator: ${op}`);
    }
  }

  private buildSetClause(update: Record<string, any>): { setClause: string; setParams: any[] } {
    const clauses: string[] = [];
    const params: any[] = [];

    // Handle $set operator or direct updates
    const fields = update.$set || update;

    for (const [key, value] of Object.entries(fields)) {
      if (key.startsWith('$')) continue; // Skip operators
      clauses.push(`"${key}" = ?`);
      params.push(this.serializeQueryValue(value));
    }

    // Handle $inc
    if (update.$inc) {
      for (const [key, value] of Object.entries(update.$inc)) {
        clauses.push(`"${key}" = "${key}" + ?`);
        params.push(value);
      }
    }

    // Handle $unset
    if (update.$unset) {
      for (const key of Object.keys(update.$unset)) {
        clauses.push(`"${key}" = NULL`);
      }
    }

    return { setClause: clauses.join(', '), setParams: params };
  }

  private serializeQueryValue(value: any): any {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
  }
}

/**
 * Create a SQL model (Mongoose-compatible API)
 */
export function createSQLModel<T>(
  name: string,
  schemaDefinition: SQLSchemaDefinition,
  options?: { timestamps?: boolean }
): SQLModel<T> {
  const schema = new SQLSchema<T>(schemaDefinition, options);
  return new SQLModel<T>(name, schema);
}

/**
 * Get a registered model by name
 */
export function getSQLModel<T>(name: string): SQLModel<T> | undefined {
  return modelRegistry.get(name);
}

/**
 * Clear model registry (for testing)
 */
export function clearSQLModelRegistry(): void {
  modelRegistry.clear();
}
```

---

## Phase 4: Query Builder & JOINs

### 4.1 SQL Query Builder

```typescript
// api/src/adapters/sql/query.ts

import type { TerrenoQuery, TerrenoDocument, PopulateOptions } from '../types';
import type { SQLModel } from './model';
import { SQLDocument } from './document';
import { getSQLConnection } from './connection';

interface QueryOptions {
  single?: boolean;
}

/**
 * SQL Query builder that mirrors Mongoose Query API
 */
export class SQLQuery<T, ResultType = TerrenoDocument<T>[]> implements TerrenoQuery<T, ResultType> {
  private model: SQLModel<T>;
  private tableName: string;
  private conditions: Record<string, any>;
  private options: QueryOptions;

  private _limit?: number;
  private _skip?: number;
  private _sort?: Record<string, 1 | -1>;
  private _select?: string[];
  private _populate: PopulateOptions[] = [];
  private _lean = false;

  constructor(
    model: SQLModel<T>,
    tableName: string,
    conditions: Record<string, any>,
    options: QueryOptions = {}
  ) {
    this.model = model;
    this.tableName = tableName;
    this.conditions = conditions;
    this.options = options;
  }

  where(conditions: Record<string, any>): this {
    this.conditions = { ...this.conditions, ...conditions };
    return this;
  }

  limit(n: number): this {
    this._limit = n;
    return this;
  }

  skip(n: number): this {
    this._skip = n;
    return this;
  }

  sort(spec: string | Record<string, 'ascending' | 'descending' | 1 | -1>): this {
    if (typeof spec === 'string') {
      // Parse "-created updated" format
      this._sort = {};
      for (const part of spec.split(/\s+/)) {
        if (part.startsWith('-')) {
          this._sort[part.slice(1)] = -1;
        } else {
          this._sort[part] = 1;
        }
      }
    } else {
      this._sort = {};
      for (const [field, dir] of Object.entries(spec)) {
        this._sort[field] = dir === 'ascending' || dir === 1 ? 1 : -1;
      }
    }
    return this;
  }

  select(fields: string | string[] | Record<string, 0 | 1>): this {
    if (typeof fields === 'string') {
      this._select = fields.split(/\s+/).filter(f => !f.startsWith('-'));
    } else if (Array.isArray(fields)) {
      this._select = fields.filter(f => !f.startsWith('-'));
    } else {
      this._select = Object.entries(fields)
        .filter(([_, v]) => v === 1)
        .map(([k]) => k);
    }
    return this;
  }

  populate(options: string | PopulateOptions | PopulateOptions[]): this {
    const opts = typeof options === 'string'
      ? [{ path: options }]
      : Array.isArray(options) ? options : [options];

    this._populate.push(...opts);
    return this;
  }

  lean(): TerrenoQuery<T, (T & { _id: string })[]> {
    this._lean = true;
    return this as any;
  }

  async countDocuments(): Promise<number> {
    return this.model.countDocuments(this.conditions);
  }

  async exec(): Promise<ResultType> {
    await this.model.ensureTable();

    const { sql, params, joinAliases } = this.buildSQL();
    const rows = getSQLConnection().query(sql).all(...params) as Record<string, any>[];

    // Transform rows to documents
    const docs = rows.map(row => this.rowToDocument(row, joinAliases));

    if (this.options.single) {
      return (docs[0] ?? null) as ResultType;
    }

    return docs as ResultType;
  }

  private buildSQL(): { sql: string; params: any[]; joinAliases: Map<string, string> } {
    const params: any[] = [];
    const joinAliases = new Map<string, string>();
    const joins: string[] = [];

    // Build SELECT clause
    let selectFields: string[] = [];

    if (this._select && this._select.length > 0) {
      selectFields = this._select.map(f => `"${this.tableName}"."${f}"`);
      // Always include _id
      if (!this._select.includes('_id')) {
        selectFields.unshift(`"${this.tableName}"."_id"`);
      }
    } else {
      selectFields = [`"${this.tableName}".*`];
    }

    // Build JOINs for populate
    for (let i = 0; i < this._populate.length; i++) {
      const pop = this._populate[i];
      const fieldPath = this.model.schema.path(pop.path);

      if (!fieldPath?.options.ref) continue;

      const refModelName = pop.model || fieldPath.options.ref;
      const refModel = this.model.db.model(refModelName);
      const refTable = refModel.collection.collectionName;
      const alias = `_j${i}`;

      joinAliases.set(pop.path, alias);

      // LEFT JOIN for optional relationships
      joins.push(
        `LEFT JOIN "${refTable}" AS "${alias}" ON "${this.tableName}"."${pop.path}" = "${alias}"."_id"`
      );

      // Add selected fields from joined table
      if (pop.select) {
        const fields = typeof pop.select === 'string'
          ? pop.select.split(/\s+/)
          : pop.select;

        const isBlocklist = fields.some(f => f.startsWith('-'));

        if (isBlocklist) {
          // Blocklist: get all fields except blocked
          const blocked = new Set(fields.map(f => f.replace('-', '')));
          const refFields = Object.keys(refModel.schema.paths)
            .filter(f => !blocked.has(f));

          for (const f of refFields) {
            selectFields.push(`"${alias}"."${f}" AS "${pop.path}.${f}"`);
          }
        } else {
          // Allowlist: only specified fields
          for (const f of fields) {
            selectFields.push(`"${alias}"."${f}" AS "${pop.path}.${f}"`);
          }
        }
      } else {
        // Select all fields from joined table
        for (const f of Object.keys(refModel.schema.paths)) {
          selectFields.push(`"${alias}"."${f}" AS "${pop.path}.${f}"`);
        }
      }

      // Handle match conditions on populate
      if (pop.match) {
        for (const [key, value] of Object.entries(pop.match)) {
          joins[joins.length - 1] += ` AND "${alias}"."${key}" = ?`;
          params.push(value);
        }
      }
    }

    let sql = `SELECT ${selectFields.join(', ')} FROM "${this.tableName}"`;

    if (joins.length > 0) {
      sql += ' ' + joins.join(' ');
    }

    // WHERE clause
    const { whereClause, whereParams } = this.buildWhereClause();
    if (whereClause !== '1=1') {
      sql += ` WHERE ${whereClause}`;
      params.push(...whereParams);
    }

    // ORDER BY
    if (this._sort) {
      const orderClauses = Object.entries(this._sort)
        .map(([field, dir]) => `"${field}" ${dir === 1 ? 'ASC' : 'DESC'}`);
      sql += ` ORDER BY ${orderClauses.join(', ')}`;
    }

    // LIMIT and OFFSET
    if (this._limit !== undefined) {
      sql += ` LIMIT ${this._limit}`;
    }
    if (this._skip !== undefined) {
      sql += ` OFFSET ${this._skip}`;
    }

    return { sql, params, joinAliases };
  }

  private buildWhereClause(): { whereClause: string; whereParams: any[] } {
    const clauses: string[] = [];
    const params: any[] = [];

    for (const [key, value] of Object.entries(this.conditions)) {
      // Handle $and / $or
      if (key === '$and' || key === '$or') {
        const subClauses: string[] = [];
        for (const subCondition of value as Record<string, any>[]) {
          const { whereClause, whereParams } = this.buildCondition(subCondition);
          subClauses.push(`(${whereClause})`);
          params.push(...whereParams);
        }
        clauses.push(`(${subClauses.join(key === '$and' ? ' AND ' : ' OR ')})`);
        continue;
      }

      const { clause, condParams } = this.buildSingleCondition(key, value);
      clauses.push(clause);
      params.push(...condParams);
    }

    return {
      whereClause: clauses.length > 0 ? clauses.join(' AND ') : '1=1',
      whereParams: params
    };
  }

  private buildCondition(conditions: Record<string, any>): { whereClause: string; whereParams: any[] } {
    const clauses: string[] = [];
    const params: any[] = [];

    for (const [key, value] of Object.entries(conditions)) {
      const { clause, condParams } = this.buildSingleCondition(key, value);
      clauses.push(clause);
      params.push(...condParams);
    }

    return {
      whereClause: clauses.join(' AND '),
      whereParams: params
    };
  }

  private buildSingleCondition(key: string, value: any): { clause: string; condParams: any[] } {
    const params: any[] = [];

    if (value === null || value === undefined) {
      return { clause: `"${this.tableName}"."${key}" IS NULL`, condParams: [] };
    }

    if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      // Handle operators
      const subClauses: string[] = [];

      for (const [op, opVal] of Object.entries(value)) {
        switch (op) {
          case '$eq':
            subClauses.push(`"${this.tableName}"."${key}" = ?`);
            params.push(this.serializeValue(opVal));
            break;
          case '$ne':
            subClauses.push(`"${this.tableName}"."${key}" != ?`);
            params.push(this.serializeValue(opVal));
            break;
          case '$gt':
            subClauses.push(`"${this.tableName}"."${key}" > ?`);
            params.push(this.serializeValue(opVal));
            break;
          case '$gte':
            subClauses.push(`"${this.tableName}"."${key}" >= ?`);
            params.push(this.serializeValue(opVal));
            break;
          case '$lt':
            subClauses.push(`"${this.tableName}"."${key}" < ?`);
            params.push(this.serializeValue(opVal));
            break;
          case '$lte':
            subClauses.push(`"${this.tableName}"."${key}" <= ?`);
            params.push(this.serializeValue(opVal));
            break;
          case '$in':
            const inPlaceholders = (opVal as any[]).map(() => '?').join(', ');
            subClauses.push(`"${this.tableName}"."${key}" IN (${inPlaceholders})`);
            params.push(...(opVal as any[]).map(v => this.serializeValue(v)));
            break;
          case '$nin':
            const ninPlaceholders = (opVal as any[]).map(() => '?').join(', ');
            subClauses.push(`"${this.tableName}"."${key}" NOT IN (${ninPlaceholders})`);
            params.push(...(opVal as any[]).map(v => this.serializeValue(v)));
            break;
          case '$exists':
            subClauses.push(
              opVal
                ? `"${this.tableName}"."${key}" IS NOT NULL`
                : `"${this.tableName}"."${key}" IS NULL`
            );
            break;
          case '$regex':
            subClauses.push(`"${this.tableName}"."${key}" LIKE ?`);
            params.push(`%${opVal}%`);
            break;
        }
      }

      return { clause: subClauses.join(' AND '), condParams: params };
    }

    // Simple equality
    return {
      clause: `"${this.tableName}"."${key}" = ?`,
      condParams: [this.serializeValue(value)]
    };
  }

  private serializeValue(value: any): any {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
  }

  private rowToDocument(
    row: Record<string, any>,
    joinAliases: Map<string, string>
  ): TerrenoDocument<T> | (T & { _id: string }) {
    // Separate main fields from joined fields
    const mainData: Record<string, any> = {};
    const joinedData: Record<string, Record<string, any>> = {};

    for (const [key, value] of Object.entries(row)) {
      if (key.includes('.')) {
        // Joined field: "ownerId.email" -> { ownerId: { email: ... } }
        const [path, field] = key.split('.', 2);
        if (!joinedData[path]) joinedData[path] = {};
        joinedData[path][field] = value;
      } else {
        mainData[key] = value;
      }
    }

    // Merge joined data (only if _id exists, meaning JOIN matched)
    for (const [path, data] of Object.entries(joinedData)) {
      if (data._id) {
        // Deserialize joined data
        const refModel = this.model.db.model(
          this.model.schema.path(path)?.options.ref || ''
        );
        mainData[path] = this.deserializeRow(data, refModel.schema.paths);
      }
      // If _id is null, leave the original foreign key value
    }

    // Deserialize main data
    const deserializedData = this.deserializeRow(mainData, this.model.schema.paths);

    if (this._lean) {
      return { ...deserializedData, id: deserializedData._id } as T & { _id: string };
    }

    return new SQLDocument<T>(this.model, deserializedData, { isNew: false });
  }

  private deserializeRow(
    row: Record<string, any>,
    paths: Record<string, any>
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(row)) {
      const path = paths[key];

      if (!path) {
        result[key] = value;
        continue;
      }

      if (value === null) {
        result[key] = null;
        continue;
      }

      switch (path.instance) {
        case 'Boolean':
          result[key] = value === 1 || value === true;
          break;
        case 'Date':
          result[key] = typeof value === 'string' ? new Date(value) : value;
          break;
        case 'Array':
        case 'Mixed':
          if (typeof value === 'string') {
            try {
              result[key] = JSON.parse(value);
            } catch {
              result[key] = value;
            }
          } else {
            result[key] = value;
          }
          break;
        case 'Number':
          result[key] = typeof value === 'string' ? parseFloat(value) : value;
          break;
        default:
          result[key] = value;
      }
    }

    return result;
  }
}
```

---

## Phase 5: Hooks & Plugins

### 5.1 SQL-Compatible Plugins

```typescript
// api/src/adapters/sql/plugins.ts

import type { SQLSchema } from './schema';

/**
 * Add soft-delete support (deleted: boolean field)
 */
export function isDeletedPlugin<T>(
  schema: SQLSchema<T>,
  defaultValue = false
): void {
  schema.paths.deleted = {
    instance: 'Boolean',
    options: {
      type: 'Boolean',
      default: defaultValue,
      index: true,
    }
  };

  // Add pre-find hooks to filter deleted documents
  // Note: In SQL adapter, this is handled in query builder
  // by checking schema.paths.deleted and adding WHERE clause
}

/**
 * Add disabled user support
 */
export function isDisabledPlugin<T>(
  schema: SQLSchema<T>,
  defaultValue = false
): void {
  schema.paths.disabled = {
    instance: 'Boolean',
    options: {
      type: 'Boolean',
      default: defaultValue,
      index: true,
    }
  };
}

/**
 * Add automatic created/updated timestamps
 */
export function createdUpdatedPlugin<T>(schema: SQLSchema<T>): void {
  schema.paths.created = {
    instance: 'Date',
    options: { type: 'Date', index: true }
  };
  schema.paths.updated = {
    instance: 'Date',
    options: { type: 'Date', index: true }
  };

  schema.pre('save', function(this: any) {
    const now = new Date();
    if (!this._data.created) {
      this._data.created = now;
    }
    this._data.updated = now;
    this._changes.set('updated', now);
  });
}

/**
 * Add admin and email fields (for user models)
 */
export function baseUserPlugin<T>(schema: SQLSchema<T>): void {
  schema.paths.admin = {
    instance: 'Boolean',
    options: { type: 'Boolean', default: false }
  };
  schema.paths.email = {
    instance: 'String',
    options: { type: 'String', index: true }
  };
}

/**
 * Add Firebase JWT support
 */
export function firebaseJWTPlugin<T>(schema: SQLSchema<T>): void {
  schema.paths.firebaseId = {
    instance: 'String',
    options: { type: 'String', index: true }
  };
}
```

---

## Phase 6: Transactions

### 6.1 Unified Transaction API

```typescript
// api/src/adapters/transactions.ts

import mongoose from 'mongoose';
import { getDatabaseBackend } from './config';
import { getSQLConnection } from './sql/connection';

export interface TransactionSession {
  /** Commit the transaction */
  commit(): Promise<void>;

  /** Rollback the transaction */
  rollback(): Promise<void>;

  /** End the session (auto-rollback if not committed) */
  end(): Promise<void>;
}

/**
 * Execute operations within a transaction
 *
 * @example
 * ```typescript
 * await withTransaction(async (session) => {
 *   await User.create({ name: 'Alice' }, { session });
 *   await Account.create({ userId: user._id }, { session });
 *   // If any operation fails, all are rolled back
 * });
 * ```
 */
export async function withTransaction<T>(
  fn: (session: TransactionSession) => Promise<T>
): Promise<T> {
  const backend = getDatabaseBackend();

  if (backend === 'mongoose') {
    return withMongooseTransaction(fn);
  } else {
    return withSQLTransaction(fn);
  }
}

/**
 * Mongoose transaction implementation
 */
async function withMongooseTransaction<T>(
  fn: (session: TransactionSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const transactionSession: TransactionSession = {
      async commit() {
        await session.commitTransaction();
      },
      async rollback() {
        await session.abortTransaction();
      },
      async end() {
        session.endSession();
      }
    };

    // Attach session to mongoose for automatic use
    (mongoose as any).__currentSession = session;

    const result = await fn(transactionSession);

    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    (mongoose as any).__currentSession = null;
    session.endSession();
  }
}

/**
 * SQL transaction implementation
 */
async function withSQLTransaction<T>(
  fn: (session: TransactionSession) => Promise<T>
): Promise<T> {
  const db = getSQLConnection();

  // SQLite transaction via bun:sqlite
  let committed = false;

  const transactionSession: TransactionSession = {
    async commit() {
      committed = true;
    },
    async rollback() {
      // Will be handled by throwing
    },
    async end() {
      // Handled by finally
    }
  };

  // Use Bun's transaction helper
  const transaction = db.transaction(() => {
    // This runs synchronously in SQLite
    // For async operations, we need a different approach
  });

  try {
    db.run('BEGIN TRANSACTION');

    const result = await fn(transactionSession);

    if (committed) {
      db.run('COMMIT');
    } else {
      db.run('COMMIT'); // Auto-commit on success
    }

    return result;
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
}

/**
 * Check if currently in a transaction
 */
export function isInTransaction(): boolean {
  const backend = getDatabaseBackend();

  if (backend === 'mongoose') {
    return !!(mongoose as any).__currentSession;
  }

  // SQL: Would need to track transaction state
  return false;
}
```

---

## Phase 7: Migration System

### 7.1 Migration Runner

```typescript
// api/src/adapters/sql/migrations.ts

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { getSQLConnection, executeSQL, querySQL } from './connection';
import { logger } from '../../logger';

interface Migration {
  version: number;
  name: string;
  filename: string;
  sql: string;
}

interface AppliedMigration {
  version: number;
  name: string;
  applied_at: string;
}

/**
 * Run pending migrations
 */
export async function runMigrations(migrationsDir: string): Promise<void> {
  const db = getSQLConnection();

  // Create migrations tracking table
  executeSQL(`
    CREATE TABLE IF NOT EXISTS "_migrations" (
      "version" INTEGER PRIMARY KEY,
      "name" TEXT NOT NULL,
      "applied_at" TEXT NOT NULL
    )
  `);

  // Get applied migrations
  const applied = new Set(
    querySQL<AppliedMigration>('SELECT version FROM "_migrations"')
      .map(r => r.version)
  );

  // Get migration files
  const migrations = getMigrationFiles(migrationsDir);

  // Run pending migrations in order
  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue;
    }

    logger.info(`Running migration ${migration.version}: ${migration.name}`);

    try {
      // Run migration in transaction
      executeSQL('BEGIN TRANSACTION');

      // Execute each statement
      const statements = parseMigrationSQL(migration.sql);
      for (const stmt of statements) {
        executeSQL(stmt);
      }

      // Record migration
      executeSQL(
        'INSERT INTO "_migrations" ("version", "name", "applied_at") VALUES (?, ?, ?)',
        [migration.version, migration.name, new Date().toISOString()]
      );

      executeSQL('COMMIT');
      logger.info(`Completed migration ${migration.version}`);
    } catch (error) {
      executeSQL('ROLLBACK');
      logger.error(`Migration ${migration.version} failed: ${error}`);
      throw error;
    }
  }
}

/**
 * Get list of migration files sorted by version
 */
function getMigrationFiles(migrationsDir: string): Migration[] {
  if (!existsSync(migrationsDir)) {
    return [];
  }

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  return files.map(file => {
    const match = file.match(/^(\d+)[-_](.+)\.sql$/);
    if (!match) {
      throw new Error(`Invalid migration filename: ${file}. Expected format: 001_name.sql`);
    }

    return {
      version: parseInt(match[1], 10),
      name: match[2].replace(/[-_]/g, ' '),
      filename: file,
      sql: readFileSync(join(migrationsDir, file), 'utf-8'),
    };
  });
}

/**
 * Parse SQL file into individual statements
 */
function parseMigrationSQL(sql: string): string[] {
  return sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
}

/**
 * Create a new migration file
 */
export function createMigration(migrationsDir: string, name: string): string {
  // Ensure directory exists
  if (!existsSync(migrationsDir)) {
    mkdirSync(migrationsDir, { recursive: true });
  }

  // Get next version number
  const migrations = getMigrationFiles(migrationsDir);
  const nextVersion = migrations.length > 0
    ? Math.max(...migrations.map(m => m.version)) + 1
    : 1;

  const versionStr = String(nextVersion).padStart(3, '0');
  const safeName = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const filename = `${versionStr}_${safeName}.sql`;
  const filepath = join(migrationsDir, filename);

  const template = `-- Migration: ${name}
-- Version: ${nextVersion}
-- Created: ${new Date().toISOString()}

-- Write your migration SQL here
-- Example:
-- CREATE TABLE "example" (
--   "_id" TEXT PRIMARY KEY,
--   "name" TEXT NOT NULL,
--   "created" TEXT
-- );

`;

  writeFileSync(filepath, template);
  logger.info(`Created migration: ${filepath}`);

  return filepath;
}

/**
 * Get migration status
 */
export function getMigrationStatus(migrationsDir: string): {
  pending: Migration[];
  applied: AppliedMigration[];
} {
  const migrations = getMigrationFiles(migrationsDir);
  const applied = querySQL<AppliedMigration>(
    'SELECT * FROM "_migrations" ORDER BY "version"'
  );
  const appliedVersions = new Set(applied.map(a => a.version));

  return {
    pending: migrations.filter(m => !appliedVersions.has(m.version)),
    applied,
  };
}

/**
 * Rollback last migration (dangerous!)
 */
export async function rollbackLastMigration(migrationsDir: string): Promise<void> {
  const { applied } = getMigrationStatus(migrationsDir);

  if (applied.length === 0) {
    logger.warn('No migrations to rollback');
    return;
  }

  const last = applied[applied.length - 1];

  logger.warn(`Rolling back migration ${last.version}: ${last.name}`);
  logger.warn('WARNING: This does NOT undo schema changes. Manual cleanup required.');

  executeSQL('DELETE FROM "_migrations" WHERE "version" = ?', [last.version]);

  logger.info(`Removed migration record ${last.version}`);
}
```

### 7.2 Migration CLI Commands

```typescript
// api/src/adapters/sql/migrationCli.ts

import { runMigrations, createMigration, getMigrationStatus, rollbackLastMigration } from './migrations';

/**
 * CLI for managing migrations
 *
 * Usage:
 *   bun run migrate              # Run pending migrations
 *   bun run migrate:create name  # Create new migration
 *   bun run migrate:status       # Show migration status
 *   bun run migrate:rollback     # Rollback last migration
 */
export async function migrationCli(args: string[], migrationsDir: string): Promise<void> {
  const command = args[0] || 'run';

  switch (command) {
    case 'run':
      await runMigrations(migrationsDir);
      break;

    case 'create':
      const name = args[1];
      if (!name) {
        console.error('Usage: migrate:create <name>');
        process.exit(1);
      }
      createMigration(migrationsDir, name);
      break;

    case 'status':
      const status = getMigrationStatus(migrationsDir);
      console.log('\nApplied migrations:');
      for (const m of status.applied) {
        console.log(`  ✓ ${m.version}: ${m.name} (${m.applied_at})`);
      }
      console.log('\nPending migrations:');
      for (const m of status.pending) {
        console.log(`  ○ ${m.version}: ${m.name}`);
      }
      if (status.pending.length === 0) {
        console.log('  (none)');
      }
      break;

    case 'rollback':
      await rollbackLastMigration(migrationsDir);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}
```

---

## Phase 8: Testing Strategy

### 8.1 Test Structure

```
api/src/adapters/
├── mongoose/
│   └── adapter.test.ts        # Backwards compatibility
│
├── sql/
│   └── tests/
│       ├── setup.ts           # Test utilities
│       ├── objectId.test.ts   # ObjectId generation
│       ├── schema.test.ts     # Schema definition
│       ├── model.test.ts      # CRUD operations
│       ├── query.test.ts      # Query builder
│       ├── joins.test.ts      # Population/JOINs
│       ├── hooks.test.ts      # Pre/post hooks
│       ├── plugins.test.ts    # Plugin support
│       ├── transactions.test.ts
│       └── migrations.test.ts
│
├── parity.test.ts             # Same tests on both backends
└── integration.test.ts        # modelRouter integration
```

### 8.2 Test Setup Utilities

```typescript
// api/src/adapters/sql/tests/setup.ts

import { beforeEach, afterEach } from 'bun:test';
import { initializeSQLConnection, closeSQLConnection, executeSQL } from '../connection';
import { clearSQLModelRegistry } from '../model';

/**
 * Setup in-memory SQLite for testing
 */
export function setupSQLTestDb() {
  beforeEach(() => {
    initializeSQLConnection({
      backend: 'sqlite',
      sqliteFilename: ':memory:'
    });
  });

  afterEach(() => {
    clearSQLModelRegistry();
    closeSQLConnection();
  });
}

/**
 * Create test tables
 */
export function createTestTables() {
  executeSQL(`
    CREATE TABLE IF NOT EXISTS "users" (
      "_id" TEXT PRIMARY KEY,
      "email" TEXT UNIQUE,
      "name" TEXT,
      "admin" INTEGER DEFAULT 0,
      "created" TEXT,
      "updated" TEXT
    )
  `);

  executeSQL(`
    CREATE TABLE IF NOT EXISTS "foods" (
      "_id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "calories" REAL,
      "ownerId" TEXT REFERENCES "users"("_id"),
      "deleted" INTEGER DEFAULT 0,
      "created" TEXT,
      "updated" TEXT
    )
  `);
}
```

### 8.3 Parity Tests

```typescript
// api/src/adapters/parity.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import mongoose from 'mongoose';
import { createSQLModel, clearSQLModelRegistry } from './sql/model';
import { initializeSQLConnection, closeSQLConnection } from './sql/connection';
import { FoodModel as MongooseFoodModel, setupDb } from '../tests';

/**
 * These tests run the SAME test code against both backends
 * to ensure behavioral parity
 */

interface TestBackend {
  name: string;
  setup: () => Promise<void>;
  teardown: () => Promise<void>;
  createFoodModel: () => any;
}

const mongooseBackend: TestBackend = {
  name: 'Mongoose',
  setup: async () => {
    await setupDb();
  },
  teardown: async () => {
    // Cleanup handled by setupDb
  },
  createFoodModel: () => MongooseFoodModel,
};

const sqlBackend: TestBackend = {
  name: 'SQL',
  setup: async () => {
    initializeSQLConnection({ backend: 'sqlite', sqliteFilename: ':memory:' });
  },
  teardown: async () => {
    clearSQLModelRegistry();
    closeSQLConnection();
  },
  createFoodModel: () => createSQLModel('Food', {
    name: { type: 'String', required: true },
    calories: { type: 'Number' },
    ownerId: { type: 'ObjectId', ref: 'User' },
    deleted: { type: 'Boolean', default: false },
  }),
};

const backends = [mongooseBackend, sqlBackend];

for (const backend of backends) {
  describe(`Parity Tests: ${backend.name}`, () => {
    let FoodModel: any;

    beforeEach(async () => {
      await backend.setup();
      FoodModel = backend.createFoodModel();
      if (FoodModel.ensureTable) {
        await FoodModel.ensureTable();
      }
    });

    afterEach(async () => {
      await backend.teardown();
    });

    describe('CRUD Operations', () => {
      it('should create a document with auto-generated _id', async () => {
        const doc = await FoodModel.create({ name: 'Apple', calories: 95 });

        expect(doc._id).toBeDefined();
        expect(doc._id).toMatch(/^[a-f0-9]{24}$/);
        expect(doc.name).toBe('Apple');
        expect(doc.calories).toBe(95);
      });

      it('should find documents', async () => {
        await FoodModel.create({ name: 'Apple', calories: 95 });
        await FoodModel.create({ name: 'Banana', calories: 89 });

        const docs = await FoodModel.find({}).exec();
        expect(docs.length).toBe(2);
      });

      it('should find by ID', async () => {
        const created = await FoodModel.create({ name: 'Apple' });
        const found = await FoodModel.findById(created._id).exec();

        expect(found).not.toBeNull();
        expect(found.name).toBe('Apple');
      });

      it('should update via save()', async () => {
        const doc = await FoodModel.create({ name: 'Apple', calories: 95 });

        doc.calories = 100;
        await doc.save();

        const updated = await FoodModel.findById(doc._id).exec();
        expect(updated.calories).toBe(100);
      });

      it('should delete document', async () => {
        const doc = await FoodModel.create({ name: 'Apple' });
        await doc.deleteOne();

        const found = await FoodModel.findById(doc._id).exec();
        expect(found).toBeNull();
      });
    });

    describe('Query Operations', () => {
      beforeEach(async () => {
        await FoodModel.create({ name: 'Apple', calories: 95 });
        await FoodModel.create({ name: 'Banana', calories: 89 });
        await FoodModel.create({ name: 'Cherry', calories: 50 });
      });

      it('should filter with conditions', async () => {
        const docs = await FoodModel.find({ name: 'Apple' }).exec();
        expect(docs.length).toBe(1);
        expect(docs[0].name).toBe('Apple');
      });

      it('should support $gt operator', async () => {
        const docs = await FoodModel.find({ calories: { $gt: 80 } }).exec();
        expect(docs.length).toBe(2);
      });

      it('should support limit', async () => {
        const docs = await FoodModel.find({}).limit(2).exec();
        expect(docs.length).toBe(2);
      });

      it('should support skip', async () => {
        const docs = await FoodModel.find({}).skip(1).exec();
        expect(docs.length).toBe(2);
      });

      it('should support sort', async () => {
        const docs = await FoodModel.find({}).sort('-calories').exec();
        expect(docs[0].name).toBe('Apple');
        expect(docs[2].name).toBe('Cherry');
      });
    });

    describe('countDocuments', () => {
      it('should count all documents', async () => {
        await FoodModel.create({ name: 'Apple' });
        await FoodModel.create({ name: 'Banana' });

        const count = await FoodModel.countDocuments({});
        expect(count).toBe(2);
      });

      it('should count with filter', async () => {
        await FoodModel.create({ name: 'Apple', calories: 95 });
        await FoodModel.create({ name: 'Banana', calories: 89 });

        const count = await FoodModel.countDocuments({ calories: { $gt: 90 } });
        expect(count).toBe(1);
      });
    });
  });
}
```

---

## Phase 9: Integration

### 9.1 Update modelRouter

```typescript
// api/src/api.ts (modifications)

import { ensureTerrenoModel, isMongooseModel } from './adapters/mongoose/adapter';
import type { TerrenoModel } from './adapters/types';

/**
 * Create a set of CRUD routes given a model and configuration options.
 *
 * @param model A Mongoose Model or TerrenoModel (SQL)
 * @param options Configuration options
 */
export function modelRouter<T>(
  model: Model<T> | TerrenoModel<T>,
  options: ModelRouterOptions<T>
): express.Router {
  // Normalize to TerrenoModel interface
  const terrenoModel = ensureTerrenoModel(model);

  // Rest of implementation uses terrenoModel instead of model...
  // All existing code should work since TerrenoModel matches Mongoose API
}
```

### 9.2 Update Exports

```typescript
// api/src/adapters/index.ts

// Types
export type {
  TerrenoModel,
  TerrenoDocument,
  TerrenoQuery,
  TerrenoSchema,
  SchemaPath,
  SchemaPathOptions,
  PopulateOptions,
} from './types';

// Configuration
export {
  configureTerrenoDatabase,
  getTerrenoDatabaseConfig,
  getDatabaseBackend,
  type DatabaseConfig,
  type DatabaseBackend,
} from './config';

// Mongoose adapter
export {
  isMongooseModel,
  wrapMongooseModel,
  ensureTerrenoModel,
} from './mongoose/adapter';

// SQL adapter
export {
  createSQLModel,
  createSQLSchema,
  getSQLModel,
  SQLModel,
  SQLSchema,
  SQLDocument,
  SQLQuery,
} from './sql';

// SQL plugins
export {
  isDeletedPlugin,
  isDisabledPlugin,
  createdUpdatedPlugin,
  baseUserPlugin,
  firebaseJWTPlugin,
} from './sql/plugins';

// SQL utilities
export {
  generateObjectId,
  isValidObjectId,
  getTimestampFromObjectId,
} from './sql/objectId';

// Migrations
export {
  runMigrations,
  createMigration,
  getMigrationStatus,
} from './sql/migrations';

// Transactions
export {
  withTransaction,
  isInTransaction,
  type TransactionSession,
} from './transactions';
```

### 9.3 Update Main Package Exports

```typescript
// api/src/index.ts (add to existing exports)

// Database adapters
export * from './adapters';
```

---

## Summary

This implementation plan provides a complete path to adding SQL database support to `@terreno/api` while maintaining full backwards compatibility with existing Mongoose code.

### Key Features

1. **Zero Breaking Changes**: Existing Mongoose models work unchanged
2. **Mongoose-Compatible API**: SQL models use the same syntax
3. **Efficient SQL**: JOINs for population, proper indexing
4. **MongoDB ObjectIds**: Familiar ID format across backends
5. **Unified Transactions**: Same API for both databases
6. **Simple Migrations**: Numbered SQL files, automatic tracking
7. **Full Plugin Support**: Same plugins work on both backends
8. **Comprehensive Testing**: Parity tests ensure identical behavior

### Implementation Order

1. **Phase 1-2**: Core interfaces and Mongoose wrapper (ensures no regressions)
2. **Phase 3-4**: SQL model and query builder (core functionality)
3. **Phase 5-6**: Hooks, plugins, and transactions (feature parity)
4. **Phase 7**: Migration system (production readiness)
5. **Phase 8-9**: Testing and integration (quality assurance)