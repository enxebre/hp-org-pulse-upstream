const { test, expect } = require('@playwright/test');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const { setupErrorTracking, logCapturedErrors, pageHasContent, mainContentIsVisible } = require('./helpers');

/**
 * Integration tests for Agentic Tools module
 *
 * These tests verify:
 * - Agentic Tools section appears in sidebar navigation
 * - Clicking Tools nav item navigates to the module view
 * - Tool cards render with correct title, description, and URL
 * - Card links open in new tabs with correct security attributes
 * - TBD cards render without clickable links and show "TBD" badge
 * - No JavaScript errors occur during navigation and interaction
 *
 * Tag: @agentic-tools
 * Usage: npx playwright test --grep @agentic-tools
 */

function jsErrors(page) {
  return page.errors.filter(e =>
    e.type === 'pageerror' || !e.message.includes('Failed to load resource')
  );
}

test.describe('Agentic Tools Module @agentic-tools', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('shows the Org Pulse intro and Strategic Initiatives on the landing page only', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const intro = page.locator('main section').first();
    await expect(intro.getByText('What is Org Pulse?', { exact: true })).toBeVisible();
    await expect(intro.getByRole('heading', {
      level: 1,
      name: 'Hybrid Platforms’ agentic evolution'
    })).toBeVisible();
    await expect(intro.getByText(
      'Org Pulse brings delivery signals, engineering data, and agentic initiatives together to tell the story of how Hybrid Platforms is evolving.',
      { exact: true }
    )).toBeVisible();

    const landingBlock = page.locator('[data-testid="strategic-initiatives"]');
    const heading = landingBlock.getByRole('heading', { level: 2, name: 'Strategic Initiatives' });
    await expect(heading).toBeVisible();
    expect(await heading.evaluate(element => getComputedStyle(element).textTransform)).toBe('uppercase');
    expect(await intro.evaluate((introElement, initiativesElement) => Boolean(
      introElement.compareDocumentPosition(initiativesElement) & Node.DOCUMENT_POSITION_FOLLOWING
    ), await landingBlock.elementHandle())).toBe(true);

    const landingToolTitles = await landingBlock.locator('[data-testid="agentic-tools-content"] h4').allTextContents();
    expect(landingToolTitles.length).toBeGreaterThan(0);
    expect(landingToolTitles).toContain('Agentic Bug Refinement');

    await page.goto('/#/agentic-tools/tools', { waitUntil: 'networkidle' });
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);
    const moduleView = page.locator('main');
    await expect(moduleView.getByRole('heading', { level: 2, name: 'Agentic Tools' })).toBeVisible();
    expect(await moduleView.getByRole('heading', { level: 1, name: 'Hybrid Platforms’ agentic evolution' }).count()).toBe(0);
    expect(await moduleView.getByRole('heading', { level: 2, name: 'Strategic Initiatives' }).count()).toBe(0);
    const moduleToolTitles = await moduleView.locator('[data-testid="agentic-tools-content"] h4').allTextContents();
    expect(moduleToolTitles).toEqual(landingToolTitles.filter(title => title !== 'Agentic Bug Refinement'));

    expect(jsErrors(page)).toHaveLength(0);
  });

  test('should display Agentic Tools section in sidebar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const mainContentVisible = await mainContentIsVisible(page);
    expect(mainContentVisible).toBe(true);

    // Look for "Agentic Tools" section header in the sidebar
    const agenticToolsSection = page.locator('aside nav', { hasText: 'Agentic Tools' });
    await expect(agenticToolsSection).toBeVisible();

    expect(jsErrors(page)).toHaveLength(0);
  });

  test('should navigate to Tools view when clicking nav item', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // First expand the "Agentic Tools" section by clicking the section header
    const sectionHeader = page.getByRole('button', { name: 'Agentic Tools', exact: true });
    await sectionHeader.click();
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Click the "Tools" nav item under Agentic Tools section (exact match to avoid matching header)
    const toolsNavItem = page.getByRole('button', { name: 'Tools', exact: true });
    await toolsNavItem.click();
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Verify we navigated to the correct route
    const url = page.url();
    expect(url).toContain('#/agentic-tools/tools');

    // Verify page title renders (in main content, not header)
    const pageTitle = page.locator('main h2', { hasText: 'Agentic Tools' });
    await expect(pageTitle).toBeVisible();

    const hasContent = await pageHasContent(page);
    expect(hasContent).toBe(true);

    expect(jsErrors(page)).toHaveLength(0);
  });

  test('should render tool cards with title and description', async ({ page }) => {
    await page.goto('/#/agentic-tools/tools');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Verify tool cards are rendered
    const toolCards = page.locator('a[target="_blank"][rel="noopener noreferrer"]');
    const cardCount = await toolCards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Verify first tool card has expected content
    const firstCard = toolCards.first();
    const cardText = await firstCard.textContent();
    expect(cardText).toBeTruthy();

    // Look for at least one card title (tools.json has example entries)
    const cardTitles = page.locator('a[target="_blank"] h4');
    const titleCount = await cardTitles.count();
    expect(titleCount).toBeGreaterThan(0);

    expect(jsErrors(page)).toHaveLength(0);
  });

  test('should set correct link attributes on tool cards', async ({ page }) => {
    await page.goto('/#/agentic-tools/tools');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const toolLinks = page.locator('a[target="_blank"][rel="noopener noreferrer"]');
    const linkCount = await toolLinks.count();
    expect(linkCount).toBeGreaterThan(0);

    // Check first link attributes
    const firstLink = toolLinks.first();
    const href = await firstLink.getAttribute('href');
    const target = await firstLink.getAttribute('target');
    const rel = await firstLink.getAttribute('rel');

    expect(href).toBeTruthy();
    expect(href).toMatch(/^https?:\/\//);
    expect(target).toBe('_blank');
    expect(rel).toBe('noopener noreferrer');

    expect(jsErrors(page)).toHaveLength(0);
  });

  test('should navigate to an internal module link in the current tab', async ({ page }) => {
    await page.goto('/#/agentic-tools/tools');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const internalCard = page.locator('[data-testid="agentic-tools-content"] .grid > *', {
      has: page.getByRole('heading', { name: 'RFE Review', exact: true })
    });
    await expect(internalCard).toHaveAttribute('href', '#/ai-impact/rfe-review');
    await expect(internalCard).not.toHaveAttribute('target', '_blank');
    await expect(internalCard).toContainText('Internal');

    const pageCount = page.context().pages().length;
    await internalCard.click();

    await expect(page).toHaveURL(/#\/ai-impact\/rfe-review$/);
    expect(page.context().pages()).toHaveLength(pageCount);
    expect(jsErrors(page)).toHaveLength(0);
  });

  test('should render the icons configured for tool cards', async ({ page }) => {
    await page.goto('/#/agentic-tools/tools');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const configuredIcons = [
      ['Example Tool 1', 'lucide-wrench'],
      ['Example Tool 2', 'lucide-hammer'],
      ['Coming Soon Tool', 'lucide-sparkles'],
      ['RFE Review', 'lucide-clipboard-list']
    ];
    for (const [title, iconClass] of configuredIcons) {
      const card = page.locator('[data-testid="agentic-tools-content"] .grid > *', {
        has: page.locator('h4', { hasText: title })
      });
      await expect(card.locator('svg')).toHaveClass(new RegExp(`\\b${iconClass}\\b`));
    }

    expect(jsErrors(page)).toHaveLength(0);
  });

  test('should preview an icon while selecting it in Agentic Tools settings', async ({ page }) => {
    await page.goto('/#/settings?tab=agentic-tools');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await page.getByRole('button', { name: 'Add Tool' }).click();
    const iconSelect = page.getByLabel('Icon *');
    const preview = page.getByTestId('icon-selection-preview');

    expect(await preview.evaluate((element, select) => Boolean(
      element.compareDocumentPosition(select) & Node.DOCUMENT_POSITION_FOLLOWING
    ), await iconSelect.elementHandle())).toBe(true);
    await expect(preview).toHaveAttribute('aria-label', 'Icon preview; select an icon');
    await expect(preview.locator('svg')).toHaveCount(0);

    const selections = [
      ['sparkles', 'lucide-sparkles'],
      ['clipboard-check', 'lucide-clipboard-check'],
      ['git-merge', 'lucide-git-merge']
    ];
    for (const [name, iconClass] of selections) {
      await iconSelect.selectOption(name);
      await expect(preview).toHaveAttribute('aria-label', `${name} icon preview`);
      await expect(preview.locator('svg')).toHaveClass(new RegExp(`\\b${iconClass}\\b`));
      await expect(preview).toHaveText('');
    }
    expect(jsErrors(page)).toHaveLength(0);
  });

  test('should not show empty state when tools are configured', async ({ page }) => {
    await page.goto('/#/agentic-tools/tools');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Verify that we don't see the "No tools configured" message
    const emptyStateMessage = page.locator('text=No tools configured');
    const isVisible = await emptyStateMessage.isVisible().catch(() => false);
    expect(isVisible).toBe(false);

    expect(jsErrors(page)).toHaveLength(0);
  });

  test('should maintain responsive grid layout', async ({ page }) => {
    await page.goto('/#/agentic-tools/tools');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Check that tool cards are rendered within a grid container
    const gridContainer = page.locator('div.grid');
    await expect(gridContainer).toBeVisible();

    // Verify grid has responsive classes
    const gridClasses = await gridContainer.getAttribute('class');
    expect(gridClasses).toContain('grid-cols-1');
    expect(gridClasses).toContain('md:grid-cols-2');
    expect(gridClasses).toContain('lg:grid-cols-3');

    expect(jsErrors(page)).toHaveLength(0);
  });

  test('should render TBD cards without clickable links', async ({ page }) => {
    await page.goto('/#/agentic-tools/tools');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Look for TBD tool card by text content
    const tbdCardText = page.locator('text=Coming Soon Tool');
    await expect(tbdCardText).toBeVisible();

    // Verify TBD badge is visible
    const tbdBadge = page.locator('span', { hasText: 'TBD' });
    await expect(tbdBadge).toBeVisible();

    // Ensure the TBD card is NOT an anchor tag with href
    const tbdCard = tbdCardText.locator('..');
    const tagName = await tbdCard.evaluate(el => el.parentElement?.tagName);
    expect(tagName).not.toBe('A');

    expect(jsErrors(page)).toHaveLength(0);
  });

  test('should not highlight TBD card icon/title on hover', async ({ page }) => {
    await page.goto('/#/agentic-tools/tools');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Find the TBD card (Coming Soon Tool)
    const tbdCard = page.locator('div.group', { has: page.locator('text=Coming Soon Tool') });
    await expect(tbdCard).toBeVisible();

    // Get the title and icon elements before hover
    const titleElement = tbdCard.locator('h4');
    const initialTitleClasses = await titleElement.getAttribute('class');

    // Verify title does NOT have group-hover:text-primary classes
    expect(initialTitleClasses).not.toContain('group-hover:text-primary-600');
    expect(initialTitleClasses).not.toContain('group-hover:text-primary-400');

    // Hover over the TBD card
    await tbdCard.hover();
    await page.waitForTimeout(100); // Brief wait for any CSS transitions

    // Verify title still doesn't have those classes (no hover effect should apply)
    const titleClassesAfterHover = await titleElement.getAttribute('class');
    expect(titleClassesAfterHover).not.toContain('group-hover:text-primary-600');
    expect(titleClassesAfterHover).not.toContain('group-hover:text-primary-400');

    expect(jsErrors(page)).toHaveLength(0);
  });
});
