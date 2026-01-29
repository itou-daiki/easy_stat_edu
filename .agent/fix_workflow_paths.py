import os
import re
import glob

WORKFLOW_DIR = ".agent/workflows"

def fix_paths(content):
    # Fix agent paths: ~/.claude/agents/name.md -> .agent/skills/name/SKILL.md
    content = re.sub(r'~/\.claude/agents/([a-zA-Z0-9_-]+)\.md', r'.agent/skills/\1/SKILL.md', content)
    
    # Fix skill paths: ~/.claude/skills/ -> .agent/skills/
    content = re.sub(r'~/\.claude/skills/', r'.agent/skills/', content)
    
    # Fix rules paths: ~/.claude/rules/ -> .agent/rules/
    content = re.sub(r'~/\.claude/rules/', r'.agent/rules/', content)

     # Fix CLAUDE_PLUGIN_ROOT
    content = re.sub(r'\$\{CLAUDE_PLUGIN_ROOT\}', r'.agent', content)

    # Fix relative script paths (node scripts/...) -> node .agent/scripts/...
    content = re.sub(r'node scripts/', r'node .agent/scripts/', content)
    
    return content

files = glob.glob(os.path.join(WORKFLOW_DIR, "*.md"))
print(f"Checking {len(files)} files...")

for file_path in files:
    with open(file_path, 'r') as f:
        content = f.read()
    
    new_content = fix_paths(content)
    
    if new_content != content:
        print(f"Fixing {file_path}")
        with open(file_path, 'w') as f:
            f.write(new_content)
    else:
        print(f"No changes in {file_path}")

print("Done.")
