#!/usr/bin/env bun

import {startLocalMcpServer} from "./localServer.js";

void startLocalMcpServer().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
