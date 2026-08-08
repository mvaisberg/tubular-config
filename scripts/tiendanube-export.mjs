#!/usr/bin/env node
/**
 * Export histórico de Tiendanube (órdenes, clientes y productos) a JSON/CSV.
 *
 * Credenciales: ~/.tubular-tiendanube.json  { app_id, client_secret, access_token?, store_id? }
 * Salida:       data/tiendanube/  (gitignoreado — contiene PII de clientes)
 *
 * Uso:
 *   1. Autorizar la app en el navegador (logueado como admin de la tienda vieja):
 *        https://www.tiendanube.com/apps/26338/authorize
 *      Al aprobar redirige a la URL de la app con ?code=XXXX (aunque la página dé 404,
 *      el code está en la barra de direcciones).
 *   2. node scripts/tiendanube-export.mjs auth <code>
 *   3. node scripts/tiendanube-export.mjs export
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CREDS_PATH = join(homedir(), '.tubular-tiendanube.json');
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'tiendanube');
const UA = 'Tubular historic export (pvmagia@gmail.com)';

const creds = JSON.parse(readFileSync(CREDS_PATH, 'utf8'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function auth(code) {
  const res = await fetch('https://www.tiendanube.com/apps/authorize/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({
      client_id: creds.app_id,
      client_secret: creds.client_secret,
      grant_type: 'authorization_code',
      code,
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    console.error('Fallo el intercambio del code:', data);
    process.exit(1);
  }
  creds.access_token = data.access_token;
  creds.store_id = String(data.user_id);
  writeFileSync(CREDS_PATH, JSON.stringify(creds, null, 2), { mode: 0o600 });
  console.log(`OK. store_id=${creds.store_id}, scope=${data.scope}. Token guardado en ${CREDS_PATH}`);
}

async function api(path, params = {}) {
  const url = new URL(`https://api.tiendanube.com/v1/${creds.store_id}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: { Authentication: `bearer ${creds.access_token}`, 'User-Agent': UA },
    });
    if (res.status === 429 && attempt < 5) {
      const wait = Number(res.headers.get('retry-after') || 2);
      await sleep(wait * 1000);
      continue;
    }
    if (res.status === 404) return null; // página más allá del final
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} en ${url}: ${await res.text()}`);
    return res.json();
  }
}

async function fetchAll(path, extraParams = {}) {
  const all = [];
  for (let page = 1; ; page++) {
    const batch = await api(path, { page, per_page: 200, ...extraParams });
    if (!batch || batch.length === 0) break;
    all.push(...batch);
    console.log(`  ${path} página ${page}: ${batch.length} (acum ${all.length})`);
    if (batch.length < 200) break;
    await sleep(600); // rate limit ~2 req/s
  }
  return all;
}

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function ordersToCsv(orders) {
  const header = [
    'numero', 'fecha', 'estado', 'estado_pago', 'estado_envio',
    'cliente', 'email', 'telefono', 'dni_cuit',
    'productos', 'cantidad_items', 'subtotal', 'descuento', 'envio', 'total', 'moneda',
    'medio_pago', 'metodo_envio', 'ciudad', 'provincia', 'nota',
  ];
  const rows = orders.map((o) => [
    o.number,
    o.created_at,
    o.status,
    o.payment_status,
    o.shipping_status,
    o.customer?.name ?? o.contact_name,
    o.customer?.email ?? o.contact_email,
    o.customer?.phone ?? o.contact_phone,
    o.customer?.identification ?? o.contact_identification,
    (o.products || []).map((p) => `${p.quantity}x ${p.name}${p.variant_values?.length ? ` (${p.variant_values.join(' / ')})` : ''}`).join(' | '),
    (o.products || []).reduce((n, p) => n + Number(p.quantity || 0), 0),
    o.subtotal,
    o.discount,
    o.shipping_cost_customer,
    o.total,
    o.currency,
    o.gateway_name || o.gateway,
    o.shipping_option,
    o.shipping_address?.city,
    o.shipping_address?.province,
    o.note,
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
}

async function exportAll() {
  if (!creds.access_token) {
    console.error('No hay access_token. Correr primero: node scripts/tiendanube-export.mjs auth <code>');
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });

  const store = await api('/store');
  console.log(`Tienda: ${store?.name?.es ?? store?.name} (id ${creds.store_id}, ${store?.original_domain})`);
  writeFileSync(join(OUT_DIR, 'store.json'), JSON.stringify(store, null, 2));

  console.log('Bajando órdenes...');
  const orders = await fetchAll('/orders', { status: 'any' });
  writeFileSync(join(OUT_DIR, 'orders.json'), JSON.stringify(orders, null, 2));
  writeFileSync(join(OUT_DIR, 'orders.csv'), '﻿' + ordersToCsv(orders));

  console.log('Bajando clientes...');
  const customers = await fetchAll('/customers');
  writeFileSync(join(OUT_DIR, 'customers.json'), JSON.stringify(customers, null, 2));

  console.log('Bajando productos...');
  const products = await fetchAll('/products');
  writeFileSync(join(OUT_DIR, 'products.json'), JSON.stringify(products, null, 2));

  console.log(`\nListo: ${orders.length} órdenes, ${customers.length} clientes, ${products.length} productos en ${OUT_DIR}`);
}

const [, , cmd, arg] = process.argv;
if (cmd === 'auth' && arg) await auth(arg);
else if (cmd === 'export') await exportAll();
else {
  console.log('Uso: tiendanube-export.mjs auth <code> | export');
  process.exit(1);
}
