## 📝 Complete Documentation Workflow

When you implement a significant update (like the Domain Builder enhancement), follow this workflow:

### Step 1: Create Detailed Update Documentation

**File:** `docs/updates/v2.1.0-domain-builder.md`

```markdown
# Domain Builder Enhancement - Dual Parsing Strategy

## Overview

[Comprehensive explanation of what changed and why]

## Technical Implementation

[Detailed code examples and implementation notes]

## Migration Guide

[Step-by-step migration instructions]

## Usage Examples

[Before/after code examples]
```

### Step 2: Document Architecture Decision (If Applicable)

**File:** `docs/architecture/decisions/001-domain-builder-enhancement.md`

```markdown
# ADR-001: Domain Builder Dual Parsing Strategy

## Status: Accepted

## Context

[Why this decision was needed]

## Decision

[What was decided]

## Consequences

[Trade-offs and implications]
```

### Step 3: Update Component Documentation

**File:** `src/model/effect/builders/README.md`

```markdown
# Domain Builder

## Recent Updates

- v2.1.0: Added withPropsParser() support

## Quick Start

[Updated examples with new features]
```

### Step 4: Update Changelog

**File:** `CHANGELOG.md`

```markdown
## [2.1.0] - 2024-12-15

### Added

- Domain Builder: withPropsParser() support
- See [detailed docs](./docs/updates/v2.1.0-domain-builder.md)
```

### Step 5: Update Guides (If Needed)

**File:** `docs/guides/migration-guide.md`

```markdown
## Migrating to v2.1.0

### Domain Builder Changes

[Migration instructions for the new features]
```

## 🔗 Cross-Reference System

Create a web of interconnected documentation:

```markdown
# In docs/updates/v2.1.0-domain-builder.md

## Related Documentation

- [ADR-001: Architecture Decision](../architecture/decisions/001-domain-builder-enhancement.md)
- [Domain Builder API](../api/domain-builder.md)
- [Migration Guide](../guides/migration-guide.md)

# In docs/architecture/decisions/001-domain-builder-enhancement.md

## Links

- [Implementation Details](../../updates/v2.1.0-domain-builder.md)
- [Domain Builder Source](../../../src/model/effect/builders/domain-builder.ts)

# In CHANGELOG.md

## [2.1.0]

### Added

- Domain Builder enhancement - [detailed docs](./docs/updates/v2.1.0-domain-builder.md)
```

## 📊 Documentation Hierarchy

```
📋 CHANGELOG.md (Root)
│   ├── Brief version summaries
│   ├── Links to detailed docs
│   └── Public-facing changes
│
📚 docs/updates/ (Detailed explanations)
│   ├── Comprehensive technical details
│   ├── Code examples and migration guides
│   └── Developer-focused content
│
🏗️ docs/architecture/decisions/ (Decision reasoning)
│   ├── Why decisions were made
│   ├── Trade-offs and alternatives considered
│   └── Long-term architectural implications
│
📄 Component READMEs (Quick reference)
│   ├── Component-specific usage
│   ├── Quick start examples
│   └── Links to detailed documentation
│
📖 docs/guides/ (User tutorials)
│   ├── End-to-end tutorials
│   ├── Best practices
│   └── Common patterns
```

## 🎨 Content Strategy by Audience

### For Users/Consumers of the Library

1. **First Stop:** `CHANGELOG.md` - What changed?
2. **Deep Dive:** `docs/guides/` - How do I use this?
3. **Migration:** `docs/guides/migration-guide.md` - How do I upgrade?

### For Contributors/Maintainers

1. **Technical Details:** `docs/updates/` - What exactly changed and how?
2. **Architecture Context:** `docs/architecture/decisions/` - Why was this decision made?
3. **Implementation:** Component READMEs - How does this component work?

### For Architects/Technical Leaders

1. **Decision Context:** `docs/architecture/decisions/` - Strategic implications
2. **System Overview:** `docs/architecture/overview.md` - Big picture
3. **Patterns:** `docs/architecture/patterns.md` - Consistent approaches

## 🔄 Maintenance Workflow

### Monthly Review

- Review `docs/updates/` for outdated information
- Update component READMEs with recent changes
- Consolidate related updates into guide improvements

### Quarterly Cleanup

- Archive old update documentation
- Update architecture overview with significant changes
- Review and update decision records if context changes

### Release Workflow

1. **Pre-release:** Draft update documentation
2. **Release:** Finalize update docs and changelog
3. **Post-release:** Update guides and examples based on user feedback

## 📈 Success Metrics

Track documentation effectiveness:

- **Discoverability**: Are developers finding the right docs?
- **Completeness**: Do docs answer common questions?
- **Accuracy**: Are docs up-to-date with code changes?
- **Usability**: Can developers successfully migrate/implement changes?

## 🎯 Quick Reference: Where to Put What

| Content Type                    | Primary Location                 | Secondary Location               |
| ------------------------------- | -------------------------------- | -------------------------------- |
| **Detailed Update Explanation** | `docs/updates/`                  | Component README                 |
| **Architecture Reasoning**      | `docs/architecture/decisions/`   | `docs/architecture/overview.md`  |
| **Public Version Summary**      | `CHANGELOG.md`                   | Release notes                    |
| **Migration Instructions**      | `docs/guides/migration-guide.md` | `docs/updates/`                  |
| **Usage Examples**              | `docs/guides/`                   | Component README                 |
| **API Reference**               | `docs/api/`                      | Inline code comments             |
| **Quick Start**                 | Component README                 | `docs/guides/getting-started.md` |
