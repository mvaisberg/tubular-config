"use client";

import { useConfigStore, getAvailablePanels } from '@/lib/store';
import { ModuleConfig, ModuleMaterial, Dimension } from '@/lib/types';
import { useMemo, useState, useRef, useEffect } from 'react';
import { addConfigToWooCart } from '@/lib/cart-helpers';
import { trackAddToCart, trackChangeBase, trackChangeMaterial, trackShareDesign } from '@/lib/analytics';
import { PROMO, isPromoActive, applyPromo } from '@/lib/promo';
import { captureCanvasJpeg } from '@/lib/capture';
import { Share2, Copy, Check, X, SlidersHorizontal, Loader2, LayoutGrid } from 'lucide-react';
import { PresetsModal } from './PresetsModal';

const MATERIAL_OPTIONS = [
    { value: 'steel', label: 'Acero' },
    { value: 'acrylic', label: 'Acrílico' },
];

const STEEL_COLORS = [
    { value: 'black', label: 'Grafito', ral: 'RAL 9011', hex: '#000000', opacity: 1 },
    { value: 'white', label: 'Blanco', ral: 'RAL 9010', hex: '#FFFFFF', opacity: 1 },
    { value: 'beige', label: 'Beige', ral: 'RAL 1019', hex: '#A48F7A', opacity: 1 },
];

const ACRYLIC_COLORS = [
    { value: 'orange_translucent', label: 'Naranja', hex: '#E64A00', opacity: 0.5 },
    { value: 'transparent', label: 'Transparente', hex: '#E0F7FA', opacity: 0.3 },
    { value: 'blue_translucent', label: 'Azul', hex: '#003366', opacity: 0.5 },
    { value: 'green_translucent', label: 'Verde', hex: '#003D1F', opacity: 0.5 },
    { value: 'black_solid', label: 'Negro', hex: '#000000', opacity: 1 },
    { value: 'white_solid', label: 'Blanco', hex: '#FFFFFF', opacity: 1 },
];

const STEEL_DIMENSIONS = {
    width: [350, 500, 750],
    height: [200, 350, 500, 750],
    depth: [350, 500],
};

const ACRYLIC_DIMENSIONS = {
    width: [200, 350, 400, 750],
    height: [200, 350, 400, 500, 750],
    depth: [250, 350],
};

