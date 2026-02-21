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
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/admin/orders" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <h1 className="text-2xl font-bold">Crear Nueva Orden</h1>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-lg font-semibold mb-4 text-gray-800">Datos del Cliente</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Nombre Completo *</label>
                            <input
                                type="text"
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Ej: Juan Pérez"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Teléfono / WhatsApp</label>
                            <input
                                type="text"
                                value={clientWhatsapp}
                                onChange={(e) => setClientWhatsapp(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Ej: +54 9 11 1234..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Canal de Venta</label>
                            <select
                                value={channel}
                                onChange={(e) => setChannel(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            >
                                <option value="showroom">Showroom</option>
                                <option value="whatsapp">WhatsApp</option>
                                <option value="ig">Instagram</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-gray-800">Ítems de la Orden</h2>
                        <button
                            onClick={addItem}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 text-sm font-medium transition-colors"
                        >
                            <Plus size={16} /> Agregar Ítem
                        </button>
                    </div>

                    <div className="space-y-3">
                        {items.length === 0 && <p className="text-sm text-gray-500 italic">No hay ítems en la orden.</p>}

                        {items.map((item, index) => (
                            <div key={item.id} className="flex gap-3 items-start bg-white p-3 rounded-lg border border-gray-200 shadow-sm relative group">
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        value={item.description}
                                        onChange={(e) => updateItem(item.id, "description", e.target.value)}
                                        placeholder="Descripción del producto..."
                                        className="w-full border-b border-gray-200 focus:border-blue-500 p-1 outline-none text-sm mb-2"
                                    />
                                    <div className="flex gap-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">Cant:</span>
                                            <input
                                                type="number"
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 0)}
                                                className="w-16 border rounded p-1 text-sm text-center"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">Precio Unit: $</span>
                                            <input
                                                type="number"
                                                min="0"
                                                value={item.unit_price}
                                                onChange={(e) => updateItem(item.id, "unit_price", parseFloat(e.target.value) || 0)}
                                                className="w-24 border rounded p-1 text-sm text-right"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right font-medium text-sm pt-2 w-24">
                                    ${(item.quantity * item.unit_price).toLocaleString('es-AR')}
                                </div>
                                <button
                                    onClick={() => removeItem(item.id)}
                                    className="text-red-400 hover:text-red-600 p-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                    title="Eliminar"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-6 bg-white grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-gray-800">Estado y Pago</h2>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Estado de Pago</label>
                            <div className="flex gap-3">
                                {["pending", "partially_paid", "paid"].map((opt) => (
                                    <button
                                        key={opt}
                                        onClick={() => setStatus(opt)}
                                        className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${status === opt
                                                ? 'bg-blue-50 border-blue-500 text-blue-700'
                                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                            }`}
                                    >
                                        {opt === 'pending' ? 'Pendiente' : opt === 'partially_paid' ? 'Parcial' : 'Pagado'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {status === "partially_paid" && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Monto Abonado (Seña)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={paidAmount}
                                        onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                                        className="w-full pl-7 pr-3 py-2 border border-blue-300 bg-blue-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-50 p-6 rounded-lg text-sm space-y-3">
                        <div className="flex justify-between items-center text-gray-600">
                            <span>Subtotal</span>
                            <span>${subtotal.toLocaleString('es-AR')}</span>
                        </div>

                        <div className="flex justify-between items-center text-gray-600">
                            <span className="flex items-center gap-2">
                                Descuento %
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={discountPercentage}
                                    onChange={(e) => setDiscountPercentage(parseFloat(e.target.value) || 0)}
                                    className="w-16 border rounded p-1 text-center bg-white"
                                />
                            </span>
                            <span className="text-red-600">-${discountAmount.toLocaleString('es-AR')}</span>
                        </div>

                        <div className="pt-3 border-t border-gray-200 flex justify-between items-center text-lg font-bold text-gray-900">
                            <span>Total Final</span>
                            <span>${finalAmount.toLocaleString('es-AR')}</span>
                        </div>

                        {status === "partially_paid" && (
                            <div className="pt-3 flex justify-between items-center text-orange-600 font-medium">
                                <span>Saldo Restante a Pagar</span>
                                <span>${remainingAmount.toLocaleString('es-AR')}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4">
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="px-8 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                    {loading ? "Guardando..." : "Guardar Orden"}
                </button>
            </div>
        </div>
    );
}
