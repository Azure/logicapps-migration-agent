/**
 * Platform Detector
 *
 * Automatic detection of source integration platforms by analyzing
 * file patterns, project structure, and configuration files.
 *
 * @module stages/discovery/PlatformDetector
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LoggingService } from '../../services/LoggingService';
import { UserPrompts } from '../../constants/UserMessages';
import {
    PlatformDetectionResult,
    PlatformIndicator,
    AlternativePlatform,
    IPlatformDetector,
    QuickScanResult,
} from './types';
import { SourcePlatformType } from '../../ir/types/common';

// =============================================================================
// Platform Detector Manager
// =============================================================================

/**
 * Main platform detector that orchestrates individual platform detectors.
 */
export class PlatformDetector implements vscode.Disposable {
    private static instance: PlatformDetector | undefined;

    private readonly logger = LoggingService.getInstance();
    private readonly detectors = new Map<SourcePlatformType, IPlatformDetector>();

    private constructor() {
        this.registerBuiltInDetectors();
    }

    /**
     * Get the singleton instance.
     */
    public static getInstance(): PlatformDetector {
        if (!PlatformDetector.instance) {
            PlatformDetector.instance = new PlatformDetector();
        }
        return PlatformDetector.instance;
    }

    /**
     * Register built-in platform detectors.
     */
    private registerBuiltInDetectors(): void {
        this.detectors.set('biztalk', new BizTalkDetector());
        this.detectors.set('mulesoft', new MuleSoftDetector());
        this.detectors.set('tibco', new TIBCODetector());
    }

