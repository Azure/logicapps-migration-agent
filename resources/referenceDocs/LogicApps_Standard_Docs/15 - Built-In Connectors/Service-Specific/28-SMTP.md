# SMTP

> Source: https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/smtp/

SMTP (Simple Mail Transfer Protocol) is an internet standard for email supported by most email processing servers. Connect to SMTP to send email.

This article describes the operations for the SMTP built-in connector, which is available only for Standard workflows in single-tenant Azure Logic Apps. If you're looking for the SMTP managed connector operations instead, see [SMTP managed connector reference](https://learn.microsoft.com/en-us/connectors/smtp/).

---

## Built-in connector settings

In a Standard logic app resource, the application and host settings control various thresholds for performance, throughput, timeout, and so on. For more information, see [Edit host and app settings for Standard logic app workflows](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings).

---

## Connector how-to guide

For more information about connecting to an SMTP server from your workflow in Azure Logic Apps, see [Connect to your SMTP account from workflows in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-smtp).

---

## Authentication

### SMTP Server Address

SMTP Server Address.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| SMTP Server Address | SMTP Server Address. | string | True | |

### User Name

User Name.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| User Name | User Name. | string | False | |

### Password

Password.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Password | Password. | securestring | False | |

### SMTP Server Port

SMTP Port Number (example: 587).

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| SMTP Server Port | SMTP Port Number (example: 587). | int | False | |

### Enable SSL?

Enable SSL? (True/False)

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Enable SSL? | Enable SSL? (True/False) | bool | False | |

---

## Actions

| Action | Description |
|--------|-------------|
| Send Email | This operation sends an email to one or more recipients. |

### Send Email

- **Operation ID:** sendEmail

This operation sends an email to one or more recipients.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| From | from | True | string | Email address of sender like sender@domain.com. |
| To | to | True | string | Specify email addresses separated by semicolons like recipient1@domain.com;recipient2@domain.com. |
| CC | cc | | string | Specify email addresses separated by semicolons like recipient1@domain.com;recipient2@domain.com. |
| Subject | subject | | string | Email Subject. |
| Body | body | | string | Email Body. |
| Is HTML? | isHTML | | string | Indicating whether the mail message body is in HTML. |
| Bcc | bcc | | string | Specify email addresses separated by semicolons like recipient1@domain.com;recipient2@domain.com. |
| Importance | importance | | string | Importance of the email (High, Normal, or Low). |
| Read Receipt | readReceipt | | string | Specify email address for Read receipt. |
| Delivery Receipt | deliveryReceipt | | string | Specify Email for Delivery Receipt. |
| Email Attachments | attachment | | string | Email Attachments. |

---

## Additional Links

- [Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Reference](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/documentintelligence/)
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/smtp/#built-in-connector-settings)
- [Connector how-to guide](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/smtp/#connector-how-to-guide)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/smtp/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/smtp/#actions)
