#!/usr/bin/env node
// `uisight-audit` is a bin inside the `uisight` package, not a package of its own, so
// `npx -y uisight-audit` -- which the README told people to run for months -- failed
// with E404 and left the name free for anyone to claim. This package holds the
// name and does what that instruction always meant.
//
// Importing runs it: the entry point has no main-module guard, and argv passes
// straight through.
import 'uisight/src/audit.mjs';
