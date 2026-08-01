import { ModuleConfig } from './types';

const MATERIAL_LABELS: Record<string, string> = {
  steel: 'Acero',
  acrylic: 'Acrílico',
};

const COLOR_LABELS: Record<string, string> = {
  black: 'Negro mate',
  white: 'Blanco',
  beige: 'Beige',
  orange_translucent: 'Naranja translúcido',
  transparent: 'Transparente',
  blue_translucent: 'Azul translúcido',
  green_translucent: 'Verde translúcido',
};

/**
 * Generates a human-readable description from an array of modules.
 * Groups identical modules by material, dimensions, and color.
 * Example: "2 módulos Acero 750×350×350mm Blanco + 1 módulo Acrílico 350×350×350mm Naranja translúcido"
 */
export function generateConfigDescription(modules: ModuleConfig[]): string {
  if (modules.length === 0) return 'Sin módulos';

  // Group modules by key signature (material + size + color)
  const groups: Record<string, { count: number; material: string; w: number; h: number; d: number; color: string }> = {};

  for (const m of modules) {
    const key = `${m.material}-${m.size.w}x${m.size.h}x${m.size.d}-${m.color}`;
    if (!groups[key]) {
      groups[key] = {
        count: 0,
        material: m.material,
        w: m.size.w,
        h: m.size.h,
        d: m.size.d,
        color: m.color,
      };
    }
    groups[key].count++;
  }

  const parts = Object.values(groups).map((g) => {
    const noun = g.count === 1 ? 'módulo' : 'módulos';
    const materialLabel = MATERIAL_LABELS[g.material] || g.material;
    const colorLabel = COLOR_LABELS[g.color] || g.color;
    return `${g.count} ${noun} ${materialLabel} ${g.w}×${g.h}×${g.d}mm ${colorLabel}`;
  });

  return parts.join(' + ');
}

/**
 * Sends the current configuration to the WooCommerce add-to-cart REST endpoint.
 * Returns the cart URL on success.
 */
export async function addConfigToWooCart(params: {
  modules: ModuleConfig[];
  hasWheels: boolean;
  totalPriceARS: number;
  totalPriceUSD: number;
}): Promise<{ success: boolean; cart_url?: string; error?: string }> {
  const { modules, hasWheels, totalPriceARS, totalPriceUSD } = params;
  const description = generateConfigDescription(modules);

  // Build the API URL relative to the parent domain (without /configurador basePath)
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const apiUrl = `${origin}/wp-json/tubular/v1/add-to-cart`;

  // Try to capture a screenshot from the 3D canvas
  let imageUrl = '';
  try {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      imageUrl = canvas.toDataURL('image/jpeg', 0.8);
    }
  } catch (e) {
    console.error('Failed to capture canvas screenshot:', e);
  }

  const body = {
    configuration: modules,
    has_wheels: hasWheels,
    price: Math.round(totalPriceARS),
    price_usd: Math.round(totalPriceUSD),
    description,
    modules_count: modules.length,
    material: modules[0]?.material || 'steel',
    image_url: imageUrl,
  };

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    return { success: false, error: data?.message || data?.error || 'Error al agregar al carrito' };
  }

  return { success: true, cart_url: data.cart_url };
}
