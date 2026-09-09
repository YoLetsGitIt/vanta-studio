/** Shared loading, empty and feedback surface. Action remains a real control. */
export default function StatePanel({
  title,
  description,
  tone = 'neutral',
  busy = false,
  icon,
  action,
  compact = false,
  children,
  className = '',
  role,
  ...props
}) {
  return (
    <div
      {...props}
      className={`studio-state-panel studio-state-panel--${tone}${compact ? ' studio-state-panel--compact' : ''} ${className}`.trim()}
      role={role || (tone === 'error' ? 'alert' : 'status')}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      aria-busy={busy || undefined}
    >
      {(busy || icon) && <span className="studio-state-icon" aria-hidden="true">{busy ? <span className="studio-spinner" /> : icon}</span>}
      <div className="studio-state-content">
        {title && <p className="studio-state-title">{title}</p>}
        {description && <p className="studio-state-description">{description}</p>}
        {children}
      </div>
      {action && <div className="studio-state-action">{action}</div>}
    </div>
  );
}
