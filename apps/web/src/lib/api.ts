export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Call the same-origin API. Pass `key` for balance-changing actions. */
export async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; key?: string } = {},
): Promise<T> {
  const response = await fetch(`/api/v1/${path}`, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    credentials: "same-origin",
    headers: {
      ...(options.body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
      ...(options.key ? { "Idempotency-Key": options.key } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const result = await response.json().catch(() => ({}));
  if (response.status === 401 && typeof window !== "undefined") {
    // A full reload clears client state after the session has ended.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/sign-in?next=${encodeURIComponent(window.location.pathname)}`;
  }
  if (!response.ok) {
    const message = Array.isArray(result.message)
      ? result.message[0]
      : result.message;
    throw new ApiError(
      message || "Something went wrong. Please try again.",
      response.status,
    );
  }
  return result as T;
}

export const newKey = () => crypto.randomUUID();
