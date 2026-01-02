#!/usr/bin/env bun

import {exec} from "node:child_process";
import {existsSync, readFileSync, writeFileSync} from "node:fs";
import {join} from "node:path";

// Find the CLI binary path directly
const cliPath = join(
	__dirname,
	"..",
	"node_modules",
	"@rtk-query",
	"codegen-openapi",
	"lib",
	"bin",
	"cli.mjs"
);
const configPath = join(__dirname, "..", "openapi-config.ts");
const tsConfigPath = join(__dirname, "..", "tsconfig.codegen.json");

// Use tsx to run the codegen CLI with the TypeScript config
const command = `TS_NODE_PROJECT=${tsConfigPath} tsx ${cliPath} ${configPath}`;

console.log("Generating SDK from OpenAPI spec...");

exec(command, (error, stdout, stderr) => {
	if (error) {
		console.error(`Error: ${error.message}`);
		process.exit(1);
	}
	if (stderr) {
		console.error(`stderr: ${stderr}`);
	}
	if (stdout) {
		console.log(stdout);
	}

	console.log("SDK generation complete!");

	// Post-process: remove empty export line if it exists
	const sdkPath = join(__dirname, "..", "store", "openApiSdk.ts");

	if (existsSync(sdkPath)) {
		let content = readFileSync(sdkPath, "utf8");
		content = content.replace(/^export const \{\} = injectedRtkApi;\n?/m, "");
		writeFileSync(sdkPath, content, "utf8");
		console.log("Cleaned up empty exports");
	}

	// Run biome formatting
	exec(
		"biome check --unsafe --write store/openApiSdk.ts",
		{cwd: join(__dirname, "..")},
		(formatError, formatStdout) => {
			if (formatError) {
				console.error(`Formatting error: ${formatError.message}`);
				process.exit(1);
			}
			if (formatStdout) {
				console.log(formatStdout);
			}
			console.log("✅ SDK generated and formatted successfully!");
		}
	);
});
