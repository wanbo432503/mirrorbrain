// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import MemoryRecord from './MemoryRecord'
import type { MemoryEvent } from '../../types/index'

describe('MemoryRecord', () => {
  it('shows the title for source-ledger browser memory events', () => {
    const event: MemoryEvent = {
      id: 'ledger:browser:event-1',
      sourceType: 'browser',
      sourceRef: 'browser:chrome-main:event-1',
      timestamp: '2026-05-12T08:55:51.747000+00:00',
      authorizationScopeId: 'scope-source-ledger',
      content: {
        title: 'MirrorBrain - Personal Memory & Knowledge System',
        summary: 'MirrorBrain UI page.',
        contentKind: 'browser-page',
        sourceSpecific: {
          url: 'http://127.0.0.1:3007/',
        },
      },
      captureMetadata: {
        upstreamSource: 'source-ledger:browser',
        checkpoint: 'ledgers/2026-05-12/browser.jsonl:1',
      },
    }

    render(<MemoryRecord event={event} />)

    expect(
      screen.getByText('MirrorBrain - Personal Memory & Knowledge System')
    ).not.toBeNull()
    expect(screen.queryByText('Unknown Event')).toBeNull()
  })
})
