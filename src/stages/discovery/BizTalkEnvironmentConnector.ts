/**
 * Read-only live BizTalk environment discovery.
 *
 * The connector delegates SQL execution to sqlcmd so the extension does not
 * need to handle database passwords or add a native SQL driver in V1.
 *
 * @module stages/discovery/BizTalkEnvironmentConnector
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { LoggingService } from '../../services/LoggingService';
import {
    BizTalkEnvironmentConnection,
    EnvironmentApplication,
    EnvironmentArtifact,
    EnvironmentInventory,
    ArtifactCategory,
    LocalBizTalkConfiguration,
} from './types';

const execFileAsync = promisify(execFile);

/**
 * Default BizTalk Server Management REST API base URL, as configured by
 * `FeaturePack.ConfigureServices.ps1 -Service management` on the BizTalk box
 * (Feature Pack 2+, IIS-hosted). See
 * https://learn.microsoft.com/en-us/biztalk/core/install-and-configure-the-management-rest-apis-in-biztalk-server
 */
const DEFAULT_MANAGEMENT_REST_API_BASE_URL = 'http://localhost/BizTalkManagementService';

/**
 * Best-effort default projection against the well-known BizTalkMgmtDb schema
 * (bts_application / bts_assembly / bts_orchestration / bts_sendport /
 * bts_receiveport / bts_pipeline / bts_documentspec / bts_maptransform).
 * Column/table names are stable across BizTalk 2013-2020 for these core
 * tables, but if a given install differs, this query simply fails and the
 * caller falls back to the PowerShell/WMI/ExplorerOM detection path. Users
 * can also override this entirely via the `bizTalk.applicationQuery` setting.
 */
const DEFAULT_LOCAL_APPLICATION_QUERY = `
SELECT
  app.nID AS id,
  app.nvcName AS name,
  app.nvcDescription AS description,
  (
    SELECT o.nID AS id, o.nvcName AS name, 'orchestration' AS type, COALESCE(asm.nvcFullName, asm.nvcName) AS assemblyIdentity
    FROM bts_orchestration o
    INNER JOIN bts_assembly asm ON asm.nID = o.nAssemblyID
    WHERE asm.nApplicationID = app.nID
    UNION ALL
    SELECT sp.nID, sp.nvcName, 'binding', NULL
    FROM bts_sendport sp
    WHERE sp.nApplicationID = app.nID
    UNION ALL
    SELECT rp.nID, rp.nvcName, 'binding', NULL
    FROM bts_receiveport rp
    WHERE rp.nApplicationID = app.nID
    UNION ALL
    SELECT pl.nID, pl.nvcName, 'pipeline', COALESCE(asm4.nvcFullName, asm4.nvcName)
    FROM bts_pipeline pl
    LEFT JOIN bts_assembly asm4 ON asm4.nID = pl.nAssemblyID
    WHERE pl.nApplicationID = app.nID
    UNION ALL
    SELECT ds.nID, ds.nvcName, 'schema', COALESCE(asm2.nvcFullName, asm2.nvcName)
    FROM bts_documentspec ds
    INNER JOIN bts_assembly asm2 ON asm2.nID = ds.nAssemblyID
    WHERE asm2.nApplicationID = app.nID
    UNION ALL
    SELECT mt.nID, mt.nvcName, 'map', COALESCE(asm3.nvcFullName, asm3.nvcName)
    FROM bts_maptransform mt
    INNER JOIN bts_assembly asm3 ON asm3.nID = mt.nAssemblyID
    WHERE asm3.nApplicationID = app.nID
    UNION ALL
    SELECT asm5.nID, asm5.nvcName, 'assembly', COALESCE(asm5.nvcFullName, asm5.nvcName)
    FROM bts_assembly asm5
    WHERE asm5.nApplicationID = app.nID
    FOR JSON PATH
  ) AS artifacts
FROM bts_application app
FOR JSON PATH
`.trim();

interface SqlApplicationRow {
    id: string | number;
    name: string;
    description?: string | null;
    dependencyApplicationIds?: Array<string | number> | null;
    artifacts?: SqlArtifactRow[] | null;
}

interface SqlArtifactRow {
    id: string | number;
    name: string;
    type: string;
    assemblyIdentity?: string | null;
    metadata?: Record<string, string | number | boolean> | null;
}

/**
 * Executes a caller-provided, version-specific BizTalk projection.
 *
 * The projection must return one JSON array of rows shaped like
 * `SqlApplicationRow`. It should select only required columns and must not
 * contain secrets or use SELECT *. Use `{{BATCH_SIZE}}` in a TOP clause
 * when the projection needs a bounded result set.
 */
export class BizTalkEnvironmentConnector {
    private readonly logger = LoggingService.getInstance();

