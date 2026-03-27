/**
 * Agent File Provisioner
 *
 * Creates `.github/agents/migration-analyser.md` in the user's workspace
 * so that the `@migration-analyser` Copilot Chat agent is available for
 * autonomous multi-step migration analysis (flow-group detection,
 * artifact inspection, and Mermaid architecture visualisation).
 *
 * The file is provisioned once after discovery completes and is idempotent —
 * it will not overwrite an existing file unless the bundled version is newer.
 *
 * @module services/AgentFileProvisioner
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LoggingService } from './LoggingService';
import { WORKFLOW_COMPLETENESS_DECOMPILE_INSTRUCTION } from './DecompilationGuidance';
import { StateManager } from './StateManager';

// =============================================================================
// Constants
// =============================================================================

const AGENT_DIR = '.github/agents';
const AGENT_FILENAME = 'migration-analyser.agent.md';
const PLANNER_AGENT_FILENAME = 'migration-planner.agent.md';
const CONVERTER_AGENT_FILENAME = 'migration-converter.agent.md';

/**
 * A version stamp embedded as an HTML comment at the top of the generated file.
 * Bump this when the prompt content changes so existing files get updated.
 */
const ANALYSER_AGENT_VERSION = '2.4.0';
const ANALYSER_VERSION_TAG = `<!-- migration-analyser-agent v${ANALYSER_AGENT_VERSION} -->`;

const PLANNER_AGENT_VERSION = '2.9.0';
const PLANNER_VERSION_TAG = `<!-- migration-planner-agent v${PLANNER_AGENT_VERSION} -->`;

const CONVERTER_AGENT_VERSION = '2.20.0';
const CONVERTER_VERSION_TAG = `<!-- migration-converter-agent v${CONVERTER_AGENT_VERSION} -->`;

// =============================================================================
// Agent File Provisioner
// =============================================================================

export class AgentFileProvisioner {
    private static instance: AgentFileProvisioner | undefined;
    private readonly logger = LoggingService.getInstance();

    private constructor() {}

    public static getInstance(): AgentFileProvisioner {
        if (!AgentFileProvisioner.instance) {
            AgentFileProvisioner.instance = new AgentFileProvisioner();
        }
        return AgentFileProvisioner.instance;
    }

