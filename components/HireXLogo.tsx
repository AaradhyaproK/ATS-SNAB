import React from 'react';
import { Link } from 'react-router-dom';

interface HireXLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'badge';
  withLink?: boolean;
  to?: string;
  isDark?: boolean;
}

export const HireXMark: React.FC<{ size?: number; className?: string; isDark?: boolean }> = ({
  size = 36,
  className = '',
  isDark = false,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform duration-200 hover:scale-105 ${className}`}
    >
      {/* Lime Squircle Background */}
      <rect width="100" height="100" rx="24" fill="#D4F82C" />

      {/* Modern Bold 'hx' Monogram with Growth Arrow */}
      {/* Letter 'h' */}
      <path
        d="M20 25H32V45.5C34.2 40.5 38.8 38 45 38C52 38 56 42.5 56 50.5V75H44V52.5C44 48.5 42 46.5 38.5 46.5C34.5 46.5 32 49 32 54.5V75H20V25Z"
        fill="#111215"
      />

      {/* Diagonal Backslash of 'X' */}
      <path
        d="M48 39H60L74 61V75L56 48L48 39Z"
        fill="#111215"
      />

      {/* Upward Growth Arrow of 'X' */}
      <path
        d="M50 75L68 47V52L72 45L65 49H70L54 75H50Z"
        fill="#111215"
      />
      {/* Arrowhead */}
      <polygon
        points="65,22 83,22 83,40 76,33 58,60 52,54 70,27"
        fill="#111215"
      />
    </svg>
  );
};

export const HireXLogo: React.FC<HireXLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'full',
  withLink = false,
  to = '/',
  isDark = false,
}) => {
  const sizeMap = {
    sm: { icon: 26, text: 'text-base', arrow: 'text-xs' },
    md: { icon: 34, text: 'text-xl', arrow: 'text-sm' },
    lg: { icon: 44, text: 'text-2xl', arrow: 'text-base' },
    xl: { icon: 56, text: 'text-4xl', arrow: 'text-2xl' },
  };

  const currentSize = sizeMap[size];

  const content = (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Brand Icon Badge */}
      <HireXMark size={currentSize.icon} isDark={isDark} />

      {/* Brand Typographic Wordmark */}
      {variant === 'full' && (
        <span
          className={`font-black tracking-tight ${currentSize.text} ${
            isDark ? 'text-white' : 'text-[#111215]'
          }`}
        >
          hireX
          <span className="text-[#8FB305] ml-0.5 inline-block transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
            ↗
          </span>
        </span>
      )}
    </div>
  );

  if (withLink) {
    return (
      <Link to={to} className="group inline-flex items-center">
        {content}
      </Link>
    );
  }

  return content;
};

export default HireXLogo;
