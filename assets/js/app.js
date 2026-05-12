// app.js — lógica principal de la aplicación

// ════════════════════════════════════════════════════
// SUPABASE
// ════════════════════════════════════════════════════
const { createClient } = supabase;
const sb = createClient(
  'https://lligzxpgsnugzabaavpo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsaWd6eHBnc251Z3phYmFhdnBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNDkxNjAsImV4cCI6MjA5MzkyNTE2MH0.FhNl3CiCTDJOhftmd2TDflB4WjZIHqwtUaVwS3YgO2E'
);

// ════════════════════════════════════════════════════
// ESTADO GLOBAL
// ════════════════════════════════════════════════════
let appState = {
  session:        null,
  perfil:         null,
  envios:         [],
  tarifas:        [],
  isGuest:        false,
  selectedTarifa: null,
  checkoutStep:   2,
  modoEntrega:    null,
  ultimoEnvio:    null,
};

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8787/api'
  : '/api';

const CARRIER_LOGO = { estafeta:'logo-estafeta', dhl:'logo-dhl', fedex:'logo-fedex', ups:'logo-ups' };

const CP_DB = {
  '44100':'Guadalajara, Jalisco', '44200':'Guadalajara, Jalisco',
  '44600':'Guadalajara, Jalisco', '45000':'Zapopan, Jalisco',
  '45100':'Zapopan, Jalisco',     '45200':'Zapopan, Jalisco',
  '46200':'Colotlán, Jalisco',    '99800':'Teul de González, Zacatecas',
  '06600':'Ciudad de México, CDMX','64000':'Monterrey, Nuevo León',
  '20000':'Aguascalientes, Ags.', '28000':'Colima, Colima',
};

// ════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════
(async () => {
  showLoading('Cargando...');
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    appState.session = session;
    await cargarPerfil(session.user.id);
    launchApp(false);
  } else {
    hideLoading();
    document.getElementById('screen-login').style.display = 'flex';
    renderIcons();
  }
  sb.auth.onAuthStateChange(async (_event, session) => {
    if (session && !appState.session) {
      appState.session = session;
      await cargarPerfil(session.user.id);
      launchApp(false);
    }
  });
})();

function renderIcons() {
  if (window.lucide) lucide.createIcons();
}

// ════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════
async function doLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.classList.add('hidden');
  if (!email || !password) { errEl.textContent = 'Completa todos los campos.'; errEl.classList.remove('hidden'); return; }
  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  showLoading('Iniciando sesión...');
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  hideLoading();
  btn.disabled = false;
  if (error) {
    errEl.textContent = error.message.includes('Invalid') ? 'Correo o contraseña incorrectos.' : error.message;
    errEl.classList.remove('hidden');
    return;
  }
  appState.session = data.session;
  await cargarPerfil(data.user.id);
  document.getElementById('screen-login').style.display = 'none';
  launchApp(false);
}

async function doRegister() {
  const nombre   = document.getElementById('reg-nombre').value.trim();
  const apellido = document.getElementById('reg-apellido').value.trim();
  const telefono = document.getElementById('reg-telefono').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl    = document.getElementById('reg-error');
  errEl.classList.add('hidden');
  if (!nombre || !telefono || !email || !password) { errEl.textContent = 'Completa los campos obligatorios.'; errEl.classList.remove('hidden'); return; }
  if (telefono.length !== 10 || isNaN(telefono)) { errEl.textContent = 'El teléfono debe tener 10 dígitos.'; errEl.classList.remove('hidden'); return; }
  if (password.length < 6) { errEl.textContent = 'La contraseña debe tener al menos 6 caracteres.'; errEl.classList.remove('hidden'); return; }
  const btn = document.getElementById('btn-register');
  btn.disabled = true;
  showLoading('Creando tu cuenta...');
  const { data, error } = await sb.auth.signUp({ email, password, options: { data: { nombre, apellido, telefono } } });
  if (error) {
    hideLoading(); btn.disabled = false;
    errEl.textContent = error.message.includes('already') ? 'Este correo ya está registrado.' : error.message;
    errEl.classList.remove('hidden');
    return;
  }
  // El trigger on_auth_user_created inserta automáticamente en public.usuarios
  hideLoading(); btn.disabled = false;
  if (data.session) {
    appState.session = data.session;
    await cargarPerfil(data.user.id);
    document.getElementById('screen-login').style.display = 'none';
    launchApp(false);
  } else {
    showToast('Cuenta creada. Revisa tu correo para confirmar.');
    switchLoginTab('ingresar', document.querySelectorAll('.login-tab')[0]);
  }
}

