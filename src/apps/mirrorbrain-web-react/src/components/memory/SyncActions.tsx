import Button from '../common/Button'

interface SyncActionsProps {
  onImportSources: () => void
  onSyncShell: () => void
  onSyncFilesystems: () => void
  onSyncScreenshot: () => void
  isImportingSources: boolean
  isSyncingShell: boolean
}

export default function SyncActions({
  onImportSources,
  onSyncShell,
  onSyncFilesystems,
  onSyncScreenshot,
  isImportingSources,
  isSyncingShell,
}: SyncActionsProps) {
  const syncButtons = [
    { label: 'Import Sources', onClick: onImportSources, loading: isImportingSources },
    { label: 'Sync Shell', onClick: onSyncShell, loading: isSyncingShell },
    { label: 'Sync Filesystems', onClick: onSyncFilesystems, loading: false },
    { label: 'Sync Screenshot', onClick: onSyncScreenshot, loading: false },
  ]
  const disabled = isImportingSources || isSyncingShell

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
          {button.loading ? 'Working...' : button.label}
        </Button>
      ))}
    </div>
  )
}
