const esbuild = require('esbuild');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
    name: 'esbuild-problem-matcher',
    setup(build) {
        build.onStart(() => {
            console.log('[watch] build started');
        });
        build.onEnd((result) => {
            result.errors.forEach(({ text, location }) => {
                console.error(`✘ [ERROR] ${text}`);
                console.error(`    ${location.file}:${location.line}:${location.column}:`);
            });
            console.log('[watch] build finished');
        });
    },
};

/**
 * Path alias plugin for esbuild
 * Resolves @services, @parsers, @ui, @types, @utils aliases
 * @type {import('esbuild').Plugin}
 */
const pathAliasPlugin = {
    name: 'path-alias',
    setup(build) {
        const aliases = {
            '@services': path.resolve(__dirname, 'src/services'),
            '@parsers': path.resolve(__dirname, 'src/tools/parsers'),
            '@generators': path.resolve(__dirname, 'src/tools/generators'),
            '@validators': path.resolve(__dirname, 'src/tools/validators'),
            '@ui': path.resolve(__dirname, 'src/ui'),
            '@types': path.resolve(__dirname, 'src/types'),
            '@utils': path.resolve(__dirname, 'src/utils'),
            '@commands': path.resolve(__dirname, 'src/commands'),
            '@errors': path.resolve(__dirname, 'src/errors'),
            '@ir': path.resolve(__dirname, 'src/ir'),
            '@copilot': path.resolve(__dirname, 'src/copilot'),
            '@stateMachine': path.resolve(__dirname, 'src/stateMachine'),
        };

        // Handle each alias
        Object.entries(aliases).forEach(([alias, aliasPath]) => {
            const filter = new RegExp(`^${alias.replace('@', '\\@')}(\\/.*)?$`);
            build.onResolve({ filter }, (args) => {
                const subPath = args.path.replace(alias, '');
                return { path: path.join(aliasPath, subPath) };
            });
        });
    },
};

async function main() {
    const ctx = await esbuild.context({
        entryPoints: ['src/extension.ts'],
        bundle: true,
        format: 'cjs',
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: 'node',
        outfile: 'dist/extension.js',
        external: ['vscode'],
        logLevel: 'silent',
        plugins: [
            pathAliasPlugin,
            /* add to the end of plugins array */
            esbuildProblemMatcherPlugin,
        ],
    });

    if (watch) {
        await ctx.watch();
    } else {
        await ctx.rebuild();
        await ctx.dispose();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