    /**
     * Provision the `@migration-analyser` agent file into the workspace that
     * contains `projectPath` (the user-selected source folder).
     *
     * Resolves to `true` if the file was created or updated, `false` if it
     * already existed at the current (or newer) version.
     */
    public async provision(projectPath: string): Promise<boolean> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(projectPath));

        // Fallback: use the first workspace folder, or the project path's parent
        const rootDir =
            workspaceFolder?.uri.fsPath ??
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ??
            path.dirname(projectPath);

        const agentDir = path.join(rootDir, AGENT_DIR);
        const agentFile = path.join(agentDir, AGENT_FILENAME);

        // Check if file already exists with current version
        if (fs.existsSync(agentFile)) {
            const existing = fs.readFileSync(agentFile, 'utf-8');
            if (existing.includes(ANALYSER_VERSION_TAG)) {
                this.logger.debug(
                    `[AgentFileProvisioner] Agent file already at v${ANALYSER_AGENT_VERSION} — skipping`
                );
                // Still provision the planner and converter agents (may be missing)
                await this.provisionPlannerAgent(agentDir);
                await this.provisionConverterAgent(agentDir);
                await this.provisionSkills(agentDir);
                return false;
            }
            this.logger.info('[AgentFileProvisioner] Updating agent file to new version');
        }

        // Ensure directory exists
        await fs.promises.mkdir(agentDir, { recursive: true });

        // Write the agent prompt file
        const content = this.buildAgentContent();
        await fs.promises.writeFile(agentFile, content, 'utf-8');

        this.logger.info(`[AgentFileProvisioner] Provisioned ${AGENT_FILENAME} → ${agentFile}`);

        // Also provision the migration-planner and migration-converter agents
        await this.provisionPlannerAgent(agentDir);
        await this.provisionConverterAgent(agentDir);

        // Provision skill files
        await this.provisionSkills(agentDir);
        return true;
    }

    /**
     * Provision the `@migration-planner` agent file.
     */
    private async provisionPlannerAgent(agentDir: string): Promise<void> {
        const plannerFile = path.join(agentDir, PLANNER_AGENT_FILENAME);

        if (fs.existsSync(plannerFile)) {
            const existing = fs.readFileSync(plannerFile, 'utf-8');
            if (existing.includes(PLANNER_VERSION_TAG)) {
                this.logger.debug(
                    `[AgentFileProvisioner] Planner agent already at v${PLANNER_AGENT_VERSION} — skipping`
                );
                return;
            }
            this.logger.info('[AgentFileProvisioner] Updating planner agent file to new version');
        }

        await fs.promises.mkdir(agentDir, { recursive: true });
        const content = this.buildPlannerAgentContent();
        await fs.promises.writeFile(plannerFile, content, 'utf-8');
        this.logger.info(
            `[AgentFileProvisioner] Provisioned ${PLANNER_AGENT_FILENAME} → ${plannerFile}`
        );
    }

    /**
     * Remove the provisioned agent file (e.g., on migration reset).
     */
    public async remove(projectPath: string): Promise<void> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(projectPath));
        const rootDir =
            workspaceFolder?.uri.fsPath ??
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ??
            path.dirname(projectPath);

        const agentFile = path.join(rootDir, AGENT_DIR, AGENT_FILENAME);
        if (fs.existsSync(agentFile)) {
            await fs.promises.unlink(agentFile);
            this.logger.info(`[AgentFileProvisioner] Removed ${agentFile}`);
        }

        const plannerFile = path.join(rootDir, AGENT_DIR, PLANNER_AGENT_FILENAME);
        if (fs.existsSync(plannerFile)) {
            await fs.promises.unlink(plannerFile);
            this.logger.info(`[AgentFileProvisioner] Removed ${plannerFile}`);
        }

        const converterFile = path.join(rootDir, AGENT_DIR, CONVERTER_AGENT_FILENAME);
        if (fs.existsSync(converterFile)) {
            await fs.promises.unlink(converterFile);
            this.logger.info(`[AgentFileProvisioner] Removed ${converterFile}`);
        }
    }

    // -------------------------------------------------------------------------
    // Agent prompt content — loaded from resources/agents/*.md
    // -------------------------------------------------------------------------

    /**
     * Read an agent prompt from the bundled resource file.
     * Injects version tag after YAML frontmatter and replaces {{DECOMPILE_INSTRUCTION}} placeholder.
     */
    private readAgentPrompt(filename: string, versionTag: string): string {
        const agentPath = path.join(__dirname, '..', 'resources', 'agents', filename);
        try {
            if (fs.existsSync(agentPath)) {
                let content = fs.readFileSync(agentPath, 'utf-8');
                content = content.replace(
                    /\{\{DECOMPILE_INSTRUCTION\}\}/g,
                    WORKFLOW_COMPLETENESS_DECOMPILE_INSTRUCTION
                );
                // Inject version tag after YAML frontmatter
                const fmClose = content.indexOf('---', 3);
                if (content.startsWith('---') && fmClose !== -1) {
                    const insertPos = fmClose + 3;
                    return (
                        content.slice(0, insertPos) + '\n' + versionTag + content.slice(insertPos)
                    );
                }
                return `${versionTag}\n${content}`;
            }
        } catch {
            // Fall through to inline fallback
        }
        return `${versionTag}\n# Agent prompt not found\n\nSee resources/agents/${filename}\n`;
    }

    private buildAgentContent(): string {
        return this.readAgentPrompt('migration-analyser.md', ANALYSER_VERSION_TAG);
    }

    // -------------------------------------------------------------------------
    // Planner Agent Prompt
    // -------------------------------------------------------------------------

    private buildPlannerAgentContent(): string {
        return this.readAgentPrompt('migration-planner.md', PLANNER_VERSION_TAG);
    }

    private buildConverterAgentContent(): string {
        return this.readAgentPrompt('migration-converter.md', CONVERTER_VERSION_TAG);
    }

    /**
     * Provision the `@migration-converter` agent file.
     */
    private async provisionConverterAgent(agentDir: string): Promise<void> {
        const converterFile = path.join(agentDir, CONVERTER_AGENT_FILENAME);

        if (fs.existsSync(converterFile)) {
            const existing = fs.readFileSync(converterFile, 'utf-8');
            if (existing.includes(CONVERTER_VERSION_TAG)) {
                this.logger.debug(
                    `[AgentFileProvisioner] Converter agent already at v${CONVERTER_AGENT_VERSION} — skipping`
                );
                return;
            }
            this.logger.info('[AgentFileProvisioner] Updating converter agent file to new version');
        }

        await fs.promises.mkdir(agentDir, { recursive: true });
        const content = this.buildConverterAgentContent();
        await fs.promises.writeFile(converterFile, content, 'utf-8');
        this.logger.info(
            `[AgentFileProvisioner] Provisioned ${CONVERTER_AGENT_FILENAME} → ${converterFile}`
        );
    }

    // -------------------------------------------------------------------------
    // Skills
    // -------------------------------------------------------------------------

    private static readonly SKILLS_VERSION = '10.20.0';
    private static readonly SKILLS_VERSION_TAG = `<!-- skills v${AgentFileProvisioner.SKILLS_VERSION} -->`;

    /**
     * Inject the version tag into skill content after the YAML frontmatter closing `---`.
     * If no frontmatter is found, prepend the tag.
     */
    private injectVersionTag(content: string): string {
        // YAML frontmatter: starts with --- and closes with ---
        const fmClose = content.indexOf('---', 3);
        if (content.startsWith('---') && fmClose !== -1) {
            const insertPos = fmClose + 3;
            return (
                content.slice(0, insertPos) +
                '\n' +
                AgentFileProvisioner.SKILLS_VERSION_TAG +
                content.slice(insertPos)
            );
        }
        return `${AgentFileProvisioner.SKILLS_VERSION_TAG}\n${content}`;
    }

    /**
     * Provision skill files into .github/skills/{skillname}/SKILL.md.
     * Skills are reusable instruction sets that agents can reference.
     * They live at .github/skills/ (sibling to .github/agents/), not inside the agents folder.
     */
    private async provisionSkills(agentDir: string): Promise<void> {
        // Determine source platform for platform-specific skills
        const sourcePlatform = StateManager.getInstance().getState().sourcePlatform || 'biztalk';
        // Map platform to skill subfolder name (default to biztalk for unknown platforms)
        const platformFolder = sourcePlatform === 'mulesoft' ? 'mulesoft' : 'biztalk';

        // Skills go to .github/skills/, which is a sibling of .github/agents/
        const githubDir = path.dirname(agentDir); // .github/
        const skillsDir = path.join(githubDir, 'skills');
        await fs.promises.mkdir(skillsDir, { recursive: true });

        const skills: { folder: string; content: string }[] = [
            {
                folder: 'dotnet-local-functions-logic-apps',
                content: this.buildCustomCodeSkill(platformFolder),
            },
            {
                folder: 'scaffold-logic-apps-project',
                content: this.buildScaffoldSkill(platformFolder),
            },
            {
                folder: 'source-to-logic-apps-mapping',
                content: this.buildMappingSkill(platformFolder),
            },
            {
                folder: 'detect-logical-groups',
                content: this.buildSkillFromResource('detect-logical-groups', platformFolder),
            },
            {
                folder: 'analyse-source-design',
                content: this.buildSkillFromResource('analyse-source-design', platformFolder),
            },
            {
                folder: 'dependency-and-decompilation-analysis',
                content: this.buildSkillFromResource(
                    'dependency-and-decompilation-analysis',
                    platformFolder
                ),
            },
            {
                folder: 'logic-apps-planning-rules',
                content: this.buildSkillFromResource('logic-apps-planning-rules', platformFolder),
            },
            {
                folder: 'conversion-task-plan-rules',
                content: this.buildSkillFromResource('conversion-task-plan-rules', platformFolder),
            },
            {
                folder: 'runtime-validation-and-testing',
                content: this.buildSkillFromResource(
                    'runtime-validation-and-testing',
                    platformFolder
                ),
            },
            {
                folder: 'workflow-json-generation-rules',
                content: this.buildSkillFromResource(
                    'workflow-json-generation-rules',
                    platformFolder
                ),
            },
            {
                folder: 'connections-json-generation-rules',
                content: this.buildSkillFromResource(
                    'connections-json-generation-rules',
                    platformFolder
                ),
            },
            {
                folder: 'no-stubs-code-generation',
                content: this.buildSkillFromResource('no-stubs-code-generation', platformFolder),
            },
            {
                folder: 'cloud-deployment-and-testing',
                content: this.buildSkillFromResource(
                    'cloud-deployment-and-testing',
                    platformFolder
                ),
            },
        ];

        for (const skill of skills) {
            const skillDir = path.join(skillsDir, skill.folder);
            await fs.promises.mkdir(skillDir, { recursive: true });
            const skillFile = path.join(skillDir, 'SKILL.md');
            // Check version — skip if already at current version
            if (fs.existsSync(skillFile)) {
                const existing = fs.readFileSync(skillFile, 'utf-8');
                if (existing.includes(AgentFileProvisioner.SKILLS_VERSION_TAG)) {
                    continue;
                }
            }
            await fs.promises.writeFile(skillFile, skill.content, 'utf-8');
            this.logger.info(`[AgentFileProvisioner] Provisioned skill: ${skill.folder}/SKILL.md`);
        }
    }

    /**
     * Generic skill loader: reads skill content from bundled resource file.
     * Looks in resources/skills/{skillFolder}/{platform}/SKILL.md first,
     * falls back to resources/skills/{skillFolder}/SKILL.md for backward compat.
     */
    private buildSkillFromResource(skillFolder: string, platform = 'biztalk'): string {
        const platformPath = path.join(
            __dirname,
            '..',
            'resources',
            'skills',
            skillFolder,
            platform,
            'SKILL.md'
        );
        const fallbackPath = path.join(
            __dirname,
            '..',
            'resources',
            'skills',
            skillFolder,
            'SKILL.md'
        );
        for (const p of [platformPath, fallbackPath]) {
            try {
                if (fs.existsSync(p)) {
                    const content = fs.readFileSync(p, 'utf-8');
                    return this.injectVersionTag(content);
                }
            } catch {
                // Try next path
            }
        }
        return `---\nname: ${skillFolder}\ndescription: ${skillFolder} skill.\n---\n${AgentFileProvisioner.SKILLS_VERSION_TAG}\n# Skill: ${skillFolder}\n\nSee the full skill document in resources/skills/${skillFolder}/${platform}/SKILL.md\n`;
    }

    /**
     * Skill: How to generate working custom code local functions.
     */
    private buildCustomCodeSkill(platform = 'biztalk'): string {
        return this.buildSkillFromResource('dotnet-local-functions-logic-apps', platform);
    }

    /**
     * Skill: How to scaffold a Logic Apps Standard project.
     */
    private buildScaffoldSkill(platform = 'biztalk'): string {
        return this.buildSkillFromResource('scaffold-logic-apps-project', platform);
    }

    /**
     * Skill: Source-to-Logic Apps component mapping reference.
     */
    private buildMappingSkill(platform = 'biztalk'): string {
        return this.buildSkillFromResource('source-to-logic-apps-mapping', platform);
    }

    /**
     * Reset singleton (for tests).
     */
    public static resetInstance(): void {
        AgentFileProvisioner.instance = undefined;
    }
}