function doGuest() {
  appState.isGuest = true;
  document.getElementById('screen-login').style.display = 'none';
  launchApp(true);
}

async function doLogout() {
  showLoading('Cerrando sesión...');
  await sb.auth.signOut();
  Object.assign(appState, { session:null, perfil:null, isGuest:false, envios:[], tarifas:[] });
  hideLoading();
  document.getElementById('main-app').classList.add('hidden');
  document.getElementById('screen-login').style.display = 'flex';
  renderIcons();
}

async function cargarPerfil(userId) {
  const { data } = await sb.from('usuarios').select('*').eq('id', userId).single();
  if (data) appState.perfil = data;
}

// ════════════════════════════════════════════════════
// LAUNCH
// ════════════════════════════════════════════════════
function launchApp(guest) {
  const app = document.getElementById('main-app');
  app.classList.remove('hidden');
  app.style.display = 'block';
  hideLoading();
  actualizarUI();
  renderEnvios();
  showScreen('cotizar');
  renderIcons();
}

function actualizarUI() {
  const p      = appState.perfil;
  const nombre = p?.nombre || (appState.isGuest ? 'Invitado' : 'Usuario');
  document.getElementById('header-user-name').textContent = nombre;
  document.getElementById('perfil-avatar').textContent    = nombre.charAt(0).toUpperCase();
  document.getElementById('perfil-nombre').textContent    = p ? `${p.nombre} ${p.apellido || ''}`.trim() : 'Invitado';
  document.getElementById('perfil-email').textContent     = p?.telefono ? `+52 ${p.telefono}` : (appState.session?.user?.email || '—');
  const mes = new Date().toLocaleString('es-MX', { month:'long', year:'numeric' });
  document.getElementById('envios-mes-badge').textContent = mes;
  if (p?.tiene_descuento) {
    const sub = document.getElementById('perfil-descuento-sub');
    sub.textContent = `Activo — ${p.tipo_descuento || 'Especial'}`;
    sub.style.color = 'var(--green)';
  }
}

