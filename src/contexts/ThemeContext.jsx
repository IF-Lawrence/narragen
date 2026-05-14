import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { createTheme, alpha } from '@mui/material/styles';
import { DEFAULT_PRIMARY, DEFAULT_PRIMARY_DARK } from '../services/dynamicColor';

const ThemeContext = createContext(null);

// 精简后的核心语义色 (背景和文字保持固定)
const lightFixedColors = {
    background: {
        default: '#F9F8F4', // Nobel Cream (页面背景)
        paper: '#FFFFFF',   // 卡片/容器背景
    },
    text: {
        primary: '#1C1917', // Stone-900 (主要文字)
        secondary: '#57534E', // Stone-600 (次要文字)
    },
    divider: '#E7E5E4', // Stone-200 (边框/分割线)
};

const darkFixedColors = {
    background: {
        default: '#0F0F0F', // 近黑色
        paper: '#1C1917',   // Stone-900
    },
    text: {
        primary: '#F5F5F4', // Stone-100
        secondary: '#A8A29E', // Stone-400
    },
    divider: '#44403C', // Stone-700
};

/**
 * 根据主色生成深色版本（用于 hover 等状态）
 */
const darkenColor = (hex, amount = 20) => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0x00FF) - amount);
    const b = Math.max(0, (num & 0x0000FF) - amount);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
};

/**
 * 根据主色生成浅色版本（用于深色模式）
 */
const lightenColor = (hex, amount = 40) => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0x00FF) + amount);
    const b = Math.min(255, (num & 0x0000FF) + amount);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
};

/**
 * 计算颜色的相对亮度 (WCAG 2.1 标准)
 * @see https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
const getRelativeLuminance = (hex) => {
    if (!hex) return 0;
    const num = parseInt(hex.replace('#', ''), 16);
    const r = (num >> 16) & 0xFF;
    const g = (num >> 8) & 0xFF;
    const b = num & 0xFF;

    const [rs, gs, bs] = [r, g, b].map(c => {
        const sRGB = c / 255;
        return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

/**
 * 计算两个颜色之间的对比度 (WCAG 2.1)
 * @returns 对比度比值，范围 1:1 到 21:1
 */
const getContrastRatio = (hex1, hex2) => {
    const lum1 = getRelativeLuminance(hex1);
    const lum2 = getRelativeLuminance(hex2);
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    return (lighter + 0.05) / (darker + 0.05);
};

/**
 * 确保前景色与背景色有足够对比度
 * 如果对比度不足，递归加深前景色直到满足要求
 * @param {string} foreground - 前景色 hex
 * @param {string} background - 背景色 hex
 * @param {number} minRatio - 最低对比度要求，默认 3.5 (WCAG AA 大文本)
 * @param {number} maxIterations - 最大迭代次数，防止无限循环
 */
const ensureContrastOnBackground = (foreground, background, minRatio = 3.5, maxIterations = 20) => {
    let color = foreground;
    let iterations = 0;

    while (getContrastRatio(color, background) < minRatio && iterations < maxIterations) {
        color = darkenColor(color, 15);
        iterations++;
    }

    return color;
};

/**
 * 根据背景色亮度返回合适的对比文字颜色
 */
const getContrastText = (hex) => {
    if (!hex) return '#1C1917';
    const num = parseInt(hex.replace('#', ''), 16);
    const r = (num >> 16) & 0xFF;
    const g = (num >> 8) & 0xFF;
    const b = num & 0xFF;
    // 使用 WCAG 亮度公式
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    // 亮度高于 150 使用深色文字，否则使用白色
    return brightness > 150 ? '#1C1917' : '#FFFFFF';
};

/**
 * 创建主题
 * @param {string} mode - 'light' 或 'dark'
 * @param {string|null} dynamicPrimary - 动态主色（可选）
 */
