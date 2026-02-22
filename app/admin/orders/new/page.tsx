"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface OrderItem {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
}

export default function NewOrderPage() {
    const router = useRouter();
    const supabase = createClient();
    const [loading, setLoading] = useState(false);

    // Form states
    const [clientName, setClientName] = useState("");
    const [clientWhatsapp, setClientWhatsapp] = useState("");
    const [channel, setChannel] = useState("showroom");
    const [items, setItems] = useState<OrderItem[]>([]);
    const [discountPercentage, setDiscountPercentage] = useState<number>(0);
    const [status, setStatus] = useState("pending");
    const [paidAmount, setPaidAmount] = useState<number>(0);

    const addItem = () => {
        setItems([
            ...items,
            { id: crypto.randomUUID(), description: "", quantity: 1, unit_price: 0 }
        ]);
    };

    const updateItem = (id: string, field: keyof OrderItem, value: any) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const removeItem = (id: string) => {
        setItems(items.filter(item => item.id !== id));
    };

    const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
    const discountAmount = subtotal * (discountPercentage / 100);
    const finalAmount = subtotal - discountAmount;
    const remainingAmount = finalAmount - paidAmount;

    const handleSave = async () => {
        if (!clientName) {
            alert("El nombre del cliente es obligatorio");
            return;
        }
        if (items.length === 0) {
            alert("Debe agregar al menos un ítem a la orden");
            return;
        }

        setLoading(true);

        const { error } = await supabase.from("admin_orders").insert([{
            client_name: clientName,
            client_whatsapp: clientWhatsapp,
            channel: channel,
            items: items,
            total_amount: subtotal,
            discount_percentage: discountPercentage,
            final_amount: finalAmount,
            status: status,
            paid_amount: status === "paid" ? finalAmount : paidAmount
        }]);

        if (error) {
            alert("Error al guardar la orden: " + error.message);
            setLoading(false);
        } else {
            router.push("/admin/orders");
            router.refresh();
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-32">
            <header className="mb-12 border-b-2 border-black pb-4 flex items-center gap-6">
                <Link href="/admin/orders" className="p-3 border-2 border-black hover:bg-black hover:text-white transition-colors">
                    <ArrowLeft size={24} strokeWidth={2.5} />
                </Link>
                <div>
                    <h1 className="text-4xl font-black tracking-tight uppercase">Crear Nueva Orden</h1>
                    <p className="text-black/60 text-xs font-bold uppercase tracking-widest mt-1">Registro de cobro manual</p>
                </div>
            </header>

            <div className="bg-white border-2 border-black shadow-[8px_8px_0px_#000] overflow-hidden">
                <div className="p-8 border-b-2 border-black">
                    <h2 className="text-xl font-black uppercase tracking-tight text-black mb-6">Datos del Cliente</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="group">
                            <label className="text-[10px] font-black uppercase tracking-widest text-black mb-2 block group-focus-within:text-blue-600 transition-colors">Nombre Completo *</label>
                            <input
                                type="text"
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                                className="w-full border-2 border-black p-3 bg-white text-black font-bold outline-none focus:border-blue-600 transition-colors uppercase"
                                placeholder="EJ: JUAN PÉREZ"
                            />
                        </div>
                        <div className="group">
                            <label className="text-[10px] font-black uppercase tracking-widest text-black mb-2 block group-focus-within:text-blue-600 transition-colors">Teléfono / WhatsApp</label>
                            <input
                                type="text"
                                value={clientWhatsapp}
                                onChange={(e) => setClientWhatsapp(e.target.value)}
                                className="w-full border-2 border-black p-3 bg-white text-black font-bold outline-none focus:border-blue-600 transition-colors uppercase"
                                placeholder="EJ: +54 9 11 1234..."
                            />
                        </div>
                        <div className="group">
                            <label className="text-[10px] font-black uppercase tracking-widest text-black mb-2 block group-focus-within:text-blue-600 transition-colors">Canal de Venta</label>
                            <select
                                value={channel}
                                onChange={(e) => setChannel(e.target.value)}
                                className="w-full border-2 border-black p-3 bg-white text-black font-bold outline-none focus:border-blue-600 transition-colors uppercase appearance-none"
                            >
                                <option value="showroom">SHOWROOM</option>
                                <option value="whatsapp">WHATSAPP</option>
                                <option value="ig">INSTAGRAM</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="p-8 border-b-2 border-black bg-black/5">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-black uppercase tracking-tight text-black">Ítems de la Orden</h2>
                        <button
                            onClick={addItem}
                            className="flex items-center gap-2 px-4 py-2 bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-colors shadow-[4px_4px_0px_#000]"
                        >
                            <Plus size={14} strokeWidth={2.5} /> AGREGAR ÍTEM
                        </button>
                    </div>

                    <div className="space-y-4">
                        {items.length === 0 && <p className="text-[10px] font-bold text-black/40 uppercase tracking-widest">NO HAY ÍTEMS EN LA ORDEN.</p>}

                        {items.map((item, index) => (
                            <div key={item.id} className="flex gap-4 items-start bg-white p-4 border-2 border-black group">
                                <div className="flex-1 space-y-4">
                                    <input
                                        type="text"
                                        value={item.description}
                                        onChange={(e) => updateItem(item.id, "description", e.target.value)}
                                        placeholder="DESCRIPCIÓN DEL PRODUCTO..."
                                        className="w-full border-b-2 border-black focus:border-blue-600 py-2 outline-none text-sm font-bold uppercase transition-colors"
                                    />
                                    <div className="flex gap-6">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-black/60">CANT:</span>
                                            <input
                                                type="number"
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 0)}
                                                className="w-20 border-2 border-black p-2 text-sm font-bold text-center outline-none focus:border-blue-600 transition-colors"
                                            />
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-black/60">PRECIO UNIT: $</span>
                                            <input
                                                type="number"
                                                min="0"
                                                value={item.unit_price}
                                                onChange={(e) => updateItem(item.id, "unit_price", parseFloat(e.target.value) || 0)}
                                                className="w-32 border-2 border-black p-2 text-sm font-bold text-right outline-none focus:border-blue-600 transition-colors"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end justify-between h-full space-y-4">
                                    <button
                                        onClick={() => removeItem(item.id)}
                                        className="text-black hover:text-white hover:bg-black p-2 border-2 border-transparent hover:border-black transition-colors"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={18} strokeWidth={2} />
                                    </button>
                                    <div className="font-black text-lg text-black mt-auto">
                                        ${(item.quantity * item.unit_price).toLocaleString('es-AR')}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-8 bg-white grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-6">
                        <h2 className="text-xl font-black uppercase tracking-tight text-black">Estado y Pago</h2>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-black mb-3 block">Estado de Pago</label>
                            <div className="flex gap-4">
                                {["pending", "partially_paid", "paid"].map((opt) => (
                                    <button
                                        key={opt}
                                        onClick={() => setStatus(opt)}
                                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest border-2 transition-colors ${status === opt
                                            ? 'bg-black border-black text-white shadow-[4px_4px_0px_#000]'
                                            : 'bg-white border-black text-black hover:bg-black/5'
                                            }`}
                                    >
                                        {opt === 'pending' ? 'PENDIENTE' : opt === 'partially_paid' ? 'PARCIAL' : 'PAGADO'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {status === "partially_paid" && (
                            <div className="group animate-in fade-in slide-in-from-top-2 duration-200">
                                <label className="text-[10px] font-black uppercase tracking-widest text-black mb-2 block group-focus-within:text-blue-600 transition-colors">Monto Abonado (Seña)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3 text-black font-black">$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={paidAmount}
                                        onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                                        className="w-full pl-8 pr-4 py-3 border-2 border-black bg-white text-black font-bold outline-none focus:border-blue-600 transition-colors"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-black/5 p-8 border-2 border-black space-y-6 flex flex-col justify-center">
                        <div className="flex justify-between items-center text-black">
                            <span className="text-xs font-black uppercase tracking-widest opacity-60">Subtotal</span>
                            <span className="text-sm font-black">${subtotal.toLocaleString('es-AR')}</span>
                        </div>

                        <div className="flex justify-between items-center text-black">
                            <span className="flex items-center gap-3 text-xs font-black uppercase tracking-widest opacity-60">
                                Descuento %
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={discountPercentage}
                                    onChange={(e) => setDiscountPercentage(parseFloat(e.target.value) || 0)}
                                    className="w-20 border-2 border-black p-1 text-center bg-white text-black outline-none focus:border-blue-600 transition-colors"
                                />
                            </span>
                            <span className="text-sm font-black text-blue-600">-${discountAmount.toLocaleString('es-AR')}</span>
                        </div>

                        <div className="pt-6 border-t-2 border-black flex justify-between items-end text-black">
                            <span className="text-sm font-black uppercase tracking-widest">Total Final</span>
                            <span className="text-3xl font-black leading-none">${finalAmount.toLocaleString('es-AR')}</span>
                        </div>

                        {status === "partially_paid" && (
                            <div className="pt-4 flex justify-between items-center text-blue-600 font-black animate-in fade-in">
                                <span className="text-[10px] uppercase tracking-widest">Saldo Restante</span>
                                <span className="text-lg">${remainingAmount.toLocaleString('es-AR')}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-8">
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="px-8 py-4 bg-blue-600 text-white text-sm font-black uppercase tracking-widest hover:bg-black transition-colors disabled:opacity-50 shadow-[6px_6px_0px_#000]"
                >
                    {loading ? "GUARDANDO..." : "GUARDAR ORDEN"}
                </button>
            </div>
        </div>
    );
}
