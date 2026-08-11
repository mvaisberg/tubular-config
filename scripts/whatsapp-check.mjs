#!/usr/bin/env node
/**
 * Chequeo de la integración de WhatsApp Cloud API + alta de la plantilla de reviews.
 *
 * Uso:
 *   node --env-file=.env.local scripts/whatsapp-check.mjs          → diagnóstico
 *   node --env-file=.env.local scripts/whatsapp-check.mjs --create-template
 *       → además da de alta la plantilla review_request en Meta (queda "pending"
 *         hasta que Meta la apruebe; suele tardar de minutos a horas)
 */
const token = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const waba = process.env.WHATSAPP_WABA_ID;

const missing = [
    ['WHATSAPP_ACCESS_TOKEN', token],
    ['WHATSAPP_PHONE_NUMBER_ID', phoneId],
    ['WHATSAPP_WABA_ID', waba],
].filter(([, v]) => !v).map(([k]) => k);

if (missing.length) {
    console.error('Faltan credenciales en .env.local:', missing.join(', '));
    process.exit(1);
}

const g = async (path, opts = {}) => {
    const res = await fetch(`https://graph.facebook.com/v21.0/${path}`, {
        ...opts,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    return res.json();
};

// 1. Número
const phone = await g(`${phoneId}?fields=display_phone_number,verified_name,code_verification_status,quality_rating,name_status`);
if (phone.error) {
    console.error('❌ Número: ', phone.error.message);
    process.exit(1);
}
console.log(`✅ Número: ${phone.display_phone_number} — "${phone.verified_name}"`);
console.log(`   verificación: ${phone.code_verification_status} | calidad: ${phone.quality_rating} | nombre: ${phone.name_status}`);

// 2. Plantillas
const tpls = await g(`${waba}/message_templates?fields=name,status,language,category&limit=50`);
if (tpls.error) {
    console.error('❌ Plantillas:', tpls.error.message);
    process.exit(1);
}
const list = tpls.data || [];
console.log(`\nPlantillas (${list.length}):`);
for (const t of list) console.log(`   ${t.name} [${t.language}] — ${t.status} (${t.category})`);

const hasReview = list.find(t => t.name === 'review_request' && t.language === 'es_AR');

// 3. Alta de review_request si falta
if (!hasReview && process.argv.includes('--create-template')) {
    console.log('\nCreando plantilla review_request…');
    const body = {
        name: 'review_request',
        language: 'es_AR',
        category: 'MARKETING',
        components: [
            {
                type: 'BODY',
                text: 'Hola {{1}}! 👋 Te escribimos de Tubular.\n\nHace unos días recibiste tu {{2}}. ¿Nos contás qué te pareció? Son 30 segundos y nos ayuda muchísimo.\n\nRespondé este mensaje y arrancamos 💙',
                example: { body_text: [['Martín', 'mueble']] },
            },
        ],
    };
    const created = await g(`${waba}/message_templates`, { method: 'POST', body: JSON.stringify(body) });
    if (created.error) console.error('❌ Alta falló:', created.error.message);
    else console.log('✅ Plantilla enviada a revisión de Meta:', JSON.stringify(created));
} else if (!hasReview) {
    console.log('\n⚠️ Falta la plantilla review_request (es_AR). Correr con --create-template para darla de alta.');
} else {
    console.log(`\n${hasReview.status === 'APPROVED' ? '✅' : '⏳'} review_request: ${hasReview.status}`);
}
