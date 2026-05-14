import { expect, test } from '@playwright/test';

import { startMirrorBrainMvpFixture } from './fixtures/mirrorbrain-mvp-fixture.js';

test('runs the standalone UI with current top-level tabs', async ({ page }) => {
  const fixture = await startMirrorBrainMvpFixture();

  try {
    await page.goto(fixture.origin);

    await expect(
      page.getByRole('heading', { name: 'MirrorBrain' }),
    ).toBeVisible();
    await expect(page.getByText('Personal Memory & Knowledge')).toBeVisible();
    await expect(page.getByRole('tab', { name: /^memory sources$/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^preview$/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^published$/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^skill$/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^knowledge$/i })).toHaveCount(0);

    await expect(page.getByText('Showing 1 of 1 unique URLs')).toBeVisible();
    await page.getByRole('button', { name: 'Import Sources' }).click();
    await expect(
      page.getByText('Source import completed: 1 events imported from 1 ledgers'),
    ).toBeVisible();

    await page.getByRole('tab', { name: /^preview$/i }).click();
    await expect(page.getByRole('button', { name: 'Last 6h' })).toBeVisible();

    await page.getByRole('tab', { name: /^published$/i }).click();
    await expect(page.getByTestId('published-knowledge-panel')).toContainText(
      'No published knowledge articles yet.',
    );
  } finally {
    await fixture.stop();
  }
});