// ════════════════════════════════════════════════════
// ENVÍOS
// ════════════════════════════════════════════════════
async function renderEnvios() {
  if (appState.isGuest || !appState.session) {
    document.getElementById('lista-envios').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="lock"></i></div>
        <div class="empty-state-title">Inicia sesión para ver tus envíos</div>
        <div class="empty-state-sub">Tu historial se guarda de forma segura en tu cuenta</div>
        <button class="btn btn-primary" style="margin-top:20px;width:auto;padding:11px 24px;" onclick="doLogout()">
          <i data-lucide="log-in"></i> Iniciar sesión
        </button>
      </div>`;
    renderIcons();
    return;
  }
  const { data: envios, error } = await sb.from('envios').select('*').eq('usuario_id', appState.session.user.id).order('created_at', { ascending:false }).limit(20);
  if (error) { showToast('Error al cargar envíos'); return; }
  appState.envios = envios || [];
  actualizarEstadisticas();
  if (!appState.envios.length) {
    document.getElementById('lista-envios').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="inbox"></i></div>
        <div class="empty-state-title">Sin envíos aún</div>
        <div class="empty-state-sub">Tu primer envío aparecerá aquí una vez registrado</div>
      </div>`;
    renderIcons();
    return;
  }
  const STATUS = {
    pendiente:   { label:'Por enviar',   cls:'pill-pendiente' },
    en_transito: { label:'En tránsito',  cls:'pill-transito'  },
    entregado:   { label:'Entregado',    cls:'pill-entregado' },
    cancelado:   { label:'Cancelado',    cls:'pill-cancelado' },
  };
  document.getElementById('lista-envios').innerHTML = appState.envios.map(e => {
    const s     = STATUS[e.status] || { label:e.status, cls:'pill-pendiente' };
    const fecha = new Date(e.created_at).toLocaleDateString('es-MX', { day:'2-digit', month:'short' });
    return `
      <div class="envio-card ${e.status}">
        <div class="envio-top">
          <div class="envio-guia">${e.guia}</div>
          <span class="status-pill ${s.cls}">${s.label}</span>
        </div>
        <div class="envio-dest">Para <strong>${e.destinatario_nombre || '—'}</strong></div>
        <div class="envio-dest" style="font-size:12px;color:var(--gray-500);">${e.ciudad_destino || e.cp_destino || '—'}</div>
        <div class="envio-meta">
          <span><i data-lucide="calendar"></i>${fecha}</span>
          <span><i data-lucide="truck"></i>${e.carrier}</span>
          <span><i data-lucide="banknote"></i>$${Number(e.precio).toFixed(0)} MXN</span>
        </div>
        <div class="envio-actions">
          <button class="btn btn-sm btn-outline" onclick="rastrearDesdeHistorial('${e.guia}')">
            <i data-lucide="map-pin"></i> Rastrear
          </button>
          <button class="btn btn-sm btn-ghost" onclick="copiarGuia('${e.guia}')">
            <i data-lucide="copy"></i> Copiar guía
          </button>
        </div>
      </div>`;
  }).join('');
  renderIcons();
}

function actualizarEstadisticas() {
  const envios     = appState.envios;
  const total      = envios.reduce((s,e) => s + Number(e.precio), 0);
  const enTransito = envios.filter(e => e.status === 'en_transito').length;
  document.getElementById('perfil-stat-envios').textContent   = envios.length;
  document.getElementById('perfil-stat-transito').textContent = enTransito;
  document.getElementById('perfil-stat-total').textContent    = `$${total.toFixed(0)}`;
  document.getElementById('perfil-direcciones-sub').textContent = '0 direcciones guardadas';
}

// ════════════════════════════════════════════════════
// NAVEGACIÓN
// ════════════════════════════════════════════════════
function showScreen(name) {
  document.querySelectorAll('#main-app .screen').forEach(s => s.classList.remove('active'));
  const s = document.getElementById('screen-' + name);
  if (s) s.classList.add('active');
  if (name === 'envios') renderEnvios();
  renderIcons();
}

function switchTab(name, el) {
  document.querySelectorAll('.bnav-item').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  showScreen(name);
}

function switchLoginTab(tab, el) {
  document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('tab-ingresar').classList.toggle('hidden', tab !== 'ingresar');
  document.getElementById('tab-registrar').classList.toggle('hidden', tab !== 'registrar');
}

function goBack()     { showScreen('cotizar'); }
function nuevoEnvio() { showScreen('cotizar'); }

// ════════════════════════════════════════════════════
// CP LOOKUP
// ════════════════════════════════════════════════════
const CP_CACHE = { ...CP_DB };

async function lookupCP(val) {
  const hint = document.getElementById('cpHint');
  hint.style.color = 'var(--orange)';
  if (val.length !== 5) { hint.textContent = ''; return; }

  // 1. Caché en memoria
  if (CP_CACHE[val]) { hint.textContent = CP_CACHE[val]; return; }

  hint.textContent = 'Buscando...';

  // 2. Caché en Supabase
  const { data: cached } = await sb.from('codigos_postales').select('ciudad').eq('cp', val).maybeSingle();
  if (cached?.ciudad) {
    CP_CACHE[val] = cached.ciudad;
    hint.textContent = cached.ciudad;
    return;
  }

  // 3. API copomex via Worker
  try {
    const res = await fetch(`${API_BASE}/cp/${val}`);
    if (res.ok) {
      const { ciudad } = await res.json();
      if (ciudad) {
        CP_CACHE[val] = ciudad;
        hint.textContent = ciudad;
        sb.from('codigos_postales').upsert({ cp: val, ciudad }).then(() => {});
        return;
      }
    }
  } catch {}

  hint.textContent = 'CP no encontrado';
  hint.style.color = 'var(--red)';
}

