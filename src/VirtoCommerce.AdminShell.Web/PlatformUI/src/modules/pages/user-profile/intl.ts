// Zones and language names for the profile blade: the same for every blade, so built once per page (the zones on first use:
// one formatter per zone is too much for every page load)

export const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** a language's name in `locale` (its own language by default), the code when the browser doesn't know it */
export const languageName = (code: string, locale = code) => {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
};

// legacy builds "(UTC ±HH:MM) Zone" from moment-timezone, sorted by offset; Intl has the same zone list
function offsetMinutes(zone: string) {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" })
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName")?.value;
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(part ?? "");
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}
let zones: { id: string; title: string }[] | undefined;
export function timeZones() {
  zones ??= (Intl as unknown as { supportedValuesOf(key: string): string[] })
    .supportedValuesOf("timeZone")
    .map((zone) => ({ zone, offset: offsetMinutes(zone) }))
    .sort((a, b) => a.offset - b.offset || a.zone.localeCompare(b.zone))
    .map(({ zone, offset }) => {
      const sign = offset < 0 ? "-" : "+";
      const abs = Math.abs(offset);
      const hhmm = `${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
      return { id: zone, title: `(UTC ${sign}${hhmm}) ${zone}` };
    });
  return zones;
}
