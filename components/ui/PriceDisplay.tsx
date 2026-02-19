"use client";

import { useConfigStore } from '@/lib/store';
import { useMemo } from 'react';

export const PriceDisplay = () => {
    const modules = useConfigStore((state) => state.modules);
    const totalPrice = useConfigStore((state) => state.totalPrice);

    // We can also show breakdown if needed

    return (
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-lg border border-gray-100 w-64">
            <h3 className="text-lg font-bold mb-2">Configuration</h3>
            <div className="flex justify-between items-center mb-1">
                <span className="text-gray-600">Modules:</span>
                <span className="font-mono">{modules.length}</span>
            </div>
            <div className="border-t border-gray-200 my-2 pt-2 flex justify-between items-center">
                <span className="font-semibold">Total Price:</span>
                <span className="text-xl font-bold text-blue-600">${totalPrice.toFixed(2)}</span>
            </div>
        </div>
    );
};
