# @terreno/ai

AI service layer for Terreno apps providing GPT chat, multi-modal messages, tool calling, MCP integration, and file storage. Provider-agnostic via Vercel AI SDK.

## Installation

````bash
bun add @terreno/ai
````

## Quick Start

````typescript
import {AIService, AiApp} from "@terreno/ai";
import {TerrenoApp} from "@terreno/api";
import {google} from "@ai-sdk/google";

// Create AI service with your preferred model
const aiService = new AIService({
  model: google("gemini-2.5-flash"),
  defaultTemperature: 1.0,
});

// Register with TerrenoApp
const app = new TerrenoApp({userModel: User})
  .register(new AiApp({aiService}))
  .start();
````

## Core Features

### Multi-Modal Chat

Support for text, images, and file attachments in conversations:

````typescript
// Send message with image attachment
POST /gpt/prompt
{
  "prompt": "What's in this image?",
  "attachments": [
    {
      "type": "image",
      "url": "https://example.com/image.jpg",
      "mimeType": "image/jpeg"
    }
  ]
}
````

Message content types:
- `TextContentPart` - Plain text messages
- `ImageContentPart` - Images with URL or base64 data
- `FileContentPart` - File attachments with metadata

### Tool Calling

Pass-through Vercel AI SDK tool support with SSE streaming:

````typescript
import {tool} from "ai";

const tools = {
  get_current_time: tool({
    description: "Get the current time",
    parameters: z.object({}),
    execute: async () => ({time: new Date().toISOString()}),
  }),
};

// Tools are automatically called and results streamed
const aiService = new AIService({
  model: google("gemini-2.5-flash"),
  tools,
});
````

Tool events:
- `tool-call` - When AI decides to call a tool
- `tool-result` - Tool execution result
- All tool calls persisted in conversation history

### MCP Integration

Connect to Model Context Protocol servers for extended tool capabilities:

````typescript
// Configure MCP server connection
const aiApp = new AiApp({
  aiService,
  mcpServerUrl: process.env.MCP_SERVER_URL,
});
````

MCP endpoints:
- `GET /mcp/status` - Check MCP server connection status
- `GET /mcp/tools` - List available MCP tools
- Admin routes for MCP management

### File Storage (GCS)

Upload and manage file attachments with Google Cloud Storage:

````typescript
// Upload file
POST /files
Content-Type: multipart/form-data

file: <binary data>

// Response
{
  "_id": "...",
  "filename": "document.pdf",
  "mimeType": "application/pdf",
  "size": 12345,
  "gcsPath": "files/user-id/document.pdf"
}
````

File operations:
- Upload: `POST /files`
- Get signed URL: `GET /files/:id/url`
- Delete: `DELETE /files/:id` (soft delete)
- Automatic cleanup of unused files

Environment variables:
- `GCS_BUCKET` - Google Cloud Storage bucket name
- `GCS_PROJECT_ID` - GCP project ID
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to service account key

## API Reference

### AIService

Provider-agnostic AI service using Vercel AI SDK's `LanguageModel` interface.

````typescript
const aiService = new AIService({
  model: google("gemini-2.5-flash"),
  defaultTemperature: 1.0,
  tools: {...},  // Optional tool definitions
});
````

**Methods:**

| Method | Description |
|--------|-------------|
| `generateText(options)` | Generate text (non-streaming) |
| `generateTextStream(options)` | Stream text chunks (AsyncGenerator) |
| `generateRemix({text, userId?})` | Reword text naturally |
| `generateSummary({text, userId?})` | Summarize text |
| `translateText({text, targetLanguage, sourceLanguage?, userId?})` | Translate text |
| `generateChatStream({messages, systemPrompt?, userId?, tools?})` | Stream chat response with tool support |

All methods automatically log requests to `AIRequest` model.

**Temperature Presets:**

````typescript
import {TemperaturePresets} from "@terreno/ai";

TemperaturePresets.DETERMINISTIC  // 0
TemperaturePresets.LOW            // 0.3
TemperaturePresets.BALANCED       // 0.7
TemperaturePresets.DEFAULT        // 1.0
TemperaturePresets.HIGH           // 1.5
TemperaturePresets.MAXIMUM        // 2.0
````

### Models

#### AIRequest

Logs all AI requests with metrics:

````typescript
{
  aiModel: string          // Model identifier
  prompt: string           // Input prompt
  requestType: "general" | "remix" | "summarization" | "translation" | "chat"
  response?: string        // AI response text
  responseTime?: number    // Response time in ms
  tokensUsed?: number      // Total tokens consumed
  userId?: ObjectId        // User who made request
  error?: string           // Error message if failed
  metadata?: Mixed         // Additional data
}
````

#### GptHistory

Persists conversation history:

````typescript
{
  title?: string                    // Auto-generated from first response
  userId: ObjectId                  // Owner (required)
  prompts: Array<{
    content: Array<ContentPart>,    // Multi-modal content
    type: "user" | "assistant" | "system",
    model?: string,
    toolCallId?: string,
    toolName?: string
  }>
}
````

