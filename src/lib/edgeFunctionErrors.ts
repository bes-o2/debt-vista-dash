export function getEdgeFunctionResponseError(data: unknown, fallback = "Falha ao executar a funcao."): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const response = data as { success?: boolean; error?: unknown; message?: unknown };

  if (response.success === false) {
    return typeof response.error === "string"
      ? response.error
      : typeof response.message === "string"
        ? response.message
        : fallback;
  }

  return null;
}

export async function getEdgeFunctionErrorMessage(error: unknown, fallback = "Falha ao executar a funcao."): Promise<string> {
  const context = (error as { context?: { json?: () => Promise<unknown> } } | null)?.context;

  if (context && typeof context.json === "function") {
    try {
      const body = await context.json();
      const responseError = getEdgeFunctionResponseError(body, fallback);
      if (responseError) {
        return responseError;
      }
    } catch {
      // Fall back to the client error message below.
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
