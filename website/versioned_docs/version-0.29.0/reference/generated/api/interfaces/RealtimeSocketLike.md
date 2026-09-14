Minimal shape this module requires from a Socket.io socket. Lets tests pass a
mock without standing up a real server.

## Extends

- `SocketWithDecodedToken`

## Properties

### decodedToken?

> `optional` **decodedToken?**: `DecodedRealtimeToken`

#### Inherited from

`SocketWithDecodedToken.decodedToken`

***

### emit

> **emit**: (`event`, `payload`) => `void`

#### Parameters

##### event

`string`

##### payload

`unknown`

#### Returns

`void`

***

### id

> **id**: `string`

***

### join

> **join**: (`room`) => `void` \| `Promise`\<`void`\>

#### Parameters

##### room

`string`

#### Returns

`void` \| `Promise`\<`void`\>

***

### leave

> **leave**: (`room`) => `void` \| `Promise`\<`void`\>

#### Parameters

##### room

`string`

#### Returns

`void` \| `Promise`\<`void`\>

***

### on

> **on**: (`event`, `handler`) => `void`

#### Parameters

##### event

`string`

##### handler

(...`args`) => `any`

#### Returns

`void`
