"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Pencil, Save, X, Trash2, Image as ImageIcon, Plus } from "lucide-react";

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
            if (field === 'price_ars' && value) up.price_usd = '';
            if (field === 'price_usd' && value) up.price_ars = '';
            return up;
        });
    };

    const handleCreateChange = (field: string, value: any) => {
        setCreateForm((prev: any) => {
            const up = { ...prev, [field]: value };
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
            .from('images')
            .upload(filePath, file);

        if (uploadError) {
            console.error('Error uploading image:', uploadError);
            alert('Error al subir la imagen.');
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
        <div className="space-y-6 relative pb-32">
            <div className="flex justify-between items-center mb-6">
                <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-2 bg-gray-900 text-white px-4 py-3 text-xs font-semibold tracking-normal hover:bg-indigo-600 transition-colors shadow-sm"
                >
                    <Plus size={14} strokeWidth={2.5} />
                    NUEVA PIEZA
                </button>
            </div>

            {isCreating && (
                <div className="fixed inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white border border-gray-200 p-8 max-w-lg w-full shadow-sm">
                        <h3 className="text-2xl font-semibold tracking-tighter mb-6 border-b border-gray-200 pb-2 text-gray-900">Cear Pieza</h3>
                        <div className="space-y-4">
                            <div className="group">
                                <label className="text-[10px] font-semibold tracking-normal text-gray-900 mb-1 block group-focus-within:text-indigo-600 transition-colors">SKU</label>
                                <input
                                    placeholder="SKU-XXXX"
                                    className="w-full border border-gray-200 p-2 rounded-none focus:outline-none focus:border-indigo-500 bg-white text-gray-900 font-bold transition-colors"
                                    value={createForm.sku}
                                    onChange={e => handleCreateChange('sku', e.target.value)}
                                />
                            </div>
                            <div className="group">
                                <label className="text-[10px] font-semibold tracking-normal text-gray-900 mb-1 block group-focus-within:text-indigo-600 transition-colors">Nombre</label>
                                <input
                                    placeholder="Nombre de la Pieza"
                                    className="w-full border border-gray-200 p-2 rounded-none focus:outline-none focus:border-indigo-500 bg-white text-gray-900 font-bold transition-colors"
                                    value={createForm.name}
                                    onChange={e => handleCreateChange('name', e.target.value)}
                                />
                            </div>
                            <div className="group">
                                <label className="text-[10px] font-semibold tracking-normal text-gray-900 mb-1 block group-focus-within:text-indigo-600 transition-colors">Tipo</label>
                                <select
                                    className="w-full border border-gray-200 p-2 rounded-none focus:outline-none focus:border-indigo-500 bg-white text-gray-900 font-bold transition-colors"
                                    value={createForm.type}
                                    onChange={e => handleCreateChange('type', e.target.value)}
                                >
                                    <option value="tube">TUBE</option>
                                    <option value="connector">CONNECTOR</option>
                                    <option value="panel">PANEL</option>
                                    <option value="accessory">ACCESSORY</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="group">
                                    <label className="text-[10px] font-semibold tracking-normal text-gray-900 mb-1 block group-focus-within:text-indigo-600 transition-colors">Precio ARS</label>
                                    <input
                                        type="number" step="0.01" placeholder="ARS"
                                        className="w-full border border-gray-200 p-2 rounded-none focus:outline-none focus:border-indigo-500 bg-white text-gray-900 font-semibold disabled:opacity-30 disabled:border-gray-200/30 transition-colors"
                                        value={createForm.price_ars}
                                        onChange={e => handleCreateChange('price_ars', e.target.value)}
                                        disabled={!!createForm.price_usd}
                                    />
                                </div>
                                <div className="group">
                                    <label className="text-[10px] font-semibold tracking-normal text-gray-900 mb-1 block group-focus-within:text-indigo-600 transition-colors">Precio USD</label>
                                    <input
                                        type="number" step="0.01" placeholder="USD"
                                        className="w-full border border-gray-200 p-2 rounded-none focus:outline-none focus:border-indigo-500 bg-white text-gray-900 font-semibold disabled:opacity-30 disabled:border-gray-200/30 transition-colors"
                                        value={createForm.price_usd}
                                        onChange={e => handleCreateChange('price_usd', e.target.value)}
                                        disabled={!!createForm.price_ars}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-semibold tracking-normal text-gray-900 mb-1 block">Imagen</label>
                                {createForm.image_url ? (
                                    <div className="relative w-24 h-24 mb-2 group/img">
                                        <img src={createForm.image_url} alt="Preview" className="w-full h-full object-cover border border-gray-200" />
                                        <button onClick={() => handleCreateChange('image_url', '')} className="absolute -top-3 -right-3 bg-red-600 text-white rounded-none p-2 border border-gray-200 opacity-0 group-hover/img:opacity-100 transition-opacity transform hover:scale-110"><X size={14} strokeWidth={3} /></button>
                                    </div>
                                ) : (
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleImageUpload(e, false)}
                                        disabled={uploadingImage}
                                        className="w-full border border-gray-200 p-2 text-xs font-bold rounded-none file:mr-4 file:py-2 file:px-4 file:border-0 file:text-xs file:font-semibold file:file:bg-black file:text-white hover:file:bg-indigo-600 file:transition-colors file:cursor-pointer disabled:opacity-50"
                                    />
                                )}
                            </div>

                        </div>
                        <div className="flex justify-end gap-4 mt-8 pt-4 border-t border-gray-200">
                            <button onClick={() => setIsCreating(false)} className="px-6 py-3 text-xs font-semibold tracking-normal text-gray-900 border-2 border-transparent hover:border-gray-300 transition-colors">CANCELAR</button>
                            <button onClick={handleCreate} disabled={uploadingImage} className="px-6 py-3 bg-indigo-600 text-white text-xs font-semibold tracking-normal hover:bg-black transition-colors disabled:opacity-50 shadow-sm">CREAR PIEZA</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto bg-white border border-gray-200 shadow-sm">
                <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-black">
                        <tr>
                            <th className="px-6 py-4 text-left text-[10px] font-semibold text-white tracking-normal">IMG</th>
                            <th className="px-6 py-4 text-left text-[10px] font-semibold text-white tracking-normal">SKU</th>
                            <th className="px-6 py-4 text-left text-[10px] font-semibold text-white tracking-normal">NOMBRE</th>
                            <th className="px-6 py-4 text-left text-[10px] font-semibold text-white tracking-normal">TIPO</th>
                            <th className="px-6 py-4 text-right text-[10px] font-semibold text-white tracking-normal">ARS</th>
                            <th className="px-6 py-4 text-right text-[10px] font-semibold text-white tracking-normal">USD</th>
                            <th className="px-6 py-4 text-right text-[10px] font-semibold text-white tracking-normal w-24">ACT</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {parts.map((part) => {
                            const isEditing = editingId === part.id;
                            return (
                                <tr key={part.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-6 py-3 whitespace-nowrap">
                                        {isEditing ? (
                                            <div>
                                                {editForm.image_url ? (
                                                    <div className="relative w-12 h-12">
                                                        <img src={editForm.image_url} alt="Thumb" className="w-full h-full object-cover border border-gray-200 shadow-sm" />
                                                        <button onClick={() => handleChange('image_url', '')} className="absolute -top-1 -right-1 bg-red-600 text-white rounded-none p-1 border border-gray-200"><X size={10} strokeWidth={3} /></button>
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
                                                        <label htmlFor={`file-${part.id}`} className="cursor-pointer text-gray-900 hover:text-indigo-600 p-2 border border-gray-200 shadow-sm transition-colors"><ImageIcon size={16} strokeWidth={2} /></label>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            part.image_url
                                                ? <img src={part.image_url} alt={part.name} className="w-12 h-12 object-cover border border-gray-200 shadow-sm grayscale group-hover:grayscale-0 transition-all duration-300" />
                                                : <div className="w-12 h-12 bg-gray-50 border border-gray-200/20 flex flex-col items-center justify-center text-gray-900/20 text-[8px] font-semibold"><ImageIcon size={14} className="mb-1 opacity-50" /> N/A</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-3 whitespace-nowrap text-xs font-semibold text-gray-900">
                                        {isEditing ? <input value={editForm.sku || ''} onChange={(e) => handleChange('sku', e.target.value)} className="w-full border-b border-gray-200 focus:border-indigo-500 outline-none p-1 font-semibold bg-transparent" /> : part.sku}
                                    </td>
                                    <td className="px-6 py-3 whitespace-nowrap text-xs font-bold text-gray-900">
                                        {isEditing ? (
                                            <input
                                                value={editForm.name || ''}
                                                onChange={(e) => handleChange('name', e.target.value)}
                                                className="w-full border-b border-gray-200 focus:border-indigo-500 outline-none p-1 font-bold bg-transparent"
                                            />
                                        ) : part.name}
                                    </td>
                                    <td className="px-6 py-3 whitespace-nowrap text-xs text-gray-500 font-semibold tracking-normal">
                                        {isEditing ? (
                                            <select value={editForm.type || 'tube'} onChange={e => handleChange('type', e.target.value)} className="border-b border-gray-200 focus:border-indigo-500 outline-none p-1 font-semibold bg-white">
                                                <option value="tube">TUBE</option>
                                                <option value="connector">CONNECTOR</option>
                                                <option value="panel">PANEL</option>
                                                <option value="accessory">ACCESSORY</option>
                                            </select>
                                        ) : part.type}
                                    </td>
                                    <td className="px-6 py-3 whitespace-nowrap text-xs font-semibold text-right text-gray-900">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={editForm.price_ars ?? ''}
                                                onChange={(e) => handleChange('price_ars', e.target.value)}
                                                disabled={!!editForm.price_usd}
                                                className="w-24 border-b border-gray-200 focus:border-indigo-500 outline-none p-1 text-right disabled:opacity-30 disabled:border-gray-200/30 bg-transparent"
                                            />
                                        ) : part.price_ars ? `$${Number(part.price_ars).toLocaleString('es-AR')}` : '-'}
                                    </td>
                                    <td className="px-6 py-3 whitespace-nowrap text-xs font-semibold text-right text-gray-900">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={editForm.price_usd ?? ''}
                                                onChange={(e) => handleChange('price_usd', e.target.value)}
                                                disabled={!!editForm.price_ars}
                                                className="w-24 border-b border-gray-200 focus:border-indigo-500 outline-none p-1 text-right disabled:opacity-30 disabled:border-gray-200/30 bg-transparent"
                                            />
                                        ) : part.price_usd ? `U$S ${Number(part.price_usd).toFixed(2)}` : '-'}
                                    </td>
                                    <td className="px-6 py-3 whitespace-nowrap text-right align-middle">
                                        {isEditing ? (
                                            <div className="flex justify-end gap-2">
                                                <button onClick={handleSave} className="text-gray-900 hover:text-indigo-600 transition-colors p-2 border border-transparent hover:border-gray-300"><Save size={16} strokeWidth={2.5} /></button>
                                                <button onClick={handleCancel} className="text-gray-500 hover:text-red-600 transition-colors p-2 border border-transparent hover:border-gray-300"><X size={16} strokeWidth={2.5} /></button>
                                            </div>
                                        ) : (
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEdit(part)} className="text-gray-900 hover:text-indigo-600 hover:bg-gray-50 p-2 transition-colors border border-transparent hover:border-gray-300">
                                                    <Pencil size={14} strokeWidth={2.5} />
                                                </button>
                                                <button onClick={() => handleDelete(part.id)} className="text-gray-500 hover:text-red-600 hover:bg-red-50 p-2 transition-colors border border-transparent hover:border-red-600">
                                                    <Trash2 size={14} strokeWidth={2.5} />
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

