const fetch = globalThis.fetch;
const instanceName = 'ragnar_sinai_srakjw';

const apiUrl = process.env.WHATSAPP_API_URL;
const apiKey = process.env.WHATSAPP_API_TOKEN;
const appUrl = process.env.RAGNAR_APP_URL || 'https://ragnar-crm.vercel.app';
const webhookUrl = `${appUrl}/api/webhooks/evolution`;

async function callEvo(endpoint, method, body = null) {
    const headers = { 
        'Content-Type': 'application/json',
        'apikey': apiKey
    };
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    
    const response = await fetch(`${apiUrl}${endpoint}`, options);
    const data = await response.json();
    if (!response.ok) {
        const err = new Error(`Erro em ${endpoint} (${method}): ${JSON.stringify(data)}`);
        err.data = data;
        throw err;
    }
    return data;
}

// Mapeando para camelCase (padrão v2 da Evolution)
const settings = {
  rejectCall: true,
  msgCall: "Este número só recebe mensagens de WhatsApp.",
  groupsIgnore: true,
  alwaysOnline: true,
  readMessages: false,
  readStatus: false,
  syncFullHistory: false
};

async function runFaxina() {
  console.log(`[Faxina] Iniciando limpeza refinada: ${instanceName}`);
  
  try {
    // 1. Logout/Delete
    console.log(`[1/5] Removendo instância antiga...`);
    try { await callEvo(`/instance/logout/${instanceName}`, 'DELETE'); } catch(e) {}
    try { await callEvo(`/instance/delete/${instanceName}`, 'DELETE'); } catch(e) {}
    
    await new Promise(r => setTimeout(r, 2000));

    // 2. Recriar
    console.log(`[2/5] Recriando instância (syncFullHistory: false)...`);
    await callEvo(`/instance/create`, 'POST', {
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        syncFullHistory: false
    });

    // 3. Configurar Settings
    console.log(`[3/5] Aplicando configurações de Ouro...`);
    await callEvo(`/settings/set/${instanceName}`, 'POST', settings);

    // 4. Webhook
    console.log(`[4/5] Registrando Webhook: ${webhookUrl}`);
    await callEvo(`/webhook/set/${instanceName}`, 'POST', {
        webhook: {
            url: webhookUrl,
            enabled: true,
            events: ["CONNECTION_UPDATE", "MESSAGES_UPSERT"]
        }
    });

    // 5. QR Code
    console.log(`[5/5] Recuperando QR Code...`);
    const connectData = await callEvo(`/instance/connect/${instanceName}`, 'GET');
    
    if (connectData && connectData.base64) {
        console.log(`[Faxina] SUCESSO!`);
        console.log(`RESULT_QRCODE_START`);
        console.log(connectData.base64);
        console.log(`RESULT_QRCODE_END`);
    } else {
        console.error(`[Faxina] QR Code não retornado.`);
    }

  } catch (e) {
    console.error(`[Faxina] FALHA NO PASSO:`, e.message);
  }
}

runFaxina();
