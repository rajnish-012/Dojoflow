"use client";

import { useEffect, useRef, useState } from "react";
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

type InternationalPhoneInputProps = {
  id?: string;
  value: string;
  onChange: (e164Value: string) => void;
  onBlur?: () => void;
  error?: string;
  required?: boolean;
};

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const countries = getCountries()
  .map((country) => ({
    code: country,
    name: regionNames.of(country) || country,
    callingCode: getCountryCallingCode(country),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

function getE164Candidate(value: string, country: CountryCode) {
  if (!value.trim()) return "";
  const parsed = parsePhoneNumberFromString(value, country);
  if (parsed) return parsed.number;

  const digits = value.replace(/\D/g, "").replace(/^0+/, "");
  return digits ? `+${getCountryCallingCode(country)}${digits}` : "";
}

export default function InternationalPhoneInput({
  id = "phone",
  value,
  onChange,
  onBlur,
  error,
  required = false,
}: InternationalPhoneInputProps) {
  const initialParsed = parsePhoneNumberFromString(value) || parsePhoneNumberFromString(value, "IN");
  const [country, setCountry] = useState<CountryCode>(initialParsed?.country || "IN");
  const [nationalNumber, setNationalNumber] = useState(initialParsed?.formatNational() || value);
  const lastEmittedValue = useRef(value);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (value === lastEmittedValue.current) return;
    lastEmittedValue.current = value;

    if (!value) {
      // This effect mirrors the controlled E.164 prop into the local input display.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNationalNumber("");
      return;
    }

    const parsed = parsePhoneNumberFromString(value) || parsePhoneNumberFromString(value, "IN");
    if (parsed) {
      setCountry(parsed.country || "IN");
      setNationalNumber(parsed.formatNational());
    }
  }, [value]);

  function handleNumberChange(nextValue: string) {
    const formatted = new AsYouType(country).input(nextValue);
    setNationalNumber(formatted);

    const parsed = parsePhoneNumberFromString(nextValue, country);
    if (parsed?.country && nextValue.trim().startsWith("+")) {
      setCountry(parsed.country);
      setNationalNumber(parsed.formatNational());
    }

    const e164Value = getE164Candidate(nextValue, country);
    lastEmittedValue.current = e164Value;
    onChange(e164Value);
  }

  function handleCountryChange(nextCountry: CountryCode) {
    setCountry(nextCountry);
    const e164Value = getE164Candidate(nationalNumber, nextCountry);
    lastEmittedValue.current = e164Value;
    onChange(e164Value);
  }

  const invalidPhone =
    touched && Boolean(nationalNumber) && !isValidPhoneNumber(value, country);

  return (
    <div>
      <div
        className={`flex min-w-0 overflow-hidden rounded-xl border bg-(--input-bg) transition focus-within:ring-4 focus-within:ring-(--gold)/10 ${
          error || invalidPhone
            ? "border-(--danger) focus-within:border-(--danger)"
            : "border-(--line) focus-within:border-(--gold)"
        }`}
      >
        <label className="sr-only" htmlFor={`${id}-country`}>
          Country calling code
        </label>
        <select
          id={`${id}-country`}
          aria-label="Country calling code"
          value={country}
          onChange={(event) => handleCountryChange(event.target.value as CountryCode)}
          className="max-w-[48%] border-r border-(--line) bg-transparent px-3 py-3.5 text-sm text-(--foreground) outline-none sm:max-w-[42%]"
        >
          {countries.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name} (+{item.callingCode})
            </option>
          ))}
        </select>
        <input
          id={id}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required={required}
          value={nationalNumber}
          onChange={(event) => handleNumberChange(event.target.value)}
          onBlur={() => {
            setTouched(true);
            onBlur?.();
          }}
          placeholder="Phone number"
          aria-invalid={Boolean(error || invalidPhone)}
          aria-describedby={error || invalidPhone ? `${id}-error` : undefined}
          className="min-w-0 flex-1 bg-transparent px-3 py-3.5 text-sm text-(--foreground) outline-none placeholder:text-(--ink-faint)"
        />
      </div>
      {(error || invalidPhone) && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-(--danger)" role="alert">
          {error || "Enter a valid phone number for the selected country."}
        </p>
      )}
      <p className="mt-1.5 text-xs text-(--ink-faint)">
        Saved with country code in international format.
      </p>
    </div>
  );
}

export { isValidPhoneNumber };
