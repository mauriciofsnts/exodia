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
  },
} as const;
