var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-PGmQHh/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// worker/index.js
var ENVIA_BASE = /* @__PURE__ */ __name((env) => env.ENVIA_SANDBOX === "true" ? "https://api-test.envia.com" : "https://api.envia.com", "ENVIA_BASE");
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
var CARRIERS = ["estafeta", "dhl", "fedex", "ups"];
var SERVICIOS_EXCLUIR = ["big_ticket", "freight"];
var SERVICIO_LABEL = {
  express: "Express (d\xEDa siguiente)",
  ground: "Terrestre",
  ground_od: "Terrestre OD",
  ground_do: "Terrestre DO",
  saver: "Econ\xF3mico"
};
var ORIGEN_BASE = {
  name: "Paqueter\xEDa Colotl\xE1n",
  company: "Paqueter\xEDa Colotl\xE1n AP",
  email: "colotlan@paqueteriacolotlan.mx",
  phone: "4991234567",
  street: "Av. Hidalgo",
  number: "100",
  district: "Centro",
  city: "Colotlan",
  state: "JAL",
  country: "MX",
  postalCode: "46200"
};
var worker_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, "");
    if (path === "/rate" && request.method === "POST") {
      return handleRate(request, env);
    }
    if (path === "/generate" && request.method === "POST") {
      return proxyEnvia("/ship/generate/", "POST", request, env);
    }
    if (path === "/pickup" && request.method === "POST") {
      return proxyEnvia("/ship/pickup/", "POST", request, env);
    }
    if (path === "/tracking" && request.method === "GET") {
      const guia = url.searchParams.get("guia") || "";
      return proxyEnviaGet(`/ship/tracking/${guia}`, env);
    }
    if (path === "/cancel" && request.method === "DELETE") {
      return proxyEnvia("/ship/cancel/", "DELETE", request, env);
    }
    if (path.startsWith("/cp/") && request.method === "GET") {
      const cp = path.replace("/cp/", "").trim();
      return handleCP(cp, env);
    }
    return json({ error: "Ruta no encontrada" }, 404);
  }
};
async function handleCP(cp, env) {
  if (!/^\d{5}$/.test(cp)) return json({ error: "CP inv\xE1lido" }, 400);
  const res = await fetch(
    `https://api.copomex.com/query/info_cp/${cp}?token=${env.COPOMEX_TOKEN}`,
    { headers: { "User-Agent": "PaqueteriaColotlan/1.0" } }
  );
  if (!res.ok) return json({ error: "CP no encontrado", status: res.status }, 404);
  const data = await res.json();
  if (data.error || !data.response?.length) {
    return json({ error: "CP no encontrado", raw: data }, 404);
  }
  const r = data.response[0];
  const ciudad = r.d_ciudad || r.D_mnpio || "\u2014";
  const estado = r.d_estado || "\u2014";
  return json({ cp, ciudad: `${ciudad}, ${estado}` });
}
__name(handleCP, "handleCP");
async function handleRate(request, env) {
  const body = await request.json();
  const { cpDestino, peso = 1, largo = 10, ancho = 10, alto = 10, articulo = "Paquete", seguro = 0 } = body;
  if (!cpDestino) return json({ error: "cpDestino requerido" }, 400);
  const destinoBase = {
    name: "Destinatario",
    company: "",
    email: "destinatario@example.com",
    phone: "3300000000",
    street: "Calle Principal",
    number: "1",
    district: "Centro",
    city: "Ciudad",
    state: "JAL",
    country: "MX",
    postalCode: cpDestino
  };
  const paquete = [{
    content: articulo || "Paquete",
    amount: 1,
    type: "box",
    weight: parseFloat(peso),
    insurance: parseFloat(seguro) || 0,
    declaredValue: parseFloat(seguro) || 0,
    weightUnit: "KG",
    lengthUnit: "CM",
    dimensions: {
      length: parseFloat(largo),
      width: parseFloat(ancho),
      height: parseFloat(alto)
    }
  }];
  const resultados = await Promise.allSettled(
    CARRIERS.map(
      (carrier) => fetch(`${ENVIA_BASE(env)}/ship/rate/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.ENVIA_API_TOKEN}`
        },
        body: JSON.stringify({
          origin: ORIGEN_BASE,
          destination: destinoBase,
          packages: paquete,
          shipment: { carrier, type: 1 }
        })
      }).then((r) => r.json())
    )
  );
  const tarifas = [];
  for (const resultado of resultados) {
    if (resultado.status !== "fulfilled") continue;
    const data = resultado.value?.data;
    if (!Array.isArray(data)) continue;
    for (const r of data) {
      if (SERVICIOS_EXCLUIR.includes(r.service)) continue;
      if (r.totalPrice > 3e3) continue;
      tarifas.push({
        carrier: r.carrierDescription,
        carrierId: r.carrierId,
        service: r.service,
        serviceLabel: SERVICIO_LABEL[r.service] || r.serviceDescription || r.service,
        precio: Math.round(r.totalPrice * 100) / 100,
        precioBase: r.basePrice,
        impuestos: r.taxes,
        seguro: r.insurance,
        entregaEstimada: r.deliveryEstimate,
        fechaEntrega: r.deliveryDate?.date || null,
        quoteId: r.quoteId || null
      });
    }
  }
  tarifas.sort((a, b) => a.precio - b.precio);
  return json({ tarifas });
}
__name(handleRate, "handleRate");
async function proxyEnvia(endpoint, method, request, env) {
  const body = await request.text();
  const res = await fetch(`${ENVIA_BASE(env)}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.ENVIA_API_TOKEN}`
    },
    body
  });
  const data = await res.json();
  return json(data, res.status);
}
__name(proxyEnvia, "proxyEnvia");
async function proxyEnviaGet(endpoint, env) {
  const res = await fetch(`${ENVIA_BASE(env)}${endpoint}`, {
    headers: { "Authorization": `Bearer ${env.ENVIA_API_TOKEN}` }
  });
  const data = await res.json();
  return json(data, res.status);
}
__name(proxyEnviaGet, "proxyEnviaGet");
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS }
  });
}
__name(json, "json");

// ../../Users/jorge/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../Users/jorge/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-PGmQHh/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../Users/jorge/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-PGmQHh/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
