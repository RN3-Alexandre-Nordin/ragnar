import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

const nomesBrasileiros = [
  "Rafael Silva", "Camila Oliveira", "Bruno Santos", "Amanda Costa", "Thiago Moura", "Juliana Pereira",
  "Rodrigo Alves", "Fernanda Lima", "Marcelo Gomes", "Patrícia Ribeiro", "Lucas Carvalho", "Carolina Rocha",
  "Gabriel Martins", "Mariana Barbosa", "Felipe Moraes", "Aline Castro", "Eduardo Fernandes", "Beatriz Nogueira",
  "Gustavo Pinto", "Renata Dias", "Leonardo Cardoso", "Vanessa Teixeira", "Diego Cavalcante", "Letícia Mendes",
  "Guilherme Correia", "Natália Nunes", "Ricardo Farias", "Priscila Vieira", "Wagner Batista", "Luana Freitas",
  "André Monteiro", "Thaís Ramos", "Douglas Castro", "Bruna Duarte", "Leandro Machado", "Isabela Lima",
  "Alexandre Silva", "Marina Azevedo", "Victor Santos", "Sabrina Costa", "Henrique Oliveira", "Mônica Pereira",
  "Renato Alves", "Tatiana Lima", "Caio Gomes", "Viviane Ribeiro", "Marcos Carvalho", "Larissa Rocha",
  "Daniel Martins", "Bianca Barbosa"
]

const empresasReais = [
  "Tech Solutions Ltda", "Logística Express", "Mercado Central", "Construtora Horizonte", "Comercial Alfa",
  "Agropecuária Sul", "Distribuidora Master", "Clínica Vida", "Educa Mais", "Varejo Vencer", "Indústria Padrão",
  "Autopeças Silva", "Farmácia Saúde", "Supermercado Compre Bem", "Restaurante Sabor"
]

const telefones = () => `(11) 9${Math.floor(8000 + Math.random() * 1999)}-${Math.floor(1000 + Math.random() * 8999)}`

async function main() {
  console.log("Iniciando Mássivo de Dados do CRM...")

  // 1. Pegar a Empresa "Monte Sinai"
  const { data: empresa } = await supabase
    .from('empresas')
    .select('id')
    .ilike('nome', '%Monte Sinai%')
    .single()

  if (!empresa) {
     console.error("Empresa Monte Sinai não encontrada!")
     return
  }
  const empresaId = empresa.id
  console.log("✅ Empresa Puxada: ", empresaId)

  // 2. Limpar dados antigos
  console.log("🧹 Limpando dados antigos (Canais, Leads, Cards)...")
  await supabase.from('crm_cards_history').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('crm_cards').delete().eq('empresa_id', empresaId)
  await supabase.from('crm_leads').delete().eq('empresa_id', empresaId)
  await supabase.from('crm_canais').delete().eq('empresa_id', empresaId)

  // 3. Criar Canal Único: WhatsApp
  console.log("📦 Criando Canal WhatsApp...")
  const { data: canal } = await supabase.from('crm_canais').insert({
    nome: "WhatsApp",
    tipo: "Outros",
    empresa_id: empresaId
  }).select().single()

  // 4. Buscar Usuário (Vendedor ou Admin do Monte Sinai)
  const { data: usuario } = await supabase.from('usuarios').select('id, auth_user_id').eq('empresa_id', empresaId).limit(1).single()

  // 5. Buscar Funis (Pipelines) e Estágios (Stages) disponíveis para a empresa
  const { data: pipelines } = await supabase
    .from('pipelines')
    .select('*, pipeline_stages(*)')
    .eq('empresa_id', empresaId)

  if (!pipelines || pipelines.length === 0) {
     console.error("❌ Nenhum Pipeline (Funil) encontrado para criar os cards. Crie um antes.")
     return
  }

  // Coletar todos os estágios válidos planificados
  let allStages: any[] = []
  pipelines.forEach(p => {
    p.pipeline_stages.forEach((s: any) => {
       allStages.push({ pipelineId: p.id, stageId: s.id, stageName: s.nome })
    })
  })

  // 6. Gerar 50 Leads
  console.log("🧑‍💼 Gerando 50 Leads Dinâmicos...")
  let leadsData = nomesBrasileiros.map((nome, i) => {
     let tel = telefones()
     return {
        empresa_id: empresaId,
        canal_id: canal?.id || null,
        nome: nome,
        email: `${nome.toLowerCase().split(' ').join('.')}@gmail.com`,
        whatsapp: tel,
        telefone: tel,
        cargo: i % 3 === 0 ? "Diretor" : i % 2 === 0 ? "Comprador" : "Analista",
        empresa_cliente: empresasReais[Math.floor(Math.random() * empresasReais.length)]
     }
  })

  const { data: insertedLeads, error: leadsErr } = await supabase.from('crm_leads').insert(leadsData).select()
  if (leadsErr) {
     console.error("Erro inserindo leads!", leadsErr)
     return
  }

  // 7. Gerar Cards Distribuídos
  console.log("🗂️ Gerando e Distribuindo Cards para cada Lead nos pipelines...")
  let i = 0
  const cardsToInsert = insertedLeads!.map(lead => {
     // Pick a deterministic/random stage
     const stageObj = allStages[i % allStages.length]
     i++
     return {
        empresa_id: empresaId,
        pipeline_id: stageObj.pipelineId,
        stage_id: stageObj.stageId,
        lead_id: lead.id,
        titulo: `Negociação ${lead.nome.split(' ')[0]}`,
        descricao: `Contato iniciado pelo canal Oficial, busca de compras atacadistas de volume T=${Math.floor(Math.random() * 100)}.`,
        cliente_nome: lead.nome,
        valor: Math.floor(Math.random() * 50000) + 1500
     }
  })

  const { data: insertedCards, error: cardsErr } = await supabase.from('crm_cards').insert(cardsToInsert).select()
  if (cardsErr) {
    console.error("Erro inserindo cards!", cardsErr)
    return
  }

  // 8. Opcional: Gerar Histórico "Criado" para testar
  console.log("⏱️ Gerando auditoria passiva...")
  if (usuario && insertedCards) {
     const historyBase = insertedCards.map(c => ({
        card_id: c.id,
        usuario_id: usuario.auth_user_id || usuario.id,
        acao: 'STATUS_CHANGED',
        de_stage_id: c.stage_id,
        para_stage_id: c.stage_id,
        de_pipeline_id: c.pipeline_id,
        para_pipeline_id: c.pipeline_id,
        observacao: `Card recém criado via migração importada.`
     }))
     await supabase.from('crm_cards_history').insert(historyBase)
  }

  console.log("🚀 DEMO SEED CONCLUIDO COM SUCESSO! 50 LEADS!")
}

main()
