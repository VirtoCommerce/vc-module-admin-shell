// The shell's one same-origin JSON request, for the endpoints the framework's generated clients don't cover (the menu,
// settings v2 values, profiles, localization, the sign-in log, the dashboard widgets' searches). Cookie auth applies.

/**
 * Sends `body` as JSON and returns the parsed answer (undefined for an empty one). A failed request throws with the
 * status and the response body, which carries the server's reason. `signal` aborts it (a superseded search).
 */
export async function request<T = unknown>(method: string, url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method,
    signal,
    headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    const detail = text ? `: ${text}` : "";
    throw new Error(`${response.status} ${response.statusText}${detail}`);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}