export const Sidebar = () => {
    const modules = useConfigStore((state) => state.modules);
    const selectedModuleId = useConfigStore((state) => state.selectedModuleId);
    const selectModule = useConfigStore((state) => state.actions.selectModule);
    const updateModule = useConfigStore((state) => state.actions.updateModule);
    const updateColumnWidth = useConfigStore((state) => state.actions.updateColumnWidth);
    const updateRowHeight = useConfigStore((state) => state.actions.updateRowHeight);
    const setAllDepth = useConfigStore((state) => state.actions.setAllDepth);
    const updateAllModules = useConfigStore((state) => state.actions.updateAllModules);
    const setModules = useConfigStore((state) => state.actions.setModules);
    const totalPrice = useConfigStore((state) => state.totalPrice);
    const settings = useConfigStore((state) => state.settings);
    const partsData = useConfigStore((state) => state.partsData);
    const hasWheels = useConfigStore((state) => state.hasWheels);
    const setHasWheels = useConfigStore((state) => state.actions.setHasWheels);
    const [isAddingToCart, setIsAddingToCart] = useState(false);
    const [addToCartError, setAddToCartError] = useState<string | null>(null);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [shareCopied, setShareCopied] = useState(false);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [shareLoading, setShareLoading] = useState(false);
    const [mobileSheet, setMobileSheet] = useState<'config' | 'cart' | null>(null);
    const [isPresetsOpen, setIsPresetsOpen] = useState(false);

    useEffect(() => {
        if (!selectedModuleId) return;
        if (typeof window === 'undefined') return;
        if (window.matchMedia('(min-width: 768px)').matches) return;
        setMobileSheet('config');
    }, [selectedModuleId]);

    // Promo Color Drop — baja el precio base mientras esté vigente.
    // `basePrice` es el precio efectivo que se cobra (lista o lista −20%).
    const promoActive = isPromoActive();
    const listPrice = Math.round(totalPrice);
    const basePrice = applyPromo(totalPrice, promoActive);
    // Efectivo/transferencia: durante la promo, 20% Color Drop + 20% adicional = 40% OFF del precio de lista.
    const cashLabel = promoActive ? '20% + 20%' : '20%OFF';
    // Efectivo = 20% sobre el precio ya descontado (basePrice). Con promo eso es
    // 20% Color Drop + 20% efectivo COMPUESTO (×0.8×0.8 = ×0.64), no 40% lineal.
    const cashPrice = Math.round(basePrice * 0.80);
    // Mientras cargan settings/parts desde Supabase, el precio real todavía no está
    // calculado (totalPrice = 0). Mostramos un loader en vez de "$0".
    const isPriceLoading = !settings || partsData.length === 0;
    const dragStartY = useRef<number | null>(null);
    const dragDelta = useRef(0);

    const handleSheetTouchStart = (e: React.TouchEvent) => {
        dragStartY.current = e.touches[0].clientY;
        dragDelta.current = 0;
    };
    const handleSheetTouchMove = (e: React.TouchEvent) => {
        if (dragStartY.current === null) return;
        dragDelta.current = e.touches[0].clientY - dragStartY.current;
    };
    const handleSheetTouchEnd = () => {
        if (dragDelta.current > 50) {
            setMobileSheet(null);
        }
        dragStartY.current = null;
        dragDelta.current = 0;
    };

    const targetModule = useMemo(() =>
        modules.find(m => m.id === selectedModuleId) || modules[0],
        [modules, selectedModuleId]
    );

    // If no modules, don't render (or render empty state)
    if (modules.length === 0) return null;

    // Helper to apply updates
    const handleUpdate = (updates: Partial<ModuleConfig>) => {
        if (selectedModuleId) {
            updateModule(selectedModuleId, updates);
        } else {
            updateAllModules(updates);
        }
    };

    const applyMaterialChange = (material: ModuleMaterial) => {
        const current = targetModule?.material || 'steel';
        if (material === current) return;
        trackChangeMaterial(material);
        // Reset to a single default module — sizes between materials don't overlap,
        // so preserving multi-module layouts on switch would create invalid geometry.
        if (material === 'acrylic') {
            setModules([{
                id: crypto.randomUUID(),
                position: { x: 0, y: 0, z: 0 },
                size: { w: 400, h: 400, d: 350 },
                color: 'orange_translucent',
                material: 'acrylic',
                hasPanel: { top: true, bottom: true, left: false, right: false, front: false, back: false },
            }]);
        } else {
            setModules([{
                id: crypto.randomUUID(),
                position: { x: 0, y: 0, z: 0 },
                size: { w: 750, h: 350, d: 350 },
                color: 'black',
                material: 'steel',
                hasPanel: { top: true, bottom: true, left: true, right: true, front: false, back: true },
            }]);
        }
    };

    const handleSteelStyleChange = (style: 'all' | 'no-back' | 'top-bottom') => {
        let hasPanel = { ...targetModule.hasPanel };

        // Base reset
        hasPanel = {
            top: true,
            bottom: true,
            left: false,
            right: false,
            front: false,
            back: false
        };

        if (style === 'all') {
            hasPanel.left = true;
            hasPanel.right = true;
            hasPanel.back = true;
        } else if (style === 'no-back') {
            hasPanel.left = true;
            hasPanel.right = true;
            hasPanel.back = false;
        } else if (style === 'top-bottom') {
            // Just top/bottom, already set
        }

        handleUpdate({ hasPanel });
    };

    const handleColorChange = (color: string) => {
        if (selectedModuleId) {
            handleUpdate({ color });
        } else {
            updateAllModules({ color });
        }
    };

    const handleAddToCart = async () => {
        if (modules.length === 0) return;
        setIsAddingToCart(true);
        setAddToCartError(null);

        try {
            const usdRate = settings?.usd_exchange_rate || 1000;
            const finalPrice = applyPromo(totalPrice, promoActive); // precio con Color Drop si está vigente
            const totalPriceUSD = finalPrice / usdRate;

            trackAddToCart({
                value: finalPrice,
                currency: "ARS",
                modulesCount: modules.length,
                material: modules[0]?.material,
                contentIds: modules.map(m => `${m.material}-${m.size.w}x${m.size.h}x${m.size.d}-${m.color}`),
            });

            const result = await addConfigToWooCart({
                modules,
                hasWheels,
                totalPriceARS: finalPrice,
                totalPriceUSD,
            });

            if (result.success && result.cart_url) {
                window.location.href = result.cart_url;
            } else {
                setAddToCartError(result.error || 'Error desconocido');
                setIsAddingToCart(false);
            }
        } catch (err) {
            console.error('Error adding to cart:', err);
            setAddToCartError('Error de conexión. Intentá de nuevo.');
            setIsAddingToCart(false);
        }
    };

    const currentMaterial = targetModule?.material || 'steel';
    const currentColors = currentMaterial === 'steel' ? STEEL_COLORS : ACRYLIC_COLORS;

    // Determine current steel style from panels
    const getSteelStyle = (): 'all' | 'no-back' | 'top-bottom' => {
        const p = targetModule.hasPanel;
        if (!p.left && !p.right && !p.back) return 'top-bottom';
        if (p.left && p.right && !p.back) return 'no-back';
        return 'all'; // Default/Fallback
    };
    const hasLeftNeighbor = modules.some(m =>
        Math.abs((m.position.x + m.size.w) - targetModule.position.x) < 1 &&
        Math.abs(m.position.y - targetModule.position.y) < 1 &&
        Math.abs(m.position.z - targetModule.position.z) < 1
    );

    const buildInlineShareUrl = (): string => {
        if (typeof window === 'undefined') return '';
        const payload = JSON.stringify({ modules, hasWheels });
        const encoded = btoa(payload);
        const url = new URL(window.location.href);
        url.searchParams.delete('quote');
        url.searchParams.set('config', encoded);
        return url.toString();
    };

    const createShortShareUrl = async (): Promise<string> => {
        try {
            // Screenshot del 3D (preserveDrawingBuffer ya está activo). El endpoint
            // lo sube al bucket `quotes` y lo deja en configuration.image_url, que es
            // lo que el manager usa como miniatura del ítem.
            const imageData = captureCanvasJpeg(0.65, 900);

            const res = await fetch('/configurador/api/checkout/whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    modules,
                    hasWheels,
                    totalPrice: applyPromo(totalPrice, promoActive),
                    usdExchangeRate: settings?.usd_exchange_rate || 1000,
                    clientName: 'Share Link',
                    imageData,
                }),
            });
            const json = await res.json();
            if (!res.ok || !json.quoteId) throw new Error(json.error || 'No quoteId returned');
            const u = new URL(window.location.href);
            u.searchParams.delete('config');
            u.searchParams.set('quote', json.quoteId);
            return u.toString();
        } catch (e) {
            console.error('Short share URL failed, falling back to inline:', e);
            return buildInlineShareUrl();
        }
    };

    const handleShare = async () => {
        if (modules.length === 0) return;

        const isMobile = typeof window !== 'undefined' &&
            (window.matchMedia('(max-width: 767px)').matches ||
             window.matchMedia('(pointer: coarse)').matches);

        if (isMobile && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
            try {
                const url = await createShortShareUrl();
                await navigator.share({
                    title: 'Mi diseño Tubular',
                    text: 'Mirá esta configuración que armé en Tubular',
                    url,
                });
                trackShareDesign({ method: 'native', value: basePrice, currency: 'ARS' });
                return;
            } catch (e) {
                if ((e as Error)?.name === 'AbortError') return;
                // Fall through to popup if native share fails for any other reason
            }
        }

        setShareCopied(false);
        setShareUrl(null);
        setShareLoading(true);
        setShareModalOpen(true);
        trackShareDesign({ method: 'modal', value: basePrice, currency: 'ARS' });
        const url = await createShortShareUrl();
        setShareUrl(url);
        setShareLoading(false);
    };

    const handleCopyShareLink = async () => {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            setShareCopied(true);
            setTimeout(() => setShareCopied(false), 2000);
        } catch (e) {
            console.error('Failed to copy share link:', e);
        }
    };

    const handleWhatsAppShare = () => {
        if (!shareUrl) return;
        const text = encodeURIComponent(`Mirá este diseño que armé en Tubular: ${shareUrl}`);
        window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
    };

    const configBody = (
        <div className="p-4">
                    {promoActive && (
                        <div className="-mx-4 -mt-4 mb-3 overflow-hidden bg-red-600 select-none">
                            <div className="promo-marquee-track py-1.5">
                                {[0, 1].map(i => (
                                    <span key={i} className="text-[0.7rem] font-bold uppercase tracking-wider text-white" aria-hidden={i === 1}>
                                        {PROMO.marqueeText}
                                        <span className="mx-6 opacity-70">✦</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="hidden md:flex flex-col items-center mb-3">
                        <a href="https://tubular.com.ar/"><img src="/brandbook/logo/logo-azul.svg" alt="Tubular" className="w-[108px]" /></a>
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsPresetsOpen(true)}
                        className="md:hidden mb-3 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-[#354763]/10 bg-[#f5f5f5] text-[#354763] text-[11px] font-bold uppercase tracking-widest cursor-pointer"
                    >
                        <LayoutGrid size={14} />
                        Empezá desde un modelo
                    </button>

                    {selectedModuleId ? (
                        <div className="mb-3 flex items-center justify-between gap-2 bg-[#354763] text-white rounded-lg px-3 py-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-widest">
                                Módulo {Math.max(1, modules.findIndex(m => m.id === selectedModuleId) + 1)} / {modules.length}
                            </span>
                            <button
                                onClick={() => selectModule(null)}
                                className="text-[10px] font-bold uppercase tracking-widest bg-white/15 hover:bg-white/25 rounded-full px-2 py-0.5 cursor-pointer"
                                title="Deseleccionar: color aplica a todo el mueble"
                            >
                                ✕ Todo
                            </button>
                        </div>
                    ) : modules.length > 1 ? (
                        <p className="mb-3 text-[11px] text-black/45 font-medium">
                            Tocá un módulo en el 3D para cambiar sus medidas.
                        </p>
                    ) : null}

                    <div className="mb-3">
                        <h3 className="text-[10px] uppercase tracking-widest font-extrabold text-black mb-2">Tipo</h3>
                        <div className="flex gap-1.5">
                            {MATERIAL_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => applyMaterialChange(opt.value as ModuleMaterial)}
                                    className={`flex-1 py-1.5 px-3 rounded-lg border-2 transition-all font-bold text-[11px] uppercase tracking-widest ${currentMaterial === opt.value
                                        ? 'bg-[#354763] text-white border-[#354763] cursor-pointer'
                                        : 'bg-[#f5f5f5] text-black/70 border-transparent hover:bg-[#354763]/5 cursor-pointer'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mb-3">
                        <h3 className="text-[10px] uppercase tracking-widest font-extrabold text-black mb-2">Base</h3>
                        <div className="flex gap-1.5">
                            {[
                                { wheels: false, label: 'Patas', img: '/configurador/base-styles/patas.png' },
                                { wheels: true, label: 'Ruedas', img: '/configurador/base-styles/ruedas.png' },
                            ].map(opt => {
                                const isSelected = hasWheels === opt.wheels;
                                return (
                                    <button
                                        key={opt.label}
                                        type="button"
                                        onClick={() => {
                                            if (hasWheels === opt.wheels) return;
                                            setHasWheels(opt.wheels);
                                            trackChangeBase(opt.wheels);
                                        }}
                                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-lg border-2 transition-all cursor-pointer ${isSelected
                                            ? 'border-[#354763] bg-white'
                                            : 'border-transparent bg-[#f5f5f5] hover:bg-[#354763]/5'
                                            }`}
                                        title={opt.label}
                                    >
                                        <img src={opt.img} alt="" className="w-7 h-7 rounded object-cover" />
                                        <span className="text-[11px] font-bold text-[#354763]">{opt.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="h-px w-full bg-[#354763]/8 my-3" />

                    {currentMaterial === 'steel' && (() => {
                                    const avail = getAvailablePanels(targetModule.size.w, targetModule.size.h, targetModule.size.d, 'steel');
                                    const topMat: ModuleMaterial = targetModule.topPanelMaterial ?? 'steel';
                                    const currentStyle = getSteelStyle();
                                    const styleOptions = [
                                        { key: 'all' as const, label: 'Cerrado', img: '/configurador/panel-styles/all.png', available: avail.frontBack && avail.leftRight },
                                        { key: 'no-back' as const, label: 'Sin fondo', img: '/configurador/panel-styles/no-back.png', available: avail.leftRight },
                                        { key: 'top-bottom' as const, label: 'Estantes', img: '/configurador/panel-styles/top-bottom.png', available: true },
                                    ];
                                    return (
                                    <div className="mb-3">
                                        <h3 className="text-[10px] uppercase tracking-widest font-extrabold text-black mb-2">Estilo</h3>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {styleOptions.map(opt => {
                                                const isSelected = currentStyle === opt.key;
                                                const isDisabled = !opt.available;
                                                return (
                                                    <button
                                                        key={opt.key}
                                                        type="button"
                                                        disabled={isDisabled}
                                                        onClick={() => handleSteelStyleChange(opt.key)}
                                                        className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border-2 transition-all ${isSelected
                                                            ? 'border-[#354763] bg-white'
                                                            : isDisabled
                                                                ? 'border-transparent bg-[#f5f5f5] opacity-40 cursor-not-allowed grayscale'
                                                                : 'border-transparent bg-[#f5f5f5] hover:bg-[#354763]/5 cursor-pointer'
                                                        }`}
                                                        title={isDisabled ? 'No disponible para esta medida' : opt.label}
                                                    >
                                                        <img src={opt.img} alt={opt.label} className="w-8 h-8" />
                                                        <span className="text-[9px] font-bold text-[#354763] text-center leading-tight">{opt.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {styleOptions.some(o => !o.available) && (
                                            <p className="text-[10px] text-black/45 leading-snug mt-1.5">
                                                Algunos estilos no existen en {targetModule.size.w}×{targetModule.size.h}×{targetModule.size.d} mm.
                                            </p>
                                        )}
                                        <div className="flex items-center justify-between mt-2 px-0.5">
                                            <span className="text-[10px] uppercase tracking-widest font-extrabold text-black">Panel superior</span>
                                            <div className="flex gap-0.5 bg-[#f5f5f5] rounded-md p-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdate({ topPanelMaterial: 'steel' })}
                                                    className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest cursor-pointer ${topMat === 'steel' ? 'bg-[#354763] text-white' : 'text-black/55'}`}
                                                >
                                                    Acero
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdate({ topPanelMaterial: 'acrylic' })}
                                                    className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest cursor-pointer ${topMat === 'acrylic' ? 'bg-[#354763] text-white' : 'text-black/55'}`}
                                                >
                                                    Acrílico
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    );
                    })()}

                    {(() => {
                                    const dims = currentMaterial === 'acrylic' ? ACRYLIC_DIMENSIONS : STEEL_DIMENSIONS;
                                    const dimBtn = (active: boolean) =>
                                        `flex-1 py-1.5 cursor-pointer rounded-lg border-2 transition-all font-bold text-[11px] ${
                                            active
                                                ? 'bg-white border-[#354763] text-black'
                                                : 'bg-[#f5f5f5] border-transparent text-black/55 hover:bg-[#354763]/5'
                                        }`;
                                    return (
                                        <div className="mb-3 space-y-2.5">
                                            <div>
                                                <label className="block text-[10px] uppercase tracking-widest font-extrabold text-black mb-1.5">Ancho</label>
                                                <div className="flex gap-1.5">
                                                    {dims.width.map((w) => (
                                                        <button key={w} onClick={() => updateColumnWidth(targetModule.id, w)} className={dimBtn(targetModule.size.w === w)}>
                                                            {w}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase tracking-widest font-extrabold text-black mb-1.5">Alto</label>
                                                <div className="flex gap-1.5">
                                                    {dims.height.map((h) => (
                                                        <button key={h} onClick={() => updateRowHeight(targetModule.id, h)} className={dimBtn(targetModule.size.h === h)}>
                                                            {h}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase tracking-widest font-extrabold text-black mb-1.5">Profundidad</label>
                                                <div className="flex gap-1.5">
                                                    {dims.depth.map((d) => (
                                                        <button key={d} onClick={() => setAllDepth(d)} className={dimBtn(targetModule.size.d === d)}>
                                                            {d}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    );
                    })()}

                    <div className="h-px w-full bg-[#354763]/8 my-3" />

                    <div>
                        <h3 className="text-[10px] uppercase tracking-widest font-extrabold text-black mb-2">Color</h3>
                        <div className="grid grid-cols-3 gap-1.5">
                            {currentColors.map((col) => (
                                <button
                                    key={col.value}
                                    onClick={() => handleColorChange(col.value)}
                                    className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border-2 transition-all cursor-pointer ${targetModule.color === col.value
                                        ? 'border-[#354763] bg-white'
                                        : 'bg-[#f5f5f5] border-transparent hover:bg-[#354763]/5'
                                        }`}
                                >
                                    <div
                                        className="w-6 h-6 rounded-full border border-black/10"
                                        style={{ backgroundColor: col.hex, opacity: col.opacity || 1 }}
                                    />
                                    <span className="text-[10px] text-[#354763] font-bold leading-none">{col.label}</span>
                                    {'ral' in col && col.ral && (
                                        <span className="text-[8px] text-black/35 font-medium leading-none">{col.ral}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
        </div>
    );

    const installmentPrice = Math.round(basePrice / 6);
    const fmtArs = (n: number) => n.toLocaleString('es-AR');

    const pricingBody = (
                <div className="bg-white p-3 md:p-4 flex-shrink-0">
                    {promoActive && (
                        <div className="mb-2 md:mb-3 rounded-xl bg-red-600 text-white px-3 py-2 text-center shadow-md shadow-red-600/20">
                            <div className="text-[0.7rem] md:text-[0.8rem] font-black uppercase tracking-wider leading-tight">
                                {PROMO.bannerLabel}
                            </div>
                        </div>
                    )}

                    <div className="price-desktop-only items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#354763] tracking-widest uppercase">Resumen</span>
                        <span className="text-[10px] bg-[#354763] text-white px-3 py-1 rounded-full font-black">
                            {modules.length} {modules.length === 1 ? 'MÓDULO' : 'MÓDULOS'}
                        </span>
                    </div>

                    <div className="bg-[#354763]/5 p-2.5 md:p-3 rounded-xl space-y-2 mb-2 md:mb-3 border border-[#354763]/10 shadow-inner">
                        <div className="flex justify-between items-start gap-3">
                            <div className="min-w-0">
                                <div className="text-[0.7rem] md:text-xs font-black text-[#354763] uppercase tracking-widest leading-tight">
                                    6 cuotas s/ interés
                                    {promoActive && <span className="text-emerald-600 font-bold tracking-tight ml-1">20% OFF</span>}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-base md:text-lg font-black text-[#354763] tabular-nums whitespace-nowrap">
                                    {isPriceLoading ? (
                                        <Loader2 className="animate-spin text-[#354763]/50" size={18} />
                                    ) : (
                                        <>
                                            {promoActive && (
                                                <span className="text-[0.7rem] font-bold text-slate-400 line-through mr-1.5">${fmtArs(listPrice)}</span>
                                            )}
                                            6 × ${fmtArs(installmentPrice)}
                                        </>
                                    )}
                                </div>
                                {!isPriceLoading && (
                                    <div className="text-[10px] font-bold text-[#354763]/50 mt-0.5">
                                        Total ${fmtArs(basePrice)}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="h-px bg-[#354763]/10 w-full" />
                        <div className="flex justify-between items-center gap-3">
                            <span className="text-[0.7rem] md:text-xs font-black text-[#354763] uppercase tracking-widest leading-tight">
                                Efectivo o transferencia <span className="text-emerald-600 font-bold tracking-tight">{promoActive ? cashLabel : '20% OFF'}</span>
                            </span>
                            <span className="text-base md:text-lg font-black text-[#354763] tabular-nums whitespace-nowrap">
                                {isPriceLoading ? (
                                    <Loader2 className="animate-spin text-[#354763]/50" size={18} />
                                ) : (
                                    <>${fmtArs(cashPrice)}</>
                                )}
                            </span>
                        </div>
                    </div>

                    {addToCartError && (
                        <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold text-center">
                            {addToCartError}
                        </div>
                    )}

                    <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={handleShare}
                        disabled={modules.length === 0}
                        className="shrink-0 w-14 py-4 rounded-xl bg-white border-2 border-[#354763] text-[#354763] hover:bg-[#354763] hover:text-white transition-colors flex justify-center items-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Compartir diseño"
                        aria-label="Compartir diseño"
                    >
                        <Share2 className="w-5 h-5" />
                    </button>
                    <button
                        type="button"
                        disabled={isAddingToCart || isPriceLoading}
                        className="flex-1 py-4 px-6 bg-[#354763] text-white font-bold text-sm tracking-widest uppercase rounded-xl hover:bg-[#2a3850] transition-colors shadow-lg shadow-[#354763]/20 flex justify-center items-center gap-2.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        onClick={handleAddToCart}
                    >
                        {isAddingToCart ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Agregando...
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                                </svg>
                                Comprar
                            </>
                        )}
                    </button>
                    </div>

                </div>
    );

    return (
        <>
            {/* Desktop sidebar */}
            <div className="hidden md:flex h-full w-[360px] bg-white shadow-2xl border-l border-[#354763]/10 flex-shrink-0 z-20 relative flex-col">
                <div className="flex-1 overflow-y-auto">{configBody}</div>
                <div className="border-t border-[#354763]/10">{pricingBody}</div>
            </div>

            {/* Mobile expandable panel (in flex flow — pushes scene up smoothly via height transition) */}
            <div className="md:hidden w-full flex-shrink-0 bg-white border-t border-[#354763]/10 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] z-30 flex flex-col">
                <div
                    className={`flex flex-col overflow-hidden transition-[height] duration-300 ease-out ${
                        mobileSheet === 'config' ? 'h-[46dvh] border-b border-[#354763]/10' :
                        mobileSheet === 'cart' ? 'h-[38dvh] border-b border-[#354763]/10' :
                        'h-0'
                    }`}
                >
                    <div
                        onTouchStart={handleSheetTouchStart}
                        onTouchMove={handleSheetTouchMove}
                        onTouchEnd={handleSheetTouchEnd}
                        className="flex justify-center items-center py-2 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
                        aria-label="Deslizar hacia abajo para cerrar"
                        role="button"
                    >
                        <div className="w-10 h-1 rounded-full bg-slate-300" />
                    </div>
                    <div className="flex-1 overflow-y-auto overscroll-contain">
                        {mobileSheet === 'cart' ? pricingBody : configBody}
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-0 pb-[env(safe-area-inset-bottom)]">
                    <button
                        type="button"
                        onClick={() => setMobileSheet(mobileSheet === 'config' ? null : 'config')}
                        className={`flex items-center justify-center gap-2 py-3.5 font-bold text-xs tracking-widest uppercase border-r border-[#354763]/10 cursor-pointer transition-colors ${mobileSheet === 'config' ? 'bg-[#354763]/10 text-[#1e314b]' : 'bg-white text-[#1e314b] active:bg-[#354763]/5'}`}
                    >
                        <SlidersHorizontal className="w-4 h-4" />
                        Configurar
                    </button>
                    <button
                        type="button"
                        onClick={() => setMobileSheet(mobileSheet === 'cart' ? null : 'cart')}
                        className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-white cursor-pointer transition-colors ${mobileSheet === 'cart' ? 'bg-[#2a3850]' : 'bg-[#354763] active:bg-[#2a3850]'}`}
                    >
                        <span className="text-[9px] font-bold tracking-widest uppercase opacity-80 leading-none">Ver precio</span>
                        <span className="text-base font-black leading-tight flex items-center gap-1">
                            {isPriceLoading ? (
                                <Loader2 className="animate-spin text-white" size={16} />
                            ) : (
                                <>
                                    {promoActive && (
                                        <span className="text-[10px] font-bold opacity-60 line-through">${listPrice.toLocaleString('es-AR')}</span>
                                    )}
                                    ${basePrice.toLocaleString('es-AR')}
                                </>
                            )}
                        </span>
                    </button>
                </div>
            </div>

            <PresetsModal open={isPresetsOpen} onClose={() => setIsPresetsOpen(false)} />

            {shareModalOpen && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-[#354763]/40 backdrop-blur-sm p-4"
                    onClick={() => setShareModalOpen(false)}
                >
                    <div
                        className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5 text-[#354763]">
                                <Share2 size={22} />
                                <h3 className="text-lg font-black tracking-tight">Compartir diseño</h3>
                            </div>
                            <button
                                onClick={() => setShareModalOpen(false)}
                                className="p-1.5 -mr-1.5 text-slate-400 hover:text-[#354763] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                aria-label="Cerrar"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <p className="text-sm text-slate-500 font-medium leading-relaxed">
                            Copiá el enlace o compartilo por WhatsApp.
                        </p>

                        <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                            <input
                                readOnly
                                value={shareLoading ? 'Generando enlace…' : (shareUrl ?? '')}
                                className="bg-transparent flex-1 text-[11px] font-mono text-slate-600 outline-none min-w-0"
                                onClick={(e) => (e.target as HTMLInputElement).select()}
                            />
                            <button
                                onClick={handleCopyShareLink}
                                disabled={shareLoading || !shareUrl}
                                className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-[#354763] text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-[#2a3850] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {shareCopied ? <Check size={14} /> : <Copy size={14} />}
                                {shareCopied ? 'Copiado' : 'Copiar'}
                            </button>
                        </div>

                        <button
                            onClick={handleWhatsAppShare}
                            disabled={shareLoading || !shareUrl}
                            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-[#25D366] text-white text-sm font-bold uppercase tracking-widest rounded-xl hover:bg-[#1ebe5a] transition-colors cursor-pointer shadow-lg shadow-[#25D366]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                            </svg>
                            Compartir por WhatsApp
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};
