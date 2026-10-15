/** A same-origin JSON request for a search provider: the auth cookie applies, and the search's signal aborts it */
export async function searchApi<T>(method: string, url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method,
    signal,
    headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${method} ${url} failed: ${response.status}`);
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
