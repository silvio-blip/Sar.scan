type Body = Record<string, unknown> | undefined;

export const invokeEdge = async (data: { name: string; body?: Body }) => {
  const res = await fetch("/api/edge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erro na chamada de API");
  return res.json();
};
