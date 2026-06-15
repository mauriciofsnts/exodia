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
    help: {
      title: "📖 Commands",
      hint: "Use `{prefix}help <command>` for details on a specific command.",
      notFound: "Command `{command}` not found. Use `{prefix}help` to list them.",
      usage: "Usage",
      options: "Options",
      noOptions: "No options.",
      required: "required",
      optional: "optional",
    },
    config: {
      title: "⚙️ Server configuration",
      current: "Prefix: `{prefix}`\nLanguage: `{lang}`",
      help: "Change with `{prefix}config prefix <value>` or `{prefix}config lang <en-US|pt-BR>`.",
      prefixSet: "✅ Prefix set to `{prefix}`.",
      langSet: "✅ Language set to `{lang}`.",
      invalidPrefix: "❌ Prefix must be 1–5 characters with no spaces.",
      invalidLang: "❌ Unknown language. Options: {langs}.",
      needValue: "❌ Provide a value, e.g. `{prefix}config {action} <value>`.",
      resumeReady: "✅ Setup continued in {channel}.",
      resumeHere: "✅ Let's configure right here.",
    },
  },
  onboarding: {
    welcome: "👋 Thanks for adding me to {guild}!",
    guide:
      "Set my prefix with `{prefix}config prefix <value>` and language with `{prefix}config lang <en-US|pt-BR>`. Current prefix: `{prefix}`.",
    cantCreateChannel:
      "I couldn't create a config channel — I need the **Manage Channels** permission. Create a text channel and run `{prefix}config resume` to finish setup.",
  },
} as const;