    /**
     * Discover a local BizTalk Group without requiring manual SQL settings.
     * Registry/configuration detection supplies connection context; the
     * installed BizTalk PowerShell provider supplies the compact inventory.
     */
    /**
     * Discover a local BizTalk Group without requiring manual SQL settings.
     *
     * Order of attempts:
     *  1. Read the Management DB server/database from the registry, then run
     *     a read-only SQL projection (default well-known schema query, or an
     *     `applicationQueryOverride` if supplied) via `sqlcmd`, parsed locally.
     *  2. If SQL discovery is unavailable or fails (sqlcmd missing, schema
     *     mismatch, connection failure), fall back to the BizTalk PowerShell
     *     cmdlets, then WMI, then the ExplorerOM assembly.
     */
    public async discoverLocal(options?: {
        applicationQueryOverride?: string;
        timeoutSeconds?: number;
        managementRestApiBaseUrl?: string;
    }): Promise<EnvironmentInventory> {
        const registryConfiguration = await this.detectLocalConfiguration();
        let sqlFailureReason: string | undefined;

        if (registryConfiguration.server && registryConfiguration.managementDatabase) {
            const timeoutSeconds = options?.timeoutSeconds ?? 60;

            // 1) Prefer the BizTalk Admin Console/Explorer's own `admdta_*`
            //    stored procedures when they exist in this Management DB -
            //    this reuses the exact same authoritative data path BizTalk's
            //    own tooling uses, instead of reverse-engineering table joins.
            try {
                const spRows = await this.runStoredProcedureDiscovery(
                    registryConfiguration.server,
                    registryConfiguration.managementDatabase,
                    timeoutSeconds
                );
                if (spRows.length > 0) {
                    const applications = spRows.map((row) => this.toApplication(row));
                    const environmentName = `${registryConfiguration.server}/${registryConfiguration.managementDatabase}`;
                    this.logger.info('Discovered local BizTalk environment using admdta_* stored procedures', {
                        server: registryConfiguration.server,
                        database: registryConfiguration.managementDatabase,
                        applicationCount: applications.length,
                    });
                    return {
                        id: `biztalk:local-sp:${environmentName}`,
                        environmentName,
                        managementConnection: { server: registryConfiguration.server, managementDatabase: registryConfiguration.managementDatabase },
                        applications: await this.enrichApplications(applications),
                        discoveredAt: new Date().toISOString(),
                        authentication: 'windows-integrated',
                    };
                }
                this.logger.warn('No admdta_* stored procedures / applications were found; falling back to raw table projection', {
                    server: registryConfiguration.server,
                    database: registryConfiguration.managementDatabase,
                });
            } catch (error) {
                this.logger.warn('Stored-procedure BizTalk discovery failed, falling back to raw table projection', {
                    server: registryConfiguration.server,
                    database: registryConfiguration.managementDatabase,
                    reason: error instanceof Error ? error.message : String(error),
                });
            }

            // 2) Fall back to a direct projection against the well-known
            //    bts_* tables (works even when admdta_* procs are missing).
            const query = (options?.applicationQueryOverride?.trim() || DEFAULT_LOCAL_APPLICATION_QUERY);
            try {
                const rows = await this.runSqlProjection(
                    registryConfiguration.server,
                    registryConfiguration.managementDatabase,
                    query,
                    timeoutSeconds
                );
                const applications = rows.map((row) => this.toApplication(row));
                const environmentName = `${registryConfiguration.server}/${registryConfiguration.managementDatabase}`;
                this.logger.info('Discovered local BizTalk environment using SQL projection', {
                    server: registryConfiguration.server,
                    database: registryConfiguration.managementDatabase,
                    applicationCount: applications.length,
                });
                return {
                    id: `biztalk:local-sql:${environmentName}`,
                    environmentName,
                    managementConnection: { server: registryConfiguration.server, managementDatabase: registryConfiguration.managementDatabase },
                    applications: await this.enrichApplications(applications),
                    discoveredAt: new Date().toISOString(),
                    authentication: 'windows-integrated',
                };
            } catch (error) {
                sqlFailureReason = error instanceof Error ? error.message : String(error);
                this.logger.warn('Local SQL-based BizTalk discovery failed, falling back to PowerShell/WMI/ExplorerOM', {
                    server: registryConfiguration.server,
                    database: registryConfiguration.managementDatabase,
                    reason: sqlFailureReason,
                });
            }
        }

        // 3) SQL (stored procedures, then raw table projection) is always
        //    tried first above. Only if both SQL paths are unavailable/fail
        //    do we try the officially documented BizTalk Server Management
        //    REST APIs (http://localhost/BizTalkManagementService), which
        //    require Feature Pack 2+ and IIS to have been configured via
        //    `FeaturePack.ConfigureServices.ps1` on the BizTalk box. See
        //    https://learn.microsoft.com/en-us/biztalk/core/install-and-configure-the-management-rest-apis-in-biztalk-server
        let restApiFailureReason: string | undefined;
        try {
            const restInventory = await this.discoverViaManagementRestApi(
                options?.managementRestApiBaseUrl,
                options?.timeoutSeconds ?? 60
            );
            if (restInventory.applications.length > 0) {
                this.logger.info('Discovered local BizTalk environment using the Management REST API', {
                    baseUrl: options?.managementRestApiBaseUrl ?? DEFAULT_MANAGEMENT_REST_API_BASE_URL,
                    applicationCount: restInventory.applications.length,
                });
                return {
                    ...restInventory,
                    ...(registryConfiguration.server && registryConfiguration.managementDatabase ? {
                        managementConnection: { server: registryConfiguration.server, managementDatabase: registryConfiguration.managementDatabase },
                    } : {}),
                    applications: await this.enrichApplications(restInventory.applications),
                };
            }
            restApiFailureReason = 'The Management REST API returned no applications.';
        } catch (error) {
            restApiFailureReason = error instanceof Error ? error.message : String(error);
        }
        this.logger.warn('Management REST API BizTalk discovery unavailable, falling back to PowerShell/WMI/ExplorerOM', {
            reason: restApiFailureReason,
        });

        const result = await execFileAsync(
            'powershell.exe',
            [
                '-NoProfile',
                '-NonInteractive',
                '-ExecutionPolicy', 'Bypass',
                '-Command',
                this.localDiscoveryScript(),
            ],
            { windowsHide: true, maxBuffer: 16 * 1024 * 1024 }
        );
        const output = result.stdout.trim();
        if (!output) {
            const suffix = sqlFailureReason ? ` SQL projection also failed: ${sqlFailureReason}` : '';
            const restSuffix = restApiFailureReason ? ` Management REST API also failed: ${restApiFailureReason}` : '';
            throw new Error(`BizTalk was not detected locally or returned no deployed applications.${suffix}${restSuffix}`);
        }

        const parsed = JSON.parse(output) as {
            configuration: LocalBizTalkConfiguration;
            applications: SqlApplicationRow[];
        };
        if (!Array.isArray(parsed.applications)) {
            throw new Error('Local BizTalk discovery returned an invalid application inventory.');
        }
        const applications = parsed.applications.map((row, index) => {
            if (!this.isApplicationRow(row)) {
                throw new Error(`Invalid local BizTalk application row at index ${index}.`);
            }
            return this.toApplication(row);
        });
        const environmentName = parsed.configuration.server && parsed.configuration.managementDatabase
            ? `${parsed.configuration.server}/${parsed.configuration.managementDatabase}`
            : 'local-biztalk';
        return {
            id: `biztalk:local:${environmentName}`,
            environmentName,
            ...(parsed.configuration.server && parsed.configuration.managementDatabase ? {
                managementConnection: { server: parsed.configuration.server, managementDatabase: parsed.configuration.managementDatabase },
            } : {}),
            applications: await this.enrichApplications(applications),
            discoveredAt: new Date().toISOString(),
            authentication: 'windows-integrated',
        };
    }

    public async discover(
        connection: BizTalkEnvironmentConnection
    ): Promise<EnvironmentInventory> {
        this.validateConnection(connection);

        const timeoutSeconds = connection.timeoutSeconds ?? 60;
        const batchSize = connection.batchSize ?? 100;
        const query = this.withBatchLimit(connection.applicationQuery, batchSize);

        this.logger.info('Discovering BizTalk applications using read-only SQL projection', {
            server: connection.server,
            database: connection.managementDatabase,
            batchSize,
        });

        const rows = await this.runSqlProjection(connection.server, connection.managementDatabase, query, timeoutSeconds);
        const applications = rows.map((row) => this.toApplication(row));

        return {
            id: `biztalk:${connection.server}:${connection.managementDatabase}`,
            environmentName: `${connection.server}/${connection.managementDatabase}`,
            managementConnection: { server: connection.server, managementDatabase: connection.managementDatabase },
            applications,
            discoveredAt: new Date().toISOString(),
            authentication: 'windows-integrated',
        };
    }

    /**
     * Runs a read-only SQL projection against the Management DB via `sqlcmd`
     * (Windows Integrated Auth) and parses the resulting JSON locally.
     */
    private async runSqlProjection(
        server: string,
        managementDatabase: string,
        query: string,
        timeoutSeconds: number
    ): Promise<SqlApplicationRow[]> {
        let stdout: string;
        try {
            const result = await execFileAsync(
                'sqlcmd',
                [
                    '-S', server,
                    '-d', managementDatabase,
                    '-E',
                    '-b',
                    '-l', String(timeoutSeconds),
                    '-h', '-1',
                    '-w', '65535',
                    '-y', '0',
                    '-Q', query,
                ],
                { windowsHide: true, maxBuffer: 16 * 1024 * 1024 }
            );
            stdout = result.stdout.trim();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error('BizTalk SQL discovery failed', error instanceof Error ? error : undefined, {
                server,
                database: managementDatabase,
            });
            throw new Error(`BizTalk SQL discovery failed: ${message}`);
        }

        return this.parseRows(stdout);
    }

