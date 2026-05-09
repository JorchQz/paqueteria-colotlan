/* Cloudflare Worker — proxy Envia.com + CORS */

const ENVIA_BASE = env =>
  env.ENVIA_SANDBOX === 'true'
    ? 'https://api-test.envia.com'
    : 'https://api.envia.com';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Carriers a consultar en cotizaciones
const CARRIERS = ['estafeta', 'dhl', 'fedex', 'ups'];

// Servicios a excluir (demasiado caros o irrelevantes para paquetería local)
const SERVICIOS_EXCLUIR = ['big_ticket', 'freight'];

// Traducción de servicios al español
const SERVICIO_LABEL = {
  express:   'Express (día siguiente)',
  ground:    'Terrestre',
  ground_od: 'Terrestre OD',
  ground_do: 'Terrestre DO',
  saver:     'Económico',
};

const ORIGEN_BASE = {
  name:       'Paquetería Colotlán',
  company:    'Paquetería Colotlán AP',
  email:      'colotlan@paqueteriacolotlan.mx',
  phone:      '4991234567',
  street:     'Av. Hidalgo',
  number:     '100',
  district:   'Centro',
  city:       'Colotlan',
  state:      'JAL',
  country:    'MX',
  postalCode: '46200',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url  = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, '');

    // ── POST /api/rate ──────────────────────────────────────────
    if (path === '/rate' && request.method === 'POST') {
      return handleRate(request, env);
    }

    // ── POST /api/generate ──────────────────────────────────────
    if (path === '/generate' && request.method === 'POST') {
      return proxyEnvia('/ship/generate/', 'POST', request, env);
    }

    // ── POST /api/pickup ────────────────────────────────────────
    if (path === '/pickup' && request.method === 'POST') {
      return proxyEnvia('/ship/pickup/', 'POST', request, env);
    }

    // ── GET /api/tracking?guia=XXX ──────────────────────────────
    if (path === '/tracking' && request.method === 'GET') {
      const guia = url.searchParams.get('guia') || '';
      return proxyEnviaGet(`/ship/tracking/${guia}`, env);
    }

    // ── DELETE /api/cancel ──────────────────────────────────────
    if (path === '/cancel' && request.method === 'DELETE') {
      return proxyEnvia('/ship/cancel/', 'DELETE', request, env);
    }

    return json({ error: 'Ruta no encontrada' }, 404);
  },
};

// ── Cotizador: consulta los 4 carriers en paralelo ───────────
async function handleRate(request, env) {
  const body = await request.json();
  const { cpDestino, peso = 1, largo = 10, ancho = 10, alto = 10, articulo = 'Paquete', seguro = 0 } = body;

  if (!cpDestino) return json({ error: 'cpDestino requerido' }, 400);

  const destinoBase = {
    name:       'Destinatario',
    company:    '',
    email:      'destinatario@example.com',
    phone:      '3300000000',
    street:     'Calle Principal',
    number:     '1',
    district:   'Centro',
    city:       'Ciudad',
    state:      'JAL',
    country:    'MX',
    postalCode: cpDestino,
  };

  const paquete = [{
    content:       articulo || 'Paquete',
    amount:        1,
    type:          'box',
    weight:        parseFloat(peso),
    insurance:     parseFloat(seguro) || 0,
    declaredValue: parseFloat(seguro) || 0,
    weightUnit:    'KG',
    lengthUnit:    'CM',
    dimensions: {
      length: parseFloat(largo),
      width:  parseFloat(ancho),
      height: parseFloat(alto),
    },
  }];

  // Consulta todos los carriers en paralelo
  const resultados = await Promise.allSettled(
    CARRIERS.map(carrier =>
      fetch(`${ENVIA_BASE(env)}/ship/rate/`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${env.ENVIA_API_TOKEN}`,
        },
        body: JSON.stringify({
          origin:      ORIGEN_BASE,
          destination: destinoBase,
          packages:    paquete,
          shipment:    { carrier, type: 1 },
        }),
      }).then(r => r.json())
    )
  );

  // Agregar y filtrar resultados
  const tarifas = [];
  for (const resultado of resultados) {
    if (resultado.status !== 'fulfilled') continue;
    const data = resultado.value?.data;
    if (!Array.isArray(data)) continue;

    for (const r of data) {
      if (SERVICIOS_EXCLUIR.includes(r.service)) continue;
      // Excluir tarifas > $3000 (servicios especiales irrelevantes)
      if (r.totalPrice > 3000) continue;

      tarifas.push({
        carrier:          r.carrierDescription,
        carrierId:        r.carrierId,
        service:          r.service,
        serviceLabel:     SERVICIO_LABEL[r.service] || r.serviceDescription || r.service,
        precio:           Math.round(r.totalPrice * 100) / 100,
        precioBase:       r.basePrice,
        impuestos:        r.taxes,
        seguro:           r.insurance,
        entregaEstimada:  r.deliveryEstimate,
        fechaEntrega:     r.deliveryDate?.date || null,
        quoteId:          r.quoteId || null,
      });
    }
  }

  // Ordenar por precio ascendente
  tarifas.sort((a, b) => a.precio - b.precio);

  return json({ tarifas });
}

// ── Helpers ───────────────────────────────────────────────────
async function proxyEnvia(endpoint, method, request, env) {
  const body = await request.text();
  const res  = await fetch(`${ENVIA_BASE(env)}${endpoint}`, {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${env.ENVIA_API_TOKEN}`,
    },
    body,
  });
  const data = await res.json();
  return json(data, res.status);
}

async function proxyEnviaGet(endpoint, env) {
  const res  = await fetch(`${ENVIA_BASE(env)}${endpoint}`, {
    headers: { 'Authorization': `Bearer ${env.ENVIA_API_TOKEN}` },
  });
  const data = await res.json();
  return json(data, res.status);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
