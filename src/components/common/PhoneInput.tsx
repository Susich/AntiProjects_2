import React, { useRef, useState } from 'react';
import { Platform, TextInput, TextInputProps } from 'react-native';
import { Input } from './Input';

interface PhoneInputProps {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string;
  helperText?: string;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  autoFocus?: boolean;
  editable?: boolean;
}

/**
 * Extracts the 10-digit national part of a Russian phone number.
 * Accepts both 9991234567 and 79991234567 / 89991234567.
 */
function toNationalDigits(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length > 10 && (digits[0] === '7' || digits[0] === '8')) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

/**
 * Formats a complete 10-digit national number as (XXX) XXX-XX-XX.
 * Partial numbers stay as plain digits so no separators get in the way.
 */
function formatNational(digits: string): string {
  if (digits.length !== 10) return digits;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8, 10)}`;
}

/**
 * Phone input with a fixed +7 prefix.
 *
 * While the field is focused the editable part is just the 10 national digits,
 * so every backspace removes exactly one digit and there are no mask separators
 * to get stuck on. On blur a complete number is shown with the familiar mask.
 * The +7 prefix is never part of the editable text.
 */
export const PhoneInput: React.FC<PhoneInputProps> = ({
  label = 'Номер телефона',
  value,
  onChangeText,
  placeholder = '(___) ___-__-__',
  error,
  helperText,
  returnKeyType,
  onSubmitEditing,
  autoFocus,
  editable = true,
}) => {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<React.ElementRef<typeof TextInput>>(null);

  const national = toNationalDigits(value);
  const displayValue =
    focused || national.length !== 10 ? national : formatNational(national);

  /**
   * React may skip a re-render when sanitizing the text produces the same
   * value as before (for example, when the user tries to type an 11th digit).
   * In that case the native field would keep the rejected character, so put
   * the sanitized text back explicitly.
   */
  const syncNativeText = (text: string) => {
    const input = inputRef.current;
    if (!input) return;

    if (Platform.OS === 'web') {
      const node = input as unknown as HTMLInputElement;
      if (node && typeof node.value === 'string') {
        node.value = text;
        try {
          node.setSelectionRange(text.length, text.length);
        } catch {
          // Some input types do not support selection ranges.
        }
      }
      return;
    }

    input.setNativeProps({ text });
  };

  const handleChangeText = (text: string) => {
    const raw = text.replace(/\D/g, '');

    // The +7 is already visible, so a country/local prefix typed at the start
    // of an empty field is redundant. Ignoring it avoids the number suddenly
    // jumping when the user enters all 11 digits.
    if (raw.length === 1 && (raw === '7' || raw === '8')) {
      syncNativeText('');
      onChangeText('');
      return;
    }

    const next = toNationalDigits(text);
    if (next !== text) {
      syncNativeText(next);
    }
    onChangeText(next);
  };

  return (
    <Input
      inputRef={inputRef}
      label={label}
      placeholder={placeholder}
      leftIcon="call-outline"
      prefix="+7"
      value={displayValue}
      onChangeText={handleChangeText}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      keyboardType="phone-pad"
      autoComplete="tel"
      textContentType="telephoneNumber"
      returnKeyType={returnKeyType}
      onSubmitEditing={onSubmitEditing}
      autoFocus={autoFocus}
      editable={editable}
      maxLength={18}
      error={error}
      helperText={helperText}
    />
  );
};
