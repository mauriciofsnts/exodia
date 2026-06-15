export const enUS = {
  errors: {
    guildOnly: "This command only works in servers.",
    notInVoice: "You need to be in a voice channel.",
    noResults: "No results found.",
    generic: "An error occurred while executing this command.",
  },
  music: {
    searching: "Searching...",
    addedToQueue: "▶️ Added to queue: **{title}**",
    skipped: "⏭️ Song skipped.",
    stopped: "⏹️ Music stopped and queue cleared.",
    nothingPlaying: "Nothing is playing right now.",
    nowPlaying: "▶️ **Now playing:** {title} — requested by {requestedBy}",
    queueEntry: "{position}. {title} — {requestedBy}",
    emptyQueue: "*Queue is empty*",
  },
  commands: {
    ping: {
      response: "Pong! Latency: **{latency}ms**",
    },
    setlang: {
      success: "✅ Server language set to **{lang}**.",
      noPermission: "You need the **Manage Server** permission to use this command.",
    },
  },
} as const;
