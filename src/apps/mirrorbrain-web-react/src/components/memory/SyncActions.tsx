import Button from '../common/Button'

interface SyncActionsProps {
  onSyncBrowser: () => void
  onSyncShell: () => void
  isSyncingBrowser: boolean
  isSyncingShell: boolean
}

export default function SyncActions({
  onSyncBrowser,
  onSyncShell,
  isSyncingBrowser,
  isSyncingShell,
}: SyncActionsProps) {
  return (
    <div className="flex justify-end gap-2 mb-3">
      <Button
        variant="primary"
        onClick={onSyncBrowser}
        loading={isSyncingBrowser}
        disabled={isSyncingBrowser || isSyncingShell}
      >
        {isSyncingBrowser ? 'Syncing...' : 'Sync Browser'}
      </Button>
      <Button
        variant="default"
        onClick={onSyncShell}
        loading={isSyncingShell}
        disabled={isSyncingBrowser || isSyncingShell}
      >
        {isSyncingShell ? 'Syncing...' : 'Sync Shell'}
      </Button>
    </div>
  )
}