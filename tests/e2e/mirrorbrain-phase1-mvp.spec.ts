import { expect, type Page, test } from '@playwright/test';

import { startMirrorBrainMvpFixture } from './fixtures/mirrorbrain-mvp-fixture.js';

test('runs the phase 1 MVP review flow through the standalone UI', async ({
  page,
}) => {
  const fixture = await startMirrorBrainMvpFixture();

  try {
    await page.goto(fixture.origin);

    await expect(
      page.getByRole('heading', { name: 'MirrorBrain' }),
    ).toBeVisible();
    await expect(page.getByText('Personal Memory & Knowledge')).toBeVisible();
    await expect(page.getByText('Showing 1 of 1 unique URLs')).toBeVisible();

    await page.getByRole('button', { name: 'Import Sources' }).click();
    await expect(
      page.getByText('Source import completed: 1 events imported from 1 ledgers'),
    ).toBeVisible();

    await createAndKeepFixtureCandidate(page);

    await page.getByRole('button', { name: 'Generate Knowledge' }).click();
    await expect(
      page.getByRole('heading', { name: 'Knowledge Draft' }),
    ).toBeVisible();
    await expect(page.getByLabel('Generated Note')).toHaveValue(
      /Fixture Candidate/,
    );

    await page.reload();
    await createAndKeepFixtureCandidate(page);

    await page.getByRole('button', { name: 'Generate Skill' }).click();
    await expect(
      page.getByRole('heading', { name: 'Skill Draft' }),
    ).toBeVisible();
    await expect(page.getByText('1 references attached')).toBeVisible();
    await expect(page.locator('input[type="checkbox"]')).toBeChecked();
  } finally {
    await fixture.stop();
  }
});

async function createAndKeepFixtureCandidate(page: Page) {
  await page.getByRole('tab', { name: 'review' }).click();
  await page.getByRole('button', { name: 'Create Daily Candidates' }).click();
  await expect(page.getByText('Created 1 daily candidates')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Fixture Candidate/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Fixture Candidate/ }).click();
  await page.getByRole('button', { name: 'Keep candidate', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Kept Candidates (1)' }),
  ).toBeVisible();
  await expect(page.getByText('Candidate kept')).toBeVisible();
}
