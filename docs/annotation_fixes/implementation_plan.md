# Logic Breakdown: Two-way Mixed ANOVA (Split-Plot) UI Fix

## Goat Description
The current implementation of the Two-way Mixed ANOVA UI is mismatched with its execution logic. The backend logic (`runTwoWayMixedANOVA`) iterates over a list of pairs (Pre/Post combinations), implying support for multiple dependent variable pairs. However, the UI uses a single-variable selector (`createPairSelector`), preventing users from specifying even a single pair correctly, let alone multiple pairs.

This plan addresses this by implementing a **Multi-Pair Selector UI** that allows users to dynamically add and remove Pre/Post variable pairs.

## User Review Required
> [!IMPORTANT]
> This change modifies `js/utils.js` to introduce a new UI component (`createMultiPairSelector`) and updates `js/analyses/anova_two_way.js` to utilize it. Verify that the "Pre" and "Post" terminology aligns with your intended use case (Time 1 vs Time 2, etc.).

## Proposed Changes

### Core Logic & UI Components
#### [MODIFY] [utils.js](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/js/utils.js)
- Implement `createMultiPairSelector(containerId, columns)`:
    - Renders a container for pair rows.
    - Adds an "Add Pair" button.
    - Implementing `addPairRow()` function to append a new row with:
        - "Pre" select dropdown (for Time 1 / Condition A).
        - "Post" select dropdown (for Time 2 / Condition B).
        - "Remove" button.
    - Ensures each row has the class `.pair-row` and inputs have classes `.pre-select` and `.post-select` to match `anova_two_way.js` logic.

### Analysis Module
#### [MODIFY] [anova_two_way.js](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/js/analyses/anova_two_way.js)
- Update `render` function:
    - Replace the call to `createPairSelector` with `createMultiPairSelector`.
    - Ensure the "Run Analysis" button logic (which already iterates `.pair-row`) works correctly with the new DOM structure.

## Verification Plan

### Manual Verification
1.  **UI Check**:
    - Open "Two-way ANOVA" -> "Mixed Design".
    - Click "Add Pair" button. Verify a new row appears with two dropdowns.
    - Add multiple pairs (e.g., `Score_Pre`/`Score_Post` and `Anxiety_Pre`/`Anxiety_Post`).
    - Remove a pair and verify it disappears.
2.  **Execution Check**:
    - Load data with at least one Between-Subject factor and two Within-Subject variables.
    - Select pairs and run analysis.
    - Verify that results are generated for *each* pair.