    /**
     * Fetches applications/artifacts using BizTalk's own `admdta_*` stored
     * procedures (the same procedures the BizTalk Administration Console /
     * BizTalk Explorer use internally), instead of hand-written table joins.
     *
     * Because exact procedure names and parameter signatures vary by BizTalk
     * version/install, this discovers the procedures dynamically from
     * `sys.procedures`/`sys.parameters` and captures each procedure's result
     * set into a JSON-shaped, best-effort projection matching
     * `SqlApplicationRow`. Any procedure that doesn't exist, or whose call
     * fails (wrong parameter shape, permissions, etc.), is skipped without
     * failing the whole discovery - the caller falls back to the raw table
     * projection when this returns no applications.
     */
    private async runStoredProcedureDiscovery(
        server: string,
        managementDatabase: string,
        timeoutSeconds: number
    ): Promise<SqlApplicationRow[]> {
        let stdout: string;
        try {
            const result = await execFileAsync(
                'sqlcmd',
                [
                    '-S', server,
                    '-d', managementDatabase,
                    '-E',
                    '-b',
                    '-l', String(timeoutSeconds),
                    '-h', '-1',
                    '-w', '65535',
                    '-y', '0',
                    '-Q', this.storedProcedureDiscoveryScript(),
                ],
                { windowsHide: true, maxBuffer: 32 * 1024 * 1024 }
            );
            stdout = result.stdout.trim();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`BizTalk admdta_* stored-procedure discovery failed: ${message}`);
        }

