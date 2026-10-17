import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

interface LogoProps {
    className?: string;
    alt?: string;
    isDark?: boolean;
    style?: React.CSSProperties;
}

const lightLogoSrc = '/assets/logo-cropped-day.png';
const darkLogoSrc = '/assets/logo-cropped-night.png';

const Logo: React.FC<LogoProps> = ({
    className = '',
    alt = 'SNAB hireX',
    isDark: explicitIsDark,
    style
}) => {
    let contextIsDark: boolean | undefined = undefined;
    try {
        const themeCtx = useTheme();
        contextIsDark = themeCtx?.isDark;
    } catch {
        // Outside ThemeProvider fallback
    }

    const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
        if (typeof explicitIsDark === 'boolean') return explicitIsDark;
        if (typeof contextIsDark === 'boolean') return contextIsDark;
        if (typeof document !== 'undefined') {
            return document.documentElement.classList.contains('dark');
        }
        return false;
    });

    useEffect(() => {
        if (typeof explicitIsDark === 'boolean') {
            setIsDarkMode(explicitIsDark);
            return;
        }
        if (typeof contextIsDark === 'boolean') {
            setIsDarkMode(contextIsDark);
            return;
        }

        const checkDark = () => {
            if (typeof document !== 'undefined') {
                setIsDarkMode(document.documentElement.classList.contains('dark'));
            }
        };
        checkDark();

        if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
            const observer = new MutationObserver(checkDark);
            observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
            return () => observer.disconnect();
        }
    }, [explicitIsDark, contextIsDark]);

    const currentSrc = isDarkMode ? darkLogoSrc : lightLogoSrc;

    return (
        <img
            key={isDarkMode ? 'dark-logo' : 'light-logo'}
            src={currentSrc}
            alt={alt}
            style={style}
            className={`object-contain max-h-10 sm:max-h-11 w-auto ${className}`}
            onError={(e) => {
                const target = e.currentTarget;
                if (target.src.includes('/assets/')) {
                    target.src = isDarkMode ? '/logo-cropped-day.png' : '/logo-cropped-night.png';
                }
            }}
        />
    );
};

export default Logo;
