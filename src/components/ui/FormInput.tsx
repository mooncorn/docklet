"use client";

import { InputHTMLAttributes } from "react";

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helpText?: string;
}

export default function FormInput({
  label,
  error,
  helpText,
  id,
  ...props
}: FormInputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div>
      <label htmlFor={inputId} className="form-label">
        {label}
      </label>
      <input id={inputId} className="input-field" {...props} />
      {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
      {helpText && !error && (
        <p className="text-gray-500 text-sm mt-1">{helpText}</p>
      )}
    </div>
  );
}
