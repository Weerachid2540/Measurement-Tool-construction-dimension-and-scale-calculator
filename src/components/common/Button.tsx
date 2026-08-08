import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconOnly?: boolean;
  active?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconOnly = false,
  active = false,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    'mt-btn',
    `mt-btn--${variant}`,
    `mt-btn--${size}`,
    iconOnly ? 'mt-btn--icon' : '',
    active ? 'is-active' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" className={classes} aria-pressed={active || undefined} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {!iconOnly && children}
    </button>
  );
}
