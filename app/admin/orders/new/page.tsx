import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OrderForm } from "@/components/admin/OrderForm";

export default function NewOrderPage() {
    return (
        <div className="max-w-3xl space-y-6 pb-32">
            <header className="flex items-center gap-3">
                <Link href="/admin/orders" className="p-2 text-gray-400 hover:text-gray-900 hover:bg-white border border-gray-200 rounded-md transition-colors">
                    <ArrowLeft size={18} />
                </Link>
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Nuevo pedido</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Carga manual</p>
                </div>
            </header>

            <OrderForm mode="create" />
        </div>
    );
}
