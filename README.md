# Y-OS Scripts

Scripts de push mémoire cross-LLM pour le système Y-OS.

## Structure

```
core/
  push-mem0-core.js       ← Logique partagée (détection LLM, parsing, push)
tampermonkey/
  push-mem0.user.js       ← Script Tampermonkey/Gear (Mac + iOS Gear)
scriptable/
  push-mem0.scriptable.js ← Script Scriptable iOS (Share Sheet natif)
```

## Webhook

`POST https://yos-push-webhook.fly.dev/push`

```json
{
  "text": "conversation text",
  "url": "https://chatgpt.com/c/...",
  "source": "chatgpt",
  "project": "yos-architecture"
}
```

## Installation Tampermonkey

1. Installer Tampermonkey (Chrome/Brave/Firefox) ou Gear (iOS)
2. Nouveau script → coller `tampermonkey/push-mem0.user.js`
3. Bouton "MEM0" apparaît sur chatgpt.com, claude.ai, grok.com, gemini.google.com, perplexity.ai

## Installation Scriptable iOS

1. Installer [Scriptable](https://apps.apple.com/app/scriptable/id1405459188)
2. + → coller `scriptable/push-mem0.scriptable.js` → nommer "Push to Mem0"
3. Share Sheet depuis n'importe quelle app → Scriptable → Push to Mem0
