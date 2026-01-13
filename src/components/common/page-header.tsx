/**
 * PageHeader - Reusable page header component
 * 
 * @example
 * <PageHeader
 *   title="สินค้า"
 *   description="จัดการข้อมูลสินค้าทั้งหมด"
 *   icon={<Package className="w-6 h-6" />}
 *   actions={<Button>เพิ่มสินค้า</Button>}
 * />
 */

interface PageHeaderProps {
  title: string
  description?: string
  icon?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  icon,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] flex items-center gap-2">
          {icon && <span className="text-[var(--accent-primary)]">{icon}</span>}
          {title}
        </h1>
        {description && (
          <p className="text-[var(--text-secondary)] mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

// Breadcrumb variant
interface BreadcrumbItem {
  label: string
  href?: string
}

interface PageHeaderWithBreadcrumbProps extends PageHeaderProps {
  breadcrumbs?: BreadcrumbItem[]
}

export function PageHeaderWithBreadcrumb({
  breadcrumbs,
  ...props
}: PageHeaderWithBreadcrumbProps) {
  return (
    <div className="space-y-2">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          {breadcrumbs.map((item, index) => (
            <span key={index} className="flex items-center gap-2">
              {index > 0 && <span>/</span>}
              {item.href ? (
                <a
                  href={item.href}
                  className="hover:text-[var(--accent-primary)] transition-colors"
                >
                  {item.label}
                </a>
              ) : (
                <span className="text-[var(--text-secondary)]">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <PageHeader {...props} />
    </div>
  )
}
