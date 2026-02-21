"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            router.push("/admin");
            router.refresh();
        }
    };

    return (
        <div className="w-full max-w-md p-10 bg-[#ebecdf] rounded-2xl shadow-2xl border border-[#354763]/10">
            <div className="flex flex-col items-center mb-10 gap-2">
                <img src="/brandbook/logo/logo-azul.svg" alt="Tubular" className="w-40 mb-2" />
                <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#354763]/30">Admin Dashboard</span>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-xs font-bold border border-red-100 italic">
                    {error}
                </div>
            )}
            <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest font-extrabold text-[#354763]/60 ml-1">Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-white border-2 border-transparent focus:border-[#aab799] outline-none p-4 rounded-xl shadow-sm transition-all text-[#354763] font-medium"
                        required
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest font-extrabold text-[#354763]/60 ml-1">Contraseña</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white border-2 border-transparent focus:border-[#aab799] outline-none p-4 rounded-xl shadow-sm transition-all text-[#354763] font-medium"
                        required
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#354763] hover:bg-[#2a394f] text-white py-4 rounded-xl font-bold shadow-lg shadow-[#354763]/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center"
                >
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        "INGRESAR"
                    )}
                </button>
            </form>
        </div>
    );
}
