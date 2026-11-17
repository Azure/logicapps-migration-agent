# Synthetic Boomi Order Management application

A synthetic, interconnected corpus for testing Dell Boomi-to-Azure Logic Apps Standard migration tooling. It intentionally includes processes, maps, profiles, connections, connector operations, a Groovy script, OpenAPI, EDI/trading-partner metadata, properties, environment extensions, cross references, and deployment metadata.

IMPORTANT: The XML in this package is a synthetic migration-test representation. It has not been validated as importable AtomSphere native export XML and must not be treated as a production Boomi package.

Scenario: REST order intake -> validation -> CRM lookup -> ERP mapping/upsert -> event publication, plus invoice-to-X12/SFTP and a common error handler. Secrets are placeholders only.
