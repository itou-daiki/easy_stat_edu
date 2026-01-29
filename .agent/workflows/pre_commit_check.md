---
description: Run pre-commit checks (linting, tests, etc.)
---

# Pre-Commit Checks

This workflow faithfully reproduces the `hooks` from `everything-claude-code`, running checks that ensure code quality before you commit.

1. **Check for `console.log` statements**
   Run the following command to find any leftover debug prints.
   ```bash
   grep -r "console.log" . --include="*.js" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules
   ```

2. **Run Type Checking (if TypeScript)**
   If this is a TypeScript project, verify types.
   ```bash
   if [ -f tsconfig.json ]; then npx tsc --noEmit; fi
   ```

3. **Run Prettier Check**
   Ensure formatting is consistent.
   ```bash
   npx prettier --check "**/*.{js,jsx,ts,tsx,css,md}"
   ```

4. **Run Tests**
   Run the project's test suite.
   ```bash
   npm test
   ```
