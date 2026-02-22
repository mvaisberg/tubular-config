import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-white text-black font-sans selection:bg-blue-600 selection:text-white p-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:32px_32px] opacity-10 blur-[1px]"></div>
            <div className="relative z-10 w-full max-w-sm">
                <LoginForm />
            </div>
        </div>
    );
}
