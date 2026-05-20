export default function PageHeader({ icon, title, subtitle, children }) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        <h1 className="page-title">
          {icon && <span className="page-title-icon" aria-hidden="true">{icon}</span>}
          {title}
        </h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {children && <div className="page-header-actions">{children}</div>}
    </header>
  )
}
