# Concurrency and Isolation Deep Dive

A comprehensive explanation of how the Unit of Work pattern with CLS (Continuation Local Storage) handles concurrent requests safely in a single NestJS process.

## Table of Contents

- [The Core Question](#the-core-question)
- [Architecture Overview](#architecture-overview)
- [CLS Isolation Mechanism](#cls-isolation-mechanism)
- [Concurrent Execution Flow](#concurrent-execution-flow)
- [Sharing Context Within a Request](#sharing-context-within-a-request)
- [Common Scenarios](#common-scenarios)
- [How CLS Works Internally](#how-cls-works-internally)
- [Visual Reference](#visual-reference)
- [Common Misconceptions](#common-misconceptions)
- [Key Takeaways](#key-takeaways)

---

## The Core Question

**Q: "If we have one NestJS process with one manager, and multiple concurrent requests hit the same service class, will they conflict or use the same manager?"**

**A: No conflicts occur! Each request is completely isolated despite sharing the same service instance.**

This document explains how and why.

---

## Architecture Overview

### What's Shared (Singleton)

In a single NestJS process, these components are **shared** across all requests:

```typescript
┌─────────────────────────────────────────────────────┐
│         NestJS Application (Single Process)         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  SHARED SINGLETONS:                                 │
│  ✅ UserService instance (1 instance)              │
│  ✅ UnitOfWork instance (1 instance)               │
│  ✅ DataSource instance (1 instance)               │
│  ✅ CLS Namespace object (1 instance)              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### What's Isolated (Per-Request)

Each request gets its **own isolated** instances:

```typescript
┌─────────────────────────────────────────────────────┐
│  ISOLATED PER-REQUEST:                              │
│  🔒 CLS Execution Context                          │
│  🔒 QueryRunner (from connection pool)             │
│  🔒 EntityManager (from QueryRunner)               │
│  🔒 Database Connection (from pool)                │
│  🔒 Transaction state                              │
└─────────────────────────────────────────────────────┘
```

**The Key**: Even though the service and UnitOfWork are singletons, they **don't store request-specific state** in instance variables. All request-specific data goes into **CLS context storage**.

---

## CLS Isolation Mechanism

### How CLS Provides Isolation

CLS (Continuation Local Storage) uses Node.js **async_hooks** to track execution contexts:

```typescript
// When a request arrives
app.use(ClsMiddleware);

// Inside ClsMiddleware
class ClsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const namespace = getNamespaceInstance();

    namespace.run(() => {  // ← Creates isolated context
      // All code inside here runs in an isolated context
      // Async operations inherit this context
      next();
    });
  }
}
```

### Simplified CLS Internals

Here's a conceptual view of how CLS works:

```typescript
class Namespace {
  // Maps asyncId (from Node.js async_hooks) to context storage
  private contexts = new Map<number, Record<string, any>>();

  run(callback: () => void) {
    const asyncId = executionAsyncId();  // From Node.js async_hooks
    this.contexts.set(asyncId, {});      // Create new context storage

    callback();  // All async operations inside inherit this asyncId
  }

  get(key: string): any {
    const asyncId = executionAsyncId();       // Which context am I in?
    const context = this.contexts.get(asyncId);
    return context?.[key];                    // Read from MY context
  }

  set(key: string, value: any): void {
    const asyncId = executionAsyncId();       // Which context am I in?
    const context = this.contexts.get(asyncId);
    if (context) {
      context[key] = value;                   // Write to MY context
    }
  }
}
```

**Key Insight**: Even though `namespace` is a singleton, `namespace.get()` and `namespace.set()` operate on **different storage** depending on which async execution context is currently active.

---

## Concurrent Execution Flow

Let's trace two concurrent requests hitting the same service:

### Setup

```typescript
@Injectable()  // ← Singleton service
class UserService {
  constructor(private readonly unitOfWork: UnitOfWork) {}  // ← Singleton

  @Transactional()
  async createUser(data: UserData): Promise<User> {
    return await this.userRepo.save(newUser);
  }

  @Transactional()
  async updateUser(id: string, data: UserData): Promise<User> {
    return await this.userRepo.update(id, data);
  }
}
```

### Concurrent Requests

```
Request A: POST /users        (create new user)
Request B: PUT /users/123     (update existing user)
```

### Timeline

```typescript
Time: T0 - Requests Arrive
================================

Request A: POST /users
  → Express processes request
  → ClsMiddleware.use() executes
    → namespace.run(() => {
        // Creates Context-A (asyncId = 1001)
        next();
      });
  → Enters Context-A

Request B: PUT /users/123 (arrives concurrently!)
  → Express processes request
  → ClsMiddleware.use() executes
    → namespace.run(() => {
        // Creates Context-B (asyncId = 2001)
        next();
      });
  → Enters Context-B


Time: T1 - Entering @Transactional Decorator
===========================================

Request A (in Context-A, asyncId = 1001):
  → userService.createUser() called
  → @Transactional decorator intercepts
    → const unitOfWork = this.unitOfWork;  // ← SHARED singleton instance
    → await Effect.runPromise(unitOfWork.begin());  // Returns Effect

      Inside begin():
      ┌───────────────────────────────────────────────────┐
      │ // executionAsyncId() = 1001                      │
      │                                                    │
      │ const queryRunner = dataSource.createQueryRunner(); │
      │ // ↑ Creates QueryRunner-A from connection pool   │
      │                                                    │
      │ await queryRunner.connect();                      │
      │ await queryRunner.startTransaction();             │
      │                                                    │
      │ const namespace = getNamespaceInstance();          │
      │ // ↑ Gets the shared namespace object              │
      │                                                    │
      │ namespace.set('ENTITY_MANAGER', queryRunner.manager); │
      │ // ↑ Stores in contexts.get(1001)['ENTITY_MANAGER'] │
      │ //   = EntityManager-A                            │
      └───────────────────────────────────────────────────┘

Request B (in Context-B, asyncId = 2001, concurrent!):
  → userService.updateUser() called  // ← SAME service instance!
  → @Transactional decorator intercepts
    → const unitOfWork = this.unitOfWork;  // ← SAME singleton instance!
    → await Effect.runPromise(unitOfWork.begin());  // Returns Effect

      Inside begin():
      ┌───────────────────────────────────────────────────┐
      │ // executionAsyncId() = 2001                      │
      │                                                    │
      │ const queryRunner = dataSource.createQueryRunner(); │
      │ // ↑ Creates QueryRunner-B (different connection!) │
      │                                                    │
      │ await queryRunner.connect();                      │
      │ await queryRunner.startTransaction();             │
      │                                                    │
      │ const namespace = getNamespaceInstance();          │
      │ // ↑ Gets the SAME shared namespace object         │
      │                                                    │
      │ namespace.set('ENTITY_MANAGER', queryRunner.manager); │
      │ // ↑ Stores in contexts.get(2001)['ENTITY_MANAGER'] │
      │ //   = EntityManager-B (different from A!)        │
      └───────────────────────────────────────────────────┘


Time: T2 - Repository Operations
=========================================

Request A (in Context-A, asyncId = 1001):
  → await this.userRepo.save(newUser);
    → Inside BaseRepository.getEntityManager():

      ┌───────────────────────────────────────────────────┐
      │ // executionAsyncId() = 1001                      │
      │                                                    │
      │ const namespace = getNamespaceInstance();          │
      │ // ↑ Gets the shared namespace object              │
      │                                                    │
      │ return namespace.get('ENTITY_MANAGER');           │
      │ // ↑ Reads contexts.get(1001)['ENTITY_MANAGER']  │
      │ // Returns EntityManager-A ✅                     │
      └───────────────────────────────────────────────────┘

    → Uses EntityManager-A
    → Executes: INSERT INTO users ...
    → Uses QueryRunner-A's transaction

Request B (in Context-B, asyncId = 2001, concurrent!):
  → await this.userRepo.update(id, data);
    → Inside BaseRepository.getEntityManager():

      ┌───────────────────────────────────────────────────┐
      │ // executionAsyncId() = 2001                      │
      │                                                    │
      │ const namespace = getNamespaceInstance();          │
      │ // ↑ Gets the SAME shared namespace object         │
      │                                                    │
      │ return namespace.get('ENTITY_MANAGER');           │
      │ // ↑ Reads contexts.get(2001)['ENTITY_MANAGER']  │
      │ // Returns EntityManager-B ✅ (different!)        │
      └───────────────────────────────────────────────────┘

    → Uses EntityManager-B
    → Executes: UPDATE users SET ... WHERE id = 123
    → Uses QueryRunner-B's transaction


Time: T3 - Transaction Completion
=========================================

Request A (in Context-A):
  → @Transactional decorator auto-commits
    → await Effect.runPromise(unitOfWork.commit());  // Returns Effect
      → Commits QueryRunner-A's transaction
      → Releases QueryRunner-A back to pool
      → Clears contexts.get(1001)
  → Response sent to client

Request B (in Context-B):
  → @Transactional decorator auto-commits
    → await Effect.runPromise(unitOfWork.commit());  // Returns Effect
      → Commits QueryRunner-B's transaction
      → Releases QueryRunner-B back to pool
      → Clears contexts.get(2001)
  → Response sent to client
```

---

## Sharing Context Within a Request

### Scenario 1: Sequential Calls (Different Transactions)

```typescript
@Injectable()
class UserService {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  @Transactional()
  async createUser(data: UserData): Promise<User> {
    // Transaction 1: Creates QueryRunner-1, commits, releases
    return await this.userRepo.save(newUser);
  }

  @Transactional()
  async sendWelcome(userId: string): Promise<void> {
    // Transaction 2: Creates QueryRunner-2, commits, releases
    await this.emailRepo.logEmail(userId);
  }

  async registerUser(data: UserData) {
    const user = await this.createUser(data);    // Transaction 1
    await this.sendWelcome(user.id);             // Transaction 2
    // Two separate database transactions!
  }
}
```

**Result**: 2 separate database transactions (each method gets its own QueryRunner)

### Scenario 2: Nested Calls with Both @Transactional (ERROR!)

```typescript
@Injectable()
class UserService {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  @Transactional()
  async createUser(data: UserData): Promise<User> {
    const user = await this.userRepo.save(newUser);
    await this.sendWelcome(user.id);  // ❌ ERROR!
    return user;
  }

  @Transactional()  // ❌ ERROR: Nested @Transactional
  async sendWelcome(userId: string): Promise<void> {
    await this.emailRepo.logEmail(userId);
  }
}
```

**Result**: Throws error: `"Unit of work already active. Nested transactions are not supported."`

**Why**: The inner `@Transactional` tries to call `unitOfWork.begin()` while a transaction is already active in the same CLS context.

### Scenario 3: Shared Transaction (CORRECT Pattern!)

```typescript
@Injectable()
class UserService {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  @Transactional()  // ← Only outer method has decorator
  async createUser(data: UserData): Promise<User> {
    const user = await this.saveUserRecord(data);     // ✅ Shares transaction
    await this.createUserProfile(user.id);            // ✅ Shares transaction
    await this.logUserCreation(user.id);              // ✅ Shares transaction
    return user;
    // All three operations commit together
  }

  // ✅ NO @Transactional decorator
  private async saveUserRecord(data: UserData): Promise<User> {
    // Uses EntityManager from parent's CLS context
    return await this.userRepo.save(newUser);
  }

  // ✅ NO @Transactional decorator
  private async createUserProfile(userId: string): Promise<void> {
    // Uses same EntityManager from parent's CLS context
    await this.profileRepo.save(newProfile);
  }

  // ✅ NO @Transactional decorator
  private async logUserCreation(userId: string): Promise<void> {
    // Uses same EntityManager from parent's CLS context
    await this.auditRepo.save(auditLog);
  }
}
```

**Result**: All three operations in ONE database transaction (all share the same QueryRunner)

**How it works**:
```typescript
HTTP Request
  → CLS creates Context-A
  → createUser() has @Transactional
    → Effect.runPromise(unitOfWork.begin()) creates QueryRunner-1
    → Stores EntityManager-1 in Context-A

    → saveUserRecord() called
      → No @Transactional decorator
      → userRepo.getEntityManager()
      → Reads from Context-A
      → Gets EntityManager-1 ✅ (same!)

    → createUserProfile() called
      → No @Transactional decorator
      → profileRepo.getEntityManager()
      → Reads from Context-A
      → Gets EntityManager-1 ✅ (same!)

    → logUserCreation() called
      → No @Transactional decorator
      → auditRepo.getEntityManager()
      → Reads from Context-A
      → Gets EntityManager-1 ✅ (same!)

    → Effect.runPromise(unitOfWork.commit()) commits all three operations
```

---

## Common Scenarios

### Scenario A: Different Requests, Same Service Method

```typescript
@Injectable()
class UserService {
  @Transactional()
  async createUser(data: UserData): Promise<User> {
    return await this.userRepo.save(newUser);
  }
}

// Two users both creating accounts simultaneously
Request 1: POST /users (Alice creating account)
Request 2: POST /users (Bob creating account)
```

**Result**:
- Request 1: Context-A → QueryRunner-A → EntityManager-A
- Request 2: Context-B → QueryRunner-B → EntityManager-B
- ✅ Fully isolated, no conflicts

### Scenario B: Different Requests, Different Service Methods

```typescript
@Injectable()
class UserService {
  @Transactional()
  async createUser(data: UserData): Promise<User> {
    return await this.userRepo.save(newUser);
  }

  @Transactional()
  async updateUser(id: string, data: UserData): Promise<User> {
    return await this.userRepo.update(id, data);
  }
}

// Two users performing different operations
Request 1: POST /users (Alice creating account)
Request 2: PUT /users/123 (Bob updating profile)
```

**Result**:
- Request 1: Context-A → QueryRunner-A → EntityManager-A
- Request 2: Context-B → QueryRunner-B → EntityManager-B
- ✅ Fully isolated, no conflicts

### Scenario C: Same Request, Multiple Operations

```typescript
@Injectable()
class UserService {
  @Transactional()
  async registerUser(data: UserData): Promise<User> {
    const user = await this.createUserRecord(data);
    await this.createProfile(user.id);
    await this.sendWelcome(user.id);
    return user;
  }

  private async createUserRecord(data: UserData): Promise<User> {
    return await this.userRepo.save(newUser);
  }

  private async createProfile(userId: string): Promise<void> {
    await this.profileRepo.save(newProfile);
  }

  private async sendWelcome(userId: string): Promise<void> {
    await this.emailRepo.logEmail(userId);
  }
}

// Single request
Request: POST /register
```

**Result**:
- Single Context-A → Single QueryRunner-A → Single EntityManager-A
- All three operations share the same transaction
- ✅ All commit together or all rollback together

---

## How CLS Works Internally

### Node.js async_hooks

CLS is built on Node.js's `async_hooks` API, which tracks async execution contexts:

```typescript
import { executionAsyncId, createHook } from 'async_hooks';

// Node.js tracks each async operation with a unique ID
const hook = createHook({
  init(asyncId, type, triggerAsyncId) {
    // New async operation created
    // asyncId: unique ID for this operation
    // triggerAsyncId: ID of the parent operation
  },

  before(asyncId) {
    // About to execute callback for asyncId
  },

  after(asyncId) {
    // Finished executing callback for asyncId
  },

  destroy(asyncId) {
    // Async operation completed, cleanup
  }
});

hook.enable();
```

### CLS Uses async_hooks

```typescript
class Namespace {
  private contexts = new Map<number, any>();

  run(callback) {
    const asyncId = executionAsyncId();  // Get current async context ID

    this.contexts.set(asyncId, {});  // Create storage for this context

    // Enable tracking for child async operations
    const hook = createHook({
      init(childAsyncId, type, parentAsyncId) {
        // Child async operations inherit parent's context
        if (parentAsyncId === asyncId) {
          this.contexts.set(childAsyncId, this.contexts.get(asyncId));
        }
      }
    });

    callback();  // Run the callback
  }

  get(key) {
    const asyncId = executionAsyncId();  // Which context am I in?
    const context = this.contexts.get(asyncId);
    return context?.[key];
  }

  set(key, value) {
    const asyncId = executionAsyncId();  // Which context am I in?
    const context = this.contexts.get(asyncId);
    if (context) {
      context[key] = value;
    }
  }
}
```

### Why This Provides Isolation

```typescript
// Request A
namespace.run(() => {  // asyncId = 1001
  namespace.set('ENTITY_MANAGER', EM-A);  // contexts.get(1001)['ENTITY_MANAGER'] = EM-A

  someAsyncOperation().then(() => {       // asyncId = 1002 (child of 1001)
    namespace.get('ENTITY_MANAGER');      // reads contexts.get(1002) → EM-A
  });
});

// Request B (concurrent)
namespace.run(() => {  // asyncId = 2001
  namespace.set('ENTITY_MANAGER', EM-B);  // contexts.get(2001)['ENTITY_MANAGER'] = EM-B

  someAsyncOperation().then(() => {       // asyncId = 2002 (child of 2001)
    namespace.get('ENTITY_MANAGER');      // reads contexts.get(2002) → EM-B
  });
});
```

Even though both use the same `namespace` object, they read/write to **different storage** based on their async execution context!

---

## Visual Reference

### Complete Isolation Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    NestJS Application Process                   │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              SHARED SINGLETONS (1 instance each)          │ │
│  │                                                           │ │
│  │  UserService    UnitOfWork    DataSource    Namespace    │ │
│  │     (1)            (1)           (1)          (1)        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                      ↓              ↓              ↓            │
│                      │              │              │            │
│         ┌────────────┴──────┐  ┌───┴──────┐  ┌───┴──────┐     │
│         │                   │  │          │  │          │     │
│    ┌────▼─────┐       ┌────▼──▼──┐  ┌────▼──▼──┐  ┌────▼──┐  │
│    │Request A │       │Request B │  │Request C │  │ ... │  │
│    │          │       │          │  │          │  │     │  │
│    │Context-A │       │Context-B │  │Context-C │  │     │  │
│    │asyncId:  │       │asyncId:  │  │asyncId:  │  │     │  │
│    │  1001    │       │  2001    │  │  3001    │  │     │  │
│    │          │       │          │  │          │  │     │  │
│    │• QR-A    │       │• QR-B    │  │• QR-C    │  │     │  │
│    │• EM-A    │       │• EM-B    │  │• EM-C    │  │     │  │
│    │• Conn-1  │       │• Conn-2  │  │• Conn-3  │  │     │  │
│    │• Txn-A   │       │• Txn-B   │  │• Txn-C   │  │     │  │
│    └──────────┘       └──────────┘  └──────────┘  └─────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                 Connection Pool (Shared)                  │ │
│  │  [Conn-1] [Conn-2] [Conn-3] [Conn-4] ... [Conn-N]       │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────────────┐
                    │ PostgreSQL DB   │
                    └─────────────────┘
```

### Data Flow Per Request

```
┌──────────────────────────────────────────────────────────┐
│  HTTP Request A: POST /users                             │
└──────────────────────┬───────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────┐
│  ClsMiddleware creates Context-A (asyncId: 1001)         │
└──────────────────────┬───────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────┐
│  @Transactional decorator                                │
│  • Effect.runPromise(unitOfWork.begin())                 │
│  • Creates QueryRunner-A                                 │
│  • namespace.set('ENTITY_MANAGER', EM-A)                 │
│    → Stored in contexts[1001]                            │
└──────────────────────┬───────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────┐
│  userRepo.save()                                         │
│  • getEntityManager()                                    │
│  • namespace.get('ENTITY_MANAGER')                       │
│    → Reads from contexts[1001] → Returns EM-A            │
│  • Executes SQL using EM-A                              │
└──────────────────────┬───────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────┐
│  @Transactional decorator                                │
│  • Effect.runPromise(unitOfWork.commit())                │
│  • Commits QueryRunner-A's transaction                   │
│  • Releases QueryRunner-A back to pool                   │
│  • Clears contexts[1001]                                 │
└──────────────────────┬───────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────┐
│  Response sent to client                                 │
└──────────────────────────────────────────────────────────┘
```

---

## Common Misconceptions

### ❌ Misconception 1: "Singleton services can't handle concurrent requests safely"

**Reality**: Singleton services are **stateless**. They don't store request-specific data in instance variables. All request-specific state goes into CLS context, which is isolated per request.

```typescript
// ❌ BAD: Storing request state in instance variable
@Injectable()
class BadService {
  private currentUser: User;  // ← Shared across all requests!

  async processRequest(userId: string) {
    this.currentUser = await this.findUser(userId);  // ❌ Race condition!
    // Another request could overwrite this!
  }
}

// ✅ GOOD: Request state in CLS context
@Injectable()
class GoodService {
  constructor(private readonly unitOfWork: UnitOfWork) {}  // ← Stateless!

  @Transactional()
  async processRequest(userId: string) {
    // QueryRunner stored in CLS, not instance variable
    const user = await this.userRepo.findOne(userId);
    // Each request has its own transaction
  }
}
```

### ❌ Misconception 2: "Multiple requests will overwrite each other's EntityManager"

**Reality**: `namespace.set()` writes to **context-specific storage**, not a global shared variable.

```typescript
// Request A: asyncId = 1001
namespace.set('ENTITY_MANAGER', EM-A);
// Stores in: contexts.get(1001)['ENTITY_MANAGER'] = EM-A

// Request B (concurrent): asyncId = 2001
namespace.set('ENTITY_MANAGER', EM-B);
// Stores in: contexts.get(2001)['ENTITY_MANAGER'] = EM-B

// Later, Request A reads:
namespace.get('ENTITY_MANAGER');
// Reads from: contexts.get(1001)['ENTITY_MANAGER']
// Returns: EM-A ✅ (not overwritten!)
```

### ❌ Misconception 3: "Database connection pool means shared connections"

**Reality**: Connection pooling **reuses connections**, but each QueryRunner gets an **exclusive** connection for its transaction lifetime.

```typescript
Connection Pool: [Conn-1, Conn-2, Conn-3]

Request A arrives:
  → createQueryRunner() → Takes Conn-1 (exclusive)
  → Transaction starts on Conn-1
  → Other requests cannot use Conn-1 until released

Request B arrives (concurrent):
  → createQueryRunner() → Takes Conn-2 (exclusive)
  → Transaction starts on Conn-2
  → Completely independent from Request A

Request A completes:
  → Commits transaction
  → Releases Conn-1 back to pool
  → Conn-1 now available for new requests
```

### ❌ Misconception 4: "CLS is magic that can't be trusted"

**Reality**: CLS is built on Node.js's **async_hooks**, a stable core API. It's used by production libraries like:
- New Relic APM
- Datadog APM
- Google Cloud Trace
- AWS X-Ray SDK

The pattern is well-tested and production-proven.

---

## Key Takeaways

### ✅ Safe Concurrent Request Handling

1. **Singleton services are safe**: They're stateless and use CLS for request-specific data
2. **CLS provides isolation**: Each request gets its own execution context via async_hooks
3. **No manual context passing**: CLS automatically propagates context through async chains
4. **Connection pooling works correctly**: Each transaction gets an exclusive connection
5. **No conflicts occur**: Multiple concurrent requests are fully isolated

### ✅ Transaction Sharing Rules

| Pattern | Decorator Placement | Result |
|---------|-------------------|--------|
| **Sequential calls** | Each method has `@Transactional` | Separate transactions |
| **Nested calls** | Both methods have `@Transactional` | ❌ Error thrown |
| **Shared transaction** | Only outer method has `@Transactional` | ✅ Single shared transaction |

### ✅ Architecture Summary

```
Shared (Singleton):
  • Service instances
  • UnitOfWork instance
  • DataSource instance
  • CLS Namespace object

Isolated (Per-Request):
  • CLS execution context (via async_hooks)
  • QueryRunner (from pool)
  • EntityManager (from QueryRunner)
  • Database connection (exclusive during transaction)
  • Transaction state
```

### ✅ Safety Guarantees

1. **Request Isolation**: Each HTTP request gets its own CLS context
2. **Transaction Isolation**: Each transaction gets its own QueryRunner
3. **Connection Isolation**: Each QueryRunner gets an exclusive connection
4. **Database Isolation**: Database ACID properties provide row-level isolation
5. **Memory Isolation**: No shared mutable state in service instances

---

## Further Reading

- [Node.js async_hooks Documentation](https://nodejs.org/api/async_hooks.html)
- [cls-hooked Library](https://github.com/Jeff-Lewis/cls-hooked)
- [TypeORM QueryRunner](https://typeorm.io/query-runner)
- [Database Transaction Isolation Levels](https://en.wikipedia.org/wiki/Isolation_(database_systems))

---

## Questions or Issues?

If you encounter scenarios not covered in this document, please refer to:
- [Main TypeORM Infrastructure Guide](./README.md)
- [Effect Integration Guide](./EFFECT_INTEGRATION.md)

Or open an issue in the repository for clarification!
