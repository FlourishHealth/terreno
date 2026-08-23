#!/usr/bin/env bun

import {createProcessIo} from "./io";
import {runCli} from "./runCli";

const code = await runCli(process.argv.slice(2), createProcessIo());
process.exit(code);
