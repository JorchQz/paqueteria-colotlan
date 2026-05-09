/* tracking.js — lógica de rastreo y renderizado de progreso */

import { rastrearGuia } from './api.js';

const PASOS_ORDEN = [
  'recolectado',
  'en_transito',
  'en_destino',
  'en_reparto',
  'entregado',
];

const PASOS_LABEL = {
  recolectado:  'Paquete recolectado',
  en_transito:  'En tránsito',
  en_destino:   'Llegó a ciudad destino',
  en_reparto:   'En reparto',
  entregado:    'Entregado',
};

// Renderiza la línea de tiempo en el contenedor dado
export function renderTracking(container, eventos) {
  const ultimo = eventos[eventos.length - 1]?.status || '';
  const idxActual = PASOS_ORDEN.indexOf(ultimo);

  container.innerHTML = PASOS_ORDEN.map((paso, i) => {
    const done   = i < idxActual;
    const active = i === idxActual;
    const evento = eventos.find(e => e.status === paso);

    return `
      <div class="tracking-step ${done ? 'tracking-step--done' : ''} ${active ? 'tracking-step--active' : ''}">
        <div class="tracking-step__dot">
          ${done ? '✓' : i + 1}
        </div>
        <div class="tracking-step__body">
          <div class="tracking-step__label">${PASOS_LABEL[paso]}</div>
          ${evento ? `<div class="tracking-step__time">${formatFecha(evento.timestamp_evento)} · ${evento.ubicacion || ''}</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

// Consulta la API y actualiza el DOM
export async function actualizarRastreo(guia, container) {
  container.innerHTML = '<div class="spinner" style="margin:40px auto"></div>';
  try {
    const data = await rastrearGuia(guia);
    renderTracking(container, data.eventos || []);
  } catch (e) {
    container.innerHTML = `<p style="padding:20px;color:var(--red)">Error: ${e.message}</p>`;
  }
}

function formatFecha(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}
