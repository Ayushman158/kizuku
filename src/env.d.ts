/**
 * Expo inlines EXPO_PUBLIC_* variables into the bundle at build time. This is
 * the only one the app reads, so it is declared here rather than pulling in
 * Node's types for a codebase that never runs in Node.
 */
declare const process: { env: { EXPO_PUBLIC_KIZUKU_DEMO?: string } };
