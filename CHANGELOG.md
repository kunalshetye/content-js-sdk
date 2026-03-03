# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0-kunalshetye.5] - 2026-03-03

### SDK (`@kunalshetye/cms-sdk`) & CLI (`@kunalshetye/cms-cli`)

#### Fixed
- Root README: npm badges, install commands, and GitHub links now point to `@kunalshetye` scope
- Root README: added missing docs 13 (Forms) and 14 (Fork Features) to documentation table
- SDK README: updated install examples to current version
- SDK & CLI READMEs: converted relative doc links to GitHub URLs so they work on npm
- Broken link in `docs/2-setup.md` pointing to non-existent env vars file
- Filename typo in `docs/6-rendering-react.md` (`8-experiences.md` → `8-experience.md`)

## [1.0.0-kunalshetye.3] - 2026-03-03

### SDK (`@kunalshetye/cms-sdk`)

#### Added
- DAM asset resolver with comprehensive test coverage
- Optimizely Forms support with 10 built-in form element content types
- Automatic Forms feature detection via GraphQL introspection
- Conditional fragment inclusion for Forms queries
- Documentation for Forms (`docs/13-forms.md`) and fork features (`docs/14-fork-features.md`)

#### Fixed
- DAM query resolution
- Form support query generation

### CLI (`@kunalshetye/cms-cli`)

#### Added
- Content manifest mapper (`manifestToContent`)
- Code generator service
- Diff service for content type comparison
- File writer service
- Validation service
- Utility modules: logger, retry, spinner, config search
- Comprehensive test suites for all new services
- `config pull` and `config push` commands
- `content delete` command enhancements

#### Changed
- Updated CLI features and capabilities

## [1.0.0-kunalshetye.2] - 2026-02-17

### SDK (`@kunalshetye/cms-sdk`)

#### Added
- Initial fork release with Forms content type support
- `formsEnabled` feature flag based on introspection
- Custom versioning scheme tracking upstream `@optimizely/cms-sdk`

## [1.0.0-kunalshetye.1] - 2026-02-01

### CLI (`@kunalshetye/cms-cli`)

#### Added
- Initial fork release of the CLI tool
- Published under `@kunalshetye` scope
