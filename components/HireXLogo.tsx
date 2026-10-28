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
    <img
      src="/logo-theme-lime-squircle.png"
      alt="InterviewXpert"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`shrink-0 object-contain rounded-xl transition-transform duration-200 hover:scale-105 select-none ${className}`}
    />
  );
};

export const HireXLogo: React.FC<HireXLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'full',
  withLink = false,
  to = '/',
  isDark,
}) => {
  const sizeMap = {
    sm: { icon: 26, text: 'text-base' },
    md: { icon: 34, text: 'text-xl' },
    lg: { icon: 44, text: 'text-2xl' },
    xl: { icon: 56, text: 'text-4xl' },
  };

  const currentSize = sizeMap[size];

  // High-contrast, beautifully legible color tokens for "InterviewXpert" wordmark
  const getWordmarkClasses = () => {
    if (isDark === true) {
      return {
        brandPrefix: '!text-white',
        brandSuffix: '!text-[#D4F82C]',
      };
    }
    if (isDark === false) {
      return {
        brandPrefix: '!text-[#111215]',
        brandSuffix: '!text-[#8FB305]',
      };
    }
    // Adaptive mode when isDark is not explicitly passed
    return {
      brandPrefix: 'text-[#111215] dark:text-white',
      brandSuffix: 'text-[#8FB305] dark:text-[#D4F82C]',
    };
  };

  const { brandPrefix, brandSuffix } = getWordmarkClasses();

  const content = (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Brand Icon Badge */}
      <HireXMark size={currentSize.icon} isDark={isDark} />

      {/* Brand Typographic Wordmark */}
      {variant === 'full' && (
        <span className={`font-black tracking-tight ${currentSize.text} ${brandPrefix}`}>
          Interview<span className={brandSuffix}>Xpert</span>
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
