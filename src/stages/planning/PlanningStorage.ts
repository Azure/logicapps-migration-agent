import * as fs from 'fs';
import { randomUUID } from 'crypto';

/** Publish JSON only after the complete file has been written. */
export function writePlanningJson(filePath: string, value: unknown): void {
    const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
    try {
        fs.writeFileSync(temporaryPath, JSON.stringify(value, null, 2), 'utf-8');
        fs.renameSync(temporaryPath, filePath);
    } finally {
        if (fs.existsSync(temporaryPath)) {
            fs.unlinkSync(temporaryPath);
        }
    }
}
