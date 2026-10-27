/**
 * vc-shell's German texts (@vc-shell/framework/locales/de): a nested object of strings. vc-shell's published typings
 * for them (dist/locales/types.d.ts) don't parse, so tsconfig.json's "paths" points the import here for the type check;
 * the bundler still loads vc-shell's file.
 */
declare const de: Record<string, unknown>;
export default de;
