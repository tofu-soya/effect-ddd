# TypeORM Infrastructure Documentation Index

Complete documentation for the Unit of Work pattern with CLS-based transaction management in NestJS.

## 📚 Documentation Guides

### [Main Guide: TypeORM Infrastructure with Unit of Work](./README.md)

**Start here** for a comprehensive overview of the TypeORM infrastructure layer.

**Contents**:
- Architecture overview and diagrams
- Complete setup instructions
- 4 usage patterns (decorator, manual, programmatic, functional)
- Creating custom repositories
- Best practices and troubleshooting
- Advanced patterns (Saga, Domain Events)

**When to read**: First time setup, reference for usage patterns, troubleshooting issues

---

### [Effect Integration Guide](./EFFECT_INTEGRATION.md)

Deep dive into how Effect-based domain repositories seamlessly integrate with UnitOfWork.

**Contents**:
- How automatic integration works through shared CLS context
- Code evidence showing EntityManager sharing
- Effect-based usage patterns with `withUnitOfWork`
- Mixing Promise and Effect code
- Complete examples (CQRS handlers, Saga patterns, Pure Effect workflows)

**When to read**: When using Effect repositories from `src/ports/database/typeorm/effect-repository.factory.ts`, understanding how domain and infrastructure layers connect

---

### [Concurrency and Isolation Deep Dive](./CONCURRENCY_AND_ISOLATION.md) ⭐

Comprehensive explanation of how concurrent requests are safely isolated in a single NestJS process.

**Contents**:
- How CLS provides per-request isolation
- Detailed execution flow of concurrent requests
- Transaction sharing patterns within a request
- How async_hooks tracks execution contexts
- Common scenarios and misconceptions
- Visual diagrams and code evidence

**When to read**: Understanding concurrency safety, learning how singleton services handle multiple requests, debugging context-related issues

**Key questions answered**:
- ✅ Can multiple concurrent requests use the same service instance?
- ✅ Will they share the same EntityManager or QueryRunner?
- ✅ How does CLS provide isolation despite shared singleton instances?
- ✅ How can methods in the same class share a transaction?

---

## 🎯 Quick Navigation

### By Task

