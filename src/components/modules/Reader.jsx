import React, { useState, useEffect, useRef } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { storage } from '../../services/storage';
import {
    Box, Drawer, List, ListItem, ListItemText, ListItemButton,
    Typography, IconButton, Paper, Stack, Slider,
    FormControl, Select, MenuItem, ToggleButton, ToggleButtonGroup,
    CircularProgress, Collapse, Divider, Tooltip, alpha
} from '@mui/material';
import {
    MenuRounded as IconMenu,
    SettingsRounded as IconSettings,
    ChevronLeftRounded as IconChevronLeft,
    ChevronRightRounded as IconChevronRight,
    ExpandMoreRounded as IconExpandMore,
    ExpandLessRounded as IconExpandLess,
    FormatSizeRounded as IconFormatSize,
    DarkModeRounded as IconDarkMode,
    LightModeRounded as IconLightMode,
    AutoStoriesRounded as IconBook
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

export const Reader = ({ onExit }) => {
    const { currentProject } = useProject();
    const theme = useTheme();

    // Data State
    const [volumes, setVolumes] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [groupedChapters, setGroupedChapters] = useState({});
    const [loading, setLoading] = useState(true);

    // View State
    const [currentChapterId, setCurrentChapterId] = useState(null);
    const [drawerOpen, setDrawerOpen] = useState(true);
    const [settingsOpen, setSettingsOpen] = useState(true);

    // Reader Settings - Load from localStorage
    const [settings, setSettings] = useState(() => {
        const saved = localStorage.getItem('reader_settings');
        const defaults = {
            fontSize: 18,
            lineHeight: 1.8,
            fontFamily: "'Merriweather', 'Georgia', serif",
            theme: 'light', // light, dark, warm
            maxWidth: 900
        };
        if (saved) {
            try {
                return { ...defaults, ...JSON.parse(saved) };
            } catch (e) {
                console.warn('Failed to parse reader settings', e);
                return defaults;
            }
        }
        return defaults;
    });

    // Save settings to localStorage
    useEffect(() => {
        localStorage.setItem('reader_settings', JSON.stringify(settings));
    }, [settings]);

    // Expand State for volumes
    const [expandedVolumes, setExpandedVolumes] = useState({});

    useEffect(() => {
        if (currentProject) {
            loadData();
        }
    }, [currentProject]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [vols, chaps] = await Promise.all([
                storage.getItemsByProject('volumes', currentProject.id),
                storage.getItemsByProject('chapter_nodes', currentProject.id)
            ]);

            // Sort volumes by order
            const sortedVols = vols.sort((a, b) => a.order - b.order);

            // Group chapters by volume
            const grouped = {};
            sortedVols.forEach(v => {
                grouped[v.id] = chaps.filter(c => c.volumeId === v.id).sort((a, b) => a.order - b.order);
            });

            // Handle chapters without volume
            const noVolChapters = chaps.filter(c => !c.volumeId).sort((a, b) => a.order - b.order);
            if (noVolChapters.length > 0) {
                grouped['uncategorized'] = noVolChapters;
            }

            // Create a flat sorted list of chapters for navigation
            const flatChapters = [];
            sortedVols.forEach(v => {
                const volChaps = grouped[v.id] || [];
                flatChapters.push(...volChaps);
            });
            flatChapters.push(...noVolChapters);

            setVolumes(sortedVols);
            setChapters(flatChapters); // Use the flat sorted list
            setGroupedChapters(grouped);

            // Initialize expanded state for all volumes
            const initialExpanded = {};
            sortedVols.forEach(v => initialExpanded[v.id] = true);
            initialExpanded['uncategorized'] = true;
            setExpandedVolumes(initialExpanded);

            // Auto-select first chapter if none selected
            if (!currentChapterId && chaps.length > 0) {
                // Find first available chapter
                for (const vol of sortedVols) {
                    if (grouped[vol.id]?.length > 0) {
                        setCurrentChapterId(grouped[vol.id][0].id);
                        break;
                    }
                }
            }

        } catch (error) {
            console.error("Failed to load reader data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleVolumeToggle = (volId) => {
        setExpandedVolumes(prev => ({
            ...prev,
            [volId]: !prev[volId]
        }));
    };

    const getCurrentChapter = () => {
        return chapters.find(c => c.id === currentChapterId);
    };

    const handleNextChapter = () => {
        const currentIndex = chapters.findIndex(c => c.id === currentChapterId);
        if (currentIndex < chapters.length - 1) {
            setCurrentChapterId(chapters[currentIndex + 1].id);
            window.scrollTo(0, 0);
        }
    };

    const handlePrevChapter = () => {
        const currentIndex = chapters.findIndex(c => c.id === currentChapterId);
        if (currentIndex > 0) {
            setCurrentChapterId(chapters[currentIndex - 1].id);
            window.scrollTo(0, 0);
        }
    };

    // Sync with global theme
    const prevSystemThemeRef = useRef(theme.palette.mode);
    useEffect(() => {
        if (prevSystemThemeRef.current !== theme.palette.mode) {
            prevSystemThemeRef.current = theme.palette.mode;
            setSettings(prev => ({
                ...prev,
                theme: theme.palette.mode === 'dark' ? 'dark' : 'light'
            }));
        }
    }, [theme.palette.mode]);

    const getThemeStyles = () => {
        switch (settings.theme) {
            case 'dark':
                return {
                    bgcolor: '#0F0F0F', // Matches ThemeContext darkFixedColors.background.default
                    color: '#F5F5F4',   // Matches ThemeContext darkFixedColors.text.primary
                    paperBg: '#1C1917', // Matches ThemeContext darkFixedColors.background.paper
                    settingsBg: 'rgba(255, 255, 255, 0.05)'
                };
            case 'warm':
                return { bgcolor: '#f5f1e8', color: '#5f4b32', paperBg: '#fff9f0', settingsBg: 'rgba(95, 75, 50, 0.08)' };
            default:
                return { bgcolor: '#f5f5f5', color: '#2c3e50', paperBg: '#ffffff', settingsBg: 'rgba(0, 0, 0, 0.04)' };
        }
    };

    const themeStyles = getThemeStyles();
    const currentChapter = getCurrentChapter();
    const contentRef = React.useRef(null);

    useEffect(() => {
        if (contentRef.current) {
            contentRef.current.scrollTop = 0;
        }
    }, [currentChapterId]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{
            display: 'flex',
            height: '100vh',
            overflow: 'hidden',
            bgcolor: themeStyles.bgcolor,
            color: themeStyles.color,
            transition: 'background-color 0.3s, color 0.3s'
        }}>
            {/* Sidebar Toggle Button (only show when collapsed) */}
            {!drawerOpen && (
                <IconButton
                    onClick={() => setDrawerOpen(true)}
                    sx={{
                        position: 'fixed',
                        top: 16,
                        left: 80,
                        zIndex: 1200,
                        bgcolor: themeStyles.paperBg,
                        color: themeStyles.color,
                        border: '1px solid',
                        borderColor: 'divider',
                        '&:hover': {
                            bgcolor: themeStyles.paperBg,
                            opacity: 0.9
                        }
                    }}
                >
                    <IconChevronRight />
                </IconButton>
            )}

            {/* Left Sidebar: Chapter Navigation */}
            <Box
                sx={{
                    width: drawerOpen ? 260 : 0,
                    flexShrink: 0,
                    transition: 'width 0.3s ease',
                    borderRight: '1px solid',
                    borderColor: 'divider',
                    bgcolor: themeStyles.paperBg,
                    color: themeStyles.color,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    {/* Sidebar Header with Toggle Button */}
                    <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: alpha(themeStyles.color, 0.1) }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="start">
                            <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                    <IconBook sx={{ mr: 1.5, color: 'primary.main' }} />
                                    <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: 'inherit', color: 'inherit' }}>阅读</Typography>
                                </Box>
                                <Typography variant="caption" sx={{ color: alpha(themeStyles.color, 0.7) }}>
                                    沉浸式阅读与章节管理
                                </Typography>
                            </Box>
                            <IconButton size="small" onClick={() => setDrawerOpen(false)} sx={{ color: 'inherit', mt: 0.5 }}>
                                <IconMenu />
                            </IconButton>
                        </Stack>
                    </Box>

                    <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
                        <List>
                            {volumes.map(volume => {
                                const volumeChapters = groupedChapters[volume.id] || [];
                                if (volumeChapters.length === 0) return null;

                                const open = expandedVolumes[volume.id];

                                return (
                                    <Box key={volume.id}>
                                        <ListItemButton onClick={() => handleVolumeToggle(volume.id)} sx={{ py: 1 }}>
                                            <Box component={open ? IconExpandMore : IconChevronRight} sx={{ mr: 1, fontSize: 18, color: 'inherit', opacity: 0.7 }} />
                                            <Typography fontWeight="bold" variant="subtitle2" noWrap color="inherit">
                                                {volume.title || `第 ${volume.order} 卷`}
                                            </Typography>
                                        </ListItemButton>
                                        <Collapse in={open} timeout="auto" unmountOnExit>
                                            <List component="div" disablePadding>
                                                {volumeChapters.map(chapter => (
                                                    <ListItemButton
                                                        key={chapter.id}
                                                        selected={currentChapterId === chapter.id}
                                                        onClick={() => {
                                                            setCurrentChapterId(chapter.id);
                                                            // Optional: Close drawer on mobile
                                                        }}
                                                        sx={{
                                                            pl: 4, py: 0.5, my: 0.5,
                                                            borderRadius: 2,
                                                            '&.Mui-selected': {
                                                                bgcolor: alpha(themeStyles.color, 0.12),
                                                                color: themeStyles.color,
                                                                '&:hover': {
                                                                    bgcolor: alpha(themeStyles.color, 0.18),
                                                                },
                                                                '& .MuiTypography-root': {
                                                                    color: themeStyles.color,
                                                                    fontWeight: 'bold'
                                                                }
                                                            },
                                                            '&:hover': {
                                                                bgcolor: alpha(themeStyles.color, 0.05),
                                                            }
                                                        }}
                                                    >
                                                        <ListItemText
                                                            primary={`第${chapter.order}章: ${chapter.title}`}
                                                            primaryTypographyProps={{
                                                                variant: 'body2',
                                                                noWrap: true,
                                                                color: 'inherit' // Inherits from button, or overridden by specific selector above
                                                            }}
                                                        />
                                                    </ListItemButton>
                                                ))}
                                            </List>
                                        </Collapse>
                                    </Box>
                                );
                            })}
                        </List>
                    </Box>

                    <Divider sx={{ mx: 2, opacity: 0.2, borderColor: 'inherit' }} />

                    {/* Integrated Settings Area (Replacing Tips) */}
                    <Box sx={{ p: 2, m: 2, mt: 2, bgcolor: themeStyles.settingsBg, borderRadius: 2 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1, cursor: 'pointer' }} onClick={() => setSettingsOpen(!settingsOpen)}>
                            <Typography variant="caption" fontWeight="bold" color="inherit" sx={{ opacity: 0.8 }}>阅读设置</Typography>
                            <IconButton size="small" sx={{ p: 0.5, color: 'inherit' }}>
                                {settingsOpen ? <IconExpandLess fontSize="small" /> : <IconExpandMore fontSize="small" />}
                            </IconButton>
                        </Stack>

                        <Collapse in={settingsOpen}>
                            <Stack spacing={2} sx={{ mt: 1 }}>
                                <Box>
                                    <Typography variant="caption" sx={{ mb: 0.5, display: 'block', opacity: 0.7, color: 'inherit' }}>字号</Typography>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Box sx={{ fontSize: 12, opacity: 0.7, fontWeight: 'bold', color: 'inherit' }}>小</Box>
                                        <Slider
                                            size="small"
                                            value={settings.fontSize}
                                            min={12}
                                            max={24}
                                            step={1}
                                            onChange={(e, v) => setSettings({ ...settings, fontSize: v })}
                                            sx={{
                                                flex: 1,
                                                color: themeStyles.color, // Use theme color for slider
                                                '& .MuiSlider-thumb': {
                                                    bgcolor: themeStyles.color,
                                                },
                                                '& .MuiSlider-track': {
                                                    bgcolor: themeStyles.color,
                                                },
                                                '& .MuiSlider-rail': {
                                                    opacity: 0.3,
                                                    bgcolor: themeStyles.color,
                                                }
                                            }}
                                        />
                                        <Box sx={{ fontSize: 12, opacity: 0.7, fontWeight: 'bold', color: 'inherit' }}>大</Box>
                                    </Stack>
                                </Box>

                                <Box>
                                    <Typography variant="caption" sx={{ mb: 0.5, display: 'block', opacity: 0.7, color: 'inherit' }}>行宽</Typography>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Box sx={{ fontSize: 12, opacity: 0.7, fontWeight: 'bold', color: 'inherit' }}>窄</Box>
                                        <Slider
                                            size="small"
                                            value={settings.maxWidth}
                                            min={600}
                                            max={1200}
                                            step={50}
                                            onChange={(e, v) => setSettings({ ...settings, maxWidth: v })}
                                            sx={{
                                                flex: 1,
                                                color: themeStyles.color,
                                                '& .MuiSlider-thumb': {
                                                    bgcolor: themeStyles.color,
                                                },
                                                '& .MuiSlider-track': {
                                                    bgcolor: themeStyles.color,
                                                },
                                                '& .MuiSlider-rail': {
                                                    opacity: 0.3,
                                                    bgcolor: themeStyles.color,
                                                }
                                            }}
                                        />
                                        <Box sx={{ fontSize: 12, opacity: 0.7, fontWeight: 'bold', color: 'inherit' }}>宽</Box>
                                    </Stack>
                                </Box>

                                <Box>
                                    <ToggleButtonGroup
                                        value={settings.theme}
                                        exclusive
                                        onChange={(e, v) => v && setSettings({ ...settings, theme: v })}
                                        fullWidth
                                        size="small"
                                        sx={{
                                            height: 28,
                                            '& .MuiToggleButton-root': {
                                                color: themeStyles.color,
                                                borderColor: alpha(themeStyles.color, 0.2),
                                                '&.Mui-selected': {
                                                    bgcolor: alpha(themeStyles.color, 0.1),
                                                    color: themeStyles.color,
                                                    '&:hover': {
                                                        bgcolor: alpha(themeStyles.color, 0.15),
                                                    }
                                                }
                                            }
                                        }}
                                    >
                                        <ToggleButton value="light">
                                            <Box sx={{
                                                width: 16, height: 16, borderRadius: '50%',
                                                bgcolor: '#f5f5f5', border: '1px solid', borderColor: alpha(themeStyles.color, 0.2)
                                            }} />
                                        </ToggleButton>
                                        <ToggleButton value="warm">
                                            <Box sx={{
                                                width: 16, height: 16, borderRadius: '50%',
                                                bgcolor: '#f5f1e8', border: '1px solid', borderColor: alpha(themeStyles.color, 0.2)
                                            }} />
                                        </ToggleButton>
                                        <ToggleButton value="dark">
                                            <Box sx={{
                                                width: 16, height: 16, borderRadius: '50%',
                                                bgcolor: '#0F0F0F', border: '1px solid', borderColor: alpha(themeStyles.color, 0.2)
                                            }} />
                                        </ToggleButton>
                                    </ToggleButtonGroup>
                                </Box>

                                <Select
                                    fullWidth
                                    size="small"
                                    variant="standard"
                                    value={settings.fontFamily}
                                    onChange={(e) => setSettings({ ...settings, fontFamily: e.target.value })}
                                    sx={{
                                        fontSize: '0.8rem',
                                        color: themeStyles.color,
                                        '&:before': { borderColor: alpha(themeStyles.color, 0.42) },
                                        '&:after': { borderColor: themeStyles.color },
                                        '& .MuiSvgIcon-root': { color: themeStyles.color }
                                    }}
                                >
                                    <MenuItem value="'Merriweather', 'Georgia', serif">衬线体</MenuItem>
                                    <MenuItem value="'Inter', 'Roboto', sans-serif">无衬线</MenuItem>
                                </Select>
                            </Stack>
                        </Collapse>
                        {!settingsOpen && (
                            <Typography variant="caption" component="p" sx={{ mt: 0.5, opacity: 0.7, color: 'inherit' }}>
                                点击展开调整字号、主题等。
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Box>

            {/* Main Content Area */}
            <Box
                ref={contentRef}
                sx={{
                    flex: 1,
                    height: '100%',
                    overflowY: 'auto',
                    position: 'relative',
                    scrollBehavior: 'smooth'
                }}>
                {/* Reading Paper */}
                <Box sx={{
                    maxWidth: settings.maxWidth,
                    mx: 'auto',
                    pb: 10,
                    px: { xs: 2, md: 4 },
                    minHeight: 'calc(100vh - 100px)'
                }}>
                    {currentChapter ? (
                        <Box
                            sx={{
                                p: { xs: 4, md: 8 },
                                minHeight: 800,
                                color: themeStyles.color,
                                transition: 'all 0.3s ease'
                            }}
                        >
                            <Typography variant="overline" display="block" align="center" gutterBottom sx={{ opacity: 0.6, color: 'inherit' }}>
                                第 {currentChapter.order} 章
                            </Typography>
                            <Typography
                                variant="h4"
                                align="center"
                                gutterBottom
                                sx={{
                                    fontWeight: 800,
                                    mb: 6,
                                    fontFamily: settings.fontFamily,
                                    color: 'inherit'
                                }}
                            >
                                {currentChapter.title}
                            </Typography>

                            <Typography
                                variant="body1"
                                component="div"
                                sx={{
                                    fontSize: settings.fontSize,
                                    lineHeight: settings.lineHeight,
                                    fontFamily: settings.fontFamily,
                                    whiteSpace: 'pre-wrap',
                                    textAlign: 'justify'
                                }}
                            >
                                {currentChapter.content || "（暂无正文内容）"}
                            </Typography>

                            <Divider sx={{ my: 8, opacity: 0.3 }} />

                            <Stack direction="row" justifyContent="space-between">
                                <IconButton
                                    onClick={handlePrevChapter}
                                    disabled={chapters[0]?.id === currentChapterId}
                                    sx={{
                                        color: themeStyles.color,
                                        '&.Mui-disabled': { opacity: 0.3, color: themeStyles.color }
                                    }}
                                >
                                    <IconChevronLeft />
                                </IconButton>
                                <Typography variant="caption" sx={{ opacity: 0.5, color: 'inherit' }}>
                                    {chapters.findIndex(c => c.id === currentChapterId) + 1} / {chapters.length}
                                </Typography>
                                <IconButton
                                    onClick={handleNextChapter}
                                    disabled={chapters[chapters.length - 1]?.id === currentChapterId}
                                    sx={{
                                        color: themeStyles.color,
                                        '&.Mui-disabled': { opacity: 0.3, color: themeStyles.color }
                                    }}
                                >
                                    <IconChevronRight />
                                </IconButton>
                            </Stack>
                        </Box>
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', opacity: 0.6 }}>
                            <IconBook sx={{ fontSize: 64, mb: 2 }} />
                            <Typography variant="h6">请选择要阅读的章节</Typography>
                        </Box>
                    )}
                </Box>
            </Box>
        </Box>
    );
};
