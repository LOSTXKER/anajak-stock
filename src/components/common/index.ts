/**
 * Common Components - Centralized exports
 */

// Theme
export { ThemeProvider } from './theme-provider'
export { ThemeToggle, ThemeToggleSimple } from './theme-toggle'

// Page layout
export { PageHeader, PageHeaderWithBreadcrumb } from './page-header'

// Statistics
export { StatCard, StatCardGrid } from './stat-card'

// Data display
export { DataTable, Pagination } from './data-table'
export { StatusBadge, mapDocStatus, mapPRStatus, mapPOStatus } from './status-badge'

// States
export { EmptyState, NoSearchResults, NoData } from './empty-state'
export {
  Spinner,
  PageLoading,
  InlineLoading,
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonTable,
} from './loading-state'

// Filters
export { SearchFilter, SimpleSearch } from './search-filter'

// Dialogs
export { ConfirmDialog, DeleteConfirmDialog } from './confirm-dialog'
