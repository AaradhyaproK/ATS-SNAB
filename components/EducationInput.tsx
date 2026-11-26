import React, { useState } from 'react';
import {
  EDUCATION_QUALIFICATIONS,
  EducationQualification
} from '../data/allEducationDegrees';

export interface EducationInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  selectClassName?: string;
  showCustomOption?: boolean;
}

export const EducationInput: React.FC<EducationInputProps> = ({
  value,
  onChange,
  placeholder = "-- Select Education Qualification --",
  className = "",
  selectClassName,
  showCustomOption = true
}) => {
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [customText, setCustomText] = useState<string>('');

  // Check if current value matches one of the standard qualifications
  const isStandardQual = EDUCATION_QUALIFICATIONS.some(
    q => q.toLowerCase() === (value || '').trim().toLowerCase()
  );

  const defaultSelectClass = "h-9 w-full rounded-[6px] border border-gray-300 dark:border-white/[0.14] bg-white dark:bg-[#050505] px-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-black dark:focus:border-blue-400 font-medium transition-colors cursor-pointer shadow-xs";
  const selectStyle = selectClassName || className || defaultSelectClass;

  const handleSelectChange = (val: string) => {
    if (val === '__custom__') {
      setIsCustomMode(true);
      setCustomText(value || '');
      return;
    }
    setIsCustomMode(false);
    onChange(val);
  };

  const handleCustomSubmit = () => {
    if (customText.trim()) {
      onChange(customText.trim());
    }
  };

  if (isCustomMode) {
    return (
      <div className="w-full flex items-center gap-1.5">
        <input
          type="text"
          value={customText}
          onChange={(e) => {
            setCustomText(e.target.value);
            onChange(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleCustomSubmit();
            }
          }}
          placeholder={placeholder || "Type qualification (e.g. B.Tech, Graduate, Diploma)..."}
          className={selectStyle}
          autoFocus
        />
        <button
          type="button"
          onClick={() => {
            setIsCustomMode(false);
          }}
          className="h-9 px-2.5 rounded-[6px] border border-gray-300 dark:border-white/10 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 text-xs font-semibold shrink-0 cursor-pointer transition-colors"
          title="Back to dropdown options"
        >
          Options
        </button>
      </div>
    );
  }

  return (
    <div className="w-full relative">
      <select
        value={value || ''}
        onChange={(e) => handleSelectChange(e.target.value)}
        className={selectStyle}
      >
        <option value="" className="bg-white dark:bg-[#111111] text-gray-400">
          {placeholder}
        </option>

        {/* If the current value is a custom or existing specific qualification not in standard list, display it */}
        {value && !isStandardQual && (
          <option
            value={value}
            className="bg-white dark:bg-[#111111] text-emerald-600 dark:text-emerald-400 font-semibold"
          >
            ✓ {value}
          </option>
        )}

        {EDUCATION_QUALIFICATIONS.map((qual) => (
          <option
            key={qual}
            value={qual}
            className="bg-white dark:bg-[#111111] text-slate-900 dark:text-white font-medium"
          >
            {qual}
          </option>
        ))}

        {showCustomOption && (
          <option
            value="__custom__"
            className="bg-white dark:bg-[#111111] text-blue-600 dark:text-blue-400 font-semibold"
          >
            ✏️ Other / Type Custom Qualification...
          </option>
        )}
      </select>
    </div>
  );
};
