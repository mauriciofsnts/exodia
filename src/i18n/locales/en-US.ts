export const enUS = {
  errors: {
    guildOnly: "This command only works in servers.",
    notInVoice: "You need to be in a voice channel.",
    noResults: "No results found.",
    generic: "An error occurred while executing this command.",
    noPermission: "You don't have permission to use this command.",
    cooldown: "⏳ Wait {seconds}s before using this command again.",
    dbRequired: "This command needs the database to be enabled.",
  },
  music: {
    searching: "Searching...",
    addedToQueue: "▶️ Added to queue: **{title}**",
    skipped: "⏭️ Song skipped.",
    stopped: "⏹️ Music stopped and queue cleared.",
    nothingPlaying: "Nothing is playing right now.",
    nowPlaying: "▶️ **Now playing:** {title} — requested by {requestedBy}",
    trackError: "⚠️ Couldn't play **{title}**, skipping to the next one.",
    queueEntry: "{position}. {title} — {requestedBy}",
    emptyQueue: "*Queue is empty*",
    mostPlayedHeader: "🔥 **Top {count} most played** — added to the queue:",
    mostPlayedEntry: "{position}. {title} — {plays} plays",
    noHistory: "No play history yet — play some songs first.",
    voteHint: "React 👍 👎 ⭐ to vote — it shapes the /mostplayed ranking.",
  },
  commands: {
    ping: {
      response: "Pong! Latency: **{latency}ms**",
    },
    setlang: {
      success: "✅ Server language set to **{lang}**.",
      noPermission: "You need the **Manage Server** permission to use this command.",
    },
    password: {
      sentToDm: "🔐 Sent a fresh password to your DMs.",
      dmFailed: "❌ Couldn't DM you — open your direct messages and try again.",
      dmContent:
        "🔐 Your new password (this message self-destructs in {seconds}s):\n||`{password}`||",
    },
  },
} as const;
