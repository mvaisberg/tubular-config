"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useConfigStore } from "@/lib/store";

export function DataLoader() {
    const searchParams = useSearchParams();
    const quoteId = searchParams.get("quote");
    const supabase = createClient();
    const setModules = useConfigStore((state) => state.actions.setModules); // Let's check if we have setModules in store

    useEffect(() => {
        const loadQuoteData = async () => {
            if (!quoteId) return;

            // Try quotes table first
            let { data, error } = await supabase
                .from("quotes")
                .select("configuration")
                .eq("id", quoteId)
                .single();

            // If not found, try preconfigured_products
            if (!data) {
                const { data: prodData } = await supabase
                    .from("preconfigured_products")
                    .select("configuration")
                    .eq("id", quoteId)
                    .single();
                data = prodData;
            }

            if (data && data.configuration) {
                if (Array.isArray(data.configuration)) {
                    setModules(data.configuration);
                } else if (data.configuration.modules) {
                    setModules(data.configuration.modules);
                }
            }
        };

        loadQuoteData();
    }, [quoteId, supabase, setModules]);

    return null;
}