const createAppTheme = (mode, dynamicPrimary = null) => {
    const fixedColors = mode === 'dark' ? darkFixedColors : lightFixedColors;

    // 计算 primary 色
    let primaryMain, primaryDark;
    if (dynamicPrimary) {
        if (mode === 'dark') {
            // 深色模式下使用更亮的版本
            primaryMain = lightenColor(dynamicPrimary, 30);
            primaryDark = dynamicPrimary;
        } else {
            // 亮模式下：确保主色与浅色背景有足够对比度
            primaryMain = ensureContrastOnBackground(
                dynamicPrimary,
                lightFixedColors.background.default,
                3.5 // WCAG AA 大文本标准
            );
            primaryDark = darkenColor(primaryMain, 25);
        }
    } else {
        // 默认 Nobel Gold
        primaryMain = mode === 'dark' ? DEFAULT_PRIMARY_DARK : DEFAULT_PRIMARY;
        primaryDark = mode === 'dark' ? DEFAULT_PRIMARY : darkenColor(DEFAULT_PRIMARY, 25);
    }

    const primary = {
        main: primaryMain,
        dark: primaryDark,
        contrastText: getContrastText(primaryMain),
    };

    return createTheme({
        cssVariables: true,
        palette: {
            mode,
            primary,
            text: fixedColors.text,
            background: {
                default: fixedColors.background.default,
                paper: fixedColors.background.paper,
            },
            divider: fixedColors.divider,
        },
        typography: {
            fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
            h1: { fontFamily: '"ZhuqueFangsong", serif', fontWeight: 600, color: fixedColors.text.primary },
            h2: { fontFamily: '"ZhuqueFangsong", serif', fontWeight: 600, color: fixedColors.text.primary },
            h3: { fontFamily: '"ZhuqueFangsong", serif', fontWeight: 600, color: fixedColors.text.primary },
            h4: { fontFamily: '"ZhuqueFangsong", serif', fontWeight: 500, color: fixedColors.text.primary },
            h5: { fontFamily: '"ZhuqueFangsong", serif', fontWeight: 500, color: fixedColors.text.primary },
            h6: { fontFamily: '"ZhuqueFangsong", serif', fontWeight: 500, color: fixedColors.text.primary },
            subtitle1: { fontWeight: 500 },
            subtitle2: { fontWeight: 600 },
            body1: { lineHeight: 1.7 },
            body2: { lineHeight: 1.6 },
            button: { textTransform: 'none', fontWeight: 600 },
        },
        shape: {
            borderRadius: 8,
        },
        components: {
            // --- Buttons ---
            MuiButton: {
                styleOverrides: {
                    root: {
                        borderRadius: 8,
                        padding: '8px 20px',
                        boxShadow: 'none',
                        fontWeight: 600,
                        '&:hover': {
                            boxShadow: 'none',
                            backgroundColor: alpha(primary.main, 0.08),
                        },
                    },
                    contained: {
                        borderRadius: 999,
                        backgroundColor: primary.main,
                        color: primary.contrastText,
                        '&:hover': {
                            backgroundColor: primary.dark,
                            boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
                        },
                    },
                    outlined: {
                        borderColor: fixedColors.divider,
                        color: primary.main,
                        '&:hover': {
                            borderColor: primary.main,
                            backgroundColor: alpha(primary.main, 0.04),
                        }
                    }
                },
            },

            // --- Cards ---
            MuiCard: {
                styleOverrides: {
                    root: {
                        borderRadius: 8,
                        boxShadow: mode === 'dark' ? '0px 1px 3px rgba(0,0,0,0.3)' : '0px 1px 3px rgba(0,0,0,0.05)',
                        backgroundColor: fixedColors.background.paper,
                        border: `1px solid ${fixedColors.divider}`,
                        transition: 'all 0.2s ease-in-out',
                    },
                },
                defaultProps: {
                    elevation: 0,
                }
            },

            // --- Text Fields ---
            MuiTextField: {
                defaultProps: {
                    variant: 'outlined',
                },
                styleOverrides: {
                    root: {
                        '& .MuiFilledInput-root': {
                            backgroundColor: 'transparent',
                            '&:hover': { backgroundColor: 'transparent' },
                            '&.Mui-focused': { backgroundColor: 'transparent' },
                        }
                    }
                }
            },
            MuiOutlinedInput: {
                styleOverrides: {
                    root: {
                        borderRadius: 6,
                        backgroundColor: 'transparent',
                        '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: fixedColors.divider,
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: fixedColors.text.secondary,
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderColor: primary.main,
                            borderWidth: '2px',
                        },
                    }
                }
            },
            MuiInputLabel: {
                styleOverrides: {
                    root: {
                        color: fixedColors.text.secondary,
                        '&.Mui-focused': {
                            color: primary.main,
                        }
                    }
                }
            },

            // --- Drawer ---
            MuiDrawer: {
                styleOverrides: {
                    paper: {
                        borderRight: `1px solid ${fixedColors.divider}`,
                        backgroundColor: fixedColors.background.paper,
                    },
                },
            },

            // --- Lists ---
            MuiListItemButton: {
                styleOverrides: {
                    root: {
                        borderRadius: 8,
                        margin: '2px 8px',
                        '&.Mui-selected': {
                            backgroundColor: alpha(primary.main, 0.1),
                            color: fixedColors.text.primary,
                            fontWeight: 600,
                            '&:hover': {
                                backgroundColor: alpha(primary.main, 0.15),
                            },
                            '& .MuiListItemIcon-root': {
                                color: primary.main,
                            }
                        },
                    },
                },
            },

            // --- Dialogs ---
            MuiDialog: {
                styleOverrides: {
                    paper: {
                        borderRadius: 12,
                        backgroundColor: fixedColors.background.paper,
                        boxShadow: mode === 'dark' ? '0px 8px 32px rgba(0,0,0,0.4)' : '0px 8px 32px rgba(0,0,0,0.08)',
                    }
                }
            },
        },
    });
};

export const ThemeProvider = ({ children }) => {
    const [mode, setMode] = useState(() => {
        return localStorage.getItem('theme-mode') || 'light';
    });

    // 动态主色（从项目封面提取）
    const [dynamicPrimary, setDynamicPrimary] = useState(null);

    // 根据 mode 和 dynamicPrimary 创建主题
    const theme = useMemo(
        () => createAppTheme(mode, dynamicPrimary),
        [mode, dynamicPrimary]
    );

    useEffect(() => {
        // Save to localStorage
        localStorage.setItem('theme-mode', mode);

        // Also update document body for any CSS that relies on it
        if (mode === 'dark') {
            document.body.setAttribute('data-theme', 'dark');
            document.body.setAttribute('arco-theme', 'dark');
        } else {
            document.body.removeAttribute('data-theme');
            document.body.removeAttribute('arco-theme');
        }
    }, [mode]);

    const toggleTheme = () => {
        setMode((prevMode) => (prevMode === 'dark' ? 'light' : 'dark'));
    };

    /**
     * 重置为默认主色
     */
    const resetDynamicPrimary = () => {
        setDynamicPrimary(null);
    };

    const value = {
        mode,
        setMode,
        toggleTheme,
        theme,
        // 动态主色相关
        dynamicPrimary,
        setDynamicPrimary,
        resetDynamicPrimary,
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useThemeMode = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useThemeMode must be used within a ThemeProvider');
    }
    return context;
};

export default ThemeContext;

