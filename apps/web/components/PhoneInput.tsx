'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';

// Country codes with phone prefixes
export const COUNTRY_PHONE_CODES: Record<string, { name: string; prefix: string; flag: string }> = {
  US: { name: 'United States', prefix: '+1', flag: '🇺🇸' },
  IN: { name: 'India', prefix: '+91', flag: '🇮🇳' },
  GB: { name: 'United Kingdom', prefix: '+44', flag: '🇬🇧' },
  CA: { name: 'Canada', prefix: '+1', flag: '🇨🇦' },
  AU: { name: 'Australia', prefix: '+61', flag: '🇦🇺' },
  DE: { name: 'Germany', prefix: '+49', flag: '🇩🇪' },
  FR: { name: 'France', prefix: '+33', flag: '🇫🇷' },
  JP: { name: 'Japan', prefix: '+81', flag: '🇯🇵' },
  SG: { name: 'Singapore', prefix: '+65', flag: '🇸🇬' },
  AE: { name: 'UAE', prefix: '+971', flag: '🇦🇪' },
};

type PhoneInputProps = {
  value: string;
  onChange: (fullPhone: string, phoneNumber: string, countryCode: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  error?: string;
  className?: string;
};

export default function PhoneInput({
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder = '10-digit number',
  error,
  className = '',
}: PhoneInputProps) {
  const { clinic } = useAuth();

  // Lock to clinic's country code
  const countryCode = clinic?.countryCode || 'US';
  const [phoneNumber, setPhoneNumber] = useState('');

  // Parse incoming value if it has a prefix
  useEffect(() => {
    if (value) {
      // Try to parse the value to extract the number part
      for (const [, data] of Object.entries(COUNTRY_PHONE_CODES)) {
        if (value.startsWith(data.prefix)) {
          setPhoneNumber(value.slice(data.prefix.length).replace(/\D/g, ''));
          return;
        }
      }
      // If no prefix found, just use the number part (digits only)
      setPhoneNumber(value.replace(/\D/g, '').slice(0, 10));
    } else {
      setPhoneNumber('');
    }
  }, []);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits, max 10 characters
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhoneNumber(digits);

    const prefix = COUNTRY_PHONE_CODES[countryCode]?.prefix || '+1';
    const fullPhone = digits ? `${prefix}${digits}` : '';
    onChange(fullPhone, digits, countryCode);
  };

  // Handle keydown to prevent non-numeric input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow: backspace, delete, tab, escape, enter, arrows
    if (
      e.key === 'Backspace' ||
      e.key === 'Delete' ||
      e.key === 'Tab' ||
      e.key === 'Escape' ||
      e.key === 'Enter' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' ||
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
      (e.ctrlKey && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) ||
      (e.metaKey && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase()))
    ) {
      return;
    }
    // Block if not a number
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const currentCountry = COUNTRY_PHONE_CODES[countryCode] || COUNTRY_PHONE_CODES.US;

  return (
    <div className={className}>
      <div className="flex">
        {/* Country code - locked display */}
        <div className="flex items-center px-3 bg-gray-100 border border-r-0 border-gray-300 rounded-l-md text-sm text-gray-700">
          <span className="mr-1">{currentCountry.flag}</span>
          <span className="font-medium">{currentCountry.prefix}</span>
        </div>

        {/* Phone number input - numbers only */}
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={phoneNumber}
          onChange={handlePhoneChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          maxLength={10}
          className={`input-field rounded-l-none flex-1 ${
            error || (required && phoneNumber && phoneNumber.length !== 10)
              ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
              : ''
          }`}
        />
      </div>

      {/* Validation message */}
      {phoneNumber && phoneNumber.length !== 10 && (
        <p className="mt-1 text-xs text-amber-600">
          Phone number must be 10 digits ({phoneNumber.length}/10)
        </p>
      )}

      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

// Helper to format phone for display
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return '';

  // Find the prefix and format
  for (const [, data] of Object.entries(COUNTRY_PHONE_CODES)) {
    if (phone.startsWith(data.prefix)) {
      const number = phone.slice(data.prefix.length);
      if (number.length === 10) {
        return `${data.prefix} (${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`;
      }
      return `${data.prefix} ${number}`;
    }
  }

  // Fallback: just format as US number if 10 digits
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return phone;
}

// Validation helper
export function isValidPhone(phone: string): boolean {
  if (!phone) return false;

  // Check if has a valid prefix
  for (const [, data] of Object.entries(COUNTRY_PHONE_CODES)) {
    if (phone.startsWith(data.prefix)) {
      const number = phone.slice(data.prefix.length);
      return /^\d{10}$/.test(number);
    }
  }

  // Check if just 10 digits
  return /^\d{10}$/.test(phone.replace(/\D/g, ''));
}

// Email validation helper
export function isValidEmail(email: string): boolean {
  if (!email) return false;
  // Standard email regex pattern
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}
