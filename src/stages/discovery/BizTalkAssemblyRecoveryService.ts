import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { MsiExtractorService } from '../../services/MsiExtractorService';
import { parseXml, getAllElements, getAttr } from '../../parsers/utils/xml';
import { EnvironmentApplication, EnvironmentInventory } from './types';

const execFileAsync = promisify(execFile);

export interface RecoveredAssembly {
    identity: string;
    sourcePath?: string;
    sha256?: string;
    provenance?: string;
    references?: string[];
    referenceWarning?: string;
    error?: string;
}

/** Recover real deployment resources, never generate a DLL from reflected XML. */
export class BizTalkAssemblyRecoveryService {
    public async recover(
        environment: EnvironmentInventory,
        application: EnvironmentApplication,
        applicationDir: string
    ): Promise<RecoveredAssembly[]> {
        const identities = new Set(
            application.artifacts.map((a) => a.assemblyIdentity).filter((a): a is string => !!a)
        );
        if (application.bindingsXml) {
            const document = parseXml(application.bindingsXml);
            for (const module of document ? getAllElements(document, 'ModuleRef') : []) {
                const name = getAttr(module, 'Name');
                if (name && !name.startsWith('[')) {
                    identities.add(name);
                }
            }
        }
        const workDir = path.join(applicationDir, `__assembly_recovery_${crypto.randomUUID()}`);
        await fs.promises.mkdir(workDir, { recursive: true });
        const failures: string[] = [];
        const exportedFiles: string[] = [];
        try {
            const connection = environment.managementConnection;
            if (connection) {
                try {
                    const packagePath = path.join(workDir, 'application.msi');
                    await execFileAsync('BTSTask.exe', [
                        'ExportApp', `/ApplicationName:${application.name}`, `/Package:${packagePath}`,
                        `/Server:${connection.server}`, `/Database:${connection.managementDatabase}`,
                    ], { windowsHide: true, timeout: 180_000, maxBuffer: 4 * 1024 * 1024 });
                    const extracted = await MsiExtractorService.getInstance().extractMsi(
                        packagePath, path.join(workDir, 'export')
                    );
                    if (!extracted.success) {
                        throw new Error(extracted.error ?? 'MSI extraction failed.');
                    }
                    exportedFiles.push(...extracted.extractedFiles.filter((f) => /\.dll$/i.test(f)));
                    for (const resource of extracted.resources) {
                        if (/Assembly$/i.test(resource.type) && resource.luid) {
                            identities.add(resource.luid);
                        }
                    }
                } catch (error) {
                    failures.push(`BTSTask ExportApp: ${error instanceof Error ? error.message : String(error)}`);
                }
            } else {
                failures.push('Native export skipped: the discovered Management DB server/database is unknown. Configure the BizTalk server and managementDatabase settings and rediscover.');
            }
            if (identities.size === 0 && exportedFiles.length === 0) {
                return [{ identity: '(application assembly resources)', error: `${failures.join(' ')} No assembly identities or exported DLLs were exposed by discovery.` }];
            }
            const requestPath = path.join(workDir, 'request.json');
            const resultPath = path.join(workDir, 'result.json');
            const scriptPath = path.join(workDir, 'recover.ps1');
            await fs.promises.writeFile(requestPath, JSON.stringify({
                identities: [...identities], exportedFiles,
                outputDir: path.join(applicationDir, 'assemblies'), resultPath,
                exactPaths: application.artifacts.flatMap((a) =>
                    [a.metadata?.sourcePath, a.metadata?.SourceLocation].filter(
                        (p): p is string => typeof p === 'string' && path.isAbsolute(p)
                    )
                ),
            }));
            await fs.promises.writeFile(scriptPath, this.recoveryScript());
            try {
                await execFileAsync('powershell.exe', [
                    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
                    '-File', scriptPath, '-RequestPath', requestPath,
                ], { windowsHide: true, timeout: 180_000, maxBuffer: 4 * 1024 * 1024 });
                const results = JSON.parse((await fs.promises.readFile(resultPath, 'utf8')).replace(/^\uFEFF/, '')) as RecoveredAssembly[];
                if (!Array.isArray(results)) {
                    throw new Error('Assembly recovery returned no result array.');
                }
                return results.map((result) => result.error
                    ? { ...result, error: `${result.error} ${failures.join(' ')} Obtain the exact deployed version from the owning BizTalk application (including referenced/shared applications), its installer, or run discovery on a BizTalk host with that assembly. No DLL was recovered for this identity.` }
                    : result);
            } catch (error) {
                return [...identities, ...(identities.size ? [] : ['(exported assembly resources)'])].map((identity) => ({
                    identity,
                    error: `${failures.join(' ')} Assembly recovery failed: ${error instanceof Error ? error.message : String(error)}. Run discovery on Windows with BizTalk administration tools and read/export permissions; supply the exact deployed assembly if native export cannot provide it.`,
                }));
            }
        } finally {
            await fs.promises.rm(workDir, { recursive: true, force: true });
        }
    }

