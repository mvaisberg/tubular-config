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

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            router.push("/admin");
            router.refresh();
        }
    };

    return (
        <div className="w-full bg-white border border-gray-200 rounded-lg shadow-sm p-8">
            <div className="mb-7">
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Tubular</h1>
                <p className="text-sm text-gray-500 mt-1">Admin access</p>
            </div>

            {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-md p-3 mb-5">
                    {error}
                </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-gray-400 transition-colors"
                        placeholder="admin@tubular.com"
                        required
                        autoFocus
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Contraseña</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                        required
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-indigo-600 text-white py-2.5 text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 mt-2"
                >
                    {loading ? "Entrando…" : "Iniciar sesión"}
                </button>
            </form>
        </div>
    );
}
