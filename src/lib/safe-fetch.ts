/**
 * Utilitário seguro para requisições HTTP e parsing de JSON.
 * Evita crashes do tipo "Unexpected token <, Request Entity Too Large, etc."
 * e retorna mensagens compreensíveis e humanizadas.
 */

export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T | null; error: string | null }> {
  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get("content-type") || "";

    if (!response.ok) {
      let errorMessage = `Erro na requisição (${response.status})`;

      if (response.status === 413) {
        errorMessage =
          "A imagem é muito pesada para o servidor. Ela foi otimizada para novo envio.";
      } else if (response.status === 502 || response.status === 503 || response.status === 504) {
        errorMessage =
          "O servidor está momentaneamente ocupado ou em manutenção. Tente novamente em alguns segundos.";
      } else if (contentType.includes("application/json")) {
        try {
          const jsonErr = await response.json();
          errorMessage =
            jsonErr.error ||
            jsonErr.erro ||
            jsonErr.message ||
            `Erro do servidor (${response.status})`;
        } catch {
          // ignora
        }
      } else {
        const textErr = await response.text().catch(() => "");
        if (textErr && textErr.length < 200 && !textErr.includes("<!DOCTYPE")) {
          errorMessage = textErr;
        }
      }

      return {
        ok: false,
        status: response.status,
        data: null,
        error: errorMessage,
      };
    }

    if (contentType.includes("application/json")) {
      const data = await response.json();
      return {
        ok: true,
        status: response.status,
        data,
        error: null,
      };
    }

    const text = await response.text();
    try {
      const cleanJson = text.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      return {
        ok: true,
        status: response.status,
        data: parsed,
        error: null,
      };
    } catch {
      return {
        ok: false,
        status: response.status,
        data: null,
        error: "Resposta do servidor em formato inesperado.",
      };
    }
  } catch (err: any) {
    const isNetworkError =
      err.message?.includes("Failed to fetch") ||
      err.message?.includes("NetworkError") ||
      err.message?.includes("Load failed");

    return {
      ok: false,
      status: 0,
      data: null,
      error: isNetworkError
        ? "Falha de conexão com o servidor. Verifique a internet e tente novamente."
        : err.message || "Erro de comunicação com o servidor.",
    };
  }
}
