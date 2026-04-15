"use client";

import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "icon";
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantClasses = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  danger: "btn-danger",
  icon: "btn-icon",
};

export default function Button({
  variant = "secondary",
  loading = false,
  icon,
  children,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`${variantClasses[variant]} ${className} inline-flex items-center justify-center gap-2`}
      {...props}
    >
      {loading ? <span className="spinner !w-4 !h-4 !border-2" /> : icon}
      {children}
    </button>
  );
}
