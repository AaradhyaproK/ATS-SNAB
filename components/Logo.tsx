import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

interface LogoProps {
    className?: string;
    alt?: string;
    isDark?: boolean;
}

const lightLogoSrc = '/assets/logo-cropped-night.png';
const darkLogoSrc = '/assets/logo-cropped-day.png';

const Logo: React.FC<LogoProps> = ({
    className = '',
    alt = 'SNAB hireX',
    isDark: explicitIsDark
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
            className={`object-contain ${className}`}
            onError={(e) => {
                const target = e.currentTarget;
                if (target.src.includes('/assets/')) {
                    target.src = isDarkMode ? '/logo-cropped-night.png' : '/logo-cropped-day.png';
                }
            }}
        />
    );
};

export default Logo;