// ════════════════════════════════════════════════════
// COTIZADOR — Envia.com via Worker
// ════════════════════════════════════════════════════
async function buscarTarifas() {
  const cp = document.getElementById('cpDestino').value.trim();
  if (cp.length !== 5) { showToast('Ingresa un CP destino de 5 dígitos'); return; }
  showLoading('Cotizando con las paqueterías...');
  document.getElementById('resultados-section').classList.add('hidden');
  try {
    const res = await fetch(`${API_BASE}/rate`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        cpDestino: cp,
        peso:    parseFloat(document.getElementById('peso').value)  || 1,
        largo:   parseFloat(document.getElementById('largo').value) || 10,
        ancho:   parseFloat(document.getElementById('ancho').value) || 10,
        alto:    parseFloat(document.getElementById('alto').value)  || 10,
        articulo: document.getElementById('articulo').value || 'Paquete',
        seguro:  parseFloat(document.getElementById('seguro').value) || 0,
      }),
    });
    const data = await res.json();
    hideLoading();
    if (!res.ok || !data.tarifas?.length) { showToast(data.error || 'Sin tarifas para ese destino'); return; }
    appState.tarifas = data.tarifas;
    renderTarifas();
    document.getElementById('resultados-section').classList.remove('hidden');
    document.getElementById('resultados-section').scrollIntoView({ behavior:'smooth', block:'start' });
  } catch {
    hideLoading();
    showToast('Sin conexión al servidor. Ejecuta: npx wrangler dev');
  }
}

function renderTarifas() {
  const desc  = document.getElementById('descuento').checked;
  const lista = document.getElementById('lista-tarifas');
  lista.innerHTML = appState.tarifas.map((t, i) => {
    const precio    = desc ? Math.round(t.precio * 0.9 * 100) / 100 : t.precio;
    const logoClass = CARRIER_LOGO[t.carrier.toLowerCase()] || 'logo-estafeta';
    const tag       = t.carrier.toUpperCase().substring(0, 7);
    return `
      <div class="tarifa-card" onclick="elegirTarifa(${i},${precio})" id="tarifa-${i}">
        <div class="tarifa-logo ${logoClass}">${tag}</div>
        <div class="tarifa-info">
          <div class="tarifa-carrier">${t.carrier}</div>
          <div class="tarifa-service">${t.serviceLabel}</div>
          <div class="tarifa-eta">${t.entregaEstimada}</div>
        </div>
        <div class="tarifa-price">$${precio.toFixed(0)}</div>
      </div>`;
  }).join('');
  renderIcons();
}

