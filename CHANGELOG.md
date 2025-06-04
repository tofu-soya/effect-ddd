# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- New features in development

### Changed

- Changes to existing functionality

### Deprecated

- Soon-to-be removed features

### Removed

- Features removed in this release

### Fixed

- Bug fixes

### Security

- Security-related changes

## [2.1.0] - 2024-12-15

### Added

- **Domain Builder Enhancement**: Dual parsing strategy with `withPropsParser()` support
  - New `withPropsParser()` function for custom parsing logic
  - Priority-based parser resolution (propsParser > schema > error)
  - Mutual exclusivity between parsing strategies
  - See [detailed update docs](./docs/updates/v2.1.0-domain-builder.md)
- **File Organization**: Improved structure with separated interfaces and implementations
  - New `interfaces/` folder for type definitions
  - New `implementations/` folder for trait implementations
  - Enhanced component-specific documentation

### Changed

- **Domain Builder**: Enhanced `createPropsParser()` with intelligent strategy selection
- **Error Messages**: Improved error messages when no parser is configured

### Fixed

- Type inference issues with complex generic constraints

### Documentation

- [Domain Builder Enhancement](./docs/updates/v2.1.0-domain-builder.md) - Comprehensive update guide
- [ADR-001](./docs/architecture/decisions/001-domain-builder-enhancement.md) - Architecture decision reasoning
- Updated component README files

## [2.0.0] - 2024-11-01

### Added

- **Effect Integration**: Full migration to Effect-ts ecosystem
- **Value Objects**: New Effect-based value object system
- **Entities**: Enhanced entity framework with Effect integration
- **Aggregate Roots**: Domain events with Effect-based publishing

### Breaking Changes

- Migrated from fp-ts to Effect-ts
- Changed error handling to use Effect's error model
- Updated all domain model interfaces

### Migration

- See [Effect Migration Guide](./docs/guides/migration-guide.md)
- Breaking changes affect all domain model creation

## [1.5.0] - 2024-10-15

### Added

- TypeORM repository factory
- Enhanced validation utilities
- RabbitMQ integration improvements

### Changed

- Improved error handling across all components
- Enhanced TypeScript support

### Fixed

- Memory leaks in repository connections
- Validation edge cases
