---
name: Planning with Files
description: A comprehensive context management system for AI agents. Enforces externalizing memory to disk to prevent hallucinations and maintain long-term coherence.
---

# Planning with Files (v2.2.0)

> **The Core Pattern**:  
> `Context Window = RAM` (Volatile, Limited)  
> `Filesystem = Disk` (Persistent, Unlimited)  
> **Rule**: Anything important MUST be written to disk immediately.

## 1. Critical Rules (Non-Negotiable)

### 1.1 Create Plan First
Never start a complex task (coding, research, refactoring) without creating or updating `task_plan.md`. This is your anchor.

### 1.2 The 2-Action Rule
"After every **2** view/browser/search operations, **IMMEDIATELY** save key findings to `findings.md`."
- Prevents "context window washouts" where new tokens push out old insights.
- If you read a file and find a bug, log it in `findings.md` *before* trying to fix it.

### 1.3 Read Before Decide
Before making a major decision (architecture change, deletion, new library), **read the plan file**.
- This refreshes your "Attention Window" with the original goals and constraints.

### 1.4 Update After Act
After completing a phase or a significant step:
1.  Mark the item as `[x]` in `task_plan.md` or `progress.md`.
2.  Log any errors encountered in `task_plan.md` (Errors Section).
3.  Note new files created.

### 1.5 The 3-Strike Error Protocol
If an action fails (e.g., test failure, API error, file not found):
1.  **Attempt 1: Diagnose & Fix**: Read error, identify root cause, apply fix.
2.  **Attempt 2: Alternative Approach**: If the exact same error happens, **STOP**. Do not try the same thing again. Use a different tool, library, or method.
3.  **Attempt 3: Broader Rethink**: Question your assumptions. Is the file path wrong? Is the logic flawed?
4.  **AFTER 3 FAILURES**: **Escalate to User**. Stop spinning your wheels.

## 2. File Goals

### `task_plan.md` (The Strategy)
- **Purpose**: Defines *what* we are doing and *how*.
- **Contains**: Objectives, Step-by-step implementation plan, Current Status, Error Log.
- **Update Frequency**: At the start of a task, and after every major phase completion.

### `findings.md` (The Memory)
- **Purpose**: Stores raw information, code snippets, documentation, and "aha!" moments.
- **Contains**: Relevant file content summaries, API references, decisions made, bug causes.
- **Update Frequency**: **High**. Every 2-3 tool calls during research/debugging.

### `progress.md` (The Journal)
- **Purpose**: A chronological log of actions taken (optional if using `task.md` heavily/Agentic Mode).
- **Contains**: Timestamps, specific commands run, test results.

## 3. Workflow Implementation

### Phase 1: Initialization / Planning
1.  **Check Context**: Run `ls -R` or `list_dir` to see if planning files exist.
2.  **Create/Read**:
    - **Task Plan**: Create `task_plan.md` using `templates/task_plan.md` as a guide.
    - **Findings**: Create `findings.md` using `templates/findings.md` for research notes.
    - *Note*: You can use `read_file .agent/skills/planning-with-files/templates/task_plan.md` to see the structure.

### Phase 2: Execution (The Loop)
1.  **Read** code/docs.
2.  **Write** findings to `findings.md` (2-Action Rule).
3.  **Update** `task_plan.md` if the plan changes based on findings.
4.  **Act** (Write code, run command).
5.  **Verify** result.
6.  **Log** outcome to `progress.md` or `task_plan.md`.

## 4. When to Use
- **USE FOR**: Multi-step tasks, Debugging complex bugs, Feature implementation, Refactoring.
- **SKIP FOR**: Trivial one-shot questions (e.g., "What time is it?", "Fix this typo on line 10").

## 5. Anti-Patterns (What NOT to do)
- **Storing everything in RAM**: Relying on your context window to remember what you read 10 turns ago.
- **"I'll remember that"**: You won't. Write it down.
- **Looping on Errors**: Retrying the same failing command 5 times hoping it works. (Use 3-Strike Protocol).
