#!/usr/bin/env bun

import {enableScaffoldWrites} from "../scaffoldWriteMode.js";
import {startLocalMcpServer} from "./localServer.js";

enableScaffoldWrites();

void startLocalMcpServer().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
