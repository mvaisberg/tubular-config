"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useConfigStore } from "@/lib/store";

export function DataLoader() {
    const searchParams = useSearchParams();
    const quoteId = searchParams.get("quote");
    const configParam = searchParams.get("config");
    const supabase = createClient();
    const setModules = useConfigStore((state) => state.actions.setModules);

    useEffect(() => {
        // Load from inline base64-encoded config (used by admin order links).
        if (configParam) {
            try {
                const json = JSON.parse(atob(configParam));
                const modules = Array.isArray(json) ? json : json.modules || json.configuration;
                if (Array.isArray(modules)) {
                    setModules(modules);
                }
            } catch (e) {
                console.error("Failed to parse config param:", e);
            }
            return;
        }

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
    }, [quoteId, configParam, supabase, setModules]);

    return null;
}
