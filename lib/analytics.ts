import { trackCustom, trackStandard } from './meta-tracking';
import { sendGoogleCapi } from './google-capi';
import { isInternalTrafficSync } from './internal-traffic';

declare global {
    interface Window {
        dataLayer?: Record<string, unknown>[];
        gtag?: (...args: unknown[]) => void;
    }
}

type Props = Record<string, unknown>;

// Eventos que NO cuentan como interacción real (solo carga de página).
const NON_INTERACTION = new Set(['configurator_open']);

function logFirstParty(event: string, payload: Props) {
    // Registro propio en Supabase: mide uso real de la sesión (vs tráfico basura).
    try {
        const key = sessionStorage.getItem('tubular_session_key');
        if (!key || NON_INTERACTION.has(event)) return;
        const price = typeof payload.value === 'number' ? payload.value : undefined;
        void fetch('/configurador/api/track/configurator', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: 'event', session_key: key, event, price }),
            keepalive: true,
        }).catch(() => {});
    } catch { /* nunca romper */ }
}

function pushDataLayer(event: string, payload: Props = {}) {
    if (typeof window === 'undefined') return;
    if (isInternalTrafficSync()) return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...payload });
    if (typeof window.gtag === 'function') {
        window.gtag('event', event, payload);
    }
    logFirstParty(event, payload);
}

/** Apertura del configurador (además del PageView de Meta). */
export function trackConfiguratorOpen(extra: Props = {}) {
    pushDataLayer('configurator_open', extra);
    sendGoogleCapi('configurator_open', extra);
    trackStandard('ViewContent', {
        content_type: 'product',
        content_name: 'Configurador Tubular',
        content_category: 'configurator',
        ...extra,
    });
}

// Cada mutación real de la configuración (medida, color, módulo, panel…).
// Debounce de 2s para no inundar durante arrastres/carritos de clicks.
let lastMutationAt = 0;
export function trackConfigMutation(price?: number) {
    const now = Date.now();
    if (now - lastMutationAt < 2000) return;
    lastMutationAt = now;
    pushDataLayer('configura', price ? { value: price } : {});
}

export function trackStartConfigurator(extra: Props = {}) {
    pushDataLayer('inicio_configuracion', extra);
    sendGoogleCapi('inicio_configuracion', extra);
    trackCustom('inicioDeConfiguracion', extra);
}

export function trackApplyPreset(presetId: string, presetName: string) {
    pushDataLayer('apply_preset', {
        content_type: 'preset',
        content_id: presetId,
        content_name: presetName,
    });
    trackCustom('applyPreset', { content_name: presetName, content_ids: [presetId] });
}

export function trackChangeMaterial(material: string) {
    pushDataLayer('change_material', { material });
    trackCustom('changeMaterial', { content_name: material });
}

export function trackChangeBase(hasWheels: boolean) {
    pushDataLayer('change_base', { base: hasWheels ? 'ruedas' : 'patas' });
    trackCustom('changeBase', { content_name: hasWheels ? 'ruedas' : 'patas' });
}

export function trackToggleAmbientar(on: boolean) {
    if (!on) return;
    pushDataLayer('toggle_ambientar', { value: 1 });
    trackCustom('toggleAmbientar');
}

export function trackToggleDecor(on: boolean) {
    if (!on) return;
    pushDataLayer('toggle_decorar', { value: 1 });
    trackCustom('toggleDecorar');
}

export function trackShareDesign(extra: Props = {}) {
    pushDataLayer('share_design', extra);
    sendGoogleCapi('share_design', extra);
    trackCustom('shareDesign', extra);
    trackStandard('Lead', {
        content_name: 'Compartir diseño',
        content_category: 'configurator',
        ...extra,
    });
}

export function trackAddToCart(params: {
    value: number;
    currency?: string;
    modulesCount: number;
    material?: string;
    contentIds: string[];
}) {
    const currency = params.currency || 'ARS';
    sendGoogleCapi('add_to_cart', {
        value: params.value,
        currency,
        num_items: params.modulesCount,
        material: params.material,
    });
    pushDataLayer('add_to_cart', {
        currency,
        value: params.value,
        ecommerce: {
            currency,
            value: params.value,
            items: [{
                item_id: 'tubular-configurador',
                item_name: 'Mueble Tubular configurado',
                item_category: params.material || 'steel',
                quantity: 1,
                price: params.value,
            }],
        },
        num_items: params.modulesCount,
    });
    trackStandard('AddToCart', {
        value: params.value,
        currency,
        content_type: 'product_group',
        content_ids: params.contentIds,
        num_items: params.modulesCount,
        content_name: 'Mueble Tubular configurado',
    });
}
