A real-time sync event emitted to clients via WebSocket.

## Properties

### collection

> **collection**: `string`

Route path used as tag type (e.g. "todos")

***

### data?

> `optional` **data?**: `any`

Serialized document data (omitted for hard deletes)

***

### id

> **id**: `string`

Document ID

***

### method

> **method**: `"delete"` \| `"create"` \| `"update"`

The CRUD method that triggered this event

***

### model

> **model**: `string`

Mongoose model name (e.g. "Todo")

***

### timestamp

> **timestamp**: `number`

Epoch milliseconds when the event was generated

***

### updatedFields?

> `optional` **updatedFields?**: `string`[]

Fields that were updated (for update events from change streams)
