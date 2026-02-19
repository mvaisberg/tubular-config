import { useConfigStore } from '@/lib/store';
import { ModuleConfig } from '@/lib/types';
import { Plus, Trash2, RotateCcw } from 'lucide-react'; // Using Lucide icons if available

export const Toolbar = () => {
    const selectedModuleId = useConfigStore((state) => state.selectedModuleId);
    const modules = useConfigStore((state) => state.modules);
    const addModule = useConfigStore((state) => state.actions.addModule);
    const removeModule = useConfigStore((state) => state.actions.removeModule);
    const reset = useConfigStore((state) => state.actions.reset);

    const handleAdd = (direction: 'right' | 'left' | 'top' | 'bottom' | 'front' | 'back') => {
        const selected = modules.find(m => m.id === selectedModuleId);
        if (!selected) {
            // If nothing selected, maybe add at 0,0,0 if empty?
            if (modules.length === 0) {
                addModule({
                    id: crypto.randomUUID(),
                    position: { x: 0, y: 0, z: 0 },
                    size: { w: 750, h: 350, d: 350 },
                    color: 'white',
                    hasPanel: { top: true, bottom: true, left: true, right: true, front: false, back: true }
                });
            }
            return;
        }

        const { x, y, z } = selected.position;
        const { w, h, d } = selected.size;

        let newPos = { x, y, z };

        // Default new module size same as selected? Or standard 750x350x350?
        // Let's copy selected size for continuity
        const newSize = { ...selected.size };

        switch (direction) {
            case 'right': newPos.x += w; break;
            case 'left': newPos.x -= w; break; // Wait, if left, we subtract NEW width? Assuming same width.
            case 'top': newPos.y += h; break;
            case 'bottom': newPos.y -= h; break;
            case 'front': newPos.z += d; break;
            case 'back': newPos.z -= d; break;
        }

        // Check collision?
        const exists = modules.some(m =>
            m.position.x === newPos.x &&
            m.position.y === newPos.y &&
            m.position.z === newPos.z
        );

        if (exists) {
            alert("Space occupied!");
            return;
        }

        addModule({
            id: crypto.randomUUID(),
            position: newPos,
            size: newSize,
            color: selected.color,
            hasPanel: { ...selected.hasPanel } // Copy panels config
        });
    };

    return (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm p-4 rounded-full shadow-lg border border-gray-100 flex gap-4 items-center">
            {modules.length === 0 && (
                <button onClick={() => handleAdd('right')} className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 font-medium">
                    Start Configuration
                </button>
            )}

            {selectedModuleId && (
                <>
                    <div className="flex gap-2 border-r border-gray-200 pr-4">
                        <button onClick={() => handleAdd('left')} className="p-2 hover:bg-gray-100 rounded-full" title="Add Left">←</button>
                        <button onClick={() => handleAdd('right')} className="p-2 hover:bg-gray-100 rounded-full" title="Add Right">→</button>
                        <button onClick={() => handleAdd('top')} className="p-2 hover:bg-gray-100 rounded-full" title="Add Top">↑</button>
                        <button onClick={() => handleAdd('bottom')} className="p-2 hover:bg-gray-100 rounded-full" title="Add Bottom">↓</button>
                        <button onClick={() => handleAdd('front')} className="p-2 hover:bg-gray-100 rounded-full" title="Add Front">↗</button>
                        <button onClick={() => handleAdd('back')} className="p-2 hover:bg-gray-100 rounded-full" title="Add Back">↙</button>
                    </div>
                    <button
                        onClick={() => removeModule(selectedModuleId)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-full"
                        title="Delete Selected"
                    >
                        <Trash2 size={20} />
                    </button>
                </>
            )}

            <button
                onClick={reset}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-full ml-2"
                title="Reset All"
            >
                <RotateCcw size={20} />
            </button>
        </div>
    );
};
