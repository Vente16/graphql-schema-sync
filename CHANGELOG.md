# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-04

### Added

- CLI: `graphql-schema-env-sync generate`
- Multi-environment schema introspection and compatibility merge
- Compatibility SDL with per-field environment comments
- JSON and HTML compatibility reports
- `defaults.ts` helpers: response normalizers, `isOperationAvailable`, `filterOperationArgs`
- `graphql-codegen` integration (TypeScript, operations, React Apollo hooks)
- Local demo with three mock GraphQL servers (`pnpm demo`)
