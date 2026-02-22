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
        <div className="w-full bg-white border border-black p-8 lg:p-12 shadow-[8px_8px_0px_#000]">
            <div className="flex flex-col items-start mb-8 gap-0 border-b border-black pb-6">
                <h1 className="text-4xl font-black tracking-tighter uppercase relative group">
                    Tubular
                    <span className="absolute -bottom-1 left-0 w-full h-[2px] bg-blue-600 scale-x-100 transition-transform origin-left"></span>
                </h1>
                <span className="text-[10px] uppercase font-bold text-black/50 tracking-[0.3em] mt-3">Admin Access</span>
            </div>

            {error && (
                <div className="bg-black text-white p-4 mb-6 text-xs font-bold uppercase tracking-wider relative overflow-hidden">
                    <span className="relative z-10">{error}</span>
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-red-600"></div>
                </div>
            )}
            <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2 group">
                    <label className="block text-[10px] uppercase tracking-widest font-bold text-black transition-colors group-focus-within:text-blue-600">Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-white border border-black outline-none p-3 text-sm focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-none rounded-none placeholder:text-black/30"
                        placeholder="admin@tubular.com"
                        required
                    />
                </div>
                <div className="space-y-2 group">
                    <label className="block text-[10px] uppercase tracking-widest font-bold text-black transition-colors group-focus-within:text-blue-600">Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white border border-black outline-none p-3 text-sm focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-none rounded-none"
                        required
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-black text-white py-4 text-xs font-bold uppercase tracking-widest hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:hover:bg-black mt-8 flex items-center justify-center relative group"
                >
                    {loading ? (
                        <span className="animate-pulse">Loading...</span>
                    ) : (
                        <>
                            <span className="relative z-10 transition-transform group-hover:translate-x-2">Login</span>
                            <span className="absolute opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all font-serif italic text-blue-200 ml-[-4rem]">→</span>
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}
