/**
 * Produces dependency-ordered migration steps for live BizTalk applications.
 *
 * @module stages/discovery/ApplicationMigrationScheduler
 */

import {
    ApplicationMigrationSchedule,
    ApplicationMigrationStep,
    EnvironmentApplication,
    EnvironmentInventory,
} from './types';

export class ApplicationMigrationScheduler {
    public buildSchedule(inventory: EnvironmentInventory): ApplicationMigrationSchedule {
        const applications = new Map(inventory.applications.map((application) => [application.id, application]));
        const dependencies = new Map<string, Set<string>>();

        for (const application of inventory.applications) {
            dependencies.set(
                application.id,
                new Set(application.dependencyApplicationIds.filter((id) => applications.has(id) && id !== application.id))
            );
        }

        const remaining = new Set(applications.keys());
        const steps: ApplicationMigrationStep[] = [];
        let order = 1;

        while (remaining.size > 0) {
            const ready = [...remaining]
                .filter((id) => [...(dependencies.get(id) ?? [])].every((dependency) => !remaining.has(dependency)))
                .sort((left, right) => this.applicationName(applications, left).localeCompare(this.applicationName(applications, right)));

            if (ready.length === 0) {
                break;
            }

            for (const id of ready) {
                remaining.delete(id);
                const application = applications.get(id);
                if (application) {
                    steps.push(this.createStep(application, order++, 'ready'));
                }
            }
        }

        const cycles = this.findCycles(remaining, dependencies);
        for (const cycle of cycles) {
            for (const id of cycle) {
                remaining.delete(id);
                const application = applications.get(id);
                if (application) {
                    steps.push(this.createStep(application, order++, 'cycle'));
                }
            }
        }

        const blockedApplicationIds = [...remaining];
        for (const id of blockedApplicationIds) {
            const application = applications.get(id);
            if (application) {
                steps.push(this.createStep(application, order++, 'blocked'));
            }
        }

        return { steps, cycles, blockedApplicationIds };
    }

    private createStep(
        application: EnvironmentApplication,
        order: number,
        status: ApplicationMigrationStep['status']
    ): ApplicationMigrationStep {
        return {
            applicationId: application.id,
            applicationName: application.name,
            dependencyApplicationIds: [...application.dependencyApplicationIds],
            order,
            status,
        };
    }

    private applicationName(applications: Map<string, EnvironmentApplication>, id: string): string {
        return applications.get(id)?.name ?? id;
    }

    private findCycles(remaining: Set<string>, dependencies: Map<string, Set<string>>): string[][] {
        const cycles: string[][] = [];
        const visited = new Set<string>();
        const active = new Set<string>();

        const visit = (id: string, path: string[]): void => {
            if (active.has(id)) {
                const start = path.indexOf(id);
                if (start >= 0) {
                    cycles.push(path.slice(start));
                }
                return;
            }
            if (visited.has(id)) {
                return;
            }
            active.add(id);
            for (const dependency of dependencies.get(id) ?? []) {
                if (remaining.has(dependency)) {
                    visit(dependency, [...path, dependency]);
                }
            }
            active.delete(id);
            visited.add(id);
        };

        for (const id of remaining) {
            visit(id, [id]);
        }
        return cycles;
    }
}
