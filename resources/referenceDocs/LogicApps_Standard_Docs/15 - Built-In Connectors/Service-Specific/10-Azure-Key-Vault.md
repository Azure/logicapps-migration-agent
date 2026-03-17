# Key Vault
Source: [https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/keyvault/](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/keyvault/)
Connect to Azure Key Vault to securely store and access secrets.
This article describes the operations for the Azure Key Vault built-in connector, which is available only for Standard workflows in single-tenant Azure Logic Apps. If you're looking for the Azure Key Vault managed connector operations instead, see [Azure Key Vault managed connector reference](https://learn.microsoft.com/en-us/connectors/keyvault/).
## Built-in connector settings
In a Standard logic app resource, the application and host settings control various thresholds for performance, throughput, timeout, and so on. For more information, see [Edit host and app settings for Standard logic app workflows](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings).
## Authentication
### Active Directory OAuth
#### Parameters
| Name | Description | Type | Required | Default |
| --- | --- | --- | --- | --- |
| Vault URI | Vault URI to be used for connection | string | True |  |
| Active Directory OAuth | Active Directory OAuth | string | True |  |
| Authority | Active Directory authority | string | False |  |
| Tenant | Active Directory tenant | string | True |  |
| Credential type | Active Directory credential type | string | False | Certificate, Secret |
| Client ID | Active Directory client ID | string | True |  |
| Client secret | Active Directory client secret | securestring | True |  |
| Pfx | Active Directory pfx | securestring | True |  |
| Password | Active Directory password | securestring | True |  |
### Managed identity
#### Parameters
| Name | Description | Type | Required | Default |
| --- | --- | --- | --- | --- |
| Vault URI | Vault URI to be used for connection | string | True |  |
| Managed identity | Managed identity | string | True |  |
| Managed identity | Managed identity | string | False |  |
## Actions
| Action | Description |
| --- | --- |
| Decrypt data with key | Decrypt data with key |
| Decrypt data with key version | Decrypt data with key version |
| Encrypt data with key | Encrypt data with key |
| Encrypt data with key version | Encrypt data with key version |
| Get key metadata | Get key metadata |
| Get key version metadata | Get key version metadata |
| Get secret | Get secret |
| Get secret metadata | Get secret metadata |
| Get secret version | Get secret version |
| Get secret version metadata | Get secret version metadata |
| List key versions | List key versions |
| List keys | List keys |
| List secret versions | List secret versions |
| List secrets | List secrets |
### Decrypt data with key
- **Operation ID:** decryptDataWithKey
#### Parameters
| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Key | keyName | True | string | Name of the key. |
| Algorithm | algorithm | True | string | Name of the algorithm. |
| Encrypted data | encryptedData | True | string | Encrypted data to decrypt. |
#### Returns
| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Raw data | rawData | string | Raw data. |
### Decrypt data with key version
- **Operation ID:** decryptDataWithKeyVersion
#### Parameters
| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Key | keyName | True | string | Name of the key. |
| Version | version | True | string | Version of the key. |
| Algorithm | algorithm | True | string | Name of the algorithm. |
| Encrypted data | encryptedData | True | string | Encrypted data to decrypt. |
#### Returns
| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Raw data | rawData | string | Raw data. |
### Encrypt data with key
- **Operation ID:** encryptDataWithKey
#### Parameters
| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Key | keyName | True | string | Name of the key. |
| Algorithm | algorithm | True | string | Name of the algorithm. |
| Raw text | rawData | True | string | Raw text to encrypt. |
#### Returns
| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Cipher text | encryptedData | string | Encrypted data. |
### Encrypt data with key version
- **Operation ID:** encryptDataWithKeyVersion
#### Parameters
| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Key | keyName | True | string | Name of the key. |
| Version | version | True | string | Version of the key. |
| Algorithm | algorithm | True | string | Name of the algorithm. |
| Raw text | rawData | True | string | Raw text to encrypt. |
#### Returns
| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Cipher text | encryptedData | string | Encrypted data. |
### Get key metadata
- **Operation ID:** getKeyMetadata
#### Parameters
| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Key | keyName | True | string | Name of the key. |
#### Returns
| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Key name | name | string | Name of the key. |
| Key version | version | string | Version of the key. |
| Key enabled? | isEnabled | string | A flag indicating whether the key is enabled. |
| Allowed operations | allowedOperations | string | Operations allowed using the key. |
| Key type | keyType | string | Type of the key. |
| Key creation time | createdTime | string | Time when the key was created. |
| Key last updated time | lastUpdatedTime | string | Time when the key was last updated. |
| Key validity start time | validityStartTime | string | Time when the key validity starts. |
| Key expiry time | validityEndTime | string | Time when the key validity ends. |
### Get key version metadata
- **Operation ID:** getKeyVersionMetadata
#### Parameters
| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Key | keyName | True | string | Name of the key. |
| Version | version | True | string | Version of the key. |
#### Returns
| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Key name | name | string | Name of the key. |
| Key version | version | string | Version of the key. |
| Key enabled? | isEnabled | string | A flag indicating whether the key is enabled. |
| Allowed operations | allowedOperations | string | Operations allowed using the key. |
| Key type | keyType | string | Type of the key. |
| Key creation time | createdTime | string | Time when the key was created. |
| Key last updated time | lastUpdatedTime | string | Time when the key was last updated. |
| Key validity start time | validityStartTime | string | Time when the key validity starts. |
| Key expiry time | validityEndTime | string | Time when the key validity ends. |
### Get secret
- **Operation ID:** getSecret
#### Parameters
| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Secret | secretName | True | string | Name of the secret. |
#### Returns
| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Secret identifier | identifier | string | Value that uniquely identifies a secret. |
| Secret value | value | string | Value of the secret. |
| Secret name | name | string | Name of the secret. |
| Secret version | version | string | Version of the secret. |
| Secret content type | contentType | string | Content type of the secret. |
| Secert enabled? | isEnabled | string | A flag indicating whether the secret is enabled. |
| Secret creation time | createdTime | string | Time when the secret was created. |
| Secret last updated time | lastUpdatedTime | string | Time when the secret was last updated. |
| Secret validity start time | validityStartTime | string | Time when the secret validity starts. |
| Secret expiry time | validityEndTime | string | Time when the secret validity ends. |
### Get secret metadata
- **Operation ID:** getSecretMetadata
#### Parameters
| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Secret | secretName | True | string | Name of the secret. |
#### Returns
| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Secret name | name | string | Name of the secret. |
| Secret version | version | string | Version of the secret. |
| Secret content type | contentType | string | Content type of the secret. |
| Secert enabled? | isEnabled | string | A flag indicating whether the secret is enabled. |
| Secret creation time | createdTime | string | Time when the secret was created. |
| Secret last updated time | lastUpdatedTime | string | Time when the secret was last updated. |
| Secret validity start time | validityStartTime | string | Time when the secret validity starts. |
| Secret expiry time | validityEndTime | string | Time when the secret validity ends. |
### Get secret version
- **Operation ID:** getSecretVersion
#### Parameters
| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Secret | secretName | True | string | Name of the secret. |
| Version | version | True | string | Version of the secret. |
#### Returns
| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Secret identifier | identifier | string | Value that uniquely identifies a secret. |
| Secret value | value | string | Value of the secret. |
| Secret name | name | string | Name of the secret. |
| Secret version | version | string | Version of the secret. |
| Secret content type | contentType | string | Content type of the secret. |
| Secert enabled? | isEnabled | string | A flag indicating whether the secret is enabled. |
| Secret creation time | createdTime | string | Time when the secret was created. |
| Secret last updated time | lastUpdatedTime | string | Time when the secret was last updated. |
| Secret validity start time | validityStartTime | string | Time when the secret validity starts. |
| Secret expiry time | validityEndTime | string | Time when the secret validity ends. |
### Get secret version metadata
- **Operation ID:** getSecretVersionMetadata
#### Parameters
| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Secret | secretName | True | string | Name of the secret. |
| Version | version | True | string | Version of the secret. |
#### Returns
| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Secret name | name | string | Name of the secret. |
| Secret version | version | string | Version of the secret. |
| Secret content type | contentType | string | Content type of the secret. |
| Secert enabled? | isEnabled | string | A flag indicating whether the secret is enabled. |
| Secret creation time | createdTime | string | Time when the secret was created. |
| Secret last updated time | lastUpdatedTime | string | Time when the secret was last updated. |
| Secret validity start time | validityStartTime | string | Time when the secret validity starts. |
| Secret expiry time | validityEndTime | string | Time when the secret validity ends. |
### List key versions
- **Operation ID:** listKeyVersionMetadata
#### Parameters
| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Key | keyName | True | string | Name of the key. |
#### Returns
Collection of keys.
- **Keys list** array
### List keys
- **Operation ID:** listKeyMetadata
#### Returns
Collection of keys.
- **Keys list** array
### List secret versions
- **Operation ID:** listSecretVersionMetadata
#### Parameters
| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Secret | secretName | True | string | Name of the secret. |
#### Returns
Collection of secrets.
- **Secrets list** array
### List secrets
- **Operation ID:** listSecretMetadata
#### Returns
Collection of secrets.
- **Secrets list** array
## Additional Links
- [Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/keyvault/#built-in-connector-settings)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/keyvault/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/keyvault/#actions)
