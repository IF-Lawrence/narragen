import { useEffect, useState } from 'react';

const responsiveMap = {
    xs: '(max-width: 575px)',
    sm: '(min-width: 576px)',
    md: '(min-width: 768px)',
    lg: '(min-width: 992px)',
    xl: '(min-width: 1200px)',
    xxl: '(min-width: 1600px)',
};

export const useBreakpoint = () => {
    const [screens, setScreens] = useState({});

    useEffect(() => {
        const token = {};
        const handlers = {};

        Object.keys(responsiveMap).forEach((screen) => {
            const mediaQuery = window.matchMedia(responsiveMap[screen]);

            const handler = (e) => {
                setScreens((prev) => {
                    if (e.matches) {
                        return { ...prev, [screen]: true };
                    } else {
                        const next = { ...prev };
                        delete next[screen];
                        return next;
                    }
                });
            };

            handlers[screen] = { mediaQuery, handler };

            // Initial check
            if (mediaQuery.matches) {
                token[screen] = true;
            }

            mediaQuery.addEventListener('change', handler);
        });

        setScreens(token);

        return () => {
            Object.keys(handlers).forEach((screen) => {
                const { mediaQuery, handler } = handlers[screen];
                mediaQuery.removeEventListener('change', handler);
            });
        };
    }, []);

    return screens;
};
