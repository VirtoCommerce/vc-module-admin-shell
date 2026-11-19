// The user's regional format and time zone (src/shell/regionalFormat.ts): what a stored value means to Intl.
// Runs on Node's own test runner, which strips the TypeScript types itself: node --test tests/
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  REGIONAL_FORMAT_SETTING,
  TIME_ZONE_SETTING,
  browserLocale,
  browserTimeZone,
  effectiveRegional,
  formatDateIn,
  formatNumberIn,
  normalizeLocale,
  normalizeTimeZone,
  regionalOfProfile,
} from "../src/shell/regionalFormat.ts";

const browser = { locale: "fr-FR", timeZone: "America/New_York" };

test("stored codes are lower case with a dash: Intl gets them in its own case", () => {
  assert.equal(normalizeLocale("en-us"), "en-US");
  assert.equal(normalizeLocale("de-de"), "de-DE");
  assert.equal(normalizeLocale("zh-hans-cn"), "zh-Hans-CN");
  assert.equal(normalizeLocale("es-419"), "es-419");
  assert.equal(normalizeLocale("fr"), "fr");
});

test("older codes have an underscore", () => {
  assert.equal(normalizeLocale("af_ZA"), "af-ZA");
  assert.equal(normalizeLocale("sr_latn_rs"), "sr-Latn-RS");
});

test("no code, or one that isn't a locale, is none", () => {
  for (const code of [null, undefined, "", "  ", 42, "not a locale", "en--us"]) {
    assert.equal(normalizeLocale(code), undefined, String(code));
  }
});

test("a zone Intl takes is kept; one it rejects is none", () => {
  assert.equal(normalizeTimeZone("Europe/Berlin"), "Europe/Berlin");
  assert.equal(normalizeTimeZone("UTC"), "UTC");
  for (const zone of [null, undefined, "", "Mars/Olympus_Mons", "GMT+25", 3]) {
    assert.equal(normalizeTimeZone(zone), undefined, String(zone));
  }
});

test("the user's choice wins", () => {
  assert.deepEqual(effectiveRegional("de-de", "Europe/Berlin", browser), {
    locale: "de-DE",
    timeZone: "Europe/Berlin",
  });
});

test("no regional format: the browser's locale; no zone: the browser's zone", () => {
  assert.deepEqual(effectiveRegional(null, null, browser), browser);
  assert.deepEqual(effectiveRegional(undefined, "Asia/Tokyo", browser), { locale: "fr-FR", timeZone: "Asia/Tokyo" });
  assert.deepEqual(effectiveRegional("ja-jp", null, browser), { locale: "ja-JP", timeZone: "America/New_York" });
});

test("a zone Intl rejects falls back to the browser's zone instead of throwing", () => {
  assert.deepEqual(effectiveRegional("en-us", "Nowhere/Atlantis", browser), {
    locale: "en-US",
    timeZone: "America/New_York",
  });
  assert.doesNotThrow(() => formatDateIn(effectiveRegional("en-us", "Nowhere/Atlantis"), new Date()));
});

test("without a browser given, this machine's locale and zone", () => {
  const regional = effectiveRegional(null, null);
  assert.equal(regional.locale, browserLocale());
  assert.equal(regional.timeZone, browserTimeZone());
  assert.ok(Intl.getCanonicalLocales(regional.locale).length);
});

test("a profile's settings: the user's value, else the browser's (not the platform's default)", () => {
  const profile = (format: object, zone: object) => ({
    settings: [
      { name: "VirtoCommerce.Platform.UI.Language", value: "de-DE" },
      { name: REGIONAL_FORMAT_SETTING, ...format },
      { name: TIME_ZONE_SETTING, ...zone },
    ],
  });
  assert.deepEqual(regionalOfProfile(profile({ value: "en-gb" }, { value: "Europe/London" }), browser), {
    locale: "en-GB",
    timeZone: "Europe/London",
  });
  // the platform's RegionalFormat default is "en": a profile without a choice still gets the browser's region
  assert.deepEqual(regionalOfProfile(profile({ value: null, defaultValue: "en" }, { value: null }), browser), browser);
  assert.deepEqual(regionalOfProfile(profile({ value: null }, { value: "bogus" }), browser), browser);
  assert.deepEqual(regionalOfProfile({ settings: [] }, browser), browser);
  assert.deepEqual(regionalOfProfile(undefined, browser), browser);
});

test("dates use the locale and the zone", () => {
  // 23:30 UTC on 1 March is already 2 March in Tokyo
  const when = "2024-03-01T23:30:00Z";
  const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit" };
  assert.equal(formatDateIn({ locale: "en-US", timeZone: "UTC" }, when, options), "03/01/2024");
  assert.equal(formatDateIn({ locale: "en-US", timeZone: "Asia/Tokyo" }, when, options), "03/02/2024");
  assert.equal(formatDateIn({ locale: "de-DE", timeZone: "Asia/Tokyo" }, when, options), "02.03.2024");
  // options may name their own zone (a license's calendar date)
  assert.equal(
    formatDateIn({ locale: "de-DE", timeZone: "Asia/Tokyo" }, when, { ...options, timeZone: "UTC" }),
    "01.03.2024",
  );
});

test("no date, or an invalid one, formats as nothing", () => {
  for (const value of [null, undefined, "", "not a date", new Date(Number.NaN)]) {
    assert.equal(formatDateIn(browser, value), "");
  }
});

test("numbers use the locale", () => {
  assert.equal(formatNumberIn({ locale: "en-US", timeZone: "UTC" }, 1234567.5), "1,234,567.5");
  assert.equal(formatNumberIn({ locale: "de-DE", timeZone: "UTC" }, 1234567.5), "1.234.567,5");
  assert.equal(formatNumberIn({ locale: "en-US", timeZone: "UTC" }, 3, { signDisplay: "exceptZero" }), "+3");
});
