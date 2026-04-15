const fetch = globalThis.fetch;
const instanceName = 'teste_ve5o9';

const apiUrl = process.env.WHATSAPP_API_URL;
const apiKey = process.env.WHATSAPP_API_TOKEN;

async function callEvo(endpoint, method, body = null) {
    const headers = { 
        'Content-Type': 'application/json',
        'apikey': apiKey
    };
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    
    const response = await fetch(`${apiUrl}${endpoint}`, options);
    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data));
    return data;
}

const settings = {
  rejectCall: true,
  msgCall: "Este número só recebe mensagens de WhatsApp.",
  groupsIgnore: true,
  alwaysOnline: true,
  readMessages: false,
  readStatus: false,
  syncFullHistory: false
};

async function fixInstance() {
  console.log(`[Fix] Aplicando configurações de Ouro na instância: ${instanceName}`);
  try {
    await callEvo(`/settings/set/${instanceName}`, 'POST', settings);
    console.log(`[Fix] SUCESSO! Configurações aplicadas.`);
  } catch (e) {
    console.error(`[Fix] ERRO:`, e.message);
  }
}

fixInstance();
