/* auth.js — cliente Supabase y helpers de autenticación */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL     = window.__ENV__?.SUPABASE_URL     || '';
const SUPABASE_ANON_KEY = window.__ENV__?.SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Login con email/contraseña ────────────────────────────────
export async function loginEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

// ── Registro ──────────────────────────────────────────────────
export async function registrar({ email, password, nombre, telefono }) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;

  // Insertar fila en tabla `usuarios`
  await supabase.from('usuarios').insert({
    id: data.user.id,
    nombre,
    telefono,
    email,
    rol: 'cliente',
  });

  return data.session;
}

// ── Logout ────────────────────────────────────────────────────
export async function logout() {
  await supabase.auth.signOut();
  window.location.reload();
}

// ── Escuchar cambios de sesión ────────────────────────────────
export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => callback(session));
}