function elegirTarifa(i, precio) {
  document.querySelectorAll('.tarifa-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('tarifa-' + i).classList.add('selected');
  const t = appState.tarifas[i];
  appState.selectedTarifa = { carrier:t.carrier, servicio:t.serviceLabel, precio, dias:t.entregaEstimada, quoteId:t.quoteId, service:t.service };
  setTimeout(() => iniciarCheckout(), 350);
}

// ════════════════════════════════════════════════════
// CHECKOUT
// ════════════════════════════════════════════════════
function iniciarCheckout() {
  if (appState.isGuest) { showToast('Inicia sesión para registrar un envío'); return; }
  appState.checkoutStep = 2;
  appState.modoEntrega  = null;
  showScreen('checkout');
  renderCheckoutStep();
}

function renderCheckoutStep() {
  const t       = appState.selectedTarifa;
  const content = document.getElementById('checkout-content');
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById('step' + i);
    if (i < appState.checkoutStep)       { el.className = 'step-circle done';    el.innerHTML = '<i data-lucide="check" style="width:12px;height:12px;stroke-width:3;"></i>'; }
    else if (i === appState.checkoutStep) { el.className = 'step-circle active';  el.textContent = i; }
    else                                  { el.className = 'step-circle pending'; el.textContent = i; }
    if (i < 4) { const ln = document.getElementById('line'+i); if(ln) ln.className = 'step-line'+(i<appState.checkoutStep?' done':''); }
  }

  if (appState.checkoutStep === 2) {
    content.innerHTML = `
      <div class="card">
        <div class="card-header"><i data-lucide="truck"></i> Modo de entrega</div>
        <div class="entrega-grid">
          <div class="entrega-card ${appState.modoEntrega==='oficina'?'selected':''}" onclick="selectEntrega('oficina')">
            <div class="entrega-card-icon"><i data-lucide="building-2"></i></div>
            <div class="entrega-card-title">Lo llevo a la oficina</div>
            <div class="entrega-card-desc">La guía estará lista e impresa cuando llegues</div>
            <span class="entrega-badge badge-blue">Sin costo extra</span>
          </div>
          <div class="entrega-card ${appState.modoEntrega==='recoleccion'?'selected':''}" onclick="selectEntrega('recoleccion')">
            <div class="entrega-card-icon"><i data-lucide="truck"></i></div>
            <div class="entrega-card-title">Recolección a domicilio</div>
            <div class="entrega-card-desc">El operador pasa por tu paquete</div>
            <span class="entrega-badge badge-green">Conveniente</span>
          </div>
        </div>

        <div id="recoleccion-form" class="${appState.modoEntrega==='recoleccion'?'':'hidden'}">
          <div class="divider-label"><span class="divider-text">Datos de recolección</span></div>
          <div class="field-grid-1">
            <div class="field"><div class="field-label">Dirección completa</div>
            <input class="field-input" id="rec-direccion" placeholder="Calle, número, colonia" /></div>
          </div>
          <div class="field-grid-2">
            <div class="field"><div class="field-label">Horario preferido</div>
            <select class="field-input" id="rec-horario">
              <option>9:00 — 12:00</option><option>12:00 — 15:00</option><option>15:00 — 18:00</option>
            </select></div>
            <div class="field"><div class="field-label">Fecha</div>
            <input class="field-input" id="rec-fecha" type="date" /></div>
          </div>
        </div>

        <div style="background:var(--gray-50);border-radius:var(--radius);padding:12px;margin-bottom:14px;">
          <div style="font-size:11px;color:var(--gray-500);margin-bottom:3px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Tarifa seleccionada</div>
          <div style="font-size:14px;font-weight:700;color:var(--navy);">${t.carrier} · ${t.servicio}</div>
          <div style="font-size:22px;font-weight:800;color:var(--orange);">$${t.precio} MXN</div>
        </div>
        <button class="btn btn-primary" onclick="nextStep()">
          <i data-lucide="arrow-right"></i> Continuar
        </button>
      </div>`;

  } else if (appState.checkoutStep === 3) {
    const p  = appState.perfil;
    const cp = document.getElementById('cpDestino').value;
    content.innerHTML = `
      <div class="card">
        <div class="card-header"><i data-lucide="user"></i> Remitente</div>
        <div class="field-grid-2">
          <div class="field"><div class="field-label">Nombre *</div><input class="field-input" id="rem-nombre" value="${p?.nombre||''}" /></div>
          <div class="field"><div class="field-label">Apellido</div><input class="field-input" id="rem-apellido" value="${p?.apellido||''}" /></div>
        </div>
        <div class="field-grid-2">
          <div class="field"><div class="field-label">Teléfono *</div><input class="field-input" id="rem-telefono" value="${p?.telefono||''}" /></div>
          <div class="field"><div class="field-label">Empresa</div><input class="field-input" id="rem-empresa" placeholder="Opcional" /></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><i data-lucide="map-pin"></i> Destinatario</div>
        <div class="field-grid-2">
          <div class="field"><div class="field-label">Nombre *</div><input class="field-input" id="dest-nombre" placeholder="Nombre" /></div>
          <div class="field"><div class="field-label">Apellido</div><input class="field-input" id="dest-apellido" placeholder="Apellido" /></div>
        </div>
        <div class="field-grid-2">
          <div class="field"><div class="field-label">Teléfono *</div><input class="field-input" id="dest-telefono" placeholder="10 dígitos" /></div>
          <div class="field"><div class="field-label">Correo</div><input class="field-input" id="dest-email" type="email" placeholder="Opcional" /></div>
        </div>
        <div class="field-grid-2">
          <div class="field"><div class="field-label">CP Destino</div><input class="field-input" id="dest-cp" value="${cp}" /></div>
          <div class="field"><div class="field-label">Ciudad / Estado</div><input class="field-input" id="dest-ciudad" value="${CP_DB[cp]||''}" /></div>
        </div>
        <div class="field-grid-2">
          <div class="field"><div class="field-label">Colonia *</div><input class="field-input" id="dest-colonia" placeholder="Colonia" /></div>
          <div class="field"><div class="field-label">Calle y número *</div><input class="field-input" id="dest-calle" placeholder="Morelos 123" /></div>
        </div>
        <div class="field-grid-1">
          <div class="field"><div class="field-label">Referencias</div><input class="field-input" id="dest-referencias" placeholder="Ej. Casa verde, portón negro" /></div>
        </div>
      </div>
      <button class="btn btn-primary" onclick="nextStep()">
        <i data-lucide="arrow-right"></i> Continuar
      </button>`;

  } else if (appState.checkoutStep === 4) {
    content.innerHTML = `
      <div class="card">
        <div class="card-header"><i data-lucide="receipt"></i> Resumen del envío</div>
        <div class="detail-row"><div class="detail-key">Paquetería</div><div class="detail-val">${t.carrier} · ${t.servicio}</div></div>
        <div class="detail-row"><div class="detail-key">Entrega</div><div class="detail-val">${appState.modoEntrega==='recoleccion'?'Recolección a domicilio':'Lo llevo a la oficina'}</div></div>
        <div class="detail-row"><div class="detail-key">Tiempo estimado</div><div class="detail-val">${t.dias}</div></div>
        <div class="detail-row" style="border-top:1.5px solid var(--gray-200);margin-top:6px;padding-top:12px;">
          <div class="detail-key" style="font-weight:700;font-size:14px;">Total a cobrar</div>
          <div class="detail-val" style="font-size:22px;color:var(--orange);font-weight:800;">$${t.precio} MXN</div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><i data-lucide="credit-card"></i> Método de pago</div>
        <select class="field-input" id="metodo-pago" style="margin-bottom:12px;">
          <option value="efectivo">Efectivo en oficina</option>
          <option value="transferencia">Transferencia bancaria</option>
        </select>
        <div class="info-box yellow">
          <div class="info-box-icon"><i data-lucide="alert-circle"></i></div>
          <div class="info-box-text">El pago se realiza al momento de entregar el paquete en la oficina o en la recolección.</div>
        </div>
      </div>
      <button class="btn btn-green" id="btn-registrar-venta" onclick="registrarVenta()" style="margin-bottom:10px;">
        <i data-lucide="check-circle"></i> Registrar y generar guía
      </button>
      <button class="btn btn-ghost" onclick="appState.checkoutStep=3;renderCheckoutStep()">
        <i data-lucide="arrow-left"></i> Editar datos
      </button>`;
  }
  renderIcons();
}