    private recoveryScript(): string {
        return String.raw`param([Parameter(Mandatory=$true)][string]$RequestPath)
$ErrorActionPreference = 'Stop'
$request = Get-Content -LiteralPath $RequestPath -Raw | ConvertFrom-Json
$results = New-Object System.Collections.Generic.List[object]
$queue = New-Object System.Collections.Generic.Queue[string]
$seen = @{}
$exported = @{}
$limit = 256
function Read-Identity([string]$file) {
    try { return [Reflection.AssemblyName]::GetAssemblyName($file) } catch { return $null }
}
function Identity-Key([Reflection.AssemblyName]$identity) { return $identity.FullName.ToLowerInvariant() }
foreach ($file in @($request.exportedFiles)) {
    $identity = Read-Identity $file
    if ($identity) {
        $key = Identity-Key $identity
        if (-not $exported.ContainsKey($key)) { $exported[$key] = @() }
        $exported[$key] += $file
        $queue.Enqueue($identity.FullName)
    } else {
        $results.Add(@{ identity = [IO.Path]::GetFileName($file); error = 'Exported file is not a readable managed assembly.' })
    }
}
foreach ($identity in @($request.identities)) { $queue.Enqueue($identity) }
$gacRoots = @(
    "$env:windir\Microsoft.NET\assembly\GAC_MSIL", "$env:windir\Microsoft.NET\assembly\GAC_32",
    "$env:windir\Microsoft.NET\assembly\GAC_64", "$env:windir\assembly\GAC",
    "$env:windir\assembly\GAC_MSIL", "$env:windir\assembly\GAC_32", "$env:windir\assembly\GAC_64"
)
$installRoots = @()
foreach ($root in @($env:ProgramFiles, [Environment]::GetEnvironmentVariable('ProgramFiles(x86)'))) {
    if ($root -and (Test-Path -LiteralPath $root)) {
        $installRoots += @(Get-ChildItem -LiteralPath $root -Directory -Filter '*BizTalk*' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
    }
}
while ($queue.Count -gt 0) {
    $requested = $queue.Dequeue()
    if ($seen.ContainsKey($requested.ToLowerInvariant())) { continue }
    $seen[$requested.ToLowerInvariant()] = $true
    if ($seen.Count -gt $limit) {
        $results.Add(@{ identity = $requested; error = 'Assembly reference traversal limit (256) reached. Discover the referenced application separately.' })
        continue
    }
    try {
        $wanted = New-Object Reflection.AssemblyName($requested)
        if ($wanted.Name -match '[\\/:*?"<>|]' -or $wanted.Name -in @('.', '..')) { throw 'Invalid assembly name.' }
        $key = Identity-Key $wanted
        $fullIdentity = $requested -match ',\s*Version=' -and $requested -match ',\s*Culture=' -and $requested -match ',\s*PublicKeyToken='
        $candidates = @()
        $provenance = 'exact-local-file'
        if ($fullIdentity -and $exported.ContainsKey($key)) {
            $candidates = @($exported[$key])
            $provenance = 'BTSTask-ExportApp'
        } else {
            if (-not $fullIdentity) { throw 'Deployment metadata lacks a full assembly identity (name, version, culture, public key token); refusing a partial-name/version guess.' }
            $candidates += @($request.exactPaths | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf })
            foreach ($root in $gacRoots) {
                $folder = Join-Path $root $wanted.Name
                if (Test-Path -LiteralPath $folder) {
                    $candidates += @(Get-ChildItem -LiteralPath $folder -Recurse -File -Filter "$($wanted.Name).dll" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
                }
            }
            foreach ($root in $installRoots) {
                $candidates += @(Get-ChildItem -LiteralPath $root -Recurse -File -Filter "$($wanted.Name).dll" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
            }
        }
        $matches = @($candidates | Sort-Object -Unique | Where-Object {
            $actual = Read-Identity $_
            $actual -and (Identity-Key $actual) -eq $key
        })
        if ($matches.Count -eq 0) { throw 'Exact deployed assembly not found in the native export, metadata file paths, local GAC, or BizTalk installation directories.' }
        $hashes = @($matches | ForEach-Object { (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash } | Sort-Object -Unique)
        if ($hashes.Count -ne 1) { throw 'Multiple different binaries have the same assembly identity; refusing to choose. Export the authoritative application resource.' }
        $hash = $hashes[0].ToLowerInvariant()
        $destinationDir = Join-Path $request.outputDir $hash
        [IO.Directory]::CreateDirectory($destinationDir) | Out-Null
        $destination = Join-Path $destinationDir "$($wanted.Name).dll"
        Copy-Item -LiteralPath $matches[0] -Destination $destination -Force
        if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant() -ne $hash) { throw 'Copied binary hash mismatch.' }
        $references = @()
        $referenceError = $null
        try {
            $assembly = [Reflection.Assembly]::ReflectionOnlyLoad([IO.File]::ReadAllBytes($destination))
            $references = @($assembly.GetReferencedAssemblies() | ForEach-Object { $_.FullName })
            foreach ($reference in $references) {
                # Framework libraries are runtime prerequisites, not deployed BizTalk application resources.
                if (($reference -split ',')[0] -notmatch '^(mscorlib|netstandard|System(\.|$)|Microsoft\.CSharp$)') { $queue.Enqueue($reference) }
            }
        } catch { $referenceError = "Reference enumeration failed: $($_.Exception.Message)" }
        $results.Add(@{ identity = $wanted.FullName; sourcePath = $destination; sha256 = $hash; provenance = $provenance; references = $references; referenceWarning = $referenceError })
    } catch {
        $results.Add(@{ identity = $requested; error = $_.Exception.Message })
    }
}
ConvertTo-Json -InputObject @($results.ToArray()) -Depth 8 | Set-Content -LiteralPath $request.resultPath -Encoding UTF8
`;
    }
}
