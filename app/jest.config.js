/**
 * tech-04 §3.1, §12 — the JS test runner.
 *
 * One project, `jest-expo/android`, because the app is Android-only (CLAUDE.md). The other
 * jest-expo presets (ios, web, universal) would run every test file once per platform against
 * platform code that does not exist here.
 *
 * §12 splits the suite by what it touches, not by where it lives:
 *   - Pure derivation and formula tests (T3 §5/§8, T5's battle math) import no Expo module and no
 *     renderer. They assert against `docs/traverser-test-fixtures.md`.
 *   - Storage tests run against expo-sqlite's in-memory database.
 *   - RNTL component tests are reserved for components with real logic, never for layout.
 *
 * The preset is shared rather than split into per-kind projects: a pure module under this preset
 * still imports nothing, so the purity §12 asks for is a property of the test, not the runner.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  preset: 'jest-expo/android',
  // The generated native project contains its own JS (and a copy of the bundle after a build), so
  // leaving it in scope makes Jest re-run tests out of build output.
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/android/'],
  // Mirrors `tsconfig.json`'s `paths`, most-specific first — the two must agree or a module
  // resolves under `tsc` and not under Jest. ↯ `@/assets/*` is the *binary* assets directory, not
  // `src/assets/`; the generated key/registry modules are reached relatively.
  moduleNameMapper: {
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.generated.ts'],
};