function selectEntrega(modo) { appState.modoEntrega = modo; renderCheckoutStep(); }

function nextStep() {
  if (appState.checkoutStep === 2 && !appState.modoEntrega) { showToast('Selecciona el modo de entrega'); return; }
  if (appState.checkoutStep === 3) {
    if (!document.getElementById('rem-nombre').value.trim()    ||
        !document.getElementById('dest-nombre').value.trim()   ||
        !document.getElementById('dest-telefono').value.trim() ||
        !document.getElementById('dest-calle').value.trim()) {
      showToast('Completa los campos obligatorios (*)'); return;
    }
  }
  appState.checkoutStep++;
  renderCheckoutStep();
  document.getElementById('checkout-content').scrollTop = 0;
}

async function registrarVenta() {
  const t   = appState.selectedTarifa;
  const btn = document.getElementById('btn-registrar-venta');
  btn.disabled = true;
  showLoading('Registrando envío...');
  const guia = generarGuiaMock(t.carrier);
  const envio = {
    usuario_id:               appState.session.user.id,
    guia, carrier:t.carrier, servicio:t.servicio, precio:t.precio,
    peso:    parseFloat(document.getElementById('peso').value)  || 1,
    largo:   parseFloat(document.getElementById('largo').value) || 10,
    ancho:   parseFloat(document.getElementById('ancho').value) || 10,
    alto:    parseFloat(document.getElementById('alto').value)  || 10,
    articulo:             document.getElementById('articulo').value  || null,
    seguro:               parseFloat(document.getElementById('seguro').value) || null,
    descuento_aplicado:   document.getElementById('descuento').checked,
    modo_entrega:         appState.modoEntrega,
    status:               'pendiente',
    cp_origen:            '46200',
    cp_destino:           document.getElementById('dest-cp').value,
    ciudad_destino:       document.getElementById('dest-ciudad').value,
    remitente_nombre:     document.getElementById('rem-nombre').value.trim(),
    remitente_telefono:   document.getElementById('rem-telefono').value.trim(),
    destinatario_nombre:  (document.getElementById('dest-nombre').value.trim()+' '+document.getElementById('dest-apellido').value.trim()).trim(),
    destinatario_telefono:document.getElementById('dest-telefono').value.trim(),
    destinatario_email:   document.getElementById('dest-email').value.trim() || null,
    destinatario_calle:   document.getElementById('dest-calle').value.trim(),
    destinatario_colonia: document.getElementById('dest-colonia').value.trim(),
    destinatario_ciudad:  document.getElementById('dest-ciudad').value,
    destinatario_referencias: document.getElementById('dest-referencias').value.trim() || null,
    metodo_pago:          document.getElementById('metodo-pago').value,
  };
  const { error } = await sb.from('envios').insert(envio);
  hideLoading();
  if (error) { showToast('Error al registrar: ' + error.message); btn.disabled=false; return; }
  document.getElementById('guia-generada').textContent   = guia;
  document.getElementById('conf-guia-ref').textContent   = guia;
  document.getElementById('conf-paq').textContent        = `${t.carrier} · ${t.servicio}`;
  document.getElementById('conf-tipo').textContent       = appState.modoEntrega==='recoleccion' ? 'Recolección a domicilio' : 'Lo llevo a la oficina';
  document.getElementById('conf-dest').textContent       = envio.destinatario_nombre;
  document.getElementById('conf-ciudad').textContent     = envio.ciudad_destino || envio.cp_destino;
  document.getElementById('conf-eta').textContent        = t.dias;
  document.getElementById('conf-total').textContent      = `$${t.precio} MXN`;
  document.getElementById('conf-oficina-msg').classList.toggle('hidden',    appState.modoEntrega==='recoleccion');
  document.getElementById('conf-recoleccion-msg').classList.toggle('hidden', appState.modoEntrega!=='recoleccion');
  appState.ultimoEnvio = { ...envio, servicio: t.servicio, entregaEstimada: t.dias };
  showScreen('confirmacion');
  showToast('Guía generada correctamente');
}

