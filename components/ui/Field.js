'use client';

import { Children, cloneElement, forwardRef, isValidElement, useId } from 'react';

/** A visible label and connected hint/error for one control. */
export default function Field({ label, id, hint, error, required = false, children, className = '', ...props }) {
  const generatedId = useId();
  const child = Children.count(children) === 1 && isValidElement(children) ? children : null;
  const controlId = id || child?.props.id || generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const canConnect = child && (typeof child.type !== 'string' || ['input', 'select', 'textarea'].includes(child.type));
  const isRequired = required || child?.props.required;
  const describedBy = [...new Set([child?.props['aria-describedby'], hintId, errorId].filter(Boolean).join(' ').split(' ').filter(Boolean))].join(' ') || undefined;

  return (
    <div {...props} className={`studio-field ${className}`.trim()}>
      {label && (
        <label className="studio-field-label" htmlFor={controlId}>
          {label}{isRequired && <span aria-hidden="true"> *</span>}
        </label>
      )}
      {canConnect ? cloneElement(child, {
        id: controlId,
        required: isRequired || undefined,
        'aria-invalid': error ? true : child.props['aria-invalid'],
        'aria-describedby': describedBy,
      }) : children}
      {hint && <p id={hintId} className="studio-field-hint">{hint}</p>}
      {error && <p id={errorId} className="studio-field-error" role="alert">{error}</p>}
    </div>
  );
}

export const Input = forwardRef(function Input({ className = '', invalid, type = 'text', ...props }, ref) {
  return <input {...props} ref={ref} type={type} aria-invalid={invalid || props['aria-invalid']} className={`studio-control ${className}`.trim()} />;
});

export const Textarea = forwardRef(function Textarea({ className = '', invalid, rows = 4, ...props }, ref) {
  return <textarea {...props} ref={ref} rows={rows} aria-invalid={invalid || props['aria-invalid']} className={`studio-control studio-control--textarea ${className}`.trim()} />;
});

export const Select = forwardRef(function Select({ className = '', invalid, children, ...props }, ref) {
  return <select {...props} ref={ref} aria-invalid={invalid || props['aria-invalid']} className={`studio-control ${className}`.trim()}>{children}</select>;
});
