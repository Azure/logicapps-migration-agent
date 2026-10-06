# Confluence Publishing

Analysis and planning reports can be exported as DOCX or published as native
Confluence pages. DOCX remains the default. A Confluence export creates a
sanitized local bundle first, then opens the provisioned
`@confluence-publisher` agent.

## Runtime flow

1. Select **Confluence** in the report destination dropdown.
2. The extension writes `report.md`, `manifest.json`, and rendered PNG
   attachments under `.vscode/migration/confluence-exports/`.
3. Agent Chat opens `@confluence-publisher`, which reads the
   `confluence-publishing` skill.
4. The agent discovers the live schemas exposed by the official Atlassian Rovo
   MCP Server at `https://mcp.atlassian.com/v2/mcp`.
5. On first publication, choose the site, space, and optional parent page.
   Subsequent updates use the saved page mapping and replace the complete page
   body.
6. One confirmation covers the page and all attachment writes. The agent
   writes `publish-receipt.json`; only a validated successful receipt removes
   the local bundle.

The mapping file is `.vscode/migration/confluence-publishing.json`. It stores
page identity and destination metadata, never credentials. Failed, partial,
cancelled, or receipt-less bundles remain available through **Logic Apps
Migration Agent: Retry Confluence Export**. **Clear Confluence Link** removes
only the local mapping; it never deletes the Confluence page.

## Live smoke test

Before running the smoke test, configure the official Atlassian Rovo MCP Server
in the host's Agent Chat MCP settings and authenticate through the host's
standard Atlassian flow. Do not paste or store tokens in the workspace.

1. Complete discovery and analysis for a flow that has an architecture diagram
   and at least one sequence diagram.
2. Open the analysis report and select **Confluence**, then choose **Export
   Report**.
3. In Agent Chat, verify that `@confluence-publisher` is selected and that the
   available MCP schemas are discovered from `https://mcp.atlassian.com/v2/mcp`.
4. Select a test site and space, optionally choose a parent page, inspect the
   report and attachment list, and confirm the complete transaction.
5. Verify the native page contains the complete report and that each PNG is
   attached and displayed in its corresponding section.
6. Repeat the export and verify that the same mapped page is fully replaced
   rather than creating a duplicate.
7. Inspect the local bundle and verify that a successful
   `publish-receipt.json` contains the page ID, HTTPS URL, site, space, title,
   and each attachment result, with no credentials or absolute local paths.
8. Test **Retry Confluence Export** with a deliberately cancelled or failed
   publication, then test **Clear Confluence Link** and verify that the remote
   page still exists.