function generarGuiaMock(carrier) {
  const p = { Estafeta:'EST', DHL:'DHL', FedEx:'FDX', UPS:'UPS' };
  return `${p[carrier]||'PKG'}-2025-${String(Math.floor(Math.random()*90000)+10000)}`;
}

// ════════════════════════════════════════════════════
// RASTREO
// ════════════════════════════════════════════════════
async function rastrearGuia() {
  const guia = document.getElementById('guiaInput').value.trim().toUpperCase();
  if (!guia) { showToast('Ingresa un número de guía'); return; }
  showLoading('Consultando estatus...');
  document.getElementById('track-empty').classList.add('hidden');
  document.getElementById('track-resultado').classList.add('hidden');
  try {
    const res  = await fetch(`${API_BASE}/tracking?guia=${encodeURIComponent(guia)}`);
    const data = await res.json();
    hideLoading();
    if (res.ok && Array.isArray(data.data) && data.data.length) {
      const eventos = data.data.map((e, i) => ({
        icon:   i === 0 ? 'truck' : e.status?.toLowerCase().includes('deliver') ? 'check-circle' : 'check',
        texto:  e.description || e.status || 'Evento',
        lugar:  e.location   || '—',
        hora:   e.date       || '—',
        estado: i === 0 ? 'active' : 'done',
      }));
      const carrierMap = { EST:'Estafeta', DHL:'DHL', FDX:'FedEx', UPS:'UPS' };
      const prefix = guia.split('-')[0];
      renderTracking(guia, {
        destino: data.data[0]?.destination || '—',
        carrier: carrierMap[prefix] || prefix,
        eta:     data.data[0]?.estimatedDelivery || '—',
        status:  data.data[0]?.description || 'En tránsito',
        eventos,
      });
    } else {
      showToast('Guía no encontrada o sin eventos de rastreo');
      document.getElementById('track-empty').classList.remove('hidden');
    }
  } catch {
    hideLoading();
    showToast('Sin conexión al servidor. Inicia: npx wrangler dev');
    document.getElementById('track-empty').classList.remove('hidden');
  }
}

