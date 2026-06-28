Options passed to configurationPlugin.

## Properties

### secretProvider?

> `optional` **secretProvider?**: [`SecretProvider`](SecretProvider.md)

Secret provider used when resolveSecrets() is called without an explicit provider.
Typically set during app startup so the model can resolve secrets on demand.
