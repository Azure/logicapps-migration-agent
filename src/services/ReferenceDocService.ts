/**
 * ReferenceDocService
 *
 * Provides embedded reference documentation for BizTalk → Logic Apps Standard
 * component mapping. The doc content is compiled into the extension bundle
 * (not shipped as raw files) so it's available at runtime but not visible
 * to customers.
 *
 * Sources:
 *   - Azure Logic Apps Standard documentation
 *   - BizTalk Server migration documentation
 */

/**
 * Compact version of the mapping reference for inclusion in LLM prompts.
 * This avoids bloating the prompt while giving the LLM the key corrections.
 */
const COMPACT_MAPPING_REFERENCE = `
COMPONENT MAPPING REFERENCE (from official Microsoft documentation):

CRITICAL: Logic Apps Standard supports LOCAL custom code ("Call a local function 
in this logic app") — .NET functions deployed in lib/custom alongside workflows.
Do NOT map custom BizTalk components to "Azure Functions" — use LOCAL FUNCTIONS instead.

Also available: inline C# script (Execute CSharp Script Code), inline JavaScript,
inline PowerShell, and custom built-in connectors (Azure Functions extensibility model).

KEY MAPPINGS (isLogicAppsNative = true unless noted):
- FILE → File System connector (native)
- FTP/SFTP → FTP / SFTP-SSH connector (native)
- HTTP/SOAP/WCF-WebHTTP/WCF-BasicHTTP → HTTP trigger/action (native)
- SQL/WCF-SQL → SQL Server connector (native)
- SAP/WCF-SAP → SAP connector (native)
- MSMQ → Azure Service Bus (native)
- MQSeries → IBM MQ connector (native)
- SharePoint → SharePoint Online connector (native)
- WCF-NetTcp → Logic Apps local function (isLogicAppsNative=false)
- WCF-Oracle → Logic Apps local function (isLogicAppsNative=false)
- WCF-OracleEBS/Siebel/PeopleSoft → Logic Apps local function (isLogicAppsNative=false)
- Custom pipeline component → Logic Apps local function (isLogicAppsNative=true*)
- Custom functoid → Logic Apps local function (isLogicAppsNative=true*)
- Expression shape (C# code) → Inline C# Script action (isLogicAppsNative=true)
- Flat File pipeline → Integration Account Flat File or local function
- BRE rules → Azure Logic Apps Rules Engine (native, same BRE runtime)
- EDI (X12/EDIFACT/AS2) → Integration Account + connectors (native)
- Orchestration → Logic Apps Standard workflow (native)
- XSLT map → Transform XML action (native; upload to Integration Account or directly)
- Liquid templates → Liquid transform action (native)
- BAM → Azure Business Process Tracking (native)

Use Azure Functions ONLY for: >10 min processing, large streaming, complex batching,
Durable Functions patterns, non-.NET languages.
`;

/**
 * Returns the compact LLM prompt insert for component mapping.
 */
export function getCompactMappingForPrompt(platform: string): string {
    switch (platform.toLowerCase()) {
        case 'biztalk':
            return COMPACT_MAPPING_REFERENCE;
        default:
            return '';
    }
}