function renderTracking(guia, data) {
  document.getElementById('track-empty').classList.add('hidden');
  document.getElementById('track-resultado').classList.remove('hidden');
  document.getElementById('track-guia-num').textContent = guia;
  document.getElementById('track-destino').textContent  = data.destino;
  document.getElementById('track-paq').textContent      = data.carrier;
  document.getElementById('track-eta').textContent      = data.eta;
  const badge = document.getElementById('track-status-badge');
  badge.textContent = data.status;
  badge.className   = 'status-pill pill-transito';
  document.getElementById('track-eventos').innerHTML = data.eventos.map((e, i) => `
    <div class="track-step">
      <div class="track-left">
        <div class="track-dot ${e.estado}"><i data-lucide="${e.icon}"></i></div>
        ${i < data.eventos.length-1 ? `<div class="track-connector ${e.estado==='done'?'done':''}"></div>` : ''}
      </div>
      <div class="track-body">
        <div class="track-event ${e.estado}">${e.texto}</div>
        <div class="track-loc">${e.lugar}</div>
        <div class="track-time">${e.hora}</div>
      </div>
    </div>`).join('');
  renderIcons();
}

function rastrearDesdeHistorial(guia) {
  switchTab('rastrear', document.querySelectorAll('.bnav-item')[1]);
  document.getElementById('guiaInput').value = guia;
  rastrearGuia();
}

// ════════════════════════════════════════════════════
// UTILS
// ════════════════════════════════════════════════════
function copiarGuia(guia) {
  navigator.clipboard.writeText(guia).then(() => showToast('Guía copiada: ' + guia));
}

function compartirGuia() {
  const guia = document.getElementById('guia-generada').textContent;
  if (navigator.share) {
    navigator.share({ title:'Guía de envío', text:`Rastrea tu paquete: ${guia}` });
  } else {
    copiarGuia(guia);
  }
}

function showLoading(text) {
  document.getElementById('loadingText').textContent = text;
  document.getElementById('loading').classList.remove('hidden');
}
function hideLoading() {
  document.getElementById('loading').classList.add('hidden');
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}
