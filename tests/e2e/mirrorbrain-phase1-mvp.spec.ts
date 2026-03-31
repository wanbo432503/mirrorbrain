import { expect, test } from '@playwright/test';

import { startMirrorBrainMvpFixture } from './fixtures/mirrorbrain-mvp-fixture.js';

test('runs the phase 1 MVP review flow through the standalone UI', async ({
  page,
}) => {
  const fixture = await startMirrorBrainMvpFixture();

  try {
    await page.goto(fixture.origin);

    await expect(page.getByRole('heading', { name: 'MirrorBrain Phase 1 MVP' })).toBeVisible();
    await expect(page.getByText('Service Status: running')).toBeVisible();

    await page.getByRole('button', { name: 'Sync Browser Memory' }).click();
    await expect(page.getByText('activitywatch-browser:aw-watcher-web-chrome')).toBeVisible();
    await expect(
      page.getByText('Status: Browser sync completed: 1 events imported.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Create Candidate' }).click();
    await expect(
      page.getByText('Candidate: candidate:browser:aw-event-1'),
    ).toBeVisible();
    await expect(
      page.getByText('Status: Candidate created: candidate:browser:aw-event-1'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Keep Candidate' }).click();
    await expect(
      page.getByText('Reviewed: reviewed:candidate:browser:aw-event-1'),
    ).toBeVisible();
    await expect(
      page.getByText('Status: Candidate kept: reviewed:candidate:browser:aw-event-1'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Generate Knowledge' }).click();
    await expect(
      page.getByText(
        'Knowledge: knowledge-draft:reviewed:candidate:browser:aw-event-1',
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Status: Knowledge generated: knowledge-draft:reviewed:candidate:browser:aw-event-1',
      ),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Generate Skill' }).click();
    await expect(
      page.getByText(
        'Skill: skill-draft:reviewed:candidate:browser:aw-event-1',
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Status: Skill generated: skill-draft:reviewed:candidate:browser:aw-event-1',
      ),
    ).toBeVisible();
  } finally {
    await fixture.stop();
  }
});