Content part types:
- `TextContentPart` - `{type: "text", text: string}`
- `ImageContentPart` - `{type: "image", image: string | URL, mimeType?: string}`
- `FileContentPart` - `{type: "file", data: string, mimeType: string}`

#### FileAttachment

File upload metadata:

````typescript
{
  filename: string         // Original filename
  mimeType: string         // MIME type
  size: number             // File size in bytes
  gcsPath: string          // GCS storage path
  userId: ObjectId         // Owner
  deleted?: Date           // Soft delete timestamp
}
````

### Routes

#### Chat Endpoints

````typescript
// Streaming chat with multi-modal support
POST /gpt/prompt
{
  prompt: string,
  historyId?: string,
  systemPrompt?: string,
  attachments?: Array<{
    type: "image" | "file",
    url?: string,
    data?: string,
    mimeType?: string
  }>
}

// Response: Server-Sent Events stream
event: text-delta
data: {"textDelta": "Hello"}

event: tool-call
data: {"toolCallId": "...", "toolName": "get_time", "args": {}}

event: tool-result
data: {"toolCallId": "...", "result": {"time": "..."}}
````

````typescript
// Non-streaming text remix
POST /gpt/remix
{
  text: string,
  userId?: string
}

// Response
{
  remixedText: string
}
````

#### History Management

Standard CRUD via `modelRouter` at `/gpt/histories`:
- `GET /gpt/histories` - List conversations (paginated, sorted by `-updated`)
- `POST /gpt/histories` - Create conversation
- `GET /gpt/histories/:id` - Get conversation
- `PATCH /gpt/histories/:id` - Update conversation
- `DELETE /gpt/histories/:id` - Delete conversation

Permissions: `IsAuthenticated` for create/list, `IsOwner` for read/update/delete

#### AI Request Explorer

Admin-only analytics endpoint:

````typescript
GET /aiRequestsExplorer?page=1&limit=20&requestType=chat&model=gemini-2.5-flash

// Response
{
  data: [...],      // Request records with user lookup
  total: number,    // Total matching records
  page: number,
  limit: number,
  more: boolean
}
````

Query filters: `requestType`, `model`, `startDate`, `endDate`

#### File Management

````typescript
// Upload file
POST /files
Content-Type: multipart/form-data

// Get signed URL (expires in 1 hour)
GET /files/:id/url

// Delete file (soft delete)
DELETE /files/:id
````

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GCS_BUCKET` | No | Google Cloud Storage bucket for file uploads |
| `GCS_PROJECT_ID` | No | GCP project ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | No | Path to GCS service account key |
| `MCP_SERVER_URL` | No | MCP server URL for tool integration |

## Usage Examples

### Basic Chat Integration

````typescript
import {TerrenoApp} from "@terreno/api";
import {AiApp, AIService} from "@terreno/ai";
import {google} from "@ai-sdk/google";

const aiService = new AIService({
  model: google("gemini-2.5-flash"),
  defaultTemperature: 1.0,
});

const app = new TerrenoApp({userModel: User})
  .register(new AiApp({aiService}))
  .start();
````

### With Tool Calling

````typescript
import {tool} from "ai";
import {z} from "zod";

const tools = {
  get_current_time: tool({
    description: "Get the current time",
    parameters: z.object({}),
    execute: async () => ({time: new Date().toISOString()}),
  }),
  generate_pdf: tool({
    description: "Generate a PDF document",
    parameters: z.object({
      title: z.string(),
      content: z.string(),
    }),
    execute: async ({title, content}) => ({
      url: "https://example.com/document.pdf",
    }),
  }),
};

const aiService = new AIService({
  model: google("gemini-2.5-flash"),
  tools,
});
````

### With File Storage

````typescript
const app = new TerrenoApp({userModel: User})
  .register(new AiApp({
    aiService,
    gcsBucket: process.env.GCS_BUCKET,
  }))
  .start();
````

### With MCP Integration

````typescript
const app = new TerrenoApp({userModel: User})
  .register(new AiApp({
    aiService,
    mcpServerUrl: process.env.MCP_SERVER_URL,
  }))
  .start();
````

## Testing

````typescript
import {AIService} from "@terreno/ai";
import {mock} from "bun:test";

// Mock model for testing
const createMockModel = () => ({
  doGenerate: mock(async () => ({
    finishReason: "stop" as const,
    rawCall: {rawPrompt: "", rawSettings: {}},
    text: "response text",
    usage: {completionTokens: 10, promptTokens: 5},
  })),
  doStream: mock(async () => ({
    rawCall: {rawPrompt: "", rawSettings: {}},
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue({type: "text-delta" as const, textDelta: "chunk "});
        controller.enqueue({
          type: "finish" as const,
          finishReason: "stop" as const,
          usage: {completionTokens: 10, promptTokens: 5}
        });
        controller.close();
      },
    }),
  })),
  modelId: "mock-model",
  provider: "mock-provider",
  specificationVersion: "v1" as const,
});

const aiService = new AIService({model: createMockModel()});
````

## See Also

- [API Reference](./api.md) - Core API framework
- [Environment Variables](./environment-variables.md) - All configuration options
- [@terreno/ui GPTChat Component](./ui.md#gptchat) - Frontend chat UI
