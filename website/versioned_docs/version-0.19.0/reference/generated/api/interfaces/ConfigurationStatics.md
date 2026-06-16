Static methods added by configurationPlugin to the Mongoose model.

## Extended by

- [`ConfigurationModel`](ConfigurationModel.md)

## Type Parameters

### T

`T` *extends* `object`

## Methods

### getConfig()

#### Call Signature

> **getConfig**(): `Promise`\<`T` & `Document`\<`ObjectId`, `any`, `any`, `Record`\<`string`, `any`\>, \{ \}\>\>

Get the full singleton configuration document.

##### Returns

`Promise`\<`T` & `Document`\<`ObjectId`, `any`, `any`, `Record`\<`string`, `any`\>, \{ \}\>\>

#### Call Signature

> **getConfig**\<`P`\>(`key`): `Promise`\<[`PathValue`](../type-aliases/PathValue.md)\<`T`, `P`\>\>

Get a specific value by dot-notation key.

##### Type Parameters

###### P

`P` *extends* `string`

##### Parameters

###### key

`P`

##### Returns

`Promise`\<[`PathValue`](../type-aliases/PathValue.md)\<`T`, `P`\>\>

***

### getSecretFields()

> **getSecretFields**(): [`SecretFieldMeta`](SecretFieldMeta.md)[]

Get secret field metadata discovered from the schema.

#### Returns

[`SecretFieldMeta`](SecretFieldMeta.md)[]

***

### resolveSecrets()

> **resolveSecrets**(`provider?`): `Promise`\<`Map`\<`string`, `string`\>\>

Resolve all secret field values from a provider.
Uses the provider passed here, or falls back to the one configured in the plugin options.
Returns a map of path -> value.

#### Parameters

##### provider?

[`SecretProvider`](SecretProvider.md)

#### Returns

`Promise`\<`Map`\<`string`, `string`\>\>

***

### updateConfig()

> **updateConfig**(`updates`): `Promise`\<`T` & `Document`\<`ObjectId`, `any`, `any`, `Record`\<`string`, `any`\>, \{ \}\>\>

Update the singleton configuration document (deep merge).

#### Parameters

##### updates

[`DeepPartial`](../type-aliases/DeepPartial.md)\<`T`\>

#### Returns

`Promise`\<`T` & `Document`\<`ObjectId`, `any`, `any`, `Record`\<`string`, `any`\>, \{ \}\>\>
