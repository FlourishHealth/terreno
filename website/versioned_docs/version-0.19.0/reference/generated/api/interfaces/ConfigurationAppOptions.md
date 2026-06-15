Options for ConfigurationApp.

## Properties

### basePath?

> `optional` **basePath?**: `string`

Base path for configuration routes. Defaults to "/configuration".

***

### fieldOverrides?

> `optional` **fieldOverrides?**: `Record`\<`string`, \{ `widget?`: `string`; \}\>

Per-field widget overrides (e.g., {"ai.systemPrompt": "markdown"}).

***

### model

> **model**: `Model`\<`any`\>

The Mongoose model with configurationPlugin applied.
