import type { enUS } from "./locales/en-US.js";
import { enUS as enUSLocale } from "./locales/en-US.js";
import { ptBR } from "./locales/pt-BR.js";

export type Locale = "en-US" | "pt-BR";
export const SUPPORTED_LOCALES: Locale[] = ["en-US", "pt-BR"];
export const DEFAULT_LOCALE: Locale = "pt-BR";

// Dot-notation paths over the translation tree (leaves only)
// Checks T[K] extends string (leaf) rather than extends object (branch) — more reliable with deep as const
type Leaves<T, P extends string = ""> = {
  [K in keyof T]: T[K] extends string ? `${P}${K & string}` : Leaves<T[K], `${P}${K & string}.`>;
}[keyof T];

export type TranslationKey = Leaves<typeof enUS>;

// Extract {param} placeholders from a string literal
type ExtractParams<S extends string> = S extends `${string}{${infer Param}}${infer Rest}`
  ? { [K in Param | keyof ExtractParams<Rest>]: string | number }
  : Record<never, never>;

// Resolve the value type at a dot-path in an object
type Resolve<T, P extends string> = P extends `${infer Head}.${infer Tail}`
  ? Head extends keyof T
    ? Resolve<T[Head], Tail>
    : never
  : P extends keyof T
    ? T[P]
    : never;

// Used for type-level operations (key paths, param extraction) — preserves string literals
type TranslationSchema = typeof enUS;

// Used at runtime — mirrors TranslationSchema shape but with plain string values
type DeepString<T> = T extends string ? string : { readonly [K in keyof T]: DeepString<T[K]> };
type Translation = DeepString<TranslationSchema>;

// t() is only called with params when the key actually has placeholders
// Uses TranslationSchema (literal types) so ExtractParams can infer {placeholder} names
export type TFunction = <K extends TranslationKey>(
  key: K,
  ...args: keyof ExtractParams<Resolve<TranslationSchema, K> & string> extends never
    ? []
    : [params: ExtractParams<Resolve<TranslationSchema, K> & string>]
) => string;

const locales: Record<Locale, Translation> = {
  "en-US": enUSLocale,
  "pt-BR": ptBR,
};

// Maps Discord locale codes to our supported locales
const DISCORD_LOCALE_MAP: Record<string, Locale> = {
  "en-US": "en-US",
  "en-GB": "en-US",
  "pt-BR": "pt-BR",
};

export class I18n {
  resolveLocale(raw: string | null | undefined): Locale {
    if (!raw) return DEFAULT_LOCALE;
    return DISCORD_LOCALE_MAP[raw] ?? DEFAULT_LOCALE;
  }

  t(locale: Locale, key: TranslationKey, params?: Record<string, string | number>): string {
    const translation = locales[locale];
    const value = key.split(".").reduce<unknown>((obj, k) => {
      return obj && typeof obj === "object" ? (obj as Record<string, unknown>)[k] : undefined;
    }, translation);

    if (typeof value !== "string") return key;
    if (!params) return value;

    return value.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
  }

  bind(locale: Locale): TFunction {
    return (key, ...args) => this.t(locale, key, args[0] as Record<string, string | number>);
  }
}
