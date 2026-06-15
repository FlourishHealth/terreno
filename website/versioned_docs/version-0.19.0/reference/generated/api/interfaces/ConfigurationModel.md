Convenience type for a Mongoose model with configurationPlugin applied.

Use this when declaring your configuration model to get full type safety:
```typescript
export const AppConfig = mongoose.model<AppConfigDocument, ConfigurationModel<AppConfigDocument>>(
  "AppConfig",
  appConfigSchema,
);
// Then call:
const name = await AppConfig.getConfig("general.appName"); // typed as string
const full = await AppConfig.getConfig(); // typed as AppConfigDocument
```

## Extends

- `Model`\<`T`\>.[`ConfigurationStatics`](ConfigurationStatics.md)\<`T`\>

## Type Parameters

### T

`T` *extends* `object`

## Constructors

### Constructor

> **new ConfigurationModel**\<`DocType`\>(`doc?`, `fields?`, `options?`): `Document`\<`unknown`, \{ \}, `T`, \{ \}, \{ \}\> & `Require_id`\<`T`\> *extends* `object` ? `object` & `Require_id`\<`T`\> : `Require_id`\<`T`\> & `object`

#### Parameters

##### doc?

`DocType`

##### fields?

`any`

##### options?

`boolean` \| `AnyObject`

#### Returns

`Document`\<`unknown`, \{ \}, `T`, \{ \}, \{ \}\> & `Require_id`\<`T`\> *extends* `object` ? `object` & `Require_id`\<`T`\> : `Require_id`\<`T`\> & `object`

#### Inherited from

`Model<T>.constructor`

## Methods

### getConfig()

#### Call Signature

> **getConfig**(): `Promise`\<`T` & `Document`\<`ObjectId`, `any`, `any`, `Record`\<`string`, `any`\>, \{ \}\>\>

Get the full singleton configuration document.

##### Returns

`Promise`\<`T` & `Document`\<`ObjectId`, `any`, `any`, `Record`\<`string`, `any`\>, \{ \}\>\>

##### Inherited from

[`ConfigurationStatics`](ConfigurationStatics.md).[`getConfig`](ConfigurationStatics.md#getconfig)

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

##### Inherited from

[`ConfigurationStatics`](ConfigurationStatics.md).[`getConfig`](ConfigurationStatics.md#getconfig)

***

### getSecretFields()

> **getSecretFields**(): [`SecretFieldMeta`](SecretFieldMeta.md)[]

Get secret field metadata discovered from the schema.

#### Returns

[`SecretFieldMeta`](SecretFieldMeta.md)[]

#### Inherited from

[`ConfigurationStatics`](ConfigurationStatics.md).[`getSecretFields`](ConfigurationStatics.md#getsecretfields)

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

#### Inherited from

[`ConfigurationStatics`](ConfigurationStatics.md).[`resolveSecrets`](ConfigurationStatics.md#resolvesecrets)

***

### updateConfig()

> **updateConfig**(`updates`): `Promise`\<`T` & `Document`\<`ObjectId`, `any`, `any`, `Record`\<`string`, `any`\>, \{ \}\>\>

Update the singleton configuration document (deep merge).

#### Parameters

##### updates

[`DeepPartial`](../type-aliases/DeepPartial.md)\<`T`\>

#### Returns

`Promise`\<`T` & `Document`\<`ObjectId`, `any`, `any`, `Record`\<`string`, `any`\>, \{ \}\>\>

#### Inherited from

[`ConfigurationStatics`](ConfigurationStatics.md).[`updateConfig`](ConfigurationStatics.md#updateconfig)