    /**
     * Detect platform from a folder.
     *
     * @param folderPath - Path to the folder to analyze
     * @param _quickScan - Optional quick scan result to use
     */
    public async detect(
        folderPath: string,
        _quickScan?: QuickScanResult
    ): Promise<PlatformDetectionResult> {
        this.logger.info('Starting platform detection', { folderPath });

        const allResults: { platform: SourcePlatformType; result: PlatformDetectionResult }[] = [];

        // Run all detectors
        for (const [platform, detector] of this.detectors) {
            try {
                const result = await detector.detect(folderPath);
                if (result && result.confidence > 0) {
                    allResults.push({ platform, result });
                    this.logger.debug(`Detector ${platform} found indicators`, {
                        confidence: result.confidence,
                        indicatorCount: result.indicators.length,
                    });
                }
            } catch (error) {
                this.logger.warn(`Detector ${platform} failed`, {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        // Sort by confidence
        allResults.sort((a, b) => b.result.confidence - a.result.confidence);

        if (allResults.length === 0) {
            // No platform detected - return generic
            return {
                platform: 'generic',
                confidence: 0,
                indicators: [],
                alternativePlatforms: [],
            };
        }

        // Primary platform
        const primary = allResults[0];

        // Alternative platforms (others with confidence > 20)
        const alternatives: AlternativePlatform[] = allResults
            .slice(1)
            .filter((r) => r.result.confidence > 20)
            .map((r) => ({
                platform: r.platform,
                confidence: r.result.confidence,
                indicators: r.result.indicators,
            }));

        this.logger.info('Platform detection complete', {
            primary: primary.platform,
            primaryConfidence: primary.result.confidence,
            alternativeCount: alternatives.length,
        });

        return {
            platform: primary.platform,
            version: primary.result.version,
            confidence: primary.result.confidence,
            indicators: primary.result.indicators,
            alternativePlatforms: alternatives,
        };
    }

    /**
     * Detect platform with user confirmation via Quick Pick.
     */
    public async detectWithConfirmation(
        folderPath: string,
        quickScan?: QuickScanResult
    ): Promise<{ detection: PlatformDetectionResult; confirmed: boolean }> {
        const detection = await this.detect(folderPath, quickScan);

        // If high confidence, auto-confirm silently
        if (detection.confidence >= 80) {
            return { detection, confirmed: true };
        }

        // Show Quick Pick for confirmation/override
        const items: vscode.QuickPickItem[] = [];

        // Add detected platform as first option
        if (detection.platform !== 'generic') {
            items.push({
                label: `$(check) ${this.getPlatformDisplayName(detection.platform)}`,
                description: `${detection.confidence}% confidence - Auto-detected`,
                detail: detection.indicators
                    .slice(0, 3)
                    .map((i) => i.match)
                    .join(', '),
            });
        }

        // Add alternatives
        for (const alt of detection.alternativePlatforms) {
            items.push({
                label: this.getPlatformDisplayName(alt.platform),
                description: `${alt.confidence}% confidence`,
                detail: alt.indicators
                    .slice(0, 3)
                    .map((i) => i.match)
                    .join(', '),
            });
        }

        // Add all platforms
        const allPlatforms: SourcePlatformType[] = ['biztalk', 'mulesoft', 'tibco'];

        for (const platform of allPlatforms) {
            if (
                platform !== detection.platform &&
                !detection.alternativePlatforms.some((a) => a.platform === platform)
            ) {
                items.push({
                    label: this.getPlatformDisplayName(platform),
                    description: 'Manually select',
                });
            }
        }

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: UserPrompts.PLATFORM_PICKER_PLACEHOLDER,
            title: UserPrompts.PLATFORM_PICKER_TITLE,
            ignoreFocusOut: true,
        });

        if (!selected) {
            return { detection, confirmed: false };
        }

        // Parse selection
        const selectedLabel = selected.label.replace('$(check) ', '');
        const selectedPlatform = this.getPlatformFromDisplayName(selectedLabel);

        if (selectedPlatform !== detection.platform) {
            // User overrode detection
            const overrideResult: PlatformDetectionResult = {
                platform: selectedPlatform,
                confidence: 100, // User confirmed
                indicators: [],
                alternativePlatforms: [
                    {
                        platform: detection.platform,
                        confidence: detection.confidence,
                        indicators: detection.indicators,
                    },
                ],
            };
            return { detection: overrideResult, confirmed: true };
        }

        return { detection, confirmed: true };
    }

    /**
     * Get display name for platform.
     */
    private getPlatformDisplayName(platform: SourcePlatformType): string {
        const names: Record<SourcePlatformType, string> = {
            biztalk: 'BizTalk Server',
            mulesoft: 'MuleSoft Anypoint',
            tibco: 'TIBCO BusinessWorks',
            generic: 'Generic/Other',
        };
        return names[platform] || platform;
    }

    /**
     * Get platform from display name.
     */
    private getPlatformFromDisplayName(displayName: string): SourcePlatformType {
        const mapping: Record<string, SourcePlatformType> = {
            'BizTalk Server': 'biztalk',
            'MuleSoft Anypoint': 'mulesoft',
            'TIBCO BusinessWorks': 'tibco',
            'Generic/Other': 'generic',
        };
        return mapping[displayName] || 'generic';
    }

    /**
     * Dispose of resources.
     */
    public dispose(): void {
        PlatformDetector.instance = undefined;
    }
}

// =============================================================================
// Individual Platform Detectors
// =============================================================================

/**
 * Base class for platform detectors.
 */
abstract class BasePlatformDetector implements IPlatformDetector {
    abstract readonly platform: SourcePlatformType;

    protected readonly logger = LoggingService.getInstance();

    abstract detect(folderPath: string): Promise<PlatformDetectionResult | null>;

    /**
     * Helper to scan directory for files matching patterns.
     */
    protected async findFiles(
        folderPath: string,
        patterns: string[],
        maxDepth = 2
    ): Promise<string[]> {
        const matches: string[] = [];
        await this.scanDirectory(folderPath, patterns, matches, 0, maxDepth);
        return matches;
    }

    private async scanDirectory(
        dir: string,
        patterns: string[],
        matches: string[],
        currentDepth: number,
        maxDepth: number
    ): Promise<void> {
        if (currentDepth > maxDepth) {
            return;
        }

        try {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                if (entry.isFile()) {
                    for (const pattern of patterns) {
                        if (this.matchPattern(entry.name, pattern)) {
                            matches.push(fullPath);
                        }
                    }
                } else if (
                    entry.isDirectory() &&
                    !entry.name.startsWith('.') &&
                    entry.name !== 'node_modules'
                ) {
                    await this.scanDirectory(
                        fullPath,
                        patterns,
                        matches,
                        currentDepth + 1,
                        maxDepth
                    );
                }
            }
        } catch {
            // Ignore permission errors
        }
    }

    protected matchPattern(fileName: string, pattern: string): boolean {
        const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.');
        return new RegExp(`^${regexPattern}$`, 'i').test(fileName);
    }

    protected async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    protected async readFileContent(filePath: string): Promise<string | null> {
        try {
            return await fs.promises.readFile(filePath, 'utf-8');
        } catch {
            return null;
        }
    }
}

/**
 * BizTalk platform detector.
 */
class BizTalkDetector extends BasePlatformDetector {
    readonly platform: SourcePlatformType = 'biztalk';

