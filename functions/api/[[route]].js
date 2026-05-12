/**
 * Cloudflare Pages Function — catch-all para /api/*
 * Reutiliza la lógica del Worker para que Pages sirva
 * tanto los archivos estáticos como la API desde el mismo dominio.
 */
import workerHandler from '../../worker/index.js';

export async function onRequest(context) {
  return workerHandler.fetch(context.request, context.env);
}
