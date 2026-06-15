export const ptBR = {
  errors: {
    guildOnly: "Esse comando só funciona em servidores.",
    notInVoice: "Você precisa estar em um canal de voz.",
    noResults: "Nenhum resultado encontrado.",
    generic: "Ocorreu um erro ao executar esse comando.",
    noPermission: "Você não tem permissão para usar esse comando.",
    cooldown: "⏳ Espere {seconds}s antes de usar esse comando de novo.",
    dbRequired: "Esse comando precisa do banco de dados habilitado.",
  },
  music: {
    searching: "Procurando...",
    addedToQueue: "▶️ Adicionado à fila: **{title}**",
    skipped: "⏭️ Música pulada.",
    stopped: "⏹️ Música parada e fila limpa.",
    nothingPlaying: "Nenhuma música tocando no momento.",
    nowPlaying: "▶️ **Tocando:** {title} — pedido por {requestedBy}",
    trackError: "⚠️ Não consegui tocar **{title}**, pulando para a próxima.",
    queueEntry: "{position}. {title} — {requestedBy}",
    emptyQueue: "*Fila vazia*",
    mostPlayedHeader: "🔥 **Top {count} mais tocadas** — adicionadas à fila:",
    mostPlayedEntry: "{position}. {title} — {plays} plays",
    noHistory: "Sem histórico de reprodução ainda — toque algumas músicas primeiro.",
    voteHint: "Reaja 👍 👎 ⭐ pra votar — influencia o ranking do /mostplayed.",
  },
  commands: {
    ping: {
      response: "Pong! Latência: **{latency}ms**",
    },
    setlang: {
      success: "✅ Idioma do servidor definido para **{lang}**.",
      noPermission: "Você precisa da permissão **Gerenciar Servidor** para usar esse comando.",
    },
    password: {
      sentToDm: "🔐 Te mandei uma senha nova no privado.",
      dmFailed: "❌ Não consegui te mandar DM — abra suas mensagens diretas e tente de novo.",
      dmContent:
        "🔐 Sua nova senha (esta mensagem se autodestrói em {seconds}s):\n||`{password}`||",
    },
    help: {
      title: "📖 Comandos",
      hint: "Use `{prefix}help <comando>` para ver detalhes de um comando específico.",
      notFound: "Comando `{command}` não encontrado. Use `{prefix}help` para listar.",
      usage: "Uso",
      options: "Opções",
      noOptions: "Sem opções.",
      required: "obrigatório",
      optional: "opcional",
    },
    config: {
      title: "⚙️ Configuração do servidor",
      current: "Prefixo: `{prefix}`\nIdioma: `{lang}`",
      help: "Altere com `{prefix}config prefix <valor>` ou `{prefix}config lang <en-US|pt-BR>`.",
      prefixSet: "✅ Prefixo definido para `{prefix}`.",
      langSet: "✅ Idioma definido para `{lang}`.",
      invalidPrefix: "❌ O prefixo deve ter 1–5 caracteres sem espaços.",
      invalidLang: "❌ Idioma desconhecido. Opções: {langs}.",
      needValue: "❌ Informe um valor, ex.: `{prefix}config {action} <valor>`.",
      resumeReady: "✅ Configuração continuada em {channel}.",
      resumeHere: "✅ Vamos configurar aqui mesmo.",
    },
  },
  onboarding: {
    welcome: "👋 Obrigado por me adicionar em {guild}!",
    guide:
      "Defina meu prefixo com `{prefix}config prefix <valor>` e o idioma com `{prefix}config lang <en-US|pt-BR>`. Prefixo atual: `{prefix}`.",
    cantCreateChannel:
      "Não consegui criar um canal de configuração — preciso da permissão **Gerenciar Canais**. Crie um canal de texto e rode `{prefix}config resume` para concluir a configuração.",
  },
} as const;