    async detect(folderPath: string): Promise<PlatformDetectionResult | null> {
        const indicators: PlatformIndicator[] = [];
        let confidence = 0;
        let version: string | undefined;

        // Check for ApplicationDefinition.adf (BizTalk MSI extracted artifact — definitive)
        const adfFiles = await this.findFiles(folderPath, ['ApplicationDefinition.adf']);
        if (adfFiles.length > 0) {
            // Verify it's a real BizTalk ADF by checking for BizTalk namespace
            const content = await this.readFileContent(adfFiles[0]);
            if (content && content.includes('Microsoft.BizTalk.ApplicationDeployment')) {
                confidence += 50;
                indicators.push({
                    platform: 'biztalk',
                    indicatorType: 'config-file',
                    match: 'ApplicationDefinition.adf (MSI manifest)',
                    confidence: 'high',
                });

                // Try to extract version from ADF properties
                version = this.detectVersionFromAdf(content);
            }
        }

        // Check for .btproj files (high confidence)
        const btprojFiles = await this.findFiles(folderPath, ['*.btproj']);
        if (btprojFiles.length > 0) {
            confidence += 40;
            for (const file of btprojFiles.slice(0, 3)) {
                indicators.push({
                    platform: 'biztalk',
                    indicatorType: 'config-file',
                    match: path.basename(file),
                    confidence: 'high',
                });
            }
            // Try to detect version from .btproj
            version = version ?? (await this.detectVersionFromBtproj(btprojFiles[0]));
        }

        // Check for .odx files (orchestrations)
        const odxFiles = await this.findFiles(folderPath, ['*.odx']);
        if (odxFiles.length > 0) {
            confidence += 30;
            indicators.push({
                platform: 'biztalk',
                indicatorType: 'file-extension',
                match: `${odxFiles.length} orchestration(s)`,
                confidence: 'high',
            });
        }

        // Check for .btm files (maps)
        const btmFiles = await this.findFiles(folderPath, ['*.btm']);
        if (btmFiles.length > 0) {
            confidence += 15;
            indicators.push({
                platform: 'biztalk',
                indicatorType: 'file-extension',
                match: `${btmFiles.length} map(s)`,
                confidence: 'high',
            });
        }

        // Check for binding files
        const bindingFiles = await this.findFiles(folderPath, ['BindingInfo.xml', 'Binding*.xml']);
        if (bindingFiles.length > 0) {
            // Higher confidence if we also found ADF (MSI-extracted scenario)
            const bindingConfidenceBoost = adfFiles.length > 0 ? 30 : 10;
            confidence += bindingConfidenceBoost;
            indicators.push({
                platform: 'biztalk',
                indicatorType: 'config-file',
                match: 'Binding configuration',
                confidence: adfFiles.length > 0 ? 'high' : 'medium',
            });
        }

        // Check for .btp files (pipelines)
        const btpFiles = await this.findFiles(folderPath, ['*.btp']);
        if (btpFiles.length > 0) {
            confidence += 5;
            indicators.push({
                platform: 'biztalk',
                indicatorType: 'file-extension',
                match: `${btpFiles.length} pipeline(s)`,
                confidence: 'medium',
            });
        }

        if (indicators.length === 0) {
            return null;
        }

        return {
            platform: 'biztalk',
            version,
            confidence: Math.min(confidence, 100),
            indicators,
            alternativePlatforms: [],
        };
    }

    private async detectVersionFromBtproj(btprojPath: string): Promise<string | undefined> {
        const content = await this.readFileContent(btprojPath);
        if (!content) {
            return undefined;
        }

        // Look for BizTalk version indicators in project file
        if (content.includes('BizTalk2020') || content.includes('v16.0')) {
            return '2020';
        }
        if (content.includes('BizTalk2016') || content.includes('v14.0')) {
            return '2016';
        }
        if (content.includes('BizTalk2013') || content.includes('v12.0')) {
            return '2013';
        }

        return undefined;
    }

    /**
     * Attempt to detect BizTalk version from an ApplicationDefinition.adf file.
     * Looks at assembly versions and known SDK paths in resource properties.
     */
    private detectVersionFromAdf(content: string): string | undefined {
        // Look for BizTalk version clues in the ADF content
        if (
            content.includes('BizTalk Server 2020') ||
            content.includes('Version=10.0.') ||
            content.includes('BizTalk2020')
        ) {
            return '2020';
        }
        if (content.includes('BizTalk Server 2016') || content.includes('BizTalk2016')) {
            return '2016';
        }
        if (content.includes('BizTalk Server 2013') || content.includes('BizTalk2013')) {
            return '2013';
        }
        return undefined;
    }

    async detectVersion(folderPath: string): Promise<string | null> {
        const btprojFiles = await this.findFiles(folderPath, ['*.btproj']);
        if (btprojFiles.length > 0) {
            return (await this.detectVersionFromBtproj(btprojFiles[0])) || null;
        }
        return null;
    }
}

/**
 * MuleSoft platform detector.
 */
class MuleSoftDetector extends BasePlatformDetector {
    readonly platform: SourcePlatformType = 'mulesoft';

