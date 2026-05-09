/* app.js — lógica principal, router de pantallas y estado global */

import { supabase } from './auth.js';

// ── Estado global ──────────────────────────────────────────────
export const state = {
  usuario: null,         // objeto de sesión Supabase
  perfil:  null,         // fila de tabla `usuarios`
  cotizacion: null,      // última cotización hecha
  envioActual: null,     // envío en proceso de checkout
};

// ── Router de pantallas ───────────────────────────────────────
const screens = document.querySelectorAll('.screen');
const navItems = document.querySelectorAll('.bottom-nav__item');

export function showScreen(id) {
  screens.forEach(s => s.classList.toggle('active', s.id === id));
  navItems.forEach(n => n.classList.toggle('active', n.dataset.screen === id));
}

// ── Navegación por bottom-nav ─────────────────────────────────
navItems.forEach(item => {
  item.addEventListener('click', () => showScreen(item.dataset.screen));
});

// ── Toast ─────────────────────────────────────────────────────
export function toast(msg, duration = 3000) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

// ── Inicialización ────────────────────────────────────────────
async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    state.usuario = session.user;
    // TODO: cargar perfil desde tabla `usuarios`
    showScreen('screen-home');
  } else {
    showScreen('screen-login');
  }
}

init();
