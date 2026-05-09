/* api.js — llamadas al Cloudflare Worker (proxy hacia Envia.com y Supabase) */

const WORKER_BASE = '/api'; // el Worker responde en /api/*

async function request(path, options = {}) {
  const res = await fetch(`${WORKER_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Error ${res.status}`);
  }
  return res.json();
}

// ── Envia.com (via Worker) ────────────────────────────────────

export function cotizar({ cpOrigen, cpDestino, peso, largo, ancho, alto }) {
  return request('/rate', {
    method: 'POST',
    body: JSON.stringify({ cpOrigen, cpDestino, peso, largo, ancho, alto }),
  });
}

export function generarGuia(payload) {
  return request('/generate', { method: 'POST', body: JSON.stringify(payload) });
}

export function solicitarRecoleccion(payload) {
  return request('/pickup', { method: 'POST', body: JSON.stringify(payload) });
}

export function rastrearGuia(guia) {
  return request(`/tracking?guia=${encodeURIComponent(guia)}`);
}

export function cancelarEnvio(guia) {
  return request('/cancel', { method: 'DELETE', body: JSON.stringify({ guia }) });
}
