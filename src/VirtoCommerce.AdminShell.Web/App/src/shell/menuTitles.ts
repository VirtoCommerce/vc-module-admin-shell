import { i18n } from "@vc-shell/framework";
import type { EffectiveMenu, MenuDocument, MenuGroup, MenuItem, MenuSection, MenuTitles } from "../api/adminMenu";
import { platformTranslations } from "../modules/platform/api";

/**
 * Menu titles in the user's language. The server sends English titles and, optionally, a translation key; the shell
 * resolves them, in this order:
 *  1. a title the menu editor gave in this language (`titles`), else its English one;
 *  2. the entry's `titleKey` (a plugin's texts, the platform's server texts for an AngularJS screen's main-menu-title);
 *  3. the menu's own locale files, by id: MENU.SECTIONS.{sectionId}, MENU.GROUPS.{sectionId}_{groupId}, MENU.ITEMS.{itemId}
 *     (App/src/locales/menu/<lang>.json; any character but letters and digits becomes "_");
 *  4. the English title from the server.
 * See docs/localization.md, "Menu".
 */

const slug = (id: string) => id.replace(/[^A-Za-z0-9]/g, "_");
export const sectionKey = (id: string) => `MENU.SECTIONS.${slug(id)}`;
export const itemKey = (id: string) => `MENU.ITEMS.${slug(id)}`;
export const groupKey = (sectionId: string, groupId: string) => `MENU.GROUPS.${slug(sectionId)}_${slug(groupId)}`;
export const railKey = (sectionId: string) => `MENU.RAIL.${slug(sectionId)}`;

/** The UI language now */
export function menuLocale(): string {
  const locale = i18n.global.locale as unknown;
  return String((locale as { value?: string } | null)?.value ?? locale ?? "") || "en";
}

// the platform's server texts per language, once a key wasn't in the shell's texts (loaded on demand: they are large)
const serverTexts = new Map<string, Record<string, unknown>>();
let missingKeys = false;

function serverText(locale: string, key: string): string | undefined {
  const texts = serverTexts.get(locale);
  if (!texts) {
    missingKeys = true;
    return undefined;
  }
  const value = key
    .split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], texts);
  return typeof value === "string" && value ? value : undefined;
}

// a key of the shell's texts (the menu's, a plugin's); an entry's own titleKey may also be one of the platform's server
// texts (an AngularJS screen's "catalog.main-menu-title"), which load only when such a key is asked for
function translated(key: string | undefined, locale: string, serverToo = false): string | undefined {
  if (!key) return undefined;
  const { te, t } = i18n.global;
  if (te(key, locale) || te(key, "en")) return String(t(key));
  return serverToo ? serverText(locale, key) : undefined;
}

function pick(titles: MenuTitles | undefined, locale: string) {
  if (!titles) return undefined;
  const lang = locale.split("-")[0];
  return titles[locale] || titles[lang] || titles.en || undefined;
}

export const titleOfSection = (section: MenuSection, locale = menuLocale()) =>
  pick(section.titles, locale) ??
  translated(section.titleKey, locale, true) ??
  translated(sectionKey(section.id), locale) ??
  section.title;

export const titleOfItem = (item: MenuItem, locale = menuLocale()) =>
  pick(item.titles, locale) ??
  translated(item.titleKey, locale, true) ??
  translated(itemKey(item.id), locale) ??
  item.title;

export const titleOfGroup = (sectionId: string, group: MenuGroup, locale = menuLocale()) =>
  translated(group.titleKey, locale, true) ??
  (group.id ? translated(groupKey(sectionId, group.id), locale) : undefined) ??
  group.title;

/**
 * A rail label: a renamed section's new title (the rename is the name people chose, short labels are the default
 * names'), else the menu's short one (MENU.RAIL.configuration), else the first word of the section's title
 */
export function railLabelOf(section: { id: string; title: string; titles?: MenuTitles }) {
  const locale = menuLocale();
  return pick(section.titles, locale) ?? translated(railKey(section.id), locale) ?? section.title.split(/[\s&]+/)[0];
}

const localizeItem = (item: MenuItem, locale: string, groupTitles?: Map<string, string>): MenuItem => ({
  ...item,
  title: titleOfItem(item, locale),
  // an item names its group by the group's English title; it follows the group into the user's language
  group: item.group && groupTitles?.get(item.group) ? groupTitles.get(item.group) : item.group,
  children: (item.children ?? []).map((child) => localizeItem(child, locale)),
});

function localizeSection(section: MenuSection, locale: string): MenuSection {
  const groupTitles = new Map(
    (section.groups ?? []).map((group) => [group.title, titleOfGroup(section.id, group, locale)]),
  );
  return {
    ...section,
    title: titleOfSection(section, locale),
    groups: (section.groups ?? []).map((group) => ({ ...group, title: groupTitles.get(group.title) ?? group.title })),
    items: section.items.map((item) => localizeItem(item, locale, groupTitles)),
  };
}

/** The menu with its titles in the user's language; `serverTextsNeeded` says a key may be in the platform's texts */
export function localizeMenu<T extends EffectiveMenu | MenuDocument>(menu: T, locale = menuLocale()) {
  missingKeys = false;
  const sections = menu.sections.map((section) => localizeSection(section, locale));
  const result = { ...menu, sections } as T;
  if ("pinned" in menu) {
    (result as EffectiveMenu).pinned = menu.pinned.map((item) => localizeItem(item, locale));
    (result as EffectiveMenu).recent = menu.recent.map((item) => localizeItem(item, locale));
  }
  return { menu: result, serverTextsNeeded: missingKeys };
}

/** Loads the platform's server texts for `locale` (once); true when they were not loaded yet */
export async function loadServerTexts(locale = menuLocale()) {
  if (serverTexts.has(locale)) return false;
  serverTexts.set(locale, await platformTranslations(locale));
  return true;
}
