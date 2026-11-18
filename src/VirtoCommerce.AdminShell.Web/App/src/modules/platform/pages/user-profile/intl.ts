// Zones and language names for the profile blade

export const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** a language's name in `locale` (its own language by default), the code when the browser doesn't know it */
export const languageName = (code: string, locale = code) => {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
};

// legacy builds "(UTC ±HH:MM) Zone" from moment-timezone, sorted by offset; undefined for a zone this browser doesn't know
function offsetMinutes(zone: string) {
  let part: string | undefined;
  try {
    part = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value;
  } catch {
    return undefined;
  }
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(part ?? "");
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/** the browser's own zones: the list when the platform has none (before it served api/platform/localization/timezones) */
export const browserZones = () =>
  (Intl as unknown as { supportedValuesOf(key: string): string[] }).supportedValuesOf("timeZone");

/** the options for `ids` (the platform's time zones), sorted by offset; zones this browser can't apply are left out */
export function timeZones(ids: string[]) {
  return ids
    .map((zone) => ({ zone, offset: offsetMinutes(zone) }))
    .filter((x): x is { zone: string; offset: number } => x.offset !== undefined)
    .sort((a, b) => a.offset - b.offset || a.zone.localeCompare(b.zone))
    .map(({ zone, offset }) => {
      const sign = offset < 0 ? "-" : "+";
      const abs = Math.abs(offset);
      const hhmm = `${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
      return { id: zone, title: `(UTC ${sign}${hhmm}) ${zone}` };
    });
}
