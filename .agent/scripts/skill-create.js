/**
 * @file skill-create.js
 * @description Analyzes repository history to generate SKILL.md files
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = process.cwd();
const OUTPUT_DIR = path.join(REPO_ROOT, '.agent', 'skills');

// --- Git Analysis ---

function getGitLog(count = 200) {
    try {
        return execSync(`git log --oneline -n ${count} --name-only --pretty=format:"%H|%s|%ad" --date=short`, { encoding: 'utf8' });
    } catch (e) {
        console.error('Failed to read git log:', e.message);
        return '';
    }
}

function analyzeCommits(log) {
    const lines = log.split('\n');
    const conventions = {
        feat: 0,
        fix: 0,
        chore: 0,
        docs: 0,
        refactor: 0,
        test: 0,
        other: 0
    };

    lines.forEach(line => {
        if (!line.includes('|')) return;
        const msg = line.split('|')[1];
        if (!msg) return;

        if (msg.startsWith('feat')) conventions.feat++;
        else if (msg.startsWith('fix')) conventions.fix++;
        else if (msg.startsWith('chore')) conventions.chore++;
        else if (msg.startsWith('docs')) conventions.docs++;
        else if (msg.startsWith('refactor')) conventions.refactor++;
        else if (msg.startsWith('test')) conventions.test++;
        else conventions.other++;
    });

    return conventions;
}

// --- Skill Generation ---

function generateSkillMd(conventions) {
    const total = Object.values(conventions).reduce((a, b) => a + b, 0);
    const repoName = path.basename(REPO_ROOT);

    return `---
name: ${repoName}-patterns
description: Coding patterns extracted from ${repoName}
version: 1.0.0
source: local-git-analysis
analyzed_commits: ${total}
---

# ${repoName} Patterns

## Commit Conventions
Based on recent commit history:
- Features: ${conventions.feat}
- Fixes: ${conventions.fix}
- Maintenance (chore): ${conventions.chore}
- Documentation: ${conventions.docs}
- Refactoring: ${conventions.refactor}
- Testing: ${conventions.test}

## Code Architecture
(Auto-generated architecture overview would go here - placeholder)

## Workflows
(Auto-generated workflow usage would go here - placeholder)
`;
}

// --- Main ---

function main() {
    const args = process.argv.slice(2);

    if (args.includes('--detect') || args.includes('--output')) {
        console.log('Analyzing git history...');
        const log = getGitLog();
        const stats = analyzeCommits(log);
        const content = generateSkillMd(stats);

        // Create output directory if unrelated
        const targetDir = path.join(OUTPUT_DIR, 'auto-generated');
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const outputPath = path.join(targetDir, 'SKILL.md');
        fs.writeFileSync(outputPath, content);
        console.log(`Skill file generated at: ${outputPath}`);

        // Output for user
        console.log('\nGenerated Skill Content:');
        console.log(content);
    } else {
        console.log('Usage: node skill-create.js --detect');
    }
}

main();