        return this.parseRows(stdout);
    }

    /**
     * T-SQL batch that discovers and calls `admdta_*` stored procedures
     * (application listing plus per-application artifact procedures such as
     * `admdta_GetOrchestrations`, `admdta_GetSendPorts`, `admdta_GetSchemaRoots`,
     * etc.), normalizing their (unknown-in-advance) result columns into the
     * same `{ id, name, description, artifacts: [{ id, name, type,
     * assemblyIdentity }] }` shape produced by `DEFAULT_LOCAL_APPLICATION_QUERY`.
     * Each procedure call is wrapped in TRY/CATCH so a missing procedure or an
     * unexpected parameter shape on a given install is skipped rather than
     * aborting discovery.
     */
    private storedProcedureDiscoveryScript(): string {
        return String.raw`
SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#discoveryErrors') IS NOT NULL DROP TABLE #discoveryErrors;
CREATE TABLE #discoveryErrors (procName sysname, message nvarchar(4000));
GO
CREATE PROCEDURE #CaptureProcJson
    @procName sysname,
    @applicationId nvarchar(200) = NULL,
    @applicationName nvarchar(400) = NULL,
    @resultJson nvarchar(max) OUTPUT
AS
BEGIN
    SET @resultJson = NULL;
    BEGIN TRY
        DECLARE @objId int = OBJECT_ID(N'dbo.' + @procName, 'P');
        IF @objId IS NULL RETURN;

        DECLARE @execArgs nvarchar(max) = N'';
        SELECT @execArgs = @execArgs +
            CASE
                WHEN @applicationId IS NOT NULL AND (p.name LIKE '%applicationid%' OR p.name LIKE '%appid%' OR p.name = '@nID')
                    THEN p.name + N' = ' + @applicationId + N', '
                WHEN @applicationName IS NOT NULL AND (p.name LIKE '%applicationname%' OR p.name LIKE '%appname%')
                    THEN p.name + N' = N''' + REPLACE(@applicationName, '''', '''''') + N''', '
                ELSE N''
            END
        FROM sys.parameters p
        WHERE p.object_id = @objId AND p.parameter_id > 0;
        IF LEN(@execArgs) > 0 SET @execArgs = LEFT(@execArgs, LEN(@execArgs) - 1);

        DECLARE @cols nvarchar(max);
        SELECT @cols = STRING_AGG(CONVERT(nvarchar(max), QUOTENAME(name) + N' ' + system_type_name), N',')
        FROM sys.dm_exec_describe_first_result_set_for_object(@objId, 0)
        WHERE system_type_name IS NOT NULL;
        IF @cols IS NULL RETURN;

        IF OBJECT_ID('tempdb..#capture') IS NOT NULL DROP TABLE #capture;
        DECLARE @createSql nvarchar(max) = N'CREATE TABLE #capture (' + @cols + N');';
        EXEC(@createSql);

        DECLARE @insertSql nvarchar(max) = N'INSERT INTO #capture EXEC dbo.' + QUOTENAME(@procName) +
            CASE WHEN LEN(@execArgs) > 0 THEN N' ' + @execArgs ELSE N'' END + N';';
        EXEC(@insertSql);

        SELECT @resultJson = (SELECT * FROM #capture FOR JSON AUTO);
    END TRY
    BEGIN CATCH
        INSERT INTO #discoveryErrors (procName, message) VALUES (@procName, ERROR_MESSAGE());
    END CATCH
END
GO
DECLARE @appProc sysname;
SELECT TOP 1 @appProc = name FROM sys.procedures
WHERE name IN (N'admdta_GetApplications', N'admdta_GetApplicationList', N'admdta_EnumApplications', N'admdta_GetApplication')
ORDER BY CASE name WHEN N'admdta_GetApplications' THEN 0 ELSE 1 END;

IF @appProc IS NULL
    SELECT TOP 1 @appProc = name FROM sys.procedures
    WHERE name LIKE N'admdta_Get%Application%' AND name NOT LIKE N'%Binding%' AND name NOT LIKE N'%Role%'
    ORDER BY name;

IF @appProc IS NULL
BEGIN
    RAISERROR('No admdta_* application-listing stored procedure was found in this Management DB.', 16, 1);
    RETURN;
END

DECLARE @appJson nvarchar(max);
EXEC #CaptureProcJson @procName = @appProc, @resultJson = @appJson OUTPUT;
IF @appJson IS NULL
BEGIN
    RAISERROR('The discovered application stored procedure did not return a usable result set.', 16, 1);
    RETURN;
END

DECLARE @apps TABLE (id nvarchar(200), name nvarchar(400), description nvarchar(1000));
INSERT INTO @apps (id, name, description)
SELECT
    COALESCE(nID, ID, Id, ApplicationID, applicationId, ApplicationId) AS id,
    COALESCE(nvcName, Name, ApplicationName, applicationName, name) AS name,
    COALESCE(nvcDescription, Description, description) AS description
FROM OPENJSON(@appJson)
WITH (
    nID nvarchar(200) '$.nID', ID nvarchar(200) '$.ID', Id nvarchar(200) '$.Id',
    ApplicationID nvarchar(200) '$.ApplicationID', applicationId nvarchar(200) '$.applicationId', ApplicationId nvarchar(200) '$.ApplicationId',
    nvcName nvarchar(400) '$.nvcName', Name nvarchar(400) '$.Name', ApplicationName nvarchar(400) '$.ApplicationName',
    applicationName nvarchar(400) '$.applicationName', name nvarchar(400) '$.name',
    nvcDescription nvarchar(1000) '$.nvcDescription', Description nvarchar(1000) '$.Description', description nvarchar(1000) '$.description'
) j
WHERE COALESCE(nID, ID, Id, ApplicationID, applicationId, ApplicationId) IS NOT NULL;

DECLARE @categories TABLE (type nvarchar(50), procName sysname);
INSERT INTO @categories (type, procName) VALUES
 (N'orchestration', N'admdta_GetOrchestrations'),
 (N'binding', N'admdta_GetSendPorts'),
 (N'binding', N'admdta_GetReceivePorts'),
 (N'binding', N'admdta_GetReceiveLocations'),
 (N'pipeline', N'admdta_GetPipelines'),
 (N'schema', N'admdta_GetSchemas'),
 (N'schema', N'admdta_GetSchemaRoots'),
 (N'map', N'admdta_GetTransforms'),
 (N'map', N'admdta_GetMaps'),
 (N'assembly', N'admdta_GetAssemblies');

DECLARE @flatArtifacts TABLE (applicationId nvarchar(200), id nvarchar(400), name nvarchar(400), type nvarchar(50), assemblyIdentity nvarchar(400));

DECLARE @appId nvarchar(200), @appName nvarchar(400);
DECLARE appCursor CURSOR LOCAL FAST_FORWARD FOR SELECT id, name FROM @apps;
OPEN appCursor;
FETCH NEXT FROM appCursor INTO @appId, @appName;
WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @catType nvarchar(50), @catProc sysname;
    DECLARE catCursor CURSOR LOCAL FAST_FORWARD FOR SELECT type, procName FROM @categories;
    OPEN catCursor;
    FETCH NEXT FROM catCursor INTO @catType, @catProc;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        DECLARE @rowJson nvarchar(max);
        EXEC #CaptureProcJson @procName = @catProc, @applicationId = @appId, @applicationName = @appName, @resultJson = @rowJson OUTPUT;
        IF @rowJson IS NOT NULL
        BEGIN
            INSERT INTO @flatArtifacts (applicationId, id, name, type, assemblyIdentity)
            SELECT
                @appId,
                COALESCE(nID, ID, Id, name2, NEWID()),
                COALESCE(nvcName, Name, PortName, TransformName, SchemaName, name2, @catProc),
                @catType,
                COALESCE(AssemblyName, nvcAssemblyName, NULL)
            FROM OPENJSON(@rowJson)
            WITH (
                nID nvarchar(400) '$.nID', ID nvarchar(400) '$.ID', Id nvarchar(400) '$.Id',
                nvcName nvarchar(400) '$.nvcName', Name nvarchar(400) '$.Name',
                PortName nvarchar(400) '$.PortName', TransformName nvarchar(400) '$.TransformName',
                SchemaName nvarchar(400) '$.SchemaName', name2 nvarchar(400) '$.name',
                AssemblyName nvarchar(400) '$.AssemblyName', nvcAssemblyName nvarchar(400) '$.nvcAssemblyName'
            ) r;
        END
        FETCH NEXT FROM catCursor INTO @catType, @catProc;
    END
    CLOSE catCursor; DEALLOCATE catCursor;

    FETCH NEXT FROM appCursor INTO @appId, @appName;
END
CLOSE appCursor; DEALLOCATE appCursor;

SELECT
    a.id, a.name, a.description,
    (
        SELECT f.id, f.name, f.type, f.assemblyIdentity
        FROM @flatArtifacts f
        WHERE f.applicationId = a.id
        FOR JSON PATH
    ) AS artifacts
FROM @apps a
FOR JSON PATH;
`.trim();
    }

    /**
     * Discovers applications/artifacts through the officially documented
     * BizTalk Server Management REST APIs
     * (http://localhost/BizTalkManagementService by default), used only as a
     * fallback when SQL (stored procedures and raw table projection) is
     * unavailable. The service must already be installed/configured on the
     * BizTalk box via `FeaturePack.ConfigureServices.ps1 -Service management`
     * (Feature Pack 2+); if it isn't, the GET calls fail fast and this method
     * throws so the caller can fall back further to PowerShell/WMI/ExplorerOM.
     *
     * Windows-integrated auth is delegated to `Invoke-RestMethod
     * -UseDefaultCredentials` (NTLM/Negotiate via IIS) rather than a Node
     * HTTP client, since Node has no built-in SSPI/NTLM support.
     */
    private async discoverViaManagementRestApi(
        baseUrlOverride: string | undefined,
        timeoutSeconds: number
    ): Promise<EnvironmentInventory> {
        const baseUrl = (baseUrlOverride?.trim() || DEFAULT_MANAGEMENT_REST_API_BASE_URL).replace(/\/+$/, '');
        let stdout: string;
        try {
            const result = await execFileAsync(
                'powershell.exe',
                [
                    '-NoProfile',
                    '-NonInteractive',
                    '-ExecutionPolicy', 'Bypass',
                    '-Command',
                    this.managementRestApiDiscoveryScript(baseUrl, timeoutSeconds),
                ],
                { windowsHide: true, maxBuffer: 32 * 1024 * 1024 }
            );
            stdout = result.stdout.trim();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`BizTalk Management REST API discovery failed: ${message}`);
        }

        if (!stdout) {
            throw new Error('BizTalk Management REST API returned no output.');
        }

        const parsed = JSON.parse(stdout) as { applications?: SqlApplicationRow[] };
        if (!Array.isArray(parsed.applications)) {
            throw new Error('BizTalk Management REST API returned an invalid application inventory.');
        }
        const applications = parsed.applications.map((row, index) => {
            if (!this.isApplicationRow(row)) {
                throw new Error(`Invalid BizTalk Management REST API application row at index ${index}.`);
            }
            return this.toApplication(row);
        });

        return {
            id: `biztalk:local-rest:${baseUrl}`,
            environmentName: baseUrl,
            applications,
            discoveredAt: new Date().toISOString(),
            authentication: 'windows-integrated',
        };
    }

    /**
     * Calls the documented `GET` endpoints (`/Applications`, `/Orchestrations`,
     * `/SendPorts`, `/ReceivePorts`, `/ReceiveLocations`, `/Pipelines`,
     * `/Schemas`, `/Transforms`) and buckets each flat artifact list by its
     * `ApplicationName` field into the same `{ id, name, description,
     * artifacts: [...] }` shape used by the SQL discovery paths.
     */
    private managementRestApiDiscoveryScript(baseUrl: string, timeoutSeconds: number): string {
        return String.raw`
$ErrorActionPreference = 'Stop'
$baseUrl = '${baseUrl}'
$timeoutSeconds = ${timeoutSeconds}

function Invoke-BizTalkRest([string]$resourcePath) {
  try {
    return @(Invoke-RestMethod -Uri "$baseUrl/$resourcePath" -Method Get -UseDefaultCredentials -TimeoutSec $timeoutSeconds -ErrorAction Stop)
  } catch {
    return @()
  }
}

$applicationsRaw = Invoke-BizTalkRest 'Applications'
if (-not $applicationsRaw -or $applicationsRaw.Count -eq 0) {
  throw "GET $baseUrl/Applications returned no applications; verify the Management REST API is installed and configured (FeaturePack.ConfigureServices.ps1 -Service management)."
}

$artifactResources = @(
  @{ Path = 'Orchestrations'; Type = 'orchestration' },
  @{ Path = 'SendPorts'; Type = 'binding' },
  @{ Path = 'ReceivePorts'; Type = 'binding' },
  @{ Path = 'ReceiveLocations'; Type = 'binding' },
  @{ Path = 'Pipelines'; Type = 'pipeline' },
  @{ Path = 'Schemas'; Type = 'schema' },
  @{ Path = 'Transforms'; Type = 'map' }
)

$artifactsByApplication = @{}
foreach ($resource in $artifactResources) {
  $items = Invoke-BizTalkRest $resource.Path
  foreach ($item in $items) {
    $applicationName = $null
    foreach ($name in @('ApplicationName','applicationName')) {
      if (-not $applicationName -and $item.PSObject.Properties.Name -contains $name) { $applicationName = [string]$item.$name }
    }
    if (-not $applicationName) { continue }
    $artifactName = $null
    foreach ($name in @('Name','FullName','PortName','SchemaName','TransformName','PipelineName','OrchestrationName')) {
      if (-not $artifactName -and $item.PSObject.Properties.Name -contains $name) { $artifactName = [string]$item.$name }
    }
    if (-not $artifactName) { $artifactName = $resource.Path }
    $assemblyIdentity = $null
    foreach ($name in @('AssemblyName','FullName')) {
      if (-not $assemblyIdentity -and $item.PSObject.Properties.Name -contains $name) { $assemblyIdentity = [string]$item.$name }
    }
    if (-not $artifactsByApplication.ContainsKey($applicationName)) { $artifactsByApplication[$applicationName] = @() }
    $artifactsByApplication[$applicationName] += [ordered]@{
      id = "$($applicationName):$($resource.Path):$artifactName"
      name = $artifactName
      type = $resource.Type
      assemblyIdentity = $assemblyIdentity
    }
  }
}

$applications = @()
foreach ($application in $applicationsRaw) {
  $applicationName = if ($application.PSObject.Properties.Name -contains 'Name') { [string]$application.Name } else { $null }
  if (-not $applicationName) { continue }
  $artifacts = if ($artifactsByApplication.ContainsKey($applicationName)) { $artifactsByApplication[$applicationName] } else { @() }
  $applications += [ordered]@{
    id = $applicationName
    name = $applicationName
    description = if ($application.PSObject.Properties.Name -contains 'Description') { [string]$application.Description } else { $null }
    dependencyApplicationIds = @()
    artifacts = $artifacts
  }
}

[ordered]@{ applications = $applications } | ConvertTo-Json -Depth 8 -Compress
`;
    }

    /**
     * Best-effort enrichment: exports the authoritative BindingInfo.xml for
     * each discovered application directly from the BizTalk Group using the
     * officially supported `BTSTask.exe ExportBindings` tool, so binding-type
     * artifacts (send/receive ports) can be parsed without any local source
     * folder. A per-application temp file is used only as the interchange
     * format `BTSTask` requires and is deleted immediately after reading; no
     * on-disk source project is created or required.
     *
     * Failures (BTSTask missing, application not found, export error) are
     * logged and skipped per-application — this is best-effort enrichment,
     * not a requirement for discovery to succeed.
     */
    private async enrichWithExportedBindings(
        applications: EnvironmentApplication[]
    ): Promise<EnvironmentApplication[]> {
        const enriched: EnvironmentApplication[] = [];
        for (const application of applications) {
            const bindingsXml = await this.exportApplicationBindings(application.name);
            enriched.push(bindingsXml ? { ...application, bindingsXml } : application);
        }
        return enriched;
    }

    /**
     * Combined best-effort enrichment applied after every discovery path:
     * (1) exports authoritative bindings via BTSTask, and (2) reflects the
     * original `.xsd` text embedded in each deployed schema class's
     * `XmlContent` property directly out of the GAC-deployed assembly, so
     * schema artifacts can be parsed into IR without any local source
     * folder. Neither step requires or produces a persistent workspace path.
     */
    private async enrichApplications(
        applications: EnvironmentApplication[]
    ): Promise<EnvironmentApplication[]> {
        const withBindings = await this.enrichWithExportedBindings(applications);
        return this.enrichWithReflectedSchemaContent(withBindings);
    }

    private async exportApplicationBindings(applicationName: string): Promise<string | undefined> {
        const tempFile = path.join(
            os.tmpdir(),
            `biztalk-export-${crypto.randomUUID()}.BindingInfo.xml`
        );
        try {
            await execFileAsync(
                'BTSTask.exe',
                ['ExportBindings', `/ApplicationName:${applicationName}`, `/Destination:${tempFile}`],
                { windowsHide: true, maxBuffer: 16 * 1024 * 1024 }
            );
            const content = await fs.promises.readFile(tempFile, 'utf-8');
            return content;
        } catch (error) {
            this.logger.warn('Failed to export BizTalk application bindings via BTSTask', {
                applicationName,
                reason: error instanceof Error ? error.message : String(error),
            });
            return undefined;
        } finally {
            await fs.promises.unlink(tempFile).catch(() => undefined);
        }
    }

    /**
     * Best-effort enrichment: reflects the original design-time XML text out
     * of each deployed artifact assembly's compiled type(s). BizTalk compiles
     * every schema and pipeline into a .NET class deriving from
     * `Microsoft.XLANGs.BaseTypes.SchemaBase` / `...PipelineBase`
     * respectively, both of which always expose an `XmlContent` property
     * returning the exact original `.xsd`/`.btp` text used at compile time -
     * this is the standard, documented way to recover schema/pipeline source
     * from a deployed (GAC) assembly without a local source folder.
     *
     * Artifacts are grouped by `(assemblyIdentity, baseType)` so each
     * distinct assembly is only loaded/reflected once per artifact kind, then
     * matched back to artifacts by CLR type name (falls back to a suffix
     * match since the SQL/stored-procedure projections may return either the
     * short or fully-qualified name depending on BizTalk version).
     */
    private async enrichWithReflectedSchemaContent(
        applications: EnvironmentApplication[]
    ): Promise<EnvironmentApplication[]> {
        const reflectableKinds: Array<{ artifactType: string; baseTypeFullName: string }> = [
            { artifactType: 'schema', baseTypeFullName: 'Microsoft.XLANGs.BaseTypes.SchemaBase' },
            { artifactType: 'pipeline', baseTypeFullName: 'Microsoft.XLANGs.BaseTypes.PipelineBase' },
        ];

        const assemblyToEntries = new Map<
            string,
            { artifactType: string; baseTypeFullName: string; entries: Array<{ applicationId: string; artifactId: string }> }
        >();
        for (const { artifactType, baseTypeFullName } of reflectableKinds) {
            for (const application of applications) {
                for (const artifact of application.artifacts) {
                    if (artifact.type === artifactType && artifact.assemblyIdentity && !artifact.content) {
                        const key = `${baseTypeFullName}::${artifact.assemblyIdentity}`;
                        const existing = assemblyToEntries.get(key) ?? { artifactType, baseTypeFullName, entries: [] };
                        existing.entries.push({ applicationId: application.id, artifactId: artifact.id });
                        assemblyToEntries.set(key, existing);
                    }
                }
            }
        }
        if (assemblyToEntries.size === 0) {
            return applications;
        }

        // artifactId -> reflected XML text (artifactId is unique enough within
        // this discovery run; applicationId is only used for logging context).
        const contentByArtifactId = new Map<string, string>();
        const artifactNameById = new Map<string, string>();
        for (const application of applications) {
            for (const artifact of application.artifacts) {
                artifactNameById.set(artifact.id, artifact.name);
            }
        }

        for (const [key, { artifactType, baseTypeFullName, entries }] of assemblyToEntries) {
            const assemblyIdentity = key.slice(baseTypeFullName.length + 2);
            let reflectedTypes: Array<{ typeName: string; xmlContent: string }>;
            try {
                reflectedTypes = await this.reflectXmlContent(assemblyIdentity, baseTypeFullName);
            } catch (error) {
                this.logger.warn(`Failed to reflect ${artifactType} XmlContent from a deployed BizTalk assembly`, {
                    assemblyIdentity,
                    reason: error instanceof Error ? error.message : String(error),
                });
                continue;
            }
            if (reflectedTypes.length === 0) {
                continue;
            }
            for (const entry of entries) {
                const artifactName = artifactNameById.get(entry.artifactId);
                if (!artifactName) {
                    continue;
                }
                const match =
                    reflectedTypes.find((type) => type.typeName === artifactName) ??
                    reflectedTypes.find(
                        (type) =>
                            type.typeName.toLowerCase().endsWith(`.${artifactName.toLowerCase()}`) ||
                            artifactName.toLowerCase().endsWith(`.${type.typeName.toLowerCase()}`)
                    );
                if (match) {
                    contentByArtifactId.set(entry.artifactId, match.xmlContent);
                }
            }
        }

        if (contentByArtifactId.size === 0) {
            return applications;
        }

        return applications.map((application) => ({
            ...application,
            artifacts: application.artifacts.map((artifact) => {
                const content = contentByArtifactId.get(artifact.id);
                return content ? { ...artifact, content } : artifact;
            }),
        }));
    }

    private async reflectXmlContent(
        assemblyIdentity: string,
        baseTypeFullName: string
    ): Promise<Array<{ typeName: string; xmlContent: string }>> {
        const result = await execFileAsync(
            'powershell.exe',
            [
                '-NoProfile',
                '-NonInteractive',
                '-ExecutionPolicy', 'Bypass',
                '-Command',
                this.reflectXmlContentScript(assemblyIdentity, baseTypeFullName),
            ],
            { windowsHide: true, maxBuffer: 32 * 1024 * 1024 }
        );
        const output = result.stdout.trim();
        if (!output) {
            return [];
        }
        const parsed = JSON.parse(output) as unknown;
        const rows = Array.isArray(parsed) ? parsed : [parsed];
        return rows
            .filter(
                (row): row is { typeName: string; xmlContent: string } =>
                    !!row &&
                    typeof row === 'object' &&
                    typeof (row as Record<string, unknown>).typeName === 'string' &&
                    typeof (row as Record<string, unknown>).xmlContent === 'string'
            );
    }

    /**
     * Loads the given assembly (by simple or strong name) and reflects every
     * non-abstract type deriving from `baseTypeFullName` (a BizTalk
     * `...Base` type that always exposes an `XmlContent` property, e.g.
     * `SchemaBase` for `.xsd` or `PipelineBase` for `.btp`), returning each
     * type's `XmlContent` (the original compiled-in design XML) as
     * `{ typeName, xmlContent }`. Assembly loading tries, in order:
     * `Assembly.Load` (exact strong name), `LoadWithPartialName` (simple
     * name against the GAC), then a direct file-system scan of the .NET
     * Framework GAC folders (`GAC_MSIL`/`GAC_64`/`GAC_32`) for a matching
     * assembly folder, loaded via `LoadFrom`. Per-type reflection failures
     * are swallowed so one bad class doesn't block the others in the same
     * assembly.
     */
    private reflectXmlContentScript(assemblyIdentity: string, baseTypeFullName: string): string {
        const escapedAssemblyIdentity = assemblyIdentity.replace(/'/g, "''");
        const escapedBaseTypeFullName = baseTypeFullName.replace(/'/g, "''");
        return String.raw`
$ErrorActionPreference = 'Stop'
$assemblyIdentity = '${escapedAssemblyIdentity}'
$baseTypeFullName = '${escapedBaseTypeFullName}'

function Find-GacAssemblyFile([string]$simpleName, [string]$requiredIdentity = '') {
  $gacRoots = @(
    "$env:windir\Microsoft.NET\assembly\GAC_MSIL",
    "$env:windir\Microsoft.NET\assembly\GAC_64",
    "$env:windir\Microsoft.NET\assembly\GAC_32",
    "$env:windir\assembly\GAC_MSIL"
  )
  foreach ($root in $gacRoots) {
    if (-not (Test-Path $root)) { continue }
    $candidateDir = Join-Path $root $simpleName
    if (Test-Path $candidateDir) {
      $dll = Get-ChildItem -Path $candidateDir -Filter "$simpleName.dll" -Recurse -ErrorAction SilentlyContinue | Where-Object {
        if (-not $requiredIdentity) { return $true }
        try { return [Reflection.AssemblyName]::GetAssemblyName($_.FullName).FullName -eq $requiredIdentity } catch { return $false }
      } | Select-Object -First 1
      if ($dll) { return $dll.FullName }
    }
  }
  return $null
}

# Best-effort: make the Microsoft.XLANGs.BaseTypes assembly (SchemaBase/PipelineBase live here)
# available in this process. Add-Type -AssemblyName can throw a *terminating* exception (not just
# a non-terminating error) when the assembly can't be resolved by simple name, which -ErrorAction
# SilentlyContinue does NOT suppress under $ErrorActionPreference = 'Stop' — so this must be
# wrapped in try/catch, with a GAC file-system fallback identical to the one used for artifact
# assemblies below.
try {
  Add-Type -AssemblyName 'Microsoft.XLANGs.BaseTypes' | Out-Null
} catch {
  try {
    $baseTypesAssembly = [System.Reflection.Assembly]::Load('Microsoft.XLANGs.BaseTypes')
  } catch {
    $baseTypesAssembly = $null
  }
  if (-not $baseTypesAssembly) {
    $baseTypesGacFile = Find-GacAssemblyFile 'Microsoft.XLANGs.BaseTypes'
    if ($baseTypesGacFile) {
      try { [System.Reflection.Assembly]::LoadFrom($baseTypesGacFile) | Out-Null } catch { }
    }
  }
}

$assembly = $null
if ($assemblyIdentity -notmatch ',\s*Version=' -or $assemblyIdentity -notmatch ',\s*Culture=' -or $assemblyIdentity -notmatch ',\s*PublicKeyToken=') {
  throw "Refusing partial-name reflection for '$assemblyIdentity'; full deployed assembly identity is required."
}
$requiredIdentity = (New-Object Reflection.AssemblyName($assemblyIdentity)).FullName
try { $assembly = [System.Reflection.Assembly]::Load($assemblyIdentity) } catch { $assembly = $null }
if ($assembly -and $assembly.FullName -ne $requiredIdentity) { $assembly = $null }
if (-not $assembly) {
  $simpleName = ($assemblyIdentity -split ',')[0].Trim()
  $gacFile = Find-GacAssemblyFile $simpleName $requiredIdentity
  if ($gacFile) {
    try { $assembly = [System.Reflection.Assembly]::LoadFrom($gacFile) } catch { $assembly = $null }
  }
}
if (-not $assembly -or $assembly.FullName -ne $requiredIdentity) {
  throw "Could not load exact BizTalk assembly '$assemblyIdentity' from the GAC. No other version was substituted."
}

$baseType = $assembly.GetType($baseTypeFullName)
if (-not $baseType) {
  foreach ($loaded in [System.AppDomain]::CurrentDomain.GetAssemblies()) {
    $candidate = $loaded.GetType($baseTypeFullName)
    if ($candidate) { $baseType = $candidate; break }
  }
}
if (-not $baseType) {
  throw "Could not resolve base type '$baseTypeFullName'; ensure the BizTalk Administration tools (Microsoft.XLANGs.BaseTypes) are installed on this machine."
}

$results = @()
foreach ($type in $assembly.GetTypes()) {
  if (-not $baseType.IsAssignableFrom($type)) { continue }
  if ($type.IsAbstract) { continue }
  try {
    $flags = [System.Reflection.BindingFlags]'Public,NonPublic,Instance,Static'
    $property = $type.GetProperty('XmlContent', $flags)
    if (-not $property) { continue }
    $xmlContent = $null
    if ($property.GetGetMethod($true).IsStatic) {
      $xmlContent = $property.GetValue($null)
    } else {
      $instance = [Activator]::CreateInstance($type)
      $xmlContent = $property.GetValue($instance)
    }
    if ($xmlContent) {
      $results += [ordered]@{ typeName = $type.FullName; xmlContent = [string]$xmlContent }
    }
  } catch { continue }
}
$results | ConvertTo-Json -Depth 4 -Compress
`;
    }

    /**
     * Reads the Management DB server/database from the registry only
     * (no PowerShell BizTalk cmdlets/WMI/ExplorerOM required).
     */
    private async detectLocalConfiguration(): Promise<LocalBizTalkConfiguration> {
        const result = await execFileAsync(
            'powershell.exe',
            [
                '-NoProfile',
                '-NonInteractive',
                '-ExecutionPolicy', 'Bypass',
                '-Command',
                this.registryDetectionScript(),
            ],
            { windowsHide: true, maxBuffer: 1024 * 1024 }
        );
        const output = result.stdout.trim();
        if (!output) {
            return { server: undefined, managementDatabase: undefined, source: 'powershell' };
        }
        try {
            return JSON.parse(output) as LocalBizTalkConfiguration;
        } catch {
            return { server: undefined, managementDatabase: undefined, source: 'powershell' };
        }
    }

    private registryDetectionScript(): string {
        return String.raw`
$ErrorActionPreference = 'Stop'
$configuration = [ordered]@{ server = $null; managementDatabase = $null; source = 'powershell' }
$registryPaths = @(
  'HKLM:\SOFTWARE\Microsoft\BizTalk Server\3.0',
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\BizTalk Server\3.0',
  'HKLM:\SOFTWARE\Microsoft\BizTalk Server\3.0\Administration',
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\BizTalk Server\3.0\Administration'
)
foreach ($registryPath in $registryPaths) {
  if (Test-Path $registryPath) {
        $item = Get-ItemProperty -Path $registryPath
        foreach ($name in @('MgmtDBServer','MgmtDbServer','ManagementDatabaseServer','Server')) {
          if (-not $configuration.server -and $item.PSObject.Properties.Name -contains $name) { $configuration.server = [string]$item.$name }
        }
        foreach ($name in @('MgmtDBName','MgmtDbName','ManagementDatabase','Database')) {
          if (-not $configuration.managementDatabase -and $item.PSObject.Properties.Name -contains $name) { $configuration.managementDatabase = [string]$item.$name }
        }
        if ($configuration.server -or $configuration.managementDatabase) { $configuration.source = 'registry' }
  }
}
$configuration | ConvertTo-Json -Depth 3 -Compress
`;
    }

    private localDiscoveryScript(): string {
            return String.raw`
$ErrorActionPreference = 'Stop'
$configuration = [ordered]@{ server = $null; managementDatabase = $null; source = 'powershell' }
$diagnostics = [ordered]@{ registryPathsChecked = @(); cmdletFound = $false; wmiFound = $false; explorerOmFound = $false; explorerOmCandidatePaths = @() }
$registryPaths = @(
  'HKLM:\SOFTWARE\Microsoft\BizTalk Server\3.0',
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\BizTalk Server\3.0',
  'HKLM:\SOFTWARE\Microsoft\BizTalk Server\3.0\Administration',
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\BizTalk Server\3.0\Administration'
)
foreach ($registryPath in $registryPaths) {
  $diagnostics.registryPathsChecked += "$registryPath : $(Test-Path $registryPath)"
  if (Test-Path $registryPath) {
        $item = Get-ItemProperty -Path $registryPath
        foreach ($name in @('MgmtDBServer','MgmtDbServer','ManagementDatabaseServer','Server')) {
          if (-not $configuration.server -and $item.PSObject.Properties.Name -contains $name) { $configuration.server = [string]$item.$name }
        }
        foreach ($name in @('MgmtDBName','MgmtDbName','ManagementDatabase','Database')) {
          if (-not $configuration.managementDatabase -and $item.PSObject.Properties.Name -contains $name) { $configuration.managementDatabase = [string]$item.$name }
        }
        if ($configuration.server -or $configuration.managementDatabase) { $configuration.source = 'registry' }
  }
}
Import-Module 'BizTalk' -ErrorAction SilentlyContinue
$getApplication = Get-Command Get-BTSApplication -ErrorAction SilentlyContinue
$diagnostics.cmdletFound = [bool]$getApplication
$applications = @()
if ($getApplication) {
  $discoveredApplications = @(Get-BTSApplication)
} else {
  $applicationClass = Get-CimClass -Namespace 'root\MicrosoftBizTalkServer' -ClassName 'MSBTS_Application' -ErrorAction SilentlyContinue
  $diagnostics.wmiFound = [bool]$applicationClass
  if ($applicationClass) {
        $discoveredApplications = @(Get-CimInstance -Namespace 'root\MicrosoftBizTalkServer' -ClassName 'MSBTS_Application')
  } else {
        $explorerOmAssemblyName = 'Microsoft.BizTalk.ExplorerOM, Version=3.0.1.0, Culture=neutral, PublicKeyToken=31bf3856ad364e35'
        $explorerAssemblyCandidates = @(
          "$env:ProgramFiles\Microsoft BizTalk Server\Microsoft.BizTalk.ExplorerOM.dll",
          "\${env:ProgramFiles(x86)}\Microsoft BizTalk Server\Microsoft.BizTalk.ExplorerOM.dll",
          "$env:ProgramFiles\Microsoft BizTalk Server\Administration\Microsoft.BizTalk.ExplorerOM.dll",
          "\${env:ProgramFiles(x86)}\Microsoft BizTalk Server\Administration\Microsoft.BizTalk.ExplorerOM.dll",
          "$env:ProgramFiles\Microsoft BizTalk Server 2020\Microsoft.BizTalk.ExplorerOM.dll",
          "\${env:ProgramFiles(x86)}\Microsoft BizTalk Server 2020\Microsoft.BizTalk.ExplorerOM.dll",
          "$env:ProgramFiles\Microsoft BizTalk Server 2016\Microsoft.BizTalk.ExplorerOM.dll",
          "\${env:ProgramFiles(x86)}\Microsoft BizTalk Server 2016\Microsoft.BizTalk.ExplorerOM.dll"
        )
        $diagnostics.explorerOmCandidatePaths = $explorerAssemblyCandidates
        $explorerAssembly = $explorerAssemblyCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
        $explorerOmLoaded = $false
        try {
          Add-Type -AssemblyName $explorerOmAssemblyName -ErrorAction Stop
          $explorerOmLoaded = $true
        } catch {
          if ($explorerAssembly) {
            try {
              Add-Type -Path $explorerAssembly -ErrorAction Stop
              $explorerOmLoaded = $true
            } catch { $explorerOmLoaded = $false }
          }
        }
        $diagnostics.explorerOmFound = $explorerOmLoaded
        if (-not $explorerOmLoaded -or -not $configuration.server -or -not $configuration.managementDatabase) {
          $diagnosticJson = ($diagnostics | ConvertTo-Json -Depth 6 -Compress)
          throw "BizTalk PowerShell cmdlets, WMI classes, and ExplorerOM were not found or the Management DB server/database could not be resolved from the registry. Configure the extension settings 'logicAppsMigrationAgent.bizTalk.server', 'managementDatabase', and 'applicationQuery' manually to use SQL-based discovery instead. Diagnostics: $diagnosticJson"
        }
        $catalog = New-Object Microsoft.BizTalk.ExplorerOM.BtsCatalogExplorer
        $catalog.ConnectionString = "Server=$($configuration.server);Database=$($configuration.managementDatabase);Integrated Security=SSPI"
        $discoveredApplications = @($catalog.Applications)
  }
}
foreach ($application in $discoveredApplications) {
  $artifacts = @()
  if ($getApplication -and $application.PSObject.Properties.Name -contains 'Resources') {
        foreach ($resource in @($application.Resources)) {
          $type = if ($resource.PSObject.Properties.Name -contains 'Type') { [string]$resource.Type } else { 'other' }
          $artifacts += [ordered]@{
            id = if ($resource.PSObject.Properties.Name -contains 'Id') { [string]$resource.Id } else { [guid]::NewGuid().ToString() }
            name = if ($resource.PSObject.Properties.Name -contains 'Name') { [string]$resource.Name } else { 'resource' }
            type = $type.ToLowerInvariant()
          }
        }
  }
  if (-not $getApplication -and -not $applicationClass) {
        $resourceCollections = @(
          @{ Property = 'Orchestrations'; Type = 'orchestration' },
          @{ Property = 'SendPorts'; Type = 'binding' },
          @{ Property = 'ReceivePorts'; Type = 'binding' },
          @{ Property = 'ReceiveLocations'; Type = 'binding' },
          @{ Property = 'Pipelines'; Type = 'pipeline' },
          @{ Property = 'Schemas'; Type = 'schema' },
          @{ Property = 'Maps'; Type = 'map' }
        )
        foreach ($collection in $resourceCollections) {
          $property = $application.PSObject.Properties[$collection.Property]
          if ($property) {
            foreach ($resource in @($property.Value)) {
              $resourceName = if ($resource.PSObject.Properties['Name']) { [string]$resource.Name } else { $collection.Property }
              $assemblyName = if ($resource.PSObject.Properties['AssemblyName']) { [string]$resource.AssemblyName } else { $null }
              $artifacts += [ordered]@{
                id = "$($application.Name):$($collection.Property):$resourceName"
                name = $resourceName
                type = $collection.Type
                assemblyIdentity = $assemblyName
              }
            }
          }
        }
  }
  if (-not $getApplication) {
        if ($applicationClass) {
        $applicationName = [string]$application.Name
        $wmiArtifactClasses = @(
          @{ ClassName = 'MSBTS_Orchestration'; Type = 'orchestration' },
          @{ ClassName = 'MSBTS_SendPort'; Type = 'binding' },
          @{ ClassName = 'MSBTS_ReceivePort'; Type = 'binding' },
          @{ ClassName = 'MSBTS_Pipeline'; Type = 'pipeline' },
          @{ ClassName = 'MSBTS_ReceiveLocation'; Type = 'binding' }
        )
        foreach ($artifactClass in $wmiArtifactClasses) {
          $instances = @(Get-CimInstance -Namespace 'root\MicrosoftBizTalkServer' -ClassName $artifactClass.ClassName -ErrorAction SilentlyContinue)
          foreach ($resource in $instances) {
            if ([string]$resource.ApplicationName -eq $applicationName) {
              $resourceName = if ($resource.PSObject.Properties.Name -contains 'Name') { [string]$resource.Name } else { $artifactClass.ClassName }
              $assemblyName = if ($resource.PSObject.Properties.Name -contains 'AssemblyName') { [string]$resource.AssemblyName } else { $null }
              $artifacts += [ordered]@{
                id = "$($artifactClass.ClassName):$resourceName"
                name = $resourceName
                type = $artifactClass.Type
                assemblyIdentity = $assemblyName
              }
            }
            }
          }
        }
  }
  $applications += [ordered]@{
        id = if ($application.PSObject.Properties.Name -contains 'Id') { [string]$application.Id } else { [string]$application.Name }
        name = [string]$application.Name
        description = if ($application.PSObject.Properties.Name -contains 'Description') { [string]$application.Description } else { $null }
        dependencyApplicationIds = @()
        artifacts = $artifacts
  }
}
[ordered]@{ configuration = $configuration; applications = $applications } | ConvertTo-Json -Depth 8 -Compress
`;
    }

    private validateConnection(connection: BizTalkEnvironmentConnection): void {
        if (!connection.server.trim()) {
            throw new Error('BizTalk SQL server is required.');
        }
        if (!connection.managementDatabase.trim()) {
            throw new Error('BizTalk Management DB name is required.');
        }
        if (!connection.applicationQuery.trim()) {
            throw new Error('A version-specific BizTalk application projection is required.');
        }
        if (/\bselect\s+\*/i.test(connection.applicationQuery)) {
            throw new Error('BizTalk discovery projections must not use SELECT *.');
        }
    }

    private withBatchLimit(query: string, batchSize: number): string {
        if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
            throw new Error('BizTalk discovery batchSize must be an integer between 1 and 1000.');
        }
        return query.replaceAll('{{BATCH_SIZE}}', String(batchSize)).trim();
    }

    private parseRows(stdout: string): SqlApplicationRow[] {
        if (!stdout) {
            return [];
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(stdout);
        } catch (error) {
            throw new Error(
                `BizTalk SQL projection returned invalid JSON: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }

        if (!Array.isArray(parsed)) {
            throw new Error('BizTalk SQL projection must return a JSON array.');
        }

        return parsed.map((row, index) => {
            if (!this.isApplicationRow(row)) {
                throw new Error(`Invalid BizTalk application row at index ${index}.`);
            }
            return row;
        });
    }

    private isApplicationRow(value: unknown): value is SqlApplicationRow {
        if (!value || typeof value !== 'object') {
            return false;
        }
        const row = value as Record<string, unknown>;
        return (
            (typeof row.id === 'string' || typeof row.id === 'number') &&
            typeof row.name === 'string' &&
            (row.artifacts === undefined || row.artifacts === null || Array.isArray(row.artifacts))
        );
    }

    private toApplication(row: SqlApplicationRow): EnvironmentApplication {
        return {
            id: String(row.id),
            name: row.name,
            ...(row.description ? { description: row.description } : {}),
            artifacts: (row.artifacts ?? []).map((artifact) => this.toArtifact(artifact)),
            dependencyApplicationIds: (row.dependencyApplicationIds ?? []).map(String),
        };
    }

    private toArtifact(artifact: SqlArtifactRow): EnvironmentArtifact {
        return {
            id: String(artifact.id),
            name: artifact.name,
            type: this.toArtifactCategory(artifact.type),
            ...(artifact.assemblyIdentity || artifact.type === 'assembly'
                ? { assemblyIdentity: artifact.assemblyIdentity || artifact.name } : {}),
            ...(artifact.metadata ? { metadata: artifact.metadata } : {}),
        };
    }

    private toArtifactCategory(type: string): ArtifactCategory {
        if (type === 'assembly' || /system\.biztalk:(biztalkassembly|assembly)/i.test(type)) {
            return 'custom-code';
        }
        const categories: ArtifactCategory[] = [
            'workflow', 'orchestration', 'flow', 'process', 'map', 'schema',
            'pipeline', 'binding', 'policy', 'ruleset', 'custom-code',
            'legacy-webservice', 'hidx', 'b2b', 'dataweave', 'esql', 'api',
            'connector', 'config', 'project', 'other',
        ];
        return categories.includes(type as ArtifactCategory) ? type as ArtifactCategory : 'other';
    }
}
