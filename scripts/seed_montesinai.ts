import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function seed() {
  console.log('Iniciando Seeder: Monte Sinai Atacadista...')

  // 1. Criar Empresa
  const { data: empresa, error: errEmp } = await supabase.from('empresas').insert([{
    nome: 'Monte Sinai Atacado',
    cnpj: '45.982.113/0001-77',
    endereco: 'Avenida das Nações Unidas, 14.221 - Edifício Tower A, 12º Andar, Vila Gertrudes, São Paulo - SP',
    telefone: '(11) 98774-2201',
    email: 'comercial@montesinaiatacado.com.br'
  }]).select('*').single()

  if (errEmp) { console.error('Erro empresa:', errEmp); return; }
  console.log('Empresa Criada:', empresa.id)

  // 2. Departamentos
  const { data: deptos, error: errDep } = await supabase.from('departamentos').insert([
    { empresa_id: empresa.id, nome: 'Vendas Externas', descricao: 'Equipe de campo e atacado' },
    { empresa_id: empresa.id, nome: 'Logística/Expedição', descricao: 'Armazém e distribuição' },
    { empresa_id: empresa.id, nome: 'Financeiro/Cobrança', descricao: 'Contas, Faturamento e Inadimplência' }
  ]).select('*')
  
  const dVendas = deptos?.find(d => d.nome === 'Vendas Externas')
  const dLog = deptos?.find(d => d.nome === 'Logística/Expedição')
  const dFin = deptos?.find(d => d.nome === 'Financeiro/Cobrança')

  // 3. Grupos Acesso
  const { data: grupos } = await supabase.from('grupos_acesso').insert([
    { empresa_id: empresa.id, nome: 'Global Adm', descricao: 'Full Access Monte Sinai' },
    { empresa_id: empresa.id, nome: 'Grupo Vendas', descricao: 'Vendedores' },
    { empresa_id: empresa.id, nome: 'Grupo Logística', descricao: 'Operadores' },
    { empresa_id: empresa.id, nome: 'Grupo Financeiro', descricao: 'Analistas' }
  ]).select('*')

  const gAdm = grupos?.find(g => g.nome === 'Global Adm')
  const gVendas = grupos?.find(g => g.nome === 'Grupo Vendas')
  const gLog = grupos?.find(g => g.nome === 'Grupo Logística')
  const gFin = grupos?.find(g => g.nome === 'Grupo Financeiro')

  // 4. Auth Users
  const usersToCreate = [
    { email: 'admin@montesinaiatacado.com.br', pass: 'ragnar1234', nome: 'Admin Monte Sinai', grupo_id: gAdm?.id, role: 'admin' },
    { email: 'vendedor@montesinaiatacado.com.br', pass: 'ragnar1234', nome: 'Vendedor Externo', grupo_id: gVendas?.id, role: 'operador' },
    { email: 'logistica@montesinaiatacado.com.br', pass: 'ragnar1234', nome: 'Operador Logístico', grupo_id: gLog?.id, role: 'operador' },
    { email: 'financeiro@montesinaiatacado.com.br', pass: 'ragnar1234', nome: 'Analista Financeiro', grupo_id: gFin?.id, role: 'operador' },
  ]

  for (const u of usersToCreate) {
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
       email: u.email, password: u.pass, email_confirm: true
    })
    if (authErr && !authErr.message.includes('already exists')) {
       console.error('Erro Auth:', authErr)
       continue;
    }
    const userId = authData?.user?.id
    if (userId) {
       await supabase.from('usuarios').insert([{
          id: userId,
          auth_user_id: userId,
          empresa_id: empresa.id,
          nome_completo: u.nome,
          email: u.email,
          grupo_id: u.grupo_id,
          role_global: u.role
       }])
       console.log(`Criou Usuário ${u.nome}`)
    }
  }

  // 5. Funis
  const pipelinesToCreate = [
    { nome: 'Vendas Externas', descricao: 'Prospecção e Pedidos', depto_id: dVendas?.id,
      grupos: [gAdm?.id, gVendas?.id],
      stages: [
         { nome: 'Prospecção', cor: '#9333EA', ordem: 0 },
         { nome: 'Aprovação', cor: '#2BAADF', ordem: 1 },
         { nome: 'Não Aprovados', cor: '#EF4444', ordem: 2 },
         { nome: 'Aprovados', cor: '#80B828', ordem: 3 },
         { nome: 'Pedidos', cor: '#F97316', ordem: 4 }
      ],
      leads: 10
    },
    { nome: 'Logística/Expedição', descricao: 'Armazém e Roteirização', depto_id: dLog?.id,
      grupos: [gAdm?.id, gVendas?.id, gLog?.id], // vendedores também podem ver a logística!
      stages: [
         { nome: 'Separação', cor: '#F59E0B', ordem: 0 },
         { nome: 'Entrega', cor: '#10B981', ordem: 1 }
      ],
      leads: 5
    },
    { nome: 'Financeiro/Cobrança', descricao: 'Faturamento', depto_id: dFin?.id,
      grupos: [gAdm?.id, gFin?.id], // restrito ao financeiro e admin
      stages: [
         { nome: 'Faturamento', cor: '#3B82F6', ordem: 0 },
         { nome: 'Inadimplência', cor: '#EF4444', ordem: 1 }
      ],
      leads: 5
    }
  ]

  for (const p of pipelinesToCreate) {
     const { data: resPipe, error: pipeErr } = await supabase.from('pipelines').insert([{
         empresa_id: empresa.id,
         nome: p.nome,
         descricao: p.descricao,
         is_public: false,
         departamento_id: p.depto_id
     }]).select('*').single()

     if (pipeErr) throw pipeErr;

     // Global pipeline permissions
     for (const gid of p.grupos) {
         if (gid) await supabase.from('pipeline_grupo_acesso').insert([{ pipeline_id: resPipe.id, grupo_id: gid }])
     }

     const st_ids: string[] = []
     for (const st of p.stages) {
        const { data: resSt } = await supabase.from('pipeline_stages').insert([{
           pipeline_id: resPipe.id,
           nome: st.nome,
           cor: st.cor,
           ordem: st.ordem
        }]).select('*').single()
        
        if (resSt) {
           st_ids.push(resSt.id)
           for (const gid of p.grupos) {
              if (gid) await supabase.from('pipeline_stage_grupo_acesso').insert([{ stage_id: resSt.id, grupo_id: gid }])
           }
        }
     }

     // Inject Leads (Cards)
     console.log(`Gerando ${p.leads} cards para Funil ${p.nome}`)
     for (let i = 0; i < p.leads; i++) {
        // distribuindo aleatorio pelos stages
        const randomStage = st_ids[Math.floor(Math.random() * st_ids.length)]
        await supabase.from('crm_cards').insert([{
           empresa_id: empresa.id,
           pipeline_id: resPipe.id,
           stage_id: randomStage,
           titulo: `Pedido de Compra #${Math.floor(Math.random()*9000)+1000}`,
           cliente_nome: `Cliente/Fornecedor VIP ${i+1}`,
           valor: Math.random() * 50000,
           descricao: 'Gerado automaticamente via seeder para teste.'
        }])
     }
  }

  console.log('Seeder Monte Sinai Concluído com Sucesso!')
}

seed()
