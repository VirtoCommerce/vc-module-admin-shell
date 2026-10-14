// Same-origin fetch for the platform endpoints the framework's generated clients don't cover
// (settings v2 values, profiles, localization, sign-in log, currencies). Cookie auth applies.
export async function api<T = unknown>(method: string, url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}${text ? `: ${text}` : ""}`);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * A setting's values as legacy's settings.getValues reads them (GET settings/values/{name}: allowed values, else [value],
 * else [default]). Needs only a signed-in user, unlike GET settings/{name}; a failed lookup is an empty list.
 */
export const settingValues = (name: string) =>
  api<unknown[] | null>("GET", `/api/platform/settings/values/${encodeURIComponent(name)}`).catch(() => []);

let translations: Promise<Record<string, unknown>> | undefined;

/** The platform's merged AngularJS translations (setting titles, permission descriptions); best-effort, loaded once. */
export const platformTranslations = (locale = "en") =>
  (translations ??= api<Record<string, unknown>>("GET", `/api/platform/localization?lang=${encodeURIComponent(locale)}`).catch(
    () => ({}) as Record<string, unknown>,
  ));
