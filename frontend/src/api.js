async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    // Surface FastAPI's {"detail": ...} message when there is one.
    const body = await res.json().catch(() => null);
    const detail = typeof body?.detail === "string" ? body.detail : body?.detail?.[0]?.msg;
    throw new Error(detail || `${res.status} ${res.statusText}`);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  config: () => request("/config"),
  listRuns: () => request("/runs"),
  getRun: (id) => request(`/runs/${id}`),
  createRun: (count, seed) =>
    request("/runs", { method: "POST", body: JSON.stringify({ count, seed }) }),
  cancelRun: (id) => request(`/runs/${id}/cancel`, { method: "POST" }),
  deleteRun: (id) => request(`/runs/${id}`, { method: "DELETE" }),
  listPairs: (id, offset, limit) => request(`/runs/${id}/pairs?offset=${offset}&limit=${limit}`),
};

export const fileUrl = (id, name) => `/api/runs/${id}/files/${name}`;
export const zipUrl = (id) => `/api/runs/${id}/zip`;
