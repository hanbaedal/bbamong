#!/bin/bash
PLATFORM=${1:-android}
node scripts/cap-manager.js open $PLATFORM
