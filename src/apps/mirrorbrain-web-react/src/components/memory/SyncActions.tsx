import Button from '../common/Button'

interface SyncActionsProps {
  onSyncBrowser: () => void
  onSyncShell: () => void
  onSyncFilesystems: () => void
  onSyncScreenshot: () => void
  isSyncingBrowser: boolean
  isSyncingShell: boolean
}

export default function SyncActions({
  onSyncBrowser,
  onSyncShell,
  onSyncFilesystems,
  onSyncScreenshot,
  isSyncingBrowser,
  isSyncingShell,
}: SyncActionsProps) {
  const syncButtons = [
    { label: 'Sync Browser', onClick: onSyncBrowser, loading: isSyncingBrowser },
    { label: 'Sync Shell', onClick: onSyncShell, loading: isSyncingShell },
    { label: 'Sync Filesystems', onClick: onSyncFilesystems, loading: false },
    { label: 'Sync Screenshot', onClick: onSyncScreenshot, loading: false },
  ]
  const disabled = isSyncingBrowser || isSyncingShell

  return (
    <div className="mb-3 flex flex-wrap justify-end gap-2">
      {syncButtons.map((button) => (
        <Button
          key={button.label}
          variant="primary"
          onClick={button.onClick}
          loading={button.loading}
          disabled={disabled}
        >
          {button.loading ? 'Syncing...' : button.label}
        </Button>
      ))}
    </div>
  )
}
