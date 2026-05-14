import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Box, Card, CardHeader, CardContent, Typography,
    List, ListItem, ListItemText, ListItemButton, ListItemIcon,
    Button, IconButton, Grid, Chip, Stack,
    Tabs, Tab, Accordion, AccordionSummary, AccordionDetails,
    Divider, Alert, Paper, Collapse, Breadcrumbs, Link, Tooltip, Drawer,
    TextField, InputAdornment, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import {
    Timeline, TimelineItem, TimelineSeparator, TimelineConnector,
    TimelineContent, TimelineDot, TimelineOppositeContent
} from '@mui/lab';
import {
    RefreshRounded as IconRefresh,
    DeleteRounded as IconDelete,
    CodeRounded as IconCode,
    MessageRounded as IconMessage,
    ExpandMoreRounded as IconExpandMore,
    WarningRounded as IconWarning,
    SmartToyRounded as IconRobot,
    ChevronRightRounded as IconChevronRight,
    ChevronLeftRounded as IconChevronLeft,
    InfoRounded as IconInfo,
    MenuRounded as IconMenu,
    BugReportRounded as IconBug,
    TimelineRounded as IconTimeline,
    VisibilityRounded as IconVisibility,
    SearchRounded as IconSearch,
    FilterListRounded as IconFilter,
    CheckCircleRounded as IconCheckCircle,
    ErrorRounded as IconError,
    ContentCopyRounded as IconCopy,
    HourglassEmptyRounded as IconHourglass
} from '@mui/icons-material';
import { PromptLogger } from '../../services/PromptLogger';
import { useProject } from '../../contexts/ProjectContext';
import { useTheme, alpha } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import markdown from 'react-syntax-highlighter/dist/esm/languages/hljs/markdown';
import { atomOneDark, atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import ReactMarkdown from 'react-markdown';

// Register languages
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('markdown', markdown);

// --- JSON Validation Helper ---
const validateJson = (str) => {
    if (!str || typeof str !== 'string') return { valid: false, error: 'Empty or invalid input' };
    try {
        JSON.parse(str);
        return { valid: true, error: null };
    } catch (e) {
        return { valid: false, error: e.message };
    }
};

// --- JSON Highlighter Component ---
const JsonHighlighter = ({ content, theme }) => {
    const validation = useMemo(() => validateJson(content), [content]);
    const isDark = theme.palette.mode === 'dark';

    // Try to format JSON if valid
    let displayContent = content;
    if (validation.valid) {
        try {
            displayContent = JSON.stringify(JSON.parse(content), null, 2);
        } catch (e) {
            displayContent = content;
        }
    }

    return (
        <Box>
            {/* Validation Badge */}
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                {validation.valid ? (
                    <Chip
                        icon={<IconCheckCircle />}
                        label="Valid JSON"
                        color="success"
                        size="small"
                        variant="outlined"
                    />
                ) : (
                    <Chip
                        icon={<IconError />}
                        label="Invalid JSON"
                        color="error"
                        size="small"
                        variant="outlined"
                    />
                )}
            </Box>

            {/* Error Message */}
            {!validation.valid && validation.error && (
                <Alert severity="error" sx={{ mb: 2, fontSize: '0.8rem' }}>
                    <Typography variant="caption" fontFamily="monospace">
                        {validation.error}
                    </Typography>
                </Alert>
            )}

            {/* Syntax Highlighted Content */}
            <Box sx={{
                borderRadius: 2,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: validation.valid ? 'divider' : 'error.main'
            }}>
                <SyntaxHighlighter
                    language="json"
                    style={isDark ? atomOneDark : atomOneLight}
                    customStyle={{
                        margin: 0,
                        padding: 16,
                        fontSize: '0.8rem',
                        maxHeight: 400,
                        overflow: 'auto'
                    }}
                    wrapLongLines
                >
                    {displayContent || 'N/A'}
                </SyntaxHighlighter>
            </Box>
        </Box>
    );
};

export const PromptInspector = () => {
    const { currentProject } = useProject();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [logs, setLogs] = useState([]);
    const [selectedLog, setSelectedLog] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState(0);

    // Layout State
    const [showRefPanel, setShowRefPanel] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterAgent, setFilterAgent] = useState('');
    const [filterModel, setFilterModel] = useState('');
    const [filterTimeRange, setFilterTimeRange] = useState('all');

    const userHasSelectedLog = useRef(false);

    useEffect(() => {
        if (currentProject) {
            loadLogs();
            const interval = setInterval(() => {
                loadLogs();
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [currentProject]);

    const loadLogs = async () => {
        if (!currentProject) return;
        try {
            const data = await PromptLogger.getLogs(currentProject.id, 50);
            setLogs(data);
            if (data.length > 0 && !userHasSelectedLog.current) {
                setSelectedLog(data[0]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleLogClick = (log) => {
        setSelectedLog(log);
        userHasSelectedLog.current = true;
    };

    const handleClear = async () => {
        if (!currentProject) return;
        if (window.confirm('确定要清空所有日志吗？')) {
            await PromptLogger.clearLogs(currentProject.id);
            setLogs([]);
            setSelectedLog(null);
            userHasSelectedLog.current = false;
        }
    };

    const formatDate = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    };

    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString();
    };

    // --- Filter Logic ---
    const uniqueAgents = useMemo(() => [...new Set(logs.map(l => l.agent))], [logs]);
    const uniqueModels = useMemo(() => [...new Set(logs.map(l => l.model))], [logs]);

    const filteredLogs = useMemo(() => {
        let result = logs;

        // Filter by search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(log =>
                log.agent?.toLowerCase().includes(q) ||
                log.action?.toLowerCase().includes(q) ||
                log.taskName?.toLowerCase().includes(q) ||
                log.response?.toLowerCase().includes(q)
            );
        }

        // Filter by agent
        if (filterAgent) {
            result = result.filter(log => log.agent === filterAgent);
        }

        // Filter by model
        if (filterModel) {
            result = result.filter(log => log.model === filterModel);
        }

        // Filter by time range
        if (filterTimeRange !== 'all') {
            const now = Date.now();
            const ranges = {
                '1h': 60 * 60 * 1000,
                '6h': 6 * 60 * 60 * 1000,
                'today': now - new Date().setHours(0, 0, 0, 0)
            };
            const cutoff = now - (ranges[filterTimeRange] || 0);
            result = result.filter(log => log.timestamp >= cutoff);
        }

        return result;
    }, [logs, searchQuery, filterAgent, filterModel, filterTimeRange]);

    // --- Group Logs ---
    const groups = useMemo(() => {
        const acc = {};
        filteredLogs.forEach(log => {
            const taskId = log.taskId || 'default';
            if (!acc[taskId]) {
                acc[taskId] = {
                    id: taskId,
                    logs: [],
                    timestamp: log.timestamp,
                    agents: new Set(),
                    taskName: log.taskName || '',
                    chapterNumber: log.chapterNumber || undefined
                };
            }
            acc[taskId].logs.push(log);
            acc[taskId].agents.add(log.agent);
            if (log.timestamp < acc[taskId].timestamp) acc[taskId].timestamp = log.timestamp;
            if (log.taskName && !acc[taskId].taskName) acc[taskId].taskName = log.taskName;
            if (log.chapterNumber && !acc[taskId].chapterNumber) acc[taskId].chapterNumber = log.chapterNumber;
        });
        return Object.values(acc).sort((a, b) => b.timestamp - a.timestamp);
    }, [filteredLogs]);

    // Get current task group for timeline
    const currentTaskGroup = useMemo(() => {
        if (!selectedLog) return null;
        return groups.find(g => g.logs.some(l => l.id === selectedLog.id));
    }, [selectedLog, groups]);

    if (!currentProject) {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <IconBug sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">请先选择项目</Typography>
            </Box>
        );
    }

    // --- Sidebar Content ---
    const sidebarContent = (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <IconVisibility sx={{ mr: 1.5, color: 'primary.main' }} />
                        <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: 'inherit' }}>日志记录</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">{filteredLogs.length} / {logs.length} 条记录</Typography>
                </Box>
                <Stack direction="row" spacing={0.5}>
                    <Tooltip title="刷新">
                        <IconButton size="small" onClick={() => { setLoading(true); loadLogs(); }} disabled={loading}>
                            <IconRefresh fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="清空日志">
                        <IconButton size="small" color="error" onClick={handleClear}>
                            <IconDelete fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Box>

            {/* Search & Filter */}
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}>
                <TextField
                    fullWidth
                    size="small"
                    placeholder="搜索日志..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <IconSearch fontSize="small" />
                            </InputAdornment>
                        ),
                    }}
                    sx={{ mb: 1.5 }}
                />
                <Stack direction="row" spacing={1}>
                    <FormControl size="small" sx={{ minWidth: 80, flex: 1 }}>
                        <InputLabel>Agent</InputLabel>
                        <Select
                            value={filterAgent}
                            label="Agent"
                            onChange={(e) => setFilterAgent(e.target.value)}
                        >
                            <MenuItem value="">全部</MenuItem>
                            {uniqueAgents.map(agent => (
                                <MenuItem key={agent} value={agent}>{agent}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 80, flex: 1 }}>
                        <InputLabel>时间</InputLabel>
                        <Select
                            value={filterTimeRange}
                            label="时间"
                            onChange={(e) => setFilterTimeRange(e.target.value)}
                        >
                            <MenuItem value="all">全部</MenuItem>
                            <MenuItem value="1h">1小时内</MenuItem>
                            <MenuItem value="6h">6小时内</MenuItem>
                            <MenuItem value="today">今天</MenuItem>
                        </Select>
                    </FormControl>
                </Stack>
            </Box>

            {/* Log List */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', scrollbarGutter: 'stable' }}>
                {groups.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                            {filteredLogs.length === 0 && logs.length > 0 ? '无匹配结果' : '暂无日志'}
                        </Typography>
                    </Box>
                ) : (
                    groups.map(group => (
                        <Accordion
                            key={group.id}
                            disableGutters
                            square
                            defaultExpanded={group.id === groups[0]?.id}
                            sx={{
                                borderBottom: 1,
                                borderColor: 'divider',
                                '&:before': { display: 'none' },
                                boxShadow: 'none',
                                bgcolor: 'background.paper'
                            }}
                        >
                            <AccordionSummary expandIcon={<IconExpandMore />} sx={{ px: 2, minHeight: 48 }}>
                                <Box sx={{ width: '100%', overflow: 'hidden' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
                                            {group.chapterNumber && (
                                                <Chip label={`第${group.chapterNumber}章`} size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                                            )}
                                            {group.taskName && group.taskName.includes('(') ? (
                                                <Typography variant="subtitle2" noWrap sx={{ fontWeight: 'bold' }}>
                                                    {group.taskName.split('(')[0].trim()}
                                                </Typography>
                                            ) : (
                                                <Typography variant="subtitle2" noWrap sx={{ fontWeight: 'bold' }}>
                                                    {group.id === 'default' ? '未分类任务' : group.taskName || `任务 ${group.id.slice(0, 4)}`}
                                                </Typography>
                                            )}
                                        </Box>
                                        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, ml: 1 }}>
                                            {formatTime(group.timestamp)}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                        {[...group.agents].map(agent => (
                                            <Chip key={agent} label={agent} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'action.hover' }} />
                                        ))}
                                    </Box>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails sx={{ p: 0 }}>
                                <List disablePadding>
                                    {group.logs.map((item) => (
                                        <ListItemButton
                                            key={item.id}
                                            selected={selectedLog?.id === item.id}
                                            onClick={() => handleLogClick(item)}
                                            sx={{
                                                pl: 3,
                                                borderLeft: 3,
                                                borderColor: selectedLog?.id === item.id ? 'primary.main' : 'transparent',
                                                bgcolor: selectedLog?.id === item.id ? 'action.selected' : 'inherit',
                                                flexDirection: 'column',
                                                alignItems: 'flex-start'
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 0.5 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    {item.status === 'generating' ? (
                                                        <IconHourglass sx={{ fontSize: 14, color: 'warning.main', animation: 'pulse 1.5s infinite' }} />
                                                    ) : item.status === 'error' ? (
                                                        <IconError sx={{ fontSize: 14, color: 'error.main' }} />
                                                    ) : (
                                                        <IconCheckCircle sx={{ fontSize: 14, color: 'success.main' }} />
                                                    )}
                                                    <Typography variant="body2" fontWeight="bold">{item.agent}</Typography>
                                                </Box>
                                                <Typography variant="caption" color="text.secondary">
                                                    {formatTime(item.timestamp)}
                                                </Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                                <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: '60%' }}>
                                                    {item.action}
                                                </Typography>
                                                <Chip
                                                    label={item.status === 'generating' ? '生成中...' : item.model}
                                                    size="small"
                                                    variant="outlined"
                                                    color={item.status === 'generating' ? 'warning' : 'default'}
                                                    sx={{ height: 16, fontSize: '0.6rem', transform: 'scale(0.9)', transformOrigin: 'right center' }}
                                                />
                                            </Box>
                                        </ListItemButton>
                                    ))}
                                </List>
                            </AccordionDetails>
                        </Accordion>
                    ))
                )}
            </Box>
        </Box>
    );

    // --- Right Panel Content ---
    const handleCopyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    const rightPanelContent = selectedLog ? (
        <Box sx={{ p: 3, height: '100%', overflowY: 'auto' }}>
            <Box sx={{ mb: 4 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    日志详情 • {formatDate(selectedLog.timestamp)}
                </Typography>
                {/* Handle Bilingual Task Names (e.g. "中文 (English)") */}
                {selectedLog.taskName && selectedLog.taskName.includes('(') ? (
                    <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.4 }}>
                        {selectedLog.taskName.split('(')[0].trim()}
                    </Typography>
                ) : (
                    <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.4, wordBreak: 'break-word' }}>
                        {selectedLog.taskName || '未命名任务'}
                    </Typography>
                )}
            </Box>

            <Stack spacing={4}>
                {/* Core Info */}
                <Box>
                    <Stack spacing={2.5}>
                        <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Agent</Typography>
                            <Typography variant="body2" fontWeight="bold">{selectedLog.agent}</Typography>
                        </Box>

                        <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Model</Typography>
                            <Chip
                                label={selectedLog.model}
                                size="small"
                                sx={{
                                    height: 24,
                                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                                    color: 'primary.main',
                                    fontWeight: 'medium',
                                    border: 'none',
                                    maxWidth: '100%'
                                }}
                            />
                        </Box>

                        <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Action</Typography>
                            <Box sx={{
                                bgcolor: 'action.hover',
                                px: 1,
                                py: 0.5,
                                borderRadius: 1,
                                display: 'inline-block',
                                fontFamily: 'monospace',
                                fontSize: '0.8rem',
                                wordBreak: 'break-all'
                            }}>
                                {selectedLog.action}
                            </Box>
                        </Box>
                    </Stack>
                </Box>

                <Divider />

                {/* Task Context */}
                <Box>
                    <Stack spacing={2.5}>
                        <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Task ID</Typography>
                            {selectedLog.taskId && (
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <Typography
                                        variant="caption"
                                        fontFamily="monospace"
                                        color="text.secondary"
                                        sx={{ bgcolor: 'action.hover', px: 0.5, borderRadius: 0.5, wordBreak: 'break-all' }}
                                    >
                                        {selectedLog.taskId}
                                    </Typography>
                                </Stack>
                            )}
                        </Box>
                    </Stack>
                </Box>

                <Divider />
                {/* Stats */}
                <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>统计信息</Typography>
                    <Stack direction="row" spacing={2}>
                        <Box sx={{ flex: 1, p: 2, bgcolor: 'background.default', borderRadius: 2, textAlign: 'center' }}>
                            <Typography variant="h6" fontWeight="bold" color="text.primary" sx={{ lineHeight: 1.2 }}>
                                {selectedLog.fullPrompt ? (selectedLog.fullPrompt.length / 1000).toFixed(1) + 'k' : '0'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">Prompt</Typography>
                        </Box>
                        <Box sx={{ flex: 1, p: 2, bgcolor: 'background.default', borderRadius: 2, textAlign: 'center' }}>
                            <Typography variant="h6" fontWeight="bold" color="text.primary" sx={{ lineHeight: 1.2 }}>
                                {selectedLog.response ? (selectedLog.response.length / 1000).toFixed(1) + 'k' : '0'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">Response</Typography>
                        </Box>
                    </Stack>
                </Box>


            </Stack>
        </Box>
    ) : (
        <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
            <Typography variant="body2">请选择一条日志</Typography>
        </Box>
    );
    ;

    // --- Main Return ---
    return (
        <Box sx={{ display: 'flex', height: '100%', bgcolor: 'background.default', overflow: 'hidden', position: 'relative' }}>
            {/* Left Sidebar */}
            {isMobile ? (
                <Drawer
                    variant="temporary"
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    sx={{ '& .MuiDrawer-paper': { width: 320, boxSizing: 'border-box' } }}
                >
                    {sidebarContent}
                </Drawer>
            ) : (
                <Box sx={{
                    width: 320,
                    flexShrink: 0,
                    borderRight: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    {sidebarContent}
                </Box>
            )}

            {/* Main Content */}
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                {/* Header */}
                <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                        {isMobile && <IconButton onClick={() => setDrawerOpen(true)}><IconMenu /></IconButton>}
                        <Breadcrumbs separator={<IconChevronRight sx={{ fontSize: 16 }} />}>
                            <Link underline="hover" color="inherit" sx={{ cursor: 'pointer' }}>调试工具</Link>
                            <Typography color="text.primary" fontWeight="bold">LLM 交互透视台</Typography>
                        </Breadcrumbs>
                    </Stack>
                    <Tooltip title={showRefPanel ? "收起面板" : "展开面板"}>
                        <IconButton onClick={() => setShowRefPanel(!showRefPanel)} color={showRefPanel ? "primary" : "default"}>
                            <IconInfo />
                        </IconButton>
                    </Tooltip>
                </Box>

                {/* Tabs */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
                    <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
                        <Tab icon={<IconRobot fontSize="small" />} iconPosition="start" label="可视化结构" sx={{ minHeight: 48 }} />
                        <Tab icon={<IconCode fontSize="small" />} iconPosition="start" label="原始 Prompt" sx={{ minHeight: 48 }} />
                        <Tab icon={<IconMessage fontSize="small" />} iconPosition="start" label="模型响应" sx={{ minHeight: 48 }} />
                    </Tabs>
                </Box>

                {/* Content */}
                <Box sx={{ flexGrow: 1, overflowY: 'auto', scrollbarGutter: 'stable', p: isMobile ? 3 : 6, pb: 20 }}>
                    <Box sx={{ maxWidth: 1000, width: '100%', mx: 'auto' }}>
                        {selectedLog ? (
                            <>
                                {/* Tab 0: Visual Structure - Flow Diagram */}
                                {activeTab === 0 && (
                                    <Box>
                                        {(selectedLog.agent === 'ImageGeneration' || selectedLog.agent === 'CoverDesigner') ? (
                                            /* === Image Generation Visualization === */
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                {/* 1. Main Prompt Card */}
                                                <Card variant="outlined" sx={{ borderRadius: 4, borderColor: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>
                                                    <Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', px: 3, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <IconVisibility />
                                                        <Typography variant="subtitle1" fontWeight="bold">
                                                            {selectedLog.agent === 'CoverDesigner' ? '封面提示词 (Cover Prompt)' : '图像提示词 (Prompt)'}
                                                        </Typography>
                                                    </Box>
                                                    <Box sx={{ p: 3 }}>
                                                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                                                            {selectedLog.modules?.coverPrompt || selectedLog.modules?.characterPrompt || selectedLog.modules?.prompt || selectedLog.fullPrompt || 'N/A'}
                                                        </Typography>
                                                    </Box>
                                                </Card>

                                                {/* 2. Style & Parameters Grid */}
                                                <Grid container spacing={3}>
                                                    {/* Style Prompt */}
                                                    <Grid item xs={12} md={8}>
                                                        <Card variant="outlined" sx={{ borderRadius: 4, height: '100%', borderColor: 'secondary.main', bgcolor: alpha(theme.palette.secondary.main, 0.03) }}>
                                                            <Box sx={{ bgcolor: 'secondary.main', color: 'secondary.contrastText', px: 3, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <IconFilter />
                                                                <Typography variant="subtitle1" fontWeight="bold">风格描述 (Style)</Typography>
                                                            </Box>
                                                            <Box sx={{ p: 3 }}>
                                                                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                                                                    {selectedLog.modules?.stylePrompt || '未指定风格'}
                                                                </Typography>
                                                            </Box>
                                                        </Card>
                                                    </Grid>

                                                    {/* Parameters */}
                                                    <Grid item xs={12} md={4}>
                                                        <Card variant="outlined" sx={{ borderRadius: 4, height: '100%', borderColor: 'info.main', bgcolor: alpha(theme.palette.info.main, 0.03) }}>
                                                            <Box sx={{ bgcolor: 'info.main', color: 'info.contrastText', px: 3, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <IconCode />
                                                                <Typography variant="subtitle1" fontWeight="bold">参数配置</Typography>
                                                            </Box>
                                                            <List dense>
                                                                <ListItem>
                                                                    <ListItemText
                                                                        primary="尺寸 (Size)"
                                                                        secondary={selectedLog.modules?.size || 'Default'}
                                                                    />
                                                                </ListItem>
                                                                <Divider component="li" />
                                                                <ListItem>
                                                                    <ListItemText
                                                                        primary="模型 (Model)"
                                                                        secondary={selectedLog.modules?.model || selectedLog.model || 'Unknown'}
                                                                    />
                                                                </ListItem>
                                                                {selectedLog.modules?.designStyle && (
                                                                    <>
                                                                        <Divider component="li" />
                                                                        <ListItem>
                                                                            <ListItemText
                                                                                primary="设计风格"
                                                                                secondary={selectedLog.modules.designStyle}
                                                                            />
                                                                        </ListItem>
                                                                    </>
                                                                )}
                                                            </List>
                                                        </Card>
                                                    </Grid>
                                                </Grid>

                                                {/* 3. Result Preview (if applicable) */}
                                                {selectedLog.response && (
                                                    selectedLog.response.startsWith('data:image') ||
                                                    /\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(selectedLog.response) ||
                                                    selectedLog.response.includes('/api/images/')
                                                ) && (
                                                        <Card variant="outlined" sx={{ borderRadius: 4, overflow: 'hidden' }}>
                                                            <Box sx={{ bgcolor: 'text.primary', color: 'background.paper', px: 3, py: 1.5, display: 'flex', alignItems: 'center' }}>
                                                                <Typography variant="subtitle1" fontWeight="bold">生成结果 preview</Typography>
                                                            </Box>
                                                            <Box sx={{ p: 0, display: 'flex', justifyContent: 'center', bgcolor: 'black' }}>
                                                                <img
                                                                    src={selectedLog.response}
                                                                    alt="Generated Result"
                                                                    style={{ maxWidth: '100%', maxHeight: 500, objectFit: 'contain' }}
                                                                />
                                                            </Box>
                                                        </Card>
                                                    )}
                                            </Box>
                                        ) : (
                                            /* === Standard Text LLM Visualization === */
                                            <Box>
                                                {/* Optimized Top Stats Bar */}
                                                <Paper
                                                    elevation={0}
                                                    sx={{
                                                        mb: 4,
                                                        p: 2,
                                                        bgcolor: 'background.default',
                                                        borderRadius: 3,
                                                        border: '1px solid',
                                                        borderColor: 'divider',
                                                        display: 'flex',
                                                        justifyContent: 'space-around',
                                                        alignItems: 'center'
                                                    }}
                                                >
                                                    <Box sx={{ textAlign: 'center' }}>
                                                        <Typography variant="h4" fontWeight="bold" color="primary" sx={{ lineHeight: 1 }}>
                                                            {selectedLog.modules?.system?.length?.toLocaleString() || 0}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>系统提示词</Typography>
                                                    </Box>
                                                    <Divider orientation="vertical" flexItem />
                                                    <Box sx={{ textAlign: 'center' }}>
                                                        <Typography variant="h4" fontWeight="bold" color="warning.main" sx={{ lineHeight: 1 }}>
                                                            {Object.keys(selectedLog.modules?.context || {}).length}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>上下文模块</Typography>
                                                    </Box>
                                                    <Divider orientation="vertical" flexItem />
                                                    <Box sx={{ textAlign: 'center' }}>
                                                        <Typography variant="h4" fontWeight="bold" color="success.main" sx={{ lineHeight: 1 }}>
                                                            {selectedLog.modules?.instruction?.length?.toLocaleString() || 0}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>用户指令</Typography>
                                                    </Box>
                                                    <Divider orientation="vertical" flexItem />
                                                    <Box sx={{ textAlign: 'center' }}>
                                                        <Typography variant="h4" fontWeight="bold" color="info.main" sx={{ lineHeight: 1 }}>
                                                            {selectedLog.fullPrompt?.length?.toLocaleString() || 0}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>总字符数</Typography>
                                                    </Box>
                                                </Paper>

                                                {/* Flow Diagram */}
                                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

                                                    {/* Node 1: System Prompt */}
                                                    <Box sx={{ width: '100%', maxWidth: 900 }}>
                                                        <Card
                                                            variant="outlined"
                                                            sx={{
                                                                borderRadius: 4,
                                                                borderWidth: 2,
                                                                borderColor: 'primary.main',
                                                                bgcolor: alpha(theme.palette.primary.main, 0.03),
                                                                overflow: 'hidden'
                                                            }}
                                                        >
                                                            <Box sx={{
                                                                bgcolor: 'primary.main',
                                                                color: 'primary.contrastText',
                                                                px: 3,
                                                                py: 1.5,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 1
                                                            }}>
                                                                <IconRobot />
                                                                <Typography variant="subtitle1" fontWeight="bold">1. 系统提示词</Typography>
                                                                <Chip
                                                                    label={`${selectedLog.modules?.system?.length || 0} 字符`}
                                                                    size="small"
                                                                    sx={{ ml: 'auto', bgcolor: 'rgba(255,255,255,0.2)', color: 'inherit' }}
                                                                />
                                                            </Box>
                                                            <Accordion disableGutters elevation={0} sx={{ bgcolor: 'transparent' }}>
                                                                <AccordionSummary expandIcon={<IconExpandMore />} sx={{ px: 3, py: 1 }}>
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        定义 AI 的角色、能力和行为准则
                                                                    </Typography>
                                                                </AccordionSummary>
                                                                <AccordionDetails sx={{ px: 3, py: 2, bgcolor: 'background.default' }}>
                                                                    <Typography component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 14, maxHeight: 300, overflow: 'auto', lineHeight: 1.6 }}>
                                                                        {selectedLog.modules?.system || 'N/A'}
                                                                    </Typography>
                                                                </AccordionDetails>
                                                            </Accordion>
                                                        </Card>
                                                    </Box>

                                                    {/* Connector Arrow */}
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 1 }}>
                                                        <Box sx={{ width: 2, height: 20, bgcolor: 'divider' }} />
                                                        <IconExpandMore sx={{ color: 'text.secondary', my: -0.5 }} />
                                                    </Box>

                                                    {/* Node 2: Context Modules */}
                                                    <Box sx={{ width: '100%', maxWidth: 900 }}>
                                                        <Card
                                                            variant="outlined"
                                                            sx={{
                                                                borderRadius: 4,
                                                                borderWidth: 2,
                                                                borderColor: 'warning.main',
                                                                bgcolor: alpha(theme.palette.warning.main, 0.03),
                                                                overflow: 'hidden'
                                                            }}
                                                        >
                                                            <Box sx={{
                                                                bgcolor: 'warning.main',
                                                                color: 'warning.contrastText',
                                                                px: 3,
                                                                py: 1.5,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 1
                                                            }}>
                                                                <IconCode />
                                                                <Typography variant="subtitle1" fontWeight="bold">2. 上下文模块</Typography>
                                                                <Chip
                                                                    label={`${Object.keys(selectedLog.modules?.context || {}).length} 个模块`}
                                                                    size="small"
                                                                    sx={{ ml: 'auto', bgcolor: 'rgba(255,255,255,0.2)', color: 'inherit' }}
                                                                />
                                                            </Box>

                                                            {/* Context Module Cards in Grid */}
                                                            <Box sx={{ p: 2 }}>
                                                                {selectedLog.modules?.context && Object.keys(selectedLog.modules.context).length > 0 ? (
                                                                    <Grid container spacing={1.5}>
                                                                        {Object.entries(selectedLog.modules.context).map(([key, value]) => {
                                                                            const contentLength = typeof value === 'object'
                                                                                ? JSON.stringify(value).length
                                                                                : String(value).length;
                                                                            return (
                                                                                <Grid item xs={6} sm={4} key={key}>
                                                                                    <Accordion
                                                                                        disableGutters
                                                                                        elevation={0}
                                                                                        sx={{
                                                                                            border: '1px solid',
                                                                                            borderColor: 'divider',
                                                                                            borderRadius: 2,
                                                                                            overflow: 'hidden',
                                                                                            '&:before': { display: 'none' }
                                                                                        }}
                                                                                    >
                                                                                        <AccordionSummary
                                                                                            expandIcon={<IconExpandMore sx={{ fontSize: 16 }} />}
                                                                                            sx={{
                                                                                                minHeight: 'auto',
                                                                                                py: 1,
                                                                                                px: 1.5,
                                                                                                bgcolor: 'background.default',
                                                                                                '& .MuiAccordionSummary-content': { my: 0 }
                                                                                            }}
                                                                                        >
                                                                                            <Box>
                                                                                                <Typography variant="caption" fontWeight="bold" sx={{ display: 'block' }}>
                                                                                                    {key}
                                                                                                </Typography>
                                                                                                <Typography variant="caption" color="text.secondary">
                                                                                                    {contentLength.toLocaleString()} 字符
                                                                                                </Typography>
                                                                                            </Box>
                                                                                        </AccordionSummary>
                                                                                        <AccordionDetails sx={{ p: 1.5, bgcolor: 'background.paper', maxHeight: 150, overflow: 'auto' }}>
                                                                                            <Typography component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.5 }}>
                                                                                                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                                                                                            </Typography>
                                                                                        </AccordionDetails>
                                                                                    </Accordion>
                                                                                </Grid>
                                                                            );
                                                                        })}
                                                                    </Grid>
                                                                ) : (
                                                                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                                                                        无上下文模块
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        </Card>
                                                    </Box>

                                                    {/* Connector Arrow */}
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 1 }}>
                                                        <Box sx={{ width: 2, height: 20, bgcolor: 'divider' }} />
                                                        <IconExpandMore sx={{ color: 'text.secondary', my: -0.5 }} />
                                                    </Box>

                                                    {/* Node 3: User Instruction */}
                                                    <Box sx={{ width: '100%', maxWidth: 900 }}>
                                                        <Card
                                                            variant="outlined"
                                                            sx={{
                                                                borderRadius: 4,
                                                                borderWidth: 2,
                                                                borderColor: 'success.main',
                                                                bgcolor: alpha(theme.palette.success.main, 0.03),
                                                                overflow: 'hidden'
                                                            }}
                                                        >
                                                            <Box sx={{
                                                                bgcolor: 'success.main',
                                                                color: 'success.contrastText',
                                                                px: 3,
                                                                py: 1.5,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 1
                                                            }}>
                                                                <IconMessage />
                                                                <Typography variant="subtitle1" fontWeight="bold">3. 用户指令</Typography>
                                                                <Chip
                                                                    label={`${selectedLog.modules?.instruction?.length || 0} 字符`}
                                                                    size="small"
                                                                    sx={{ ml: 'auto', bgcolor: 'rgba(255,255,255,0.2)', color: 'inherit' }}
                                                                />
                                                            </Box>
                                                            <Accordion disableGutters elevation={0} sx={{ bgcolor: 'transparent' }}>
                                                                <AccordionSummary expandIcon={<IconExpandMore />} sx={{ px: 3, py: 1 }}>
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        本次请求的具体任务指令
                                                                    </Typography>
                                                                </AccordionSummary>
                                                                <AccordionDetails sx={{ px: 3, py: 2, bgcolor: 'background.default' }}>
                                                                    <Typography component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 14, maxHeight: 300, overflow: 'auto', lineHeight: 1.6 }}>
                                                                        {selectedLog.modules?.instruction || 'N/A'}
                                                                    </Typography>
                                                                </AccordionDetails>
                                                            </Accordion>
                                                        </Card>
                                                    </Box>

                                                    {/* Connector Arrow to Output */}
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 1 }}>
                                                        <Box sx={{ width: 2, height: 20, bgcolor: 'divider' }} />
                                                        <IconExpandMore sx={{ color: 'text.secondary', my: -0.5 }} />
                                                    </Box>

                                                    {/* Node 4: LLM Output */}
                                                    <Box sx={{ width: '100%', maxWidth: 900 }}>
                                                        <Card
                                                            variant="outlined"
                                                            sx={{
                                                                borderRadius: 4,
                                                                borderWidth: 2,
                                                                borderColor: validateJson(selectedLog.response).valid ? 'info.main' : 'error.main',
                                                                bgcolor: alpha(validateJson(selectedLog.response).valid ? theme.palette.info.main : theme.palette.error.main, 0.03),
                                                                overflow: 'hidden'
                                                            }}
                                                        >
                                                            <Box sx={{
                                                                bgcolor: validateJson(selectedLog.response).valid ? 'info.main' : 'error.main',
                                                                color: 'common.white',
                                                                px: 3,
                                                                py: 1.5,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 1
                                                            }}>
                                                                {validateJson(selectedLog.response).valid ? <IconCheckCircle /> : <IconError />}
                                                                <Typography variant="subtitle1" fontWeight="bold">4. 模型响应</Typography>
                                                                <Chip
                                                                    label={validateJson(selectedLog.response).valid ? '有效 JSON' : '解析错误'}
                                                                    size="small"
                                                                    sx={{ ml: 'auto', bgcolor: 'rgba(255,255,255,0.2)', color: 'inherit' }}
                                                                />
                                                            </Box>
                                                            <Accordion disableGutters elevation={0} sx={{ bgcolor: 'transparent' }}>
                                                                <AccordionSummary expandIcon={<IconExpandMore />} sx={{ px: 3, py: 1 }}>
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        {selectedLog.response ? `${selectedLog.response.length.toLocaleString()} 字符` : '无响应'}
                                                                    </Typography>
                                                                </AccordionSummary>
                                                                <AccordionDetails sx={{ px: 3, py: 2, bgcolor: 'background.default' }}>
                                                                    <JsonHighlighter content={selectedLog.response} theme={theme} />
                                                                </AccordionDetails>
                                                            </Accordion>
                                                        </Card>
                                                    </Box>
                                                </Box>
                                            </Box>
                                        )}
                                    </Box>
                                )}

                                {/* Tab 1: Raw Prompt - Pre-formatted text */}
                                {activeTab === 1 && (
                                    <Paper
                                        variant="outlined"
                                        sx={{
                                            bgcolor: 'background.default',
                                            borderRadius: 4,
                                            overflow: 'hidden',
                                            position: 'relative'
                                        }}
                                    >
                                        <Tooltip title="复制完整 Prompt">
                                            <IconButton
                                                onClick={() => handleCopyToClipboard(selectedLog.fullPrompt || '')}
                                                size="small"
                                                sx={{
                                                    position: 'absolute',
                                                    top: 12,
                                                    right: 12,
                                                    bgcolor: 'background.paper',
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    zIndex: 2,
                                                    '&:hover': { bgcolor: 'action.hover' }
                                                }}
                                            >
                                                <IconCopy fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <SyntaxHighlighter
                                            language="json"
                                            style={theme.palette.mode === 'dark' ? atomOneDark : atomOneLight}
                                            customStyle={{
                                                margin: 0,
                                                padding: 24,
                                                fontSize: 13,
                                                lineHeight: 1.6,
                                                background: 'transparent',
                                                borderRadius: 0,
                                            }}
                                            wrapLongLines
                                            showLineNumbers={false}
                                        >
                                            {selectedLog.fullPrompt || '无 Prompt 内容'}
                                        </SyntaxHighlighter>
                                    </Paper>
                                )}

                                {/* Tab 2: Model Response - JSON syntax highlighting or Image */}
                                {activeTab === 2 && (
                                    <Paper
                                        variant="outlined"
                                        sx={{
                                            bgcolor: 'background.default',
                                            borderRadius: 4,
                                            overflow: 'hidden',
                                            position: 'relative'
                                        }}
                                    >
                                        {/* Check if response is an image */}
                                        {selectedLog.response && (
                                            selectedLog.response.startsWith('data:image') ||
                                            /\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(selectedLog.response) ||
                                            selectedLog.response.includes('/api/images/')
                                        ) ? (
                                            <Box sx={{ p: 4, textAlign: 'center' }}>
                                                <img
                                                    src={selectedLog.response}
                                                    alt="生成的图像"
                                                    style={{
                                                        maxWidth: '100%',
                                                        maxHeight: 500,
                                                        borderRadius: 12,
                                                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
                                                    }}
                                                />
                                                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                                                    {selectedLog.action || '生成的图像'}
                                                </Typography>
                                            </Box>
                                        ) : (
                                            <>
                                                <Tooltip title="复制 Response">
                                                    <IconButton
                                                        onClick={() => handleCopyToClipboard(selectedLog.response || '')}
                                                        size="small"
                                                        sx={{
                                                            position: 'absolute',
                                                            top: 12,
                                                            right: 12,
                                                            bgcolor: 'background.paper',
                                                            border: '1px solid',
                                                            borderColor: 'divider',
                                                            zIndex: 2,
                                                            '&:hover': { bgcolor: 'action.hover' }
                                                        }}
                                                    >
                                                        <IconCopy fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <SyntaxHighlighter
                                                    language="json"
                                                    style={theme.palette.mode === 'dark' ? atomOneDark : atomOneLight}
                                                    customStyle={{
                                                        margin: 0,
                                                        padding: 24,
                                                        fontSize: 13,
                                                        lineHeight: 1.6,
                                                        background: 'transparent',
                                                        borderRadius: 0,
                                                    }}
                                                    wrapLongLines
                                                    showLineNumbers={false}
                                                >
                                                    {selectedLog.response || '无响应内容'}
                                                </SyntaxHighlighter>
                                            </>
                                        )}
                                    </Paper>
                                )}
                            </>
                        ) : (
                            <Box sx={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'text.secondary' }}>
                                <IconCode sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                                <Typography>请选择一条日志查看详情</Typography>
                            </Box>
                        )}
                    </Box>
                </Box>
            </Box>

            {/* Right Panel */}
            <Collapse in={showRefPanel} orientation="horizontal" sx={{ height: '100%', flexShrink: 0 }}>
                <Box sx={{ width: 300, minWidth: 300, flexShrink: 0, height: '100%', borderLeft: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                            <Typography variant="subtitle2" fontWeight="bold">日志详情</Typography>
                            <Typography variant="caption" color="text.secondary">快速操作与统计</Typography>
                        </Box>
                        <IconButton size="small" onClick={() => setShowRefPanel(false)}><IconChevronLeft /></IconButton>
                    </Box>
                    <Box sx={{ flexGrow: 1, overflowY: 'auto', scrollbarGutter: 'stable', p: 2 }}>
                        {rightPanelContent}
                    </Box>
                </Box>
            </Collapse>
        </Box >
    );
};
