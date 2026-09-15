# Add a GPT chat mascot

Pass a `mascot` node into `GPTChat`. Terreno does not ship a character — the consumer owns the image, Lottie, icon, or copy.

## When it shows

| Chat state | Mascot |
| --- | --- |
| `currentMessages` is empty | Rendered, centered above suggested prompts |
| One or more messages | Hidden |

Omit `mascot` to keep the default empty chat (prompts only, or a blank panel).

## Steps

### 1. Build the node in your app

Keep the asset in the consumer package. `GPTChat` only mounts whatever you pass.

```tsx
import {Box, Heading, Text} from "@terreno/ui";

const ChatMascot: React.ReactElement = (
  <Box alignItems="center" gap={2}>
    <Heading size="lg">🦊</Heading>
    <Text color="secondaryDark" size="sm">
      Ask anything.
    </Text>
  </Box>
);
```

Swap the heading for `Image`, a custom SVG, or a Lottie view.

### 2. Pass it to `GPTChat`

```tsx
<GPTChat
  currentMessages={currentMessages}
  histories={histories}
  mascot={ChatMascot}
  onCreateHistory={handleCreateHistory}
  onDeleteHistory={handleDeleteHistory}
  onSelectHistory={handleSelectHistory}
  onSubmit={handleSubmit}
  suggestedPrompts={["What can you help with?"]}
/>
```

### 3. Confirm empty vs thread

Open a new chat: the mascot is visible. After the first user or assistant message, it is gone.

## Example

The example app supplies a fox heading in `example-frontend/app/(tabs)/ai.tsx`. The demo story `GPTChat` → `Mascot` does the same without a backend.

## Related

- [`GPTChat` props](../reference/ui.md#gptchat)
- Demo: `http://localhost:8085/dev/GPTChat?story=Mascot`