    async detect(folderPath: string): Promise<PlatformDetectionResult | null> {
        const indicators: PlatformIndicator[] = [];
        let confidence = 0;
        let version: string | undefined;

        // Check for mule-artifact.json (Mule 4)
        const muleArtifactPath = path.join(folderPath, 'mule-artifact.json');
        if (await this.fileExists(muleArtifactPath)) {
            confidence += 50;
            indicators.push({
                platform: 'mulesoft',
                indicatorType: 'config-file',
                match: 'mule-artifact.json',
                confidence: 'high',
            });
            version = '4.x';
        }

        // Check for pom.xml with Mule dependencies
        const pomPath = path.join(folderPath, 'pom.xml');
        if (await this.fileExists(pomPath)) {
            const content = await this.readFileContent(pomPath);
            if (
                content &&
                (content.includes('mule-maven-plugin') || content.includes('org.mule'))
            ) {
                confidence += 30;
                indicators.push({
                    platform: 'mulesoft',
                    indicatorType: 'config-file',
                    match: 'pom.xml (Mule dependencies)',
                    confidence: 'high',
                });

                // Try to detect version
                if (content.includes('mule-4') || content.includes('4.')) {
                    version = '4.x';
                } else if (content.includes('mule-3') || content.includes('3.')) {
                    version = '3.x';
                }
            }
        }

        // Check for mule-*.xml flow files
        const muleXmlFiles = await this.findFiles(folderPath, ['mule-*.xml']);
        if (muleXmlFiles.length > 0) {
            confidence += 20;
            indicators.push({
                platform: 'mulesoft',
                indicatorType: 'file-extension',
                match: `${muleXmlFiles.length} Mule flow(s)`,
                confidence: 'high',
            });
        }

        // Check for .dwl files (DataWeave)
        const dwlFiles = await this.findFiles(folderPath, ['*.dwl']);
        if (dwlFiles.length > 0) {
            confidence += 15;
            indicators.push({
                platform: 'mulesoft',
                indicatorType: 'file-extension',
                match: `${dwlFiles.length} DataWeave file(s)`,
                confidence: 'high',
            });
        }

        if (indicators.length === 0) {
            return null;
        }

        return {
            platform: 'mulesoft',
            version,
            confidence: Math.min(confidence, 100),
            indicators,
            alternativePlatforms: [],
        };
    }
}

/**
 * TIBCO BusinessWorks platform detector.
 */
class TIBCODetector extends BasePlatformDetector {
    readonly platform: SourcePlatformType = 'tibco';

    async detect(folderPath: string): Promise<PlatformDetectionResult | null> {
        const indicators: PlatformIndicator[] = [];
        let confidence = 0;
        let version: string | undefined;

        // Common BW project descriptor
        const tibcoProjectFiles = await this.findFiles(folderPath, ['tibco.xml', 'TIBCO.xml']);
        if (tibcoProjectFiles.length > 0) {
            confidence += 45;
            indicators.push({
                platform: 'tibco',
                indicatorType: 'config-file',
                match: path.basename(tibcoProjectFiles[0]),
                confidence: 'high',
            });

            const content = await this.readFileContent(tibcoProjectFiles[0]);
            if (content) {
                if (/bw6|businessworks\s*6/i.test(content)) {
                    version = '6.x';
                } else if (/bw5|businessworks\s*5/i.test(content)) {
                    version = '5.x';
                }
            }
        }

        // Process definitions
        const processFiles = await this.findFiles(folderPath, ['*.process', '*.bwp']);
        if (processFiles.length > 0) {
            confidence += 40;
            indicators.push({
                platform: 'tibco',
                indicatorType: 'file-extension',
                match: `${processFiles.length} process file(s)`,
                confidence: 'high',
            });
        }

        // Shared resources and module descriptors used by BW projects
        const sharedResourceFiles = await this.findFiles(folderPath, [
            '*.sharedhttp',
            '*.sharedjdbc',
            'defaultVars.substvar',
            '*.archive',
        ]);
        if (sharedResourceFiles.length > 0) {
            confidence += 15;
            indicators.push({
                platform: 'tibco',
                indicatorType: 'config-file',
                match: `${sharedResourceFiles.length} shared resource/module file(s)`,
                confidence: 'medium',
            });
        }

        if (indicators.length === 0) {
            return null;
        }

        return {
            platform: 'tibco',
            version,
            confidence: Math.min(confidence, 100),
            indicators,
            alternativePlatforms: [],
        };
    }
}
