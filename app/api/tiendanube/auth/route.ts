import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
        return new NextResponse("Falta el código de autorización.", { status: 400 });
    }

    const clientId = process.env.TIENDANUBE_CLIENT_ID || "26630";
    const clientSecret = process.env.TIENDANUBE_CLIENT_SECRET || "a092b1871e879b30f267c7373903e547cfb13eed8744f832";

    try {
        const tokenRes = await fetch("https://www.tiendanube.com/apps/authorize/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "Tubular (info@tubular.com.ar)"
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: "authorization_code",
                code
            }).toString()
        });

        if (!tokenRes.ok) {
            const errorText = await tokenRes.text();
            console.error("Error obteniendo token:", errorText);
            return new NextResponse(`Error al autenticar: ${errorText}`, { status: 500 });
        }

        const data = await tokenRes.json();

        const htmlResponse = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Credenciales Tiendanube</title>
                <style>
                    body { font-family: system-ui, -apple-system, sans-serif; background-color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .card { background: white; padding: 2.5rem; border-radius: 1.5rem; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1); max-width: 500px; width: 100%; border: 1px solid #e2e8f0; }
                    h1 { color: #0f172a; margin-top: 0; font-weight: 900; letter-spacing: -0.025em; }
                    p { color: #475569; margin-bottom: 2rem; line-height: 1.5; }
                    .field { margin-bottom: 1.25rem; }
                    label { display: block; font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.1em; }
                    input { width: 100%; padding: 0.875rem; border: 2px solid #e2e8f0; border-radius: 0.75rem; background: #f8fafc; color: #0f172a; font-family: Menlo, Monaco, Consolas, monospace; font-size: 0.875rem; box-sizing: border-box; outline: none; transition: border-color 0.2s; }
                    input:focus { border-color: #3b82f6; }
                    .info { margin-top: 2rem; padding: 1.25rem; background: #eff6ff; border-radius: 1rem; border: 1px solid #bfdbfe; color: #1e3a8a; font-size: 0.875rem; line-height: 1.5; }
                    .success { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: #dcfce7; color: #166534; border-radius: 9999px; font-size: 0.75rem; font-weight: 800; margin-bottom: 1.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
                    code { background: #dbeafe; padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-weight: 600; }
                </style>
            </head>
            <body>
                <div class="card">
                    <span class="success">✓ Autenticación Exitosa</span>
                    <h1>Credenciales Listas</h1>
                    <p>Copiá estos valores (Store ID y Access Token) y dejalos en Vercel como en el <code>.env.local</code> para habilitar la sincronización de carritos.</p>
                    
                    <div class="field">
                        <label>TIENDANUBE_STORE_ID</label>
                        <input type="text" readonly value="${data.user_id}" onclick="this.select()">
                    </div>
                    
                    <div class="field">
                        <label>TIENDANUBE_ACCESS_TOKEN</label>
                        <input type="text" readonly value="${data.access_token}" onclick="this.select()">
                    </div>
                    
                    <div class="info">
                        <strong>¿Qué hago con esto?</strong><br><br>
                        1. Andá a <strong>Vercel</strong> > Settings > Environment Variables y pegalos ahí.<br>
                        2. Agregalos también a tu archivo local en la compu.<br>
                        3. ¡Listo! El botón de "Comprar" generará ahora un producto y un carrito directo.
                    </div>
                </div>
            </body>
            </html>
        `;

        return new NextResponse(htmlResponse, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });

    } catch (error: any) {
        console.error("Error exception:", error);
        return new NextResponse(`Error interno del servidor: ${error.message || 'Unknown'}`, { status: 500 });
    }
}
