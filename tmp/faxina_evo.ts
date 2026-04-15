import { EvolutionApiService } from '../src/lib/omnichannel/services/EvolutionApiService';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Carregar .env.local explicitamente
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const instanceName = 'ragnar_sinai_srakjw';
const apiUrl = process.env.WHATSAPP_API_URL;
const apiKey = process.env.WHATSAPP_API_TOKEN;
const appUrl = process.env.RAGNAR_APP_URL || 'https://ragnar-crm.vercel.app';
const webhookUrl = `${appUrl}/api/webhooks/evolution`;

const settings = {
  reject_call: true,
  msg_call: "Este número só recebe mensagens de WhatsApp.",
  groups_ignore: true,
  always_online: true,
  read_messages: false,
  read_status: false
};

async function runFaxina() {
  console.log(`[Faxina] Iniciando limpeza da instância: ${instanceName}`);
  
  try {
    // 1. Deletar
    console.log(`[Faxina] Removendo instância antiga...`);
    await EvolutionApiService.logoutInstance(instanceName, apiUrl, apiKey);
    
    // Pequena pausa para garantir que o backend da Evo processou o delete
    await new Promise(r => setTimeout(r, 2000));

    // 2. Recriar
    console.log(`[Faxina] Recriando instância com syncFullHistory=false...`);
    await EvolutionApiService.createInstance(instanceName, apiUrl, apiKey);

    // 3. Configurar
    console.log(`[Faxina] Aplicando configurações de Ouro...`);
    await EvolutionApiService.setInstanceSettings(instanceName, settings, apiUrl, apiKey);

    // 4. Webhook
    console.log(`[Faxina] Registrando Webhook: ${webhookUrl}`);
    await EvolutionApiService.registerWebhook(instanceName, webhookUrl, apiUrl, apiKey);

    // 5. QR Code
    console.log(`[Faxina] Recuperando novo QR Code...`);
    const qrcode = await EvolutionApiService.getQRCode(instanceName, apiUrl, apiKey);
    
    if (qrcode) {
        console.log(`[Faxina] SUCESSO! QR Code gerado.`);
        console.log(`RESULT_QRCODE_START`);
        console.log(qrcode);
        console.log(`RESULT_QRCODE_END`);
    } else {
        console.error(`[Faxina] Falha ao recuperar QR Code final.`);
    }

  } catch (e) {
    console.error(`[Faxina] ERRO CRÍTICO:`, e);
  }
}

runFaxina();
