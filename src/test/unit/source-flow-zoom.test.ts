import * as assert from 'assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { runInNewContext } from 'vm';

const source = fs.readFileSync(
    path.resolve(__dirname, '../../../src/views/discovery/SourceFlowVisualizer.ts'),
    'utf8'
);
const zoomScript = source.match(
    /const ZOOM_STEP =[\s\S]*?(?=\s*\/\/ Mouse-wheel zoom on diagram)/
)?.[0];
assert.ok(zoomScript, 'Source flow zoom controls must exist');

interface ZoomControls {
    zoomFit(): void;
    zoomIn(): void;
    zoomOut(): void;
    zoomReset(): void;
    getZoom(): number;
}

function createDiagram(width: number, height: number) {
    const container = { clientWidth: 1000, clientHeight: 600, scrollLeft: 400, scrollTop: 800 };
    const inner = {
        offsetWidth: width,
        offsetHeight: height,
        style: { transform: '' },
        classList: { add: () => undefined, remove: () => undefined },
    };
    const stage = { style: { width: '', height: '' } };
    const label = { textContent: '' };
    const elements = new Map<string, unknown>([
        ['diagramContainer', container],
        ['diagramInner', inner],
        ['diagramStage', stage],
        ['zoomLevel', label],
    ]);
    const controls: ZoomControls = runInNewContext(
        `${zoomScript}\n({ zoomFit, zoomIn, zoomOut, zoomReset, getZoom })`,
        {
            document: { getElementById: (id: string) => elements.get(id) },
            requestAnimationFrame: (callback: () => void) => callback(),
        }
    );
    return { container, inner, stage, label, controls };
}

describe('Source flow diagram zoom', () => {
    it('fits a tall diagram below the manual zoom minimum and resets panning', () => {
        const { container, inner, stage, label, controls } = createDiagram(2000, 10000);
        controls.zoomFit();
        assert.equal(controls.getZoom(), 0.06);
        assert.equal(inner.style.transform, 'scale(0.06)');
        assert.equal(stage.style.width, '120px');
        assert.equal(stage.style.height, '600px');
        assert.equal(label.textContent, '6%');
        assert.equal(container.scrollLeft, 0);
        assert.equal(container.scrollTop, 0);
        controls.zoomFit();
        assert.equal(controls.getZoom(), 0.06, 'Fit must not depend on the current transform');
        controls.zoomOut();
        assert.equal(
            controls.getZoom(),
            0.06,
            'Zoom Out must not enlarge an already fitted diagram'
        );
        controls.zoomReset();
        assert.equal(controls.getZoom(), 1);
        assert.equal(stage.style.height, '10000px');
        controls.zoomOut();
        assert.equal(controls.getZoom(), 0.9);
    });

    it('fits a very wide diagram without rounding its scale to zero', () => {
        const { inner, stage, label, controls } = createDiagram(300000, 2000);
        controls.zoomFit();
        assert.equal(controls.getZoom(), 1000 / 300000);
        assert.equal(inner.style.transform, `scale(${1000 / 300000})`);
        assert.ok(Math.abs(parseFloat(stage.style.width) - 1000) < 0.001);
        assert.ok(parseFloat(stage.style.height) < 600);
        assert.equal(label.textContent, '<1%');
        controls.zoomIn();
        assert.ok(controls.getZoom() > 1000 / 300000);
    });

    it('preserves the zoom when the diagram viewport is hidden', () => {
        const { container, stage, controls } = createDiagram(2000, 10000);
        controls.zoomIn();
        const previousZoom = controls.getZoom();
        const previousWidth = stage.style.width;
        container.clientWidth = 0;
        container.clientHeight = 0;
        controls.zoomFit();
        assert.equal(controls.getZoom(), previousZoom);
        assert.equal(stage.style.width, previousWidth);
    });
});
