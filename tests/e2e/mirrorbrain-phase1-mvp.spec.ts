import { expect, test } from '@playwright/test';

import { startMirrorBrainMvpFixture } from './fixtures/mirrorbrain-mvp-fixture.js';

test('runs the phase 1 MVP review flow through the standalone UI', async ({
  page,
}) => {
  const fixture = await startMirrorBrainMvpFixture();
  const expectedReviewWindowDate = getPreviousCalendarDate(new Date());

  try {
    await page.goto(fixture.origin);

    await expect(page.getByRole('heading', { name: 'MirrorBrain Phase 1 MVP' })).toBeVisible();
    await expect(page.getByText('Service Status: running')).toBeVisible();

    await page.getByRole('button', { name: 'Sync Browser Memory' }).click();
    await expect(page.getByText('activitywatch-browser:aw-watcher-web-chrome')).toBeVisible();
    await expect(
      page.getByText('Status: Browser sync completed: 1 events imported.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Review' }).click();
    await page.getByRole('button', { name: 'Create Candidate' }).click();
    await expect(
      page.getByRole('button', { name: /Fixture Candidate/ }),
    ).toBeVisible();
    await expect(
      page.getByText(
        `Status: Generated 1 daily candidates for ${expectedReviewWindowDate}.`,
      ),
    ).toBeVisible();
    await expect(
      page.getByText('This daily stream has limited evidence and should stay in human review.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Keep Candidate' }).click();
    await expect(
      page.getByText('Reviewed ID'),
    ).toBeVisible();
    await expect(
      page.getByText('reviewed:candidate:browser:aw-event-1', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Status: Candidate kept: reviewed:candidate:browser:aw-event-1'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Artifacts' }).click();
    await page.getByRole('button', { name: 'Generate Knowledge' }).click();
    await expect(
      page.getByText(
        'knowledge-draft:reviewed:candidate:browser:aw-event-1',
        { exact: true },
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
        'skill-draft:reviewed:candidate:browser:aw-event-1',
        { exact: true },
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

function getPreviousCalendarDate(reference: Date): string {
  const previousDay = new Date(reference);
  previousDay.setDate(previousDay.getDate() - 1);
  return [
    previousDay.getFullYear(),
    String(previousDay.getMonth() + 1).padStart(2, '0'),
    String(previousDay.getDate()).padStart(2, '0'),
  ].join('-');
}
