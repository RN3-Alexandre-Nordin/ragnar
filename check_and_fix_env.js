const fs = require('fs');

const SUPABASE_URL = "https://zmypzexefjbovuknjlid.supabase.co";
const header = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
const payload = "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpteXB6ZXhlZmpib3Z1a25qbGlkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTc2MTgxMywiZXhwIjoyMDc1MzM3ODEzfQ";
const signature = "3BUUfqfyEZDjOxcTAKaaJvgHqT_6fdxNZWkGiPY2m0g";

const SUPABASE_KEY = `${header}.${payload}.${signature}`;

console.log("Teste de chave:", SUPABASE_KEY);

async function check() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/crm_canais?select=id,provider_id&limit=2`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!res.ok) {
        console.log("Erro:", res.status, await res.text());
        return;
    }

    const data = await res.json();
    console.log("Chave válida! Retornou dados:");
    console.log(JSON.stringify(data, null, 2));
    
    // Reescrever o .env.local com a chave consertada
    let envLocal = fs.readFileSync('.env.local', 'utf8');
    envLocal = envLocal.replace(/SUPABASE_SERVICE_ROLE_KEY=.+/, `SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_KEY}`);
    fs.writeFileSync('.env.local', envLocal);
    console.log(".env.local corrigido com a chave correta.");
  } catch(e) {
    console.error(e);
  }
}

check();
