import { getApiUrl } from "./utils";

type Body = Record<string, unknown> | undefined;

export const invokeEdge = async (data: { name: string; body?: Body }) => {
  const url = getApiUrl("/api/edge");
  console.log(`[EdgeProxy] Calling: ${url}`);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
        const text = await res.text();
        console.error(`[EdgeProxy] Error response: ${res.status} ${text}`);
        throw new Error(`Erro na chamada de API: ${res.status}`);
    }
    const jsonResponse = await res.json();
    if (jsonResponse.error) {
        throw new Error(jsonResponse.error);
    }
    return jsonResponse;
  } catch (e) {
    console.error(`[EdgeProxy] Fetch failed to URL ${url}:`, e);
    throw e;
  }
};
