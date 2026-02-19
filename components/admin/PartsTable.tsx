"use client";

import { useState } from "react";
import { PartData } from "@/lib/types"; // Need to ensure PartData matches DB
import { createClient } from "@/lib/supabase/client";
import { Pencil, Save, X } from "lucide-react";

interface PartsTableProps {
    initialParts: any[]; // Using any for now to avoid strict type mismatch with DB vs App types
}

export default function PartsTable({ initialParts }: PartsTableProps) {
    const [parts, setParts] = useState(initialParts);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<any>({});
    const [isCreating, setIsCreating] = useState(false);
    const [createForm, setCreateForm] = useState<Partial<PartData>>({
        sku: '', name: '', type: 'tube', cost: 0, price: 0, stock: 0, dimensions: {}
    });

    const supabase = createClient();

    const handleEdit = (part: any) => {
        setEditingId(part.sku);
        setEditForm({ ...part });
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditForm({});
    };

    const handleChange = (field: string, value: any) => {
        setEditForm((prev: any) => ({ ...prev, [field]: value }));
    };

    const handleCreateChange = (field: string, value: any) => {
        setCreateForm((prev: any) => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        if (!editingId) return;

        const { error } = await supabase
            .from('parts')
            .update({
                name: editForm.name,
                cost: parseFloat(editForm.cost),
                price: parseFloat(editForm.price),
                stock: parseInt(editForm.stock)
            })
            .eq('sku', editingId); // Accessing by SKU for now as ID

        if (error) {
            alert("Error updating part: " + error.message);
        } else {
            setParts(parts.map(p => p.sku === editingId ? { ...p, ...editForm } : p));
            setEditingId(null);
        }
    };

    const handleCreate = async () => {
        const { error } = await supabase
            .from('parts')
            .insert([{
                sku: createForm.sku,
                name: createForm.name,
                type: createForm.type,
                cost: parseFloat(createForm.cost as any),
                price: parseFloat(createForm.price as any),
                stock: parseInt(createForm.stock as any),
                dimensions: createForm.dimensions || {}
            }]);

        if (error) {
            alert("Error creating part: " + error.message);
        } else {
            setParts([...parts, createForm]);
            setIsCreating(false);
            setCreateForm({ sku: '', name: '', type: 'tube', cost: 0, price: 0, stock: 0, dimensions: {} });
            // Refresh page or re-fetch? State update is enough for now.
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button
                    onClick={() => setIsCreating(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                >
                    Add New Part
                </button>
            </div>

            {isCreating && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
                        <h3 className="text-lg font-bold mb-4">Create New Part</h3>
                        <div className="space-y-3">
                            <input
                                placeholder="SKU"
                                className="w-full border p-2 rounded"
                                value={createForm.sku}
                                onChange={e => handleCreateChange('sku', e.target.value)}
                            />
                            <input
                                placeholder="Name"
                                className="w-full border p-2 rounded"
                                value={createForm.name}
                                onChange={e => handleCreateChange('name', e.target.value)}
                            />
                            <select
                                className="w-full border p-2 rounded"
                                value={createForm.type}
                                onChange={e => handleCreateChange('type', e.target.value)}
                            >
                                <option value="tube">Tube</option>
                                <option value="connector">Connector</option>
                                <option value="panel">Panel</option>
                                <option value="accessory">Accessory</option>
                            </select>
                            <div className="flex gap-2">
                                <input
                                    type="number" step="0.01" placeholder="Cost"
                                    className="w-1/2 border p-2 rounded"
                                    value={createForm.cost}
                                    onChange={e => handleCreateChange('cost', e.target.value)}
                                />
                                <input
                                    type="number" step="0.01" placeholder="Price"
                                    className="w-1/2 border p-2 rounded"
                                    value={createForm.price}
                                    onChange={e => handleCreateChange('price', e.target.value)}
                                />
                            </div>
                            <input
                                type="number" placeholder="Stock"
                                className="w-full border p-2 rounded"
                                value={createForm.stock}
                                onChange={e => handleCreateChange('stock', e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button onClick={() => setIsCreating(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                            <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Create</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price (PVP)</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {parts.map((part) => {
                            const isEditing = editingId === part.sku;
                            return (
                                <tr key={part.sku}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{part.sku}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {isEditing ? (
                                            <input
                                                value={editForm.name}
                                                onChange={(e) => handleChange('name', e.target.value)}
                                                className="w-full border rounded p-1"
                                            />
                                        ) : part.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{part.type}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={editForm.cost}
                                                onChange={(e) => handleChange('cost', e.target.value)}
                                                className="w-24 border rounded p-1 text-right"
                                            />
                                        ) : `$${part.cost.toFixed(2)}`}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={editForm.price}
                                                onChange={(e) => handleChange('price', e.target.value)}
                                                className="w-24 border rounded p-1 text-right"
                                            />
                                        ) : `$${part.price.toFixed(2)}`}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                value={editForm.stock}
                                                onChange={(e) => handleChange('stock', e.target.value)}
                                                className="w-20 border rounded p-1 text-right"
                                            />
                                        ) : part.stock}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {isEditing ? (
                                            <div className="flex justify-end gap-2">
                                                <button onClick={handleSave} className="text-green-600 hover:text-green-900"><Save size={18} /></button>
                                                <button onClick={handleCancel} className="text-red-600 hover:text-red-900"><X size={18} /></button>
                                            </div>
                                        ) : (
                                            <button onClick={() => handleEdit(part)} className="text-blue-600 hover:text-blue-900">
                                                <Pencil size={18} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
