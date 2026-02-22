export default function AdminDashboard() {
    return (
        <div className="max-w-5xl">
            <header className="mb-12 border-b border-black pb-4">
                <h1 className="text-4xl font-black tracking-tight uppercase">Dashboard</h1>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 border border-black group hover:bg-black hover:text-white transition-colors cursor-default relative overflow-hidden">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-black/60 group-hover:text-white/60 relative z-10">Total Orders</h3>
                    <p className="text-5xl font-black mt-4 relative z-10 transition-transform group-hover:translate-x-2 delay-75">0</p>
                    <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out z-0 opacity-0 group-hover:opacity-100 mix-blend-multiply"></div>
                </div>
                <div className="bg-white p-6 border border-black group hover:bg-black hover:text-white transition-colors cursor-default relative overflow-hidden">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-black/60 group-hover:text-white/60 relative z-10">Revenue</h3>
                    <p className="text-5xl font-black mt-4 relative z-10 transition-transform group-hover:translate-x-2 delay-75">$0</p>
                    <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out z-0 opacity-0 group-hover:opacity-100 mix-blend-multiply"></div>
                </div>
                <div className="bg-white p-6 border border-black group hover:bg-black hover:text-white transition-colors cursor-default relative overflow-hidden">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-black/60 group-hover:text-white/60 relative z-10">Active Parts</h3>
                    <p className="text-5xl font-black mt-4 relative z-10 transition-transform group-hover:translate-x-2 delay-75">--</p>
                    <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out z-0 opacity-0 group-hover:opacity-100 mix-blend-multiply"></div>
                </div>
            </div>
        </div>
    );
}