| What do you want to do? | Read this |
|------------------------|-----------|
| **Setup for the first time** | [Main Guide - Setup](./README.md#setup) |
| **Use @Transactional decorator** | [Main Guide - Usage](./README.md#usage) |
| **Understand Effect integration** | [Effect Integration Guide](./EFFECT_INTEGRATION.md) |
| **Understand concurrency safety** | [Concurrency Deep Dive](./CONCURRENCY_AND_ISOLATION.md) |
| **Create custom repository** | [Main Guide - Creating Repositories](./README.md#creating-custom-repositories) |
| **Debug transaction issues** | [Main Guide - Troubleshooting](./README.md#troubleshooting) |
| **Learn advanced patterns** | [Main Guide - Advanced Patterns](./README.md#advanced-patterns) |
| **Understand CLS internals** | [Concurrency Deep Dive - How CLS Works](./CONCURRENCY_AND_ISOLATION.md#how-cls-works-internally) |

### By Concept

| Concept | Document | Section |
|---------|----------|---------|
| **Unit of Work Pattern** | Main Guide | [Overview](./README.md#features) |
| **CLS (Continuation Local Storage)** | Concurrency Deep Dive | [CLS Isolation Mechanism](./CONCURRENCY_AND_ISOLATION.md#cls-isolation-mechanism) |
| **Transaction Boundaries** | Main Guide | [Usage Patterns](./README.md#usage) |
| **Effect Repositories** | Effect Integration | [Automatic Integration](./EFFECT_INTEGRATION.md#automatic-integration) |
| **Concurrent Requests** | Concurrency Deep Dive | [Concurrent Execution Flow](./CONCURRENCY_AND_ISOLATION.md#concurrent-execution-flow) |
| **Singleton Safety** | Concurrency Deep Dive | [Common Misconceptions](./CONCURRENCY_AND_ISOLATION.md#common-misconceptions) |
| **Transaction Sharing** | Concurrency Deep Dive | [Sharing Context Within Request](./CONCURRENCY_AND_ISOLATION.md#sharing-context-within-a-request) |

### By Role

| Role | Recommended Reading Order |
|------|---------------------------|
| **Backend Developer (New to project)** | 1. Main Guide → 2. Concurrency Deep Dive → 3. Effect Integration |
| **Frontend Developer (Understanding backend)** | 1. Main Guide - Quick Start → 2. Concurrency Deep Dive - Overview |
| **DevOps/SRE** | 1. Main Guide - Architecture → 2. Main Guide - Troubleshooting |
| **Architect** | 1. Concurrency Deep Dive → 2. Effect Integration → 3. Main Guide - Advanced Patterns |
| **Code Reviewer** | 1. Concurrency Deep Dive - Common Scenarios → 2. Main Guide - Best Practices |

---

## 🔍 Common Questions → Documentation

### "How do I use transactions in my NestJS handler?"
→ [Main Guide - Quick Start](./README.md#quick-start)

### "Can multiple requests use the same service instance safely?"
→ [Concurrency Deep Dive - The Core Question](./CONCURRENCY_AND_ISOLATION.md#the-core-question)

### "How do Effect repositories work with UnitOfWork?"
→ [Effect Integration - How It Works](./EFFECT_INTEGRATION.md#how-it-works)

### "Why is my EntityManager undefined?"
→ [Main Guide - Troubleshooting](./README.md#troubleshooting)

### "Can I share a transaction across multiple methods?"
→ [Concurrency Deep Dive - Sharing Context](./CONCURRENCY_AND_ISOLATION.md#sharing-context-within-a-request)

### "What happens with nested @Transactional decorators?"
→ [Concurrency Deep Dive - Scenario 2](./CONCURRENCY_AND_ISOLATION.md#scenario-2-nested-calls-with-both-transactional-error)

### "How does CLS provide isolation?"
→ [Concurrency Deep Dive - CLS Isolation Mechanism](./CONCURRENCY_AND_ISOLATION.md#cls-isolation-mechanism)

### "Is it safe to use singleton services?"
→ [Concurrency Deep Dive - Misconception 1](./CONCURRENCY_AND_ISOLATION.md#-misconception-1-singleton-services-cant-handle-concurrent-requests-safely)

---

## 📖 Learning Path

### Path 1: Quick Start (30 minutes)
1. Read [Main Guide - Features](./README.md#features)
2. Read [Main Guide - Setup](./README.md#setup)
3. Try [Main Guide - Usage Pattern 1](./README.md#option-1-using-transactional-decorator-recommended)
4. Bookmark for reference

### Path 2: Deep Understanding (2 hours)
1. Read [Main Guide](./README.md) completely
2. Read [Concurrency Deep Dive](./CONCURRENCY_AND_ISOLATION.md) completely
3. Skim [Effect Integration](./EFFECT_INTEGRATION.md)
4. Try advanced examples

### Path 3: Expert Level (4 hours)
1. Study [Concurrency Deep Dive - How CLS Works](./CONCURRENCY_AND_ISOLATION.md#how-cls-works-internally)
2. Study [Effect Integration - Complete Examples](./EFFECT_INTEGRATION.md#complete-examples)
3. Study [Main Guide - Advanced Patterns](./README.md#advanced-patterns)
4. Read source code: `unit-of-work.service.ts`, `effect-integration.ts`

---

## 🛠️ Source Code Reference

All implementation files are in `src/infra/nestjs/typeorm/`:

| File | Purpose |
|------|---------|
| `unit-of-work.service.ts` | Core UnitOfWork service implementation |
| `transactional.decorator.ts` | @Transactional method decorator |
| `transactional.utils.ts` | Utility functions for transaction context |
| `effect-integration.ts` | Effect wrappers and contexts |
| `base.repository.ts` | Transaction-aware base repository |
| `create-repository.provider.ts` | NestJS provider factory |

---

## 💡 Tips for Learning

1. **Start with examples**: Jump to usage examples first, then read theory
2. **Visual learners**: Focus on architecture diagrams in each guide
3. **Code readers**: Look at "Code Evidence" sections in Concurrency Deep Dive
4. **Sequential learners**: Read guides in order: Main → Concurrency → Effect
5. **Problem solvers**: Use "Common Questions" section above to jump to answers

---

## 🔗 External Resources

- [Node.js async_hooks Documentation](https://nodejs.org/api/async_hooks.html) - Understanding CLS internals
- [cls-hooked Library](https://github.com/Jeff-Lewis/cls-hooked) - CLS implementation used
- [TypeORM QueryRunner](https://typeorm.io/query-runner) - Transaction management
- [Effect Documentation](https://effect.website/) - Effect library patterns

---

## 📝 Contributing to Documentation

Found an error or want to add examples? Documentation files are located in:
```
packages/seedwork/docs/typeorm/
├── README.md                      # Main guide
├── EFFECT_INTEGRATION.md         # Effect integration
├── CONCURRENCY_AND_ISOLATION.md  # Concurrency deep dive
└── INDEX.md                      # This file
```

Please ensure new examples follow the existing format and include:
- Clear problem statement
- Complete working code
- Explanation of what happens
- When to use this pattern

---

**Happy learning! Start with the [Main Guide](./README.md) or explore topics using the navigation above.** 🚀
