
import { Page, expect } from '@playwright/test';
import path from 'path';

export async function uploadFile(page: Page, filePath: string) {
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(process.cwd(), filePath));
}

export async function navigateToFeature(page: Page, featureId: string) {
    // Assuming feature navigation is done via clicking cards or menu
    await page.click(`.feature-card[data-analysis="${featureId}"]`);
    await page.waitForTimeout(500); // Wait for transition
}

export async function selectVariables(page: Page, variables: string[]) {
    for (const variable of variables) {
        // Standard select option (needed for fallback at step 4)
        const selectWithOption = page.locator(`select:has(option[value="${variable}"])`);
        // 1. Try standard visible checkbox/radio input
        const input = page.locator(`input[value="${variable}"]`);
        if (await input.count() > 0) {
            // Check visibility of the first match
            if (await input.first().isVisible()) {
                await input.first().check();
            } else {
                // Fallback for hidden input, but check if it's inside a custom multiselect
                const insideMultiselect = await input.first().locator('xpath=ancestor::div[contains(@class, "multiselect-option")]').count() > 0;

                if (!insideMultiselect) {
                    // Truly hidden standalone input
                    console.log(`Using fallback hidden input for: ${variable}`);
                    await input.first().evaluate((el: HTMLInputElement) => {
                        el.checked = true;
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    });
                    continue;
                }
            }
        }

        // 2. Try standard visible input (checkbox/radio)
        // Exclude inputs inside custom multiselects (.multiselect-checkbox) as they require special handling in step 3
        const visibleInput = page.locator(`input[value="${variable}"]:not(.multiselect-checkbox)`);
        if (await visibleInput.count() > 0) {
            if (await visibleInput.first().isVisible()) {
                await visibleInput.first().check();
            } else {
                console.log(`Using fallback hidden input for: ${variable}`);
                await visibleInput.first().evaluate((el: HTMLInputElement) => {
                    el.checked = !el.checked; // Toggle or set true? Typically set true for selection.
                    el.checked = true;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                });
            }
            continue;
        }

        // 3. Try custom MultiSelect option (utils.js version)
        // STRATEGY: Find the visible CONTAINER first.
        // The options themselves are hidden inside the dropdown, but the container (.multiselect-wrapper) must be visible.

        const allContainers = page.locator('.multiselect-wrapper');
        const count = await allContainers.count();
        let matched = false;

        for (let i = 0; i < count; i++) {
            const container = allContainers.nth(i);
            if (await container.isVisible()) {
                const hasOptionValue = await container.locator(`.multiselect-option input[value="${variable}"]`).count() > 0;
                const hasOptionText = await container.locator(`.multiselect-option`).filter({ hasText: variable }).count() > 0;

                if (hasOptionValue || hasOptionText) {
                    const trigger = container.locator('.multiselect-input');

                    let option = hasOptionValue
                        ? container.locator(`.multiselect-option input[value="${variable}"]`).locator('..')
                        : container.locator(`.multiselect-option`).filter({ hasText: variable }).first();

                    if (!await option.isVisible()) {
                        await trigger.click();
                        try {
                            await option.waitFor({ state: 'visible', timeout: 1000 });
                        } catch (e) { }
                    }

                    if (await option.isVisible()) {
                        const isSelected = await option.evaluate(el => el.classList.contains('selected'));
                        if (!isSelected) {
                            await option.scrollIntoViewIfNeeded();
                            await option.click({ force: true });
                        }
                        matched = true;
                        // Close dropdown to prevent blocking other elements
                        await page.locator('body').click({ position: { x: 0, y: 0 } });
                        // Check if dropdown is closed
                        const dropdown = container.locator('.multiselect-dropdown');
                        await expect(dropdown).toBeHidden({ timeout: 1000 }).catch(() => { });
                        break;
                    }
                }
            }
        }

        if (matched) continue;

        // 4. Fallback: Force select on hidden select
        if (await selectWithOption.count() > 0) {
            console.log(`Using fallback hidden select for: ${variable}`);
            await selectWithOption.first().evaluate((select: HTMLSelectElement, varName: string) => {
                const option = Array.from(select.options).find(o => o.value === varName);
                if (option && !option.selected) {
                    option.selected = true;
                    // Dispatch change just in case
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    select.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, variable);
            continue;
        }

        console.warn(`Variable selection failed for: ${variable}`);
    }
}

export async function loadParamsFromConfig(configPath: string) {
    // Placeholder
    return {};
}

export async function selectStandardOption(page: Page, selector: string, value: string, optionType: 'value' | 'label' | 'index' = 'value') {
    const element = page.locator(selector);

    // Try standard selection first if visible
    try {
        if (await element.count() === 0) {
            console.error(`Element not found: ${selector}`);
            // Don't throw yet, let fallback try (though fallback also needs element) -> Actually if count is 0, fallback will fail too.
            // But wait, page.locator() is lazy. 
        }

        if (await element.isVisible()) {
            if (optionType === 'index') {
                await element.selectOption({ index: parseInt(value) });
            } else if (optionType === 'label') {
                await element.selectOption({ label: value });
            } else {
                await element.selectOption({ value: value });
            }
            return;
        }
    } catch (e) {
        // Continue to fallback
    }

    // Fallback for hidden select
    console.log(`Using fallback for hidden select: ${selector}`);
    try {
        await element.first().evaluate((select, { val, type }) => {
            if (!(select instanceof HTMLSelectElement)) return;

            let option;
            const options = Array.from(select.options);

            if (type === 'index') {
                option = options[parseInt(val)];
            } else if (type === 'label') {
                option = options.find(o => o.text.trim() === val);
            } else {
                option = options.find(o => o.value === val);
            }

            if (option) {
                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                select.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                // Log but don't crash page context?
                // Just log to console
                console.warn(`Option not found (fallback): ${val} [${type}]`);
            }
        }, { val: value, type: optionType });
    } catch (err) {
        console.error(`Fallback error for ${selector}: ${err}`);
        // Do not throw here to allow test to potentially recover or fail on assertion
    }
}

export async function checkRobust(page: Page, selector: string) {
    const element = page.locator(selector);
    if (await element.isVisible()) {
        await element.check();
    } else {
        await element.evaluate((el: HTMLInputElement) => {
            el.checked = true;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }
}
