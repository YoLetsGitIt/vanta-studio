'use client';

import { forwardRef } from 'react';

const Button = forwardRef(function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingLabel,
  disabled = false,
  fullWidth = false,
  type = 'button',
  className = '',
  children,
  ...props
}, ref) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`studio-button studio-button--${variant} studio-button--${size}${fullWidth ? ' studio-button--full' : ''} ${className}`.trim()}
    >
      {loading && <span className="studio-spinner" aria-hidden="true" />}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
});

export const IconButton = forwardRef(function IconButton({
  variant = 'ghost',
  className = '',
  children,
  ...props
}, ref) {
  return (
    <Button {...props} ref={ref} variant={variant} className={`studio-button--icon ${className}`.trim()}>
      <span aria-hidden="true" className="studio-button-icon">{children}</span>
    </Button>
  );
});

export default Button;
