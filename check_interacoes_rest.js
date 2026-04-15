const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = envLocal.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

if (!urlMatch || !keyMatch) {
  console.log("Variáveis não encontradas");
  process.exit(1);
}

const SUPABASE_URL = urlMatch[1].trim().replace('\r', '');
const SUPABASE_KEY = keyMatch[1].trim().replace('\r', '');

async function check() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/crm_interacoes?select=content,created_at,role,contact_name,metadata&order=created_at.desc&limit=2`, {
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
    console.log(JSON.stringify(data, null, 2));
  } catch(e) {
    console.error(e);
  }
}

check();
