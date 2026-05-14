import * as React from 'react';
import { useState, useEffect } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { useThemeMode } from '../../contexts/ThemeContext';
import { extractSourceColor } from '../../services/dynamicColor';

// MUI Imports
import { useTheme } from '@mui/material/styles';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';

// MUI Icons - Rounded filled style for consistency
import {
    EditRounded as IconEdit,
    SettingsRounded as IconSettings,
    PeopleRounded as IconPeople,
    AccountTreeRounded as IconTree,
    TuneRounded as IconTune,
    ChevronLeftRounded as IconLeft,
    MenuRounded as IconMenu,
    LightModeRounded as IconSun,
    DarkModeRounded as IconMoon,
    HistoryRounded as IconHistory,
    AutoStoriesRounded as IconBook,
    HistoryEduRounded as IconWriter,
    MenuBookRounded as IconReader,
    ViewQuiltRounded as IconStructure,
    CreateRounded as IconPen,
    PsychologyRounded as IconBrain,
    VisibilityRounded as IconEye
} from '@mui/icons-material';

const drawerWidth = 80;

export const Layout = ({ children, activeTab, onTabChange }) => {
    const { clearCurrentProject, currentProject } = useProject();
    const [mobileOpen, setMobileOpen] = useState(false);
    const muiTheme = useTheme();
    // Using 768px as the breakpoint to match original behavior logic close enough (iPad portrait)
    // or standard md (900px). Let's stick to standard MUI habits for better maintainability if possible,
    // but preserving 'isMobile' feel around tablet size is good.
    const isMobileMatch = useMediaQuery(muiTheme.breakpoints.down('md'));

    // Theme Logic - now using ThemeContext
    const { mode: themeMode, toggleTheme: handleThemeToggle, setDynamicPrimary, resetDynamicPrimary } = useThemeMode();

    // 动态主题取色：优先使用书脊颜色，其次从封面提取
    useEffect(() => {
        // 1. 优先使用书脊颜色 (用户明确设置的颜色)
        if (currentProject?.bookStyle?.spineColor) {
            setDynamicPrimary(currentProject.bookStyle.spineColor);
        }
        // 2. 如果没有书脊颜色但有封面，从封面提取
        else if (currentProject?.cover) {
            extractSourceColor(currentProject.cover).then(color => {
                if (color) {
                    setDynamicPrimary(color);
                }
            });
        }
        // 3. 都没有时重置为默认色
        else {
            resetDynamicPrimary();
        }
        // 离开项目时重置
        return () => {
            resetDynamicPrimary();
        };
    }, [currentProject?.id, currentProject?.bookStyle?.spineColor, currentProject?.cover, setDynamicPrimary, resetDynamicPrimary]);

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const menuItems = [
        { key: 'plot', icon: <IconStructure />, label: '大纲架构' },
        { key: 'characters', icon: <IconPeople />, label: '角色管理' },
        { key: 'workbench', icon: <IconPen />, label: '写作台' },
        { key: 'reader', icon: <IconReader />, label: '阅读' },
        { key: 'constraints', icon: <IconBrain />, label: '创作调控' },
        { key: 'settings', icon: <IconSettings />, label: '全局设置' },
        { key: 'inspector', icon: <IconEye />, label: '日志记录' },
    ];

    const drawerDesktopContent = (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', py: 2 }}>
            {/* Top Actions */}
            <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Tooltip title="返回项目列表" placement="right">
                    <IconButton onClick={clearCurrentProject}>
                        <IconLeft />
                    </IconButton>
                </Tooltip>
                <Tooltip title="切换主题" placement="right">
                    <IconButton onClick={handleThemeToggle}>
                        {themeMode === 'dark' ? <IconSun /> : <IconMoon />}
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Menu */}
            <List sx={{ width: '100%', px: 1 }}> {/* Added horizontal padding for rail item pills */}
                {menuItems.map((item) => (
                    <ListItem key={item.key} disablePadding sx={{ display: 'block', mb: 1 }}>
                        <Tooltip title={item.label} placement="right" arrow>
                            <ListItemButton
                                selected={activeTab === item.key}
                                onClick={() => onTabChange(item.key)}
                                sx={{
                                    minHeight: 56, // Taller touch target
                                    justifyContent: 'center',
                                    px: 2.5,
                                    flexDirection: 'column', // Stack icon and potential label (if we add it later), strictly centers content
                                }}
                            >
                                <ListItemIcon
                                    sx={{
                                        minWidth: 0,
                                        mr: 0, // Remove margin to strictly center
                                        justifyContent: 'center',
                                        color: activeTab === item.key ? 'inherit' : 'text.secondary' // Inherit color from selected state or default
                                    }}
                                >
                                    {item.icon}
                                </ListItemIcon>
                                {/* No text in desktop collapsed view, keeping it icon-only rail for now */}
                            </ListItemButton>
                        </Tooltip>
                    </ListItem>
                ))}
            </List>
        </Box>
    );

    return (
        <Box sx={{ display: 'flex' }}>
            {/* Mobile Header */}
            {isMobileMatch && (
                <AppBar position="fixed" sx={{ bgcolor: 'background.paper', color: 'text.primary', backgroundImage: 'none', boxShadow: 1 }}>
                    <Toolbar>
                        <IconButton
                            color="inherit"
                            aria-label="open drawer"
                            edge="start"
                            onClick={handleDrawerToggle}
                            sx={{ mr: 2 }}
                        >
                            <IconMenu />
                        </IconButton>
                        <Box sx={{ flexGrow: 1 }} />
                        <IconButton onClick={handleThemeToggle}>
                            {themeMode === 'dark' ? <IconSun /> : <IconMoon />}
                        </IconButton>
                        <IconButton onClick={clearCurrentProject}>
                            <IconLeft />
                        </IconButton>
                    </Toolbar>
                </AppBar>
            )}

            {/* Drawer */}
            <Box
                component="nav"
                sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
                aria-label="mailbox folders"
            >
                {/* Mobile Drawer (Temporary) */}
                {isMobileMatch ? (
                    <Drawer
                        variant="temporary"
                        open={mobileOpen}
                        onClose={handleDrawerToggle}
                        ModalProps={{
                            keepMounted: true, // Better open performance on mobile.
                        }}
                        sx={{
                            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240 },
                        }}
                    >
                        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="h6">导航</Typography>
                            <IconButton onClick={handleDrawerToggle}><IconLeft /></IconButton>
                        </Box>
                        <Divider />
                        <List>
                            {menuItems.map((item) => (
                                <ListItemButton
                                    key={item.key}
                                    selected={activeTab === item.key}
                                    onClick={() => {
                                        onTabChange(item.key);
                                        setMobileOpen(false);
                                    }}
                                >
                                    <ListItemIcon sx={{ color: activeTab === item.key ? 'primary.main' : 'inherit' }}>
                                        {item.icon}
                                    </ListItemIcon>
                                    <ListItemText primary={item.label} />
                                </ListItemButton>
                            ))}
                        </List>
                    </Drawer>
                ) : (
                    /* Desktop Drawer (Permanent) */
                    <Drawer
                        variant="permanent"
                        sx={{
                            display: { xs: 'none', md: 'block' },
                            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                        }}
                        open
                    >
                        {drawerDesktopContent}
                    </Drawer>
                )}
            </Box>

            {/* Main Content */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 0,
                    // If desktop, width is calc. If mobile, width is 100%. Layout handles this via flex.
                    width: { md: `calc(100% - ${drawerWidth}px)` },
                    mt: isMobileMatch ? 8 : 0, // AppBar height content offset (~64px)
                    height: '100vh',
                    overflow: 'hidden', // Let children handle scroll if needed or set to auto here. Arco Layout Content had overflowY: auto.
                    bgcolor: 'background.default'
                }}
            >
                {/* Replicating Arco Content overflow behavior */}
                <Box sx={{ height: '100%', overflowY: 'auto' }}>
                    {children}
                </Box>
            </Box>
        </Box>
    );
};
