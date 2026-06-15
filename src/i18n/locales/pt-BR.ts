export const ptBR = {
  errors: {
    guildOnly: "Esse comando só funciona em servidores.",
    notInVoice: "Você precisa estar em um canal de voz.",
    noResults: "Nenhum resultado encontrado.",
    generic: "Ocorreu um erro ao executar esse comando.",
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
