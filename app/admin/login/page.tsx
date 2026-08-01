import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50 text-gray-900 font-sans antialiased p-4">
            <div className="w-full max-w-sm">
                <LoginForm />
            </div>
        </div>
    );
}
