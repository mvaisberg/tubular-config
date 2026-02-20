"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Pencil, Save, X, Trash2, Image as ImageIcon } from "lucide-react";

interface PartsTableProps {
    initialParts: any[];
}

export default function PartsTable({ initialParts }: PartsTableProps) {
    const [parts, setParts] = useState(initialParts);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<any>({});
    const [isCreating, setIsCreating] = useState(false);
    const [createForm, setCreateForm] = useState<any>({
        sku: '', name: '', type: 'tube', price_ars: '', price_usd: '', image_url: ''
    });
    const [uploadingImage, setUploadingImage] = useState(false);

    const supabase = createClient();

    const handleEdit = (part: any) => {
        setEditingId(part.id);
        setEditForm({ ...part });
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditForm({});
    };

    const handleChange = (field: string, value: any) => {
        setEditForm((prev: any) => {
            const up = { ...prev, [field]: value };
            // Enforce only one price
            if (field === 'price_ars' && value) up.price_usd = '';
            if (field === 'price_usd' && value) up.price_ars = '';
            return up;
        });
    };

    const handleCreateChange = (field: string, value: any) => {
        setCreateForm((prev: any) => {
            const up = { ...prev, [field]: value };
            // Enforce only one price
            if (field === 'price_ars' && value) up.price_usd = '';
            if (field === 'price_usd' && value) up.price_ars = '';
            return up;
        });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingImage(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `parts/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('images') // Assume bucket exists, if not need to create
            .upload(filePath, file);

        if (uploadError) {
            console.error('Error uploading image:', uploadError);
            alert('Error al subir la imagen. Asegúrate que el bucket "images" exista en Supabase y sea público.');
            setUploadingImage(false);
            return;
        }

        const { data } = supabase.storage.from('images').getPublicUrl(filePath);
        
        if (isEdit) {
            handleChange('image_url', data.publicUrl);
        } else {
            handleCreateChange('image_url', data.publicUrl);
        }
        setUploadingImage(false);
    };

    const handleSave = async () => {
        if (!editingId) return;

        if (!editForm.price_ars && !editForm.price_usd) {
            alert('Debes ingresar el Precio en ARS o en USD');
            return;
        }

        const args = {
            sku: editForm.sku,
            name: editForm.name,
            type: editForm.type,
            price_ars: editForm.price_ars ? parseFloat(editForm.price_ars) : null,
            price_usd: editForm.price_usd ? parseFloat(editForm.price_usd) : null,
            image_url: editForm.image_url
        };

        const { error } = await supabase
            .from('parts')
            .update(args)
            .eq('id', editingId);

        if (error) {
            alert("Error updating part: " + error.message);
        } else {
            setParts(parts.map(p => p.id === editingId ? { ...p, ...args } : p));
            setEditingId(null);
        }
    };

    const handleCreate = async () => {
        if (!createForm.price_ars && !createForm.price_usd) {
            alert('Debes ingresar el Precio en ARS o en USD');
            return;
        }

        const args = {
            sku: createForm.sku,
            name: createForm.name,
            type: createForm.type,
            price_ars: createForm.price_ars ? parseFloat(createForm.price_ars) : null,
            price_usd: createForm.price_usd ? parseFloat(createForm.price_usd) : null,
            image_url: createForm.image_url
        };

        const { data, error } = await supabase
            .from('parts')
            .insert([args])
            .select('*')
            .single();

        if (error) {
            alert("Error creating part: " + error.message);
        } else if (data) {
            setParts([...parts, data]);
            setIsCreating(false);
            setCreateForm({ sku: '', name: '', type: 'tube', price_ars: '', price_usd: '', image_url: '' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta parte?')) return;
        
        const { error } = await supabase.from('parts').delete().eq('id', id);
        if (error) {
            alert("Error deleting part: " + error.message);
        } else {
            setParts(parts.filter(p => p.id !== id));
        }
    }

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
                                <div>
                                    <label className="text-xs text-gray-500">Precio ARS</label>
                                    <input
                                        type="number" step="0.01" placeholder="ARS"
                                        className="w-full border p-2 rounded bg-gray-50 disabled:opacity-50"
                                        value={createForm.price_ars}
                                        onChange={e => handleCreateChange('price_ars', e.target.value)}
                                        disabled={!!createForm.price_usd}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Precio USD</label>
                                    <input
                                        type="number" step="0.01" placeholder="USD"
                                        className="w-full border p-2 rounded bg-gray-50 disabled:opacity-50"
                                        value={createForm.price_usd}
                                        onChange={e => handleCreateChange('price_usd', e.target.value)}
                                        disabled={!!createForm.price_ars}
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Imagen (Opcional)</label>
                                {createForm.image_url ? (
                                    <div className="relative w-24 h-24 mb-2">
                                        <img src={createForm.image_url} alt="Preview" className="w-full h-full object-cover rounded border" />
                                        <button onClick={() => handleCreateChange('image_url', '')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><X size={12} /></button>
                                    </div>
                                ) : (
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        onChange={(e) => handleImageUpload(e, false)}
                                        disabled={uploadingImage}
                                        className="w-full border p-2 rounded text-sm disabled:opacity-50" 
                                    />
                                )}
                            </div>

                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button onClick={() => setIsCreating(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                            <button onClick={handleCreate} disabled={uploadingImage} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">Create</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price (ARS)</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price (USD)</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {parts.map((part) => {
                            const isEditing = editingId === part.id;
                            return (
                                <tr key={part.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {isEditing ? (
                                            <div>
                                                {editForm.image_url ? (
                                                     <div className="relative w-12 h-12">
                                                        <img src={editForm.image_url} alt="Thumb" className="w-full h-full object-cover rounded border" />
                                                        <button onClick={() => handleChange('image_url', '')} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X size={10} /></button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center">
                                                        <input 
                                                            type="file" 
                                                            id={`file-${part.id}`}
                                                            accept="image/*" 
                                                            onChange={(e) => handleImageUpload(e, true)}
                                                            className="hidden" 
                                                        />
                                                        <label htmlFor={`file-${part.id}`} className="cursor-pointer text-blue-500 hover:text-blue-700 p-1 border rounded"><ImageIcon size={16}/></label>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            part.image_url ? <img src={part.image_url} alt={part.name} className="w-12 h-12 object-cover rounded border" /> : <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center text-gray-400"><ImageIcon size={16}/></div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {isEditing ? <input value={editForm.sku || ''} onChange={(e) => handleChange('sku', e.target.value)} className="w-full border rounded p-1"/> : part.sku}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {isEditing ? (
                                            <input
                                                value={editForm.name || ''}
                                                onChange={(e) => handleChange('name', e.target.value)}
                                                className="w-full border rounded p-1"
                                            />
                                        ) : part.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {isEditing ? (
                                            <select value={editForm.type || 'tube'} onChange={e => handleChange('type', e.target.value)} className="border rounded p-1">
                                                <option value="tube">Tube</option>
                                                <option value="connector">Connector</option>
                                                <option value="panel">Panel</option>
                                                <option value="accessory">Accessory</option>
                                            </select>
                                        ) : part.type}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={editForm.price_ars ?? ''}
                                                onChange={(e) => handleChange('price_ars', e.target.value)}
                                                disabled={!!editForm.price_usd}
                                                className="w-24 border rounded p-1 text-right disabled:opacity-50 bg-gray-50"
                                            />
                                        ) : part.price_ars ? `$${Number(part.price_ars).toFixed(2)}` : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={editForm.price_usd ?? ''}
                                                onChange={(e) => handleChange('price_usd', e.target.value)}
                                                disabled={!!editForm.price_ars}
                                                className="w-24 border rounded p-1 text-right disabled:opacity-50 bg-gray-50"
                                            />
                                        ) : part.price_usd ? `US$${Number(part.price_usd).toFixed(2)}` : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {isEditing ? (
                                            <div className="flex justify-end gap-2">
                                                <button onClick={handleSave} className="text-green-600 hover:text-green-900"><Save size={18} /></button>
                                                <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                                            </div>
                                        ) : (
                                            <div className="flex justify-end gap-3">
                                                <button onClick={() => handleEdit(part)} className="text-blue-600 hover:text-blue-900">
                                                    <Pencil size={18} />
                                                </button>
                                                <button onClick={() => handleDelete(part.id)} className="text-red-600 hover:text-red-900">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
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

