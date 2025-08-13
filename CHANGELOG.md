# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.5.1] - 2025-08-13

### Fixed
- Updated default TTL to 60 seconds for improved performance

## [2.5.0] - 2025-08-13

### Added
- Extra path-manifest entries for folders when `/index.html` detected
- Improved folder deployment handling

### Changed
- Restored mime type detection for single file uploads
- Updated `manifestId` to `txOrManifestId` for better consistency
- Various code improvements and refactoring

## [2.3.0] - 2025-07-17

### Added
- TTL (Time To Live) seconds option to CLI arguments
- Modernized deployment with multi-signer support and enhanced CLI
- Single file ARNS name setting capability

### Changed
- Removed Solana support (not supported by ar.io SDK)
- Updated turbo SDK integration
- Various bug fixes and improvements

## [2.2.0] - 2025-07-07

### Documentation
- Updated README with new features and detailed installation instructions
- Added Turbo SDK integration documentation
- Enhanced manifest creation and security practices documentation

## [2.1.0] - 2025-05-28

### Added
- Network flags for improved configuration
- Undername flag support

### Fixed
- README documentation improvements
- Version bumping and update process

## [2.0.2] - 2025-05-13

### Fixed
- ArDrive CU URL configuration
- Added ario-process flag support

## [2.0.1] - 2025-05-07

### Fixed
- Default mime type to octet stream when no mime type is found
- Falsy check improvements (use OR instead of nullish coalescing)

## [2.0.0] - 2025-05-02

### Added
- ARNS name resolution through ar.io SDK
- Updated ant management system

### Changed
- **BREAKING**: Major refactor for ar.io SDK integration
- Updated README for ARNS parameters

## [1.1.10] - 2024-12-31

### Fixed
- Error handling improvements with process.exit on all error catches
- Set record attempt error handling

## [1.1.9] - 2024-06-01

### Fixed
- Updated dependencies and ant management
- GitHub SHA made optional
- Various bug fixes

## [1.1.7] - 2024-05-15

### Added
- Turbo SDK integration for deployments

### Changed
- **BREAKING**: Removed Irys support in favor of Turbo SDK

## [1.1.6] - 2024-05-01

### Fixed
- Upload endpoint fixes
- General stability improvements

## [1.1.5] - 2024-04-15

### Changed
- Upgraded to ar.io SDK for improved functionality

## [1.1.3] - 2024-04-01

### Added
- ar.io SDK for ANT (Arweave Name Token) management

### Fixed
- Updated inputs for set record functionality

## [1.1.1] - 2024-03-15

### Fixed
- Module configuration in package.json
- Contract argument passing improvements

## [1.1.0] - 2024-03-01

### Added
- AO ARNS update functionality
- Enhanced deployment capabilities

### Changed
- Updated project structure and dependencies

## [1.0.1] - 2024-02-25

### Fixed
- Initial bug fixes and improvements

## [1.0.0] - 2024-02-20

### Added
- Initial release of permaweb-deploy package
- Core deployment functionality for Permaweb applications
- CLI interface for deployment management
- Support for file and folder uploads
- Basic ARNS (Arweave Name Service) integration