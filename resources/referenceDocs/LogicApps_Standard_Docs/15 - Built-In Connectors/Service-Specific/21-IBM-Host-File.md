# IBM Host File

> Source: https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/hostfile/

The IBM Host File connector provides an API to work with off-line files of IBM origin.

This article describes the operations for the IBM Host File built-in connector, which is available only for Standard workflows in single-tenant Azure Logic Apps.

## Built-in connector settings

In a Standard logic app resource, the application and host settings control various thresholds for performance, throughput, timeout, and so on. For more information, see [Edit host and app settings for Standard logic app workflows](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings).

## Connector how-to guide

For more information about integrating host files from IBM mainframes with your workflow in Azure Logic Apps, see [Parse and generate host files from IBM mainframes for Standard workflows in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/connectors/integrate-host-files-ibm-mainframe).

## Authentication

### Code Page

Code Page number to use for converting text

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Code Page | Code Page number to use for converting text | int | False | |

### From iSeries

Do files originate from an iSeries

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| From iSeries | Do files originate from an iSeries | bool | False | |

## Actions

| Operation | Description |
|-----------|-------------|
| Generate Host File Contents | Generate contents of a file in IBM formats. |
| Parse Host File Contents | Parse the contents of a file in IBM formats. |

### Generate Host File Contents

- **Operation ID:** generateFileContents

Generate contents of a file in IBM formats.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| HIDX Name | hidx | True | string | Name of an HIDX file containing meta-data about the IBM file format. |
| Schema Name | schema | True | string | Name of a Schema contained in the HIDX file. |
| Rows | rows | True | string | Rows to be converted to IBM Format. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Binary Contents | contents | string | Binary data representing the contents of an IBM file, generated from the input Rows. |

### Parse Host File Contents

- **Operation ID:** parseFileContents

Parse the contents of a file in IBM formats.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| HIDX Name | hidx | True | string | Name of an HIDX file containing meta-data about the IBM file format. |
| Schema Name | schema | True | string | Name of a Schema contained in the HIDX file. |
| Binary Contents | contents | True | string | Binary data representing the contents of an IBM file. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Rows | rows | string | The result of parsing the binary file contents. |

## Additional Links

- [Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Reference](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/documentintelligence/)
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/hostfile/#built-in-connector-settings)
- [Connector how-to guide](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/hostfile/#connector-how-to-guide)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/hostfile/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/hostfile/#actions)
