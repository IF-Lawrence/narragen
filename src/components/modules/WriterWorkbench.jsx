import React, { useState, useEffect, useRef } from 'react';
import {
    Box, Paper, Typography, IconButton, Button, Card,
    TextField, Stack, List, ListItem, ListItemButton, ListItemText,
    Collapse, Checkbox, Dialog, DialogTitle, DialogContent,
    DialogActions, Snackbar, Alert, Tabs, Tab, CircularProgress,
    Divider, Tooltip, Menu, MenuItem, Fade, Chip, Avatar, Accordion,
    AccordionSummary, AccordionDetails, Stepper, Step, StepLabel, StepConnector
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreRounded';
import {
    EditRounded as IconEdit,
    SaveRounded as IconSave,
    SmartToyRounded as IconRobot,
    PersonRounded as IconPerson,
    SettingsRounded as IconSettings,
    MenuRounded as IconMenu,
    ChevronRightRounded as IconRight,
    ChevronLeftRounded as IconLeft,
    InfoRounded as IconInfo,
    AutoStoriesRounded as IconBook,
    ExpandMoreRounded as IconDown,
    LocationOnRounded as IconLocation,
    DragIndicatorRounded as IconDragDotVertical,
    CloseRounded as IconClose,
    CheckCircleRounded as IconCheckCircle,
    ErrorRounded as IconErrorCircle,
    WarningRounded as IconWarning,
    LightbulbRounded as IconLightbulb,
    AutoAwesomeRounded as IconSparkles,
    DescriptionRounded as IconFile,
    CompareArrowsRounded as IconCompare,
    TipsAndUpdatesRounded as IconTips,
    ContentCopyRounded as IconCopy,
    PlaylistPlayRounded as IconBatch,
    DeleteOutlineRounded as IconDelete,
    HistoryEduRounded as IconWriter,
    CreateRounded as IconPen
} from '@mui/icons-material';
import { useProject } from '../../contexts/ProjectContext';
import { storage, storageEx } from '../../services/storage';
import { AgentCoordinator } from '../../services/AgentCoordinator';
import {
    isContentGenerating,
    getContentGenerationStatus,
    startBackgroundContentGeneration,
    cancelContentGeneration
} from '../../services/ContentGenerationManager';


import QuickSettingsModal from './QuickSettingsModal';
import { useTheme } from '@mui/material/styles';
import EmptyStateWriter from '../../assets/illustrations/empty-state-writer.gif';

// --- Local Components ---

const BatchGenerateModal = ({ visible, onCancel, onOk, volumes, chapterNodesMap, useAutoContinue, setUseAutoContinue, onClearContent }) => {
    const [selectedChapterIds, setSelectedChapterIds] = useState(new Set());
    const [unifiedWordCount, setUnifiedWordCount] = useState(3000);
    const [perChapterWordCount, setPerChapterWordCount] = useState({}); // { chapterId: wordCount }
    const [usePerChapter, setUsePerChapter] = useState(false);
    const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
    const theme = useTheme();

    // Sort volumes by order and flatten all chapters with volume info for easier access
    const sortedVolumes = [...volumes].sort((a, b) => a.order - b.order);
    const allChapters = sortedVolumes.flatMap(v =>
        (chapterNodesMap[v.id] || []).sort((a, b) => a.order - b.order).map(c => ({ ...c, volumeId: v.id, volumeOrder: v.order }))
    );

    // Check if a chapter is already generated (has content)
    const isChapterGenerated = (chapter) => !!(chapter.content && chapter.content.trim().length > 0);

    // Check if a chapter can be selected (all previous chapters must be selected or generated)
    const canSelectChapter = (chapter, index) => {
        // Check entire chain from start to this chapter
        for (let i = 0; i < index; i++) {
            const prevChapter = allChapters[i];
            const isPrevGenerated = isChapterGenerated(prevChapter);
            const isPrevSelected = selectedChapterIds.has(prevChapter.id);
            if (!isPrevGenerated && !isPrevSelected) {
                return false; // Chain is broken
            }
        }
        return true;
    };

    // Handle chapter selection with dependency cascade
    const handleChapterToggle = (chapter, index, checked) => {
        const next = new Set(selectedChapterIds);
        if (checked) {
            next.add(chapter.id);
            // Initialize per-chapter word count if not set
            if (!perChapterWordCount[chapter.id]) {
                setPerChapterWordCount(prev => ({ ...prev, [chapter.id]: unifiedWordCount }));
            }
        } else {
            next.delete(chapter.id);
            // Uncheck all subsequent chapters that depend on this one
            for (let i = index + 1; i < allChapters.length; i++) {
                const c = allChapters[i];
                if (isChapterGenerated(c)) break; // Stop at already generated chapters
                next.delete(c.id);
            }
        }
        setSelectedChapterIds(next);
    };

    // Handle volume select all
    const handleVolumeSelect = (volId, checked) => {
        const volChapters = allChapters.filter(c => c.volumeId === volId);
        const next = new Set(selectedChapterIds);

        if (checked) {
            // Select all selectable chapters in this volume
            volChapters.forEach((chapter, i) => {
                const globalIndex = allChapters.findIndex(c => c.id === chapter.id);
                if (canSelectChapter(chapter, globalIndex) || next.has(allChapters[globalIndex - 1]?.id)) {
                    next.add(chapter.id);
                    if (!perChapterWordCount[chapter.id]) {
                        setPerChapterWordCount(prev => ({ ...prev, [chapter.id]: unifiedWordCount }));
                    }
                }
            });
        } else {
            // Deselect all in this volume
            volChapters.forEach(chapter => next.delete(chapter.id));
            // Also deselect subsequent chapters in later volumes that depend on this volume
            const lastChapterInVol = volChapters[volChapters.length - 1];
            if (lastChapterInVol) {
                const lastIndex = allChapters.findIndex(c => c.id === lastChapterInVol.id);
                for (let i = lastIndex + 1; i < allChapters.length; i++) {
                    const c = allChapters[i];
                    if (isChapterGenerated(c)) break;
                    next.delete(c.id);
                }
            }
        }
        setSelectedChapterIds(next);
    };

    // Handle select all
    const handleSelectAll = (checked) => {
        if (checked) {
            // Select all chapters (they'll all be in sequence)
            const newSet = new Set(allChapters.map(c => c.id));
            setSelectedChapterIds(newSet);
            // Initialize all word counts
            const newWordCounts = {};
            allChapters.forEach(c => {
                newWordCounts[c.id] = perChapterWordCount[c.id] || unifiedWordCount;
            });
            setPerChapterWordCount(newWordCounts);
        } else {
            setSelectedChapterIds(new Set());
        }
    };

    // Apply unified word count to all selected chapters
    const applyUnifiedToAll = () => {
        const newWordCounts = { ...perChapterWordCount };
        selectedChapterIds.forEach(id => {
            newWordCounts[id] = unifiedWordCount;
        });
        setPerChapterWordCount(newWordCounts);
    };

    // Get word count for a chapter
    const getChapterWordCount = (chapterId) => {
        if (usePerChapter && perChapterWordCount[chapterId]) {
            return perChapterWordCount[chapterId];
        }
        return unifiedWordCount;
    };

    const selectedCount = selectedChapterIds.size;
    const totalCount = allChapters.length;

    // Build config object for onOk
    const buildConfig = () => {
        const config = {};
        selectedChapterIds.forEach(id => {
            config[id] = getChapterWordCount(id);
        });
        return config;
    };

    return (
        <Dialog open={!!visible} onClose={onCancel} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 2 } }}>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, fontWeight: 'bold' }}>
                <IconRobot color="primary" />
                批量生成章节正文
            </DialogTitle>
            <DialogContent>
                {/* Word Count Config */}
                <Card variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 3, bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                    <Stack spacing={2}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography variant="subtitle2" fontWeight="bold">字数设置</Typography>
                            <Stack direction="row" alignItems="center" spacing={1}>
                                <Typography variant="caption" color="text.secondary">单独设置每章</Typography>
                                <Checkbox
                                    checked={usePerChapter}
                                    onChange={(e) => setUsePerChapter(e.target.checked)}
                                    size="small"
                                />
                            </Stack>
                        </Stack>

                        <Stack direction="row" alignItems="center" spacing={2}>
                            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                                {usePerChapter ? '默认字数：' : '统一字数：'}
                            </Typography>
                            <TextField
                                type="number"
                                size="small"
                                value={unifiedWordCount}
                                onChange={(e) => setUnifiedWordCount(e.target.value === '' ? '' : Number(e.target.value))}
                                onBlur={(e) => {
                                    const val = Number(e.target.value);
                                    if (!val || val < 500) setUnifiedWordCount(500);
                                    else if (val > 10000) setUnifiedWordCount(10000);
                                }}
                                inputProps={{ min: 500, max: 10000, step: 500 }}
                                sx={{ width: 120 }}
                            />
                            <Typography variant="caption" color="text.secondary">字</Typography>
                            {usePerChapter && selectedCount > 0 && (
                                <Button size="small" variant="text" onClick={applyUnifiedToAll}>
                                    应用到所有已选
                                </Button>
                            )}
                        </Stack>
                    </Stack>
                </Card>

                {/* Auto-Continue Config */}
                <Card variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 3, bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box>
                            <Typography variant="subtitle2" fontWeight="bold">自动续写</Typography>
                            <Typography variant="caption" color="text.secondary">
                                当输出被截断时自动续写，适合长篇内容
                            </Typography>
                        </Box>
                        <Checkbox
                            checked={useAutoContinue}
                            onChange={(e) => setUseAutoContinue(e.target.checked)}
                        />
                    </Stack>
                </Card>

                {/* Select All */}
                <Box sx={{ mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Stack direction="row" alignItems="center">
                            <Checkbox
                                onChange={(e) => handleSelectAll(e.target.checked)}
                                checked={selectedCount === totalCount && totalCount > 0}
                                indeterminate={selectedCount > 0 && selectedCount < totalCount}
                            />
                            <Typography fontWeight="bold">全选</Typography>
                        </Stack>
                        <Chip
                            label={`${selectedCount} / ${totalCount} 章`}
                            size="small"
                            color={selectedCount > 0 ? 'primary' : 'default'}
                        />
                    </Stack>
                </Box>

                {/* Volume List */}
                <Box sx={{ maxHeight: '40vh', overflow: 'auto' }}>
                    <Stack spacing={2}>
                        {sortedVolumes.map(vol => {
                            const chapters = allChapters.filter(c => c.volumeId === vol.id);
                            if (chapters.length === 0) return null;

                            const selectedInVol = chapters.filter(c => selectedChapterIds.has(c.id)).length;
                            const allSelected = selectedInVol === chapters.length;
                            const indeterminate = selectedInVol > 0 && !allSelected;

                            return (
                                <Card key={vol.id} variant="outlined" sx={{
                                    p: 2,
                                    borderRadius: 3,
                                    borderColor: selectedInVol > 0 ? 'primary.main' : 'divider',
                                    bgcolor: selectedInVol > 0 ? alpha(theme.palette.primary.main, 0.02) : 'transparent',
                                    transition: 'all 0.2s ease'
                                }}>
                                    {/* Volume Header */}
                                    <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
                                        <Checkbox
                                            onChange={(e) => handleVolumeSelect(vol.id, e.target.checked)}
                                            checked={allSelected}
                                            indeterminate={indeterminate}
                                        />
                                        <Typography variant="subtitle1" fontWeight="bold">
                                            第 {vol.order} 卷：{vol.name || vol.title}
                                        </Typography>
                                        {selectedInVol > 0 && (
                                            <Chip label={`${selectedInVol}章`} size="small" sx={{ ml: 1 }} color="primary" variant="outlined" />
                                        )}
                                    </Stack>

                                    {/* Chapter Grid */}
                                    <Box sx={{ pl: 2 }}>
                                        {chapters.map(chapter => {
                                            const globalIndex = allChapters.findIndex(c => c.id === chapter.id);
                                            const isGenerated = isChapterGenerated(chapter);
                                            const canSelect = canSelectChapter(chapter, globalIndex);
                                            const isSelected = selectedChapterIds.has(chapter.id);
                                            const isDisabled = !canSelect && !isSelected;

                                            return (
                                                <Stack
                                                    key={chapter.id}
                                                    direction="row"
                                                    alignItems="center"
                                                    sx={{
                                                        p: 1,
                                                        borderRadius: 2,
                                                        bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                                                        opacity: isDisabled ? 0.5 : 1,
                                                        transition: 'all 0.15s ease',
                                                        mb: 0.5
                                                    }}
                                                >
                                                    <Checkbox
                                                        checked={isSelected}
                                                        disabled={isDisabled}
                                                        onChange={(e) => handleChapterToggle(chapter, globalIndex, e.target.checked)}
                                                        size="small"
                                                    />
                                                    <Typography
                                                        variant="body2"
                                                        noWrap
                                                        sx={{
                                                            flex: 1,
                                                            color: isDisabled ? 'text.disabled' : 'text.primary'
                                                        }}
                                                    >
                                                        第 {chapter.order} 章：{chapter.title}
                                                    </Typography>
                                                    {isGenerated && (
                                                        <Chip label="已生成" size="small" color="success" variant="outlined" sx={{ ml: 0.5, height: 20, fontSize: '0.65rem' }} />
                                                    )}
                                                    {/* Per-chapter word count input */}
                                                    {usePerChapter && isSelected && (
                                                        <TextField
                                                            type="number"
                                                            size="small"
                                                            value={perChapterWordCount[chapter.id] ?? unifiedWordCount}
                                                            onChange={(e) => {
                                                                setPerChapterWordCount(prev => ({
                                                                    ...prev,
                                                                    [chapter.id]: e.target.value === '' ? '' : Number(e.target.value)
                                                                }));
                                                            }}
                                                            onBlur={(e) => {
                                                                const val = Number(e.target.value);
                                                                if (!val || val < 500) {
                                                                    setPerChapterWordCount(prev => ({ ...prev, [chapter.id]: 500 }));
                                                                } else if (val > 10000) {
                                                                    setPerChapterWordCount(prev => ({ ...prev, [chapter.id]: 10000 }));
                                                                }
                                                            }}
                                                            inputProps={{ min: 500, max: 10000, step: 500 }}
                                                            sx={{ width: 100, ml: 1 }}
                                                        />
                                                    )}
                                                </Stack>
                                            );
                                        })}
                                    </Box>
                                </Card>
                            );
                        })}
                    </Stack>
                </Box>

                {/* Tip */}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
                    💡 提示：章节需按顺序生成，需先选择或已生成前一章才能选择当前章节
                </Typography>
            </DialogContent>
            <DialogActions sx={{ justifyContent: 'space-between', p: 2, pt: 0 }}>
                <Button
                    onClick={() => setClearConfirmOpen(true)}
                    color="error"
                    disabled={selectedCount === 0}
                    sx={{ borderRadius: 999 }}
                >
                    清除已选内容
                </Button>
                <Stack direction="row" spacing={1}>
                    <Button onClick={onCancel} sx={{ borderRadius: 999 }}>取消</Button>
                    <Button
                        onClick={() => onOk(Array.from(selectedChapterIds), buildConfig())}
                        variant="contained"
                        disabled={selectedCount === 0}
                        sx={{ borderRadius: 999, boxShadow: 'none' }}
                    >
                        开始生成 ({selectedCount}章)
                    </Button>
                </Stack>
            </DialogActions>

            {/* Clear Confirmation Dialog */}
            <Dialog open={clearConfirmOpen} onClose={() => setClearConfirmOpen(false)} PaperProps={{ sx: { borderRadius: 4, p: 2 } }}>
                <DialogTitle sx={{ fontWeight: 'bold', color: 'error.main' }}>⚠️ 确认清除</DialogTitle>
                <DialogContent>
                    <Typography>
                        确定要清除已选的 <strong>{selectedCount}</strong> 章的正文内容吗？此操作不可撤销。
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setClearConfirmOpen(false)} sx={{ borderRadius: 999 }}>取消</Button>
                    <Button
                        onClick={() => {
                            setClearConfirmOpen(false);
                            if (onClearContent) {
                                onClearContent(Array.from(selectedChapterIds));
                            }
                        }}
                        color="error"
                        variant="contained"
                        sx={{ borderRadius: 999 }}
                    >
                        确认清除
                    </Button>
                </DialogActions>
            </Dialog>
        </Dialog>
    );
};



// --- Main Component ---

export const WriterWorkbench = ({ isVisible = true }) => {
    const { currentProject } = useProject();
    const theme = useTheme();

    // State
    const [volumes, setVolumes] = useState([]);
    const [chapterNodesMap, setChapterNodesMap] = useState({});
    const [selectedChapterId, setSelectedChapterId] = useState(null);
    const [selectedChapter, setSelectedChapter] = useState(null);
    const [editorContent, setEditorContent] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationStage, setGenerationStage] = useState('');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [bottomDrawerOpen, setBottomDrawerOpen] = useState(true); // Default open for right panel
    const [bottomDrawerTab, setBottomDrawerTab] = useState(0); // 0: scenes, 1: characters, 2: activities...
    const [targetLength, setTargetLength] = useState(4000);
    const [useAutoContinue, setUseAutoContinue] = useState(true); // 自动续写开关，默认开启
    const [characters, setCharacters] = useState([]);
    const [deviation, setDeviation] = useState(null);
    const [activitiesMap, setActivitiesMap] = useState({}); // Keyed by chapterId
    const [draftText, setDraftText] = useState('');
    const [characterUpdates, setCharacterUpdates] = useState([]);
    const [batchModalVisible, setBatchModalVisible] = useState(false);
    const [isBatchGenerating, setIsBatchGenerating] = useState(false);
    const [batchQueue, setBatchQueue] = useState([]);
    const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
    const [currentBatchChapter, setCurrentBatchChapter] = useState(null);

    const [quickSettingsVisible, setQuickSettingsVisible] = useState(false);
    const [generationMode, setGenerationMode] = useState('full');
    const [genModeAnchor, setGenModeAnchor] = useState(null); // 生成模式菜单锚点

    // Snackbar state
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
    const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'unsaved'

    // UI Persistence
    const [columnWidths, setColumnWidths] = useState(() => {
        const saved = localStorage.getItem('writerWorkbenchColumnWidths');
        return saved ? JSON.parse(saved) : { sider: 260 };
    });
    // Removed bottomDrawerHeight state as we use fixed width for right panel now

    // Refs
    const coordinatorRef = useRef(new AgentCoordinator());
    const abortControllerRef = useRef(null);
    const selectedChapterIdRef = useRef(selectedChapterId);
    const autoSaveTimeoutRef = useRef(null);
    const isInitialLoadRef = useRef(true);

    // Effects
    useEffect(() => {
        localStorage.setItem('writerWorkbenchColumnWidths', JSON.stringify(columnWidths));
    }, [columnWidths]);

    useEffect(() => {
        if (currentProject && isVisible) {
            loadData();
        }
    }, [currentProject, isVisible]);

    useEffect(() => {
        selectedChapterIdRef.current = selectedChapterId;
        if (selectedChapterId) {
            loadChapterContent(selectedChapterId);
        } else {
            setSelectedChapter(null);
            setEditorContent('');
        }
    }, [selectedChapterId]);

    // 监听后台正文生成任务事件 - 用于恢复 UI 状态
    useEffect(() => {
        const handleContentGenStatus = (event) => {
            const { projectId, chapterNumber, status, stage, content, error, wordCount } = event.detail;

            // 只处理当前项目的事件
            if (projectId !== currentProject?.id) return;

            // 查找对应的章节
            const allChapters = volumes.flatMap(v => chapterNodesMap[v.id] || []);
            const targetChapter = allChapters.find(c => c.order === chapterNumber);
            if (!targetChapter) return;

            console.log(`[WriterWorkbench] Background gen event: ${status}`, { chapterNumber, stage });

            switch (status) {
                case 'start':
                    setIsGenerating(true);
                    setGenerationStage('context');
                    break;

                case 'progress':
                    setGenerationStage(getStageLabel(stage));
                    break;

                case 'streaming':
                    // 流式内容更新 - 只更新当前选中的章节
                    if (targetChapter.id === selectedChapterIdRef.current) {
                        setEditorContent(content);
                    }
                    break;

                case 'success':
                    setIsGenerating(false);
                    setGenerationStage('');
                    // 刷新数据以获取最新内容
                    loadData();
                    // 如果当前选中的就是这个章节，更新编辑器
                    if (targetChapter.id === selectedChapterIdRef.current && content) {
                        setEditorContent(content);
                    }
                    showSnackbar(`第${chapterNumber}章生成完成 (${wordCount}字)`, 'success');
                    break;

                case 'error':
                    setIsGenerating(false);
                    setGenerationStage('');
                    showSnackbar(`第${chapterNumber}章生成失败: ${error}`, 'error');
                    break;

                case 'cancelled':
                    setIsGenerating(false);
                    setGenerationStage('');
                    showSnackbar(`第${chapterNumber}章生成已取消`);
                    break;
            }
        };

        window.addEventListener('narragen-content-gen-status', handleContentGenStatus);

        // 组件挂载时检查是否有正在运行的任务
        if (currentProject?.id && selectedChapter) {
            const isRunning = isContentGenerating(currentProject.id, selectedChapter.order);
            if (isRunning) {
                console.log('[WriterWorkbench] Reconnecting to running background task...');
                setIsGenerating(true);
                const cachedStatus = getContentGenerationStatus(currentProject.id, selectedChapter.order);
                if (cachedStatus?.stage) {
                    setGenerationStage(getStageLabel(cachedStatus.stage));
                }
            }
        }

        return () => window.removeEventListener('narragen-content-gen-status', handleContentGenStatus);
    }, [currentProject?.id, volumes, chapterNodesMap, selectedChapter]);

    useEffect(() => {
        if (!selectedChapter || !editorContent) return;
        const autoSaveTimer = setTimeout(() => {
            console.log('[WriterWorkbench] Auto-saving...');
            handleSave();
        }, 2000);
        return () => clearTimeout(autoSaveTimer);
    }, [editorContent, selectedChapter]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                if (selectedChapter) {
                    handleSave();
                    showSnackbar('已保存', 'success');
                }
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                if (selectedChapter && !isGenerating) {
                    setQuickSettingsVisible(true);
                }
            }
            if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
                e.preventDefault();
                setSidebarCollapsed(prev => !prev);
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
                e.preventDefault();
                setBottomDrawerOpen(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedChapter, isGenerating]);

    // --- Logic Functions ---

    const showSnackbar = (message, severity = 'info') => {
        setSnackbar({ open: true, message, severity });
    };

    const loadData = async () => {
        try {
            const vols = await storageEx.getVolumes(currentProject.id);
            setVolumes(vols.sort((a, b) => a.order - b.order));
            const nodesMap = {};
            for (const v of vols) {
                const nodes = await storageEx.getChapterNodesByVolume(v.id);
                nodesMap[v.id] = nodes.sort((a, b) => a.order - b.order);
            }
            setChapterNodesMap(nodesMap);
            const chars = await storage.getItemsByProject('characters', currentProject.id);
            setCharacters(chars);
        } catch (error) {
            console.error('[WriterWorkbench] Failed to load data:', error);
        }
    };

    const loadChapterContent = async (chapterId) => {
        try {
            let node = null;
            let volId = null;
            for (const vid in chapterNodesMap) {
                const found = chapterNodesMap[vid].find(n => n.id === chapterId);
                if (found) {
                    node = found;
                    volId = vid;
                    break;
                }
            }
            if (node) {
                setSelectedChapter({ ...node, volumeId: volId });
                setEditorContent(node.content || '');

                // 加载该章节的历史活动记录
                try {
                    const activities = await storage.getActivitiesByChapter(chapterId);
                    if (activities && activities.length > 0) {
                        // 按创建时间排序
                        activities.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

                        // 修正历史记录中遗留的 processing 状态为 success
                        // (如果正在加载历史数据，说明任务已结束，不应有 processing 状态)
                        const actionFixMap = {
                            '正在规划场景结构...': '场景结构规划完成',
                            '正在撰写初稿...': '初稿完成',
                            '正在分析初稿偏差...': '偏差分析完成',
                            '正在润色文字...': '润色完成',
                            '正在更新角色状态...': '角色状态更新完成'
                        };
                        const fixedActivities = activities.map(activity => {
                            if (activity.status === 'processing') {
                                // 优先使用精确匹配，否则使用动态匹配
                                let fixedAction = actionFixMap[activity.action];
                                if (!fixedAction) {
                                    // 处理动态 action 文本（如 "自动续写中 (第2次)..."）
                                    if (activity.action.startsWith('自动续写中')) {
                                        fixedAction = '初稿完成（含续写）';
                                    } else if (activity.action.startsWith('润色续写中')) {
                                        fixedAction = '润色完成（含续写）';
                                    } else {
                                        // 通用 fallback：移除末尾省略号并添加中断标记
                                        fixedAction = activity.action.replace(/\.{2,}$/, '') + '（已中断）';
                                    }
                                }
                                const fixed = { ...activity, status: 'success', action: fixedAction };
                                // 同步更新数据库
                                storage.updateActivity(fixed).catch(err =>
                                    console.error('[WriterWorkbench] Failed to fix activity status:', err)
                                );
                                return fixed;
                            }
                            return activity;
                        });

                        setActivitiesMap(prev => ({
                            ...prev,
                            [chapterId]: fixedActivities
                        }));
                    }
                } catch (actError) {
                    console.error('[WriterWorkbench] Failed to load activities:', actError);
                }
            }
        } catch (error) {
            console.error('[WriterWorkbench] loadChapterContent error:', error);
        }
    };

    const handleSave = async () => {
        if (!selectedChapter) return;
        try {
            await storage.updateItem('chapter_nodes', {
                ...selectedChapter,
                content: editorContent,
                updatedAt: new Date().toISOString()
            });
            setChapterNodesMap(prev => {
                const newMap = { ...prev };
                const list = newMap[selectedChapter.volumeId];
                const idx = list.findIndex(n => n.id === selectedChapter.id);
                if (idx !== -1) {
                    list[idx] = { ...list[idx], content: editorContent };
                }
                return newMap;
            });
        } catch (error) {
            console.error('[WriterWorkbench] Save failed', error);
            showSnackbar('保存失败: ' + error.message, 'error');
        }
    };

    // Auto-save effect: debounce 2 seconds after content changes
    useEffect(() => {
        // Skip auto-save on initial load or when no chapter is selected
        if (isInitialLoadRef.current || !selectedChapter) {
            isInitialLoadRef.current = false;
            return;
        }

        // Clear previous timeout
        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
        }

        // Set new timeout for auto-save
        setSaveStatus('unsaved');
        autoSaveTimeoutRef.current = setTimeout(async () => {
            setSaveStatus('saving');
            try {
                await storage.updateItem('chapter_nodes', {
                    ...selectedChapter,
                    content: editorContent,
                    updatedAt: new Date().toISOString()
                });
                setChapterNodesMap(prev => {
                    const newMap = { ...prev };
                    const list = newMap[selectedChapter.volumeId];
                    if (list) {
                        const idx = list.findIndex(n => n.id === selectedChapter.id);
                        if (idx !== -1) {
                            list[idx] = { ...list[idx], content: editorContent };
                        }
                    }
                    return newMap;
                });
                setSaveStatus('saved');
                console.log('[WriterWorkbench] Auto-saved');
            } catch (error) {
                console.error('[WriterWorkbench] Auto-save failed', error);
                setSaveStatus('unsaved');
            }
        }, 500); // 0.5 second debounce for near real-time saving

        // Cleanup timeout on unmount or dependency change
        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, [editorContent, selectedChapter]);

    // Reset initial load ref when chapter changes
    useEffect(() => {
        isInitialLoadRef.current = true;
    }, [selectedChapterId]);

    const addActivity = async (agent, action, details = '', extraData = null, initialStatus = 'processing', chapterId = null) => {
        const targetId = chapterId || selectedChapterIdRef.current;
        if (!targetId) return;

        const newActivity = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            chapterId: targetId,
            agent,
            time: new Date().toLocaleTimeString(),
            action,
            details,
            status: initialStatus,
            extraData
        };

        setActivitiesMap(prev => {
            const chapterActivities = prev[targetId] || [];
            return {
                ...prev,
                [targetId]: [...chapterActivities, newActivity]
            };
        });

        // 保存到数据库
        try {
            await storage.addActivity(newActivity);
        } catch (error) {
            console.error('[WriterWorkbench] Failed to save activity:', error);
        }

        if (action.includes('失败') || action.includes('错误')) {
            showSnackbar(`${agent}: ${action}`, 'error');
        }
    };


    const updateLastActivityStatus = async (status, chapterId = null) => {
        const targetId = chapterId || selectedChapterIdRef.current;
        if (!targetId) return;
        let activityToUpdate = null;
        setActivitiesMap(prev => {
            const chapterActivities = prev[targetId] || [];
            if (chapterActivities.length === 0) return prev;
            const newActivities = [...chapterActivities];
            newActivities[newActivities.length - 1] = { ...newActivities[newActivities.length - 1], status };
            activityToUpdate = newActivities[newActivities.length - 1];
            return { ...prev, [targetId]: newActivities };
        });
        // 同步更新数据库
        if (activityToUpdate) {
            try {
                await storage.updateActivity(activityToUpdate);
            } catch (error) {
                console.error('[WriterWorkbench] Failed to update activity status:', error);
            }
        }
    };

    const updateLastActivityData = async (dataUpdate, chapterId = null) => {
        const targetId = chapterId || selectedChapterIdRef.current;
        if (!targetId) return;
        let activityToUpdate = null;
        setActivitiesMap(prev => {
            const chapterActivities = prev[targetId] || [];
            if (chapterActivities.length === 0) return prev;
            const newActivities = [...chapterActivities];
            const lastActivity = newActivities[newActivities.length - 1];
            newActivities[newActivities.length - 1] = {
                ...lastActivity,
                extraData: { ...(lastActivity.extraData || {}), ...dataUpdate }
            };
            activityToUpdate = newActivities[newActivities.length - 1];
            return { ...prev, [targetId]: newActivities };
        });
        // 同步更新数据库
        if (activityToUpdate) {
            try {
                await storage.updateActivity(activityToUpdate);
            } catch (error) {
                console.error('[WriterWorkbench] Failed to update activity data:', error);
            }
        }
    };

    // 更新最后一条活动的action和status
    const updateLastActivity = async (newAction, newStatus, extraData = null, chapterId = null) => {
        const targetId = chapterId || selectedChapterIdRef.current;
        if (!targetId) return;

        setActivitiesMap(prev => {
            const chapterActivities = prev[targetId] || [];
            if (chapterActivities.length === 0) return prev;
            const newActivities = [...chapterActivities];
            const lastActivity = newActivities[newActivities.length - 1];
            const updatedActivity = {
                ...lastActivity,
                action: newAction,
                status: newStatus,
                ...(extraData && { extraData: { ...(lastActivity.extraData || {}), ...extraData } })
            };
            newActivities[newActivities.length - 1] = updatedActivity;

            // Sync to database (fire and forget)
            storage.updateActivity(updatedActivity).catch(error =>
                console.error('[WriterWorkbench] Failed to update activity:', error)
            );

            return { ...prev, [targetId]: newActivities };
        });
    };

    // Mark all processing activities as complete (fallback for missed events)
    const markAllActivitiesComplete = async (chapterId) => {
        if (!chapterId) return;

        setActivitiesMap(prev => {
            const chapterActivities = prev[chapterId] || [];
            if (chapterActivities.length === 0) return prev;

            const updatedActivities = chapterActivities.map(activity => {
                if (activity.status === 'processing') {
                    const updated = { ...activity, status: 'success' };
                    // Also update in database (fire and forget)
                    storage.updateActivity(updated).catch(err =>
                        console.error('[WriterWorkbench] Failed to update activity in DB:', err)
                    );
                    return updated;
                }
                return activity;
            });

            return { ...prev, [chapterId]: updatedActivities };
        });
    };

    const handleGenerate = async (chapterId = null, settings = {}) => {
        const targetChapterId = chapterId || selectedChapterId;
        if (!targetChapterId) {
            showSnackbar('请先选择一个章节', 'error');
            return;
        }

        const chapterToGenerate = volumes.flatMap(v => chapterNodesMap[v.id] || []).find(c => c.id === targetChapterId);
        if (!chapterToGenerate) return;

        if (chapterId) setCurrentBatchChapter(chapterToGenerate);

        setIsGenerating(true);
        setGenerationStage('context');

        // Clear previous activities from both memory and database
        setActivitiesMap(prev => ({ ...prev, [targetChapterId]: [] }));
        try {
            await storage.clearActivitiesByChapter(targetChapterId);
        } catch (err) {
            console.error('[WriterWorkbench] Failed to clear old activities:', err);
        }
        setDraftText('');
        setDeviation(null);
        setCharacterUpdates([]);

        abortControllerRef.current = new AbortController();

        const genSettings = {
            targetLength: settings.targetLength || targetLength,
            passionLevel: settings.passionLevel || 3,
            useExistingOutline: settings.useExistingOutline !== false,
            mode: settings.mode || generationMode,
            signal: abortControllerRef.current.signal,
            useAutoContinue: useAutoContinue, // 传递自动续写开关
        };

        try {
            const getScenes = () => {
                if (chapterToGenerate.summary) {
                    try {
                        const parsed = JSON.parse(chapterToGenerate.summary);
                        return parsed.scenes || parsed;
                    } catch (e) {
                        console.warn('Failed to parse scenes', e);
                    }
                }
                return null;
            };

            const scenes = genSettings.useExistingOutline ? getScenes() : null;

            const stream = coordinatorRef.current.executeChapterFlowStream(
                currentProject.id,
                chapterToGenerate.order,
                {
                    signal: abortControllerRef.current.signal,
                    length: genSettings.targetLength,
                    scenes: scenes,
                    mode: genSettings.mode,
                    passionLevel: genSettings.passionLevel,
                    currentText: editorContent,
                    useAutoContinue: genSettings.useAutoContinue
                }
            );

            let finalStyledText = '';
            const characterUpdatesAccumulator = [];

            for await (const event of stream) {
                if (event.type === 'stage') {
                    setGenerationStage(getStageLabel(event.stage));
                    updateLastActivityStatus('success', chapterToGenerate.id);

                    switch (event.stage) {
                        case 'plan':
                            addActivity('Planner Agent', '正在规划场景结构...', '', { scenes: event.data?.scenes }, 'processing', chapterToGenerate.id);
                            break;
                        case 'planComplete':
                            updateLastActivity('场景结构规划完成', 'success', { scenes: event.data?.scenes }, chapterToGenerate.id);
                            break;
                        case 'writer':
                            addActivity('Writer Agent', '正在撰写初稿...', '', null, 'processing', chapterToGenerate.id);
                            break;
                        case 'writerContinue':
                            // 自动续写进度更新
                            updateLastActivity(
                                `自动续写中 (第${event.data?.retryCount}次)... ${event.data?.currentLength}/${event.data?.targetLength}字`,
                                'processing',
                                null,
                                chapterToGenerate.id
                            );
                            break;
                        case 'writerComplete':
                            updateLastActivity('初稿完成', 'success', null, chapterToGenerate.id);
                            break;
                        case 'analysis':
                            addActivity('Planner Agent', '正在分析初稿偏差...', '', null, 'processing', chapterToGenerate.id);
                            break;
                        case 'analysisComplete':
                            setDeviation(event.data?.deviation);
                            updateLastActivity('偏差分析完成', 'success', { deviation: event.data?.deviation }, chapterToGenerate.id);
                            break;
                        case 'stylist':
                            addActivity('Stylist Agent', '正在润色文字...', '', null, 'processing', chapterToGenerate.id);
                            break;
                        case 'stylistContinue':
                            // 润色自动续写进度更新
                            updateLastActivity(
                                `润色续写中 (第${event.data?.retryCount}次)... ${event.data?.currentLength}/${event.data?.targetLength}字`,
                                'processing',
                                null,
                                chapterToGenerate.id
                            );
                            break;
                        case 'stylistComplete':
                            updateLastActivity('润色完成', 'success', null, chapterToGenerate.id);
                            break;
                        case 'updatingCharacters':
                            addActivity('System', '正在更新角色状态...', '', null, 'processing', chapterToGenerate.id);
                            break;
                        case 'updatingCharactersComplete':
                            updateLastActivity('角色状态更新完成', 'success', null, chapterToGenerate.id);
                            break;
                    }
                } else if (event.type === 'chunk') {
                    if (event.stage === 'writer' && event.fullContent) {
                        setDraftText(event.fullContent);
                        // Also show draft in editor for real-time streaming display
                        if (chapterToGenerate.id === selectedChapterIdRef.current) {
                            setEditorContent(event.fullContent);
                        }
                    }
                    if (event.stage === 'stylist' && event.fullContent) {
                        finalStyledText = event.fullContent;
                        if (chapterToGenerate.id === selectedChapterIdRef.current) {
                            setEditorContent(finalStyledText);
                        }
                    }
                } else if (event.type === 'critic') {
                    addActivity('Critic Agent', '质量评审完成', '', { critique: event.data }, 'success', chapterToGenerate.id);
                } else if (event.type === 'characterUpdate') {
                    if (event.data) {
                        setCharacterUpdates(prev => [...prev, event.data]);
                        characterUpdatesAccumulator.push(event.data);
                        updateLastActivityData({ characterUpdates: [...characterUpdatesAccumulator] }, chapterToGenerate.id);
                    }
                }
            }

            updateLastActivityStatus('success', chapterToGenerate.id);
            // Ensure all activities are marked complete (fallback for any missed Complete events)
            markAllActivitiesComplete(chapterToGenerate.id);
            addActivity('System', '生成任务完成', '', null, 'success', chapterToGenerate.id);

            await loadData();

            if (finalStyledText) {
                await storage.updateItem('chapter_nodes', {
                    ...chapterToGenerate,
                    content: finalStyledText,
                    updatedAt: new Date().toISOString()
                });

                if (chapterToGenerate.id === selectedChapterIdRef.current) {
                    setEditorContent(finalStyledText);
                }
                setChapterNodesMap(prev => {
                    const newMap = { ...prev };
                    const list = newMap[chapterToGenerate.volumeId];
                    const idx = list.findIndex(n => n.id === chapterToGenerate.id);
                    if (idx !== -1) {
                        list[idx] = { ...list[idx], content: finalStyledText };
                    }
                    return newMap;
                });
            } else {
                showSnackbar('生成的内容为空', 'warning');
            }

        } catch (error) {
            if (error.message === 'aborted') {
                updateLastActivityStatus('warning', chapterToGenerate.id);
                addActivity('System', '任务已停止', '用户手动取消', null, 'warning', chapterToGenerate.id);
                showSnackbar('已停止生成');
            } else {
                console.error(error);
                updateLastActivityStatus('error', chapterToGenerate.id);
                addActivity('System', '任务出错', error.message, null, 'error', chapterToGenerate.id);
                showSnackbar('生成出错: ' + error.message, 'error');
            }
        } finally {
            setIsGenerating(false);
            if (targetChapterId) setCurrentBatchChapter(null);
            setGenerationStage('');
            abortControllerRef.current = null;
            // 确保所有残留的 processing 状态被标记为完成（容错机制）
            markAllActivitiesComplete(chapterToGenerate.id);
        }
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        if (isBatchGenerating) {
            setIsBatchGenerating(false);
            setBatchQueue([]);
            showSnackbar('批量生成已停止');
        }
    };

    const [batchWordCountConfig, setBatchWordCountConfig] = useState({});

    const handleBatchStart = (selectedIds, wordCountConfig = {}) => {
        setBatchModalVisible(false);
        if (selectedIds.length === 0) return;
        const allChapters = volumes.flatMap(v => chapterNodesMap[v.id] || []);
        const sortedIds = selectedIds.sort((a, b) => {
            const charA = allChapters.find(c => c.id === a);
            const charB = allChapters.find(c => c.id === b);
            return (charA?.order || 0) - (charB?.order || 0);
        });
        setBatchQueue(sortedIds);
        setBatchWordCountConfig(wordCountConfig);
        setBatchProgress({ current: 0, total: sortedIds.length });
        setIsBatchGenerating(true);
    };

    // 批量清除章节正文内容
    const handleClearChapterContent = async (chapterIds) => {
        if (!chapterIds || chapterIds.length === 0) return;

        try {
            const allChapters = volumes.flatMap(v => chapterNodesMap[v.id] || []);

            for (const id of chapterIds) {
                const chapter = allChapters.find(c => c.id === id);
                if (chapter) {
                    await storage.updateItem('chapter_nodes', {
                        ...chapter,
                        content: '', // 清空正文
                        updatedAt: new Date().toISOString()
                    });
                }
            }

            // 刷新章节列表
            await loadData();

            showSnackbar(`已清除 ${chapterIds.length} 章的正文内容`, 'success');
            setBatchModalVisible(false);
        } catch (err) {
            console.error('Failed to clear chapter content:', err);
            showSnackbar('清除失败: ' + err.message, 'error');
        }
    };

    useEffect(() => {
        if (!isBatchGenerating) return;
        if (isGenerating) return;

        if (batchQueue.length === 0) {
            setIsBatchGenerating(false);
            setBatchWordCountConfig({});
            showSnackbar('批量生成完成', 'success');
            return;
        }

        const nextId = batchQueue[0];
        setBatchQueue(prev => prev.slice(1));

        // Get word count for this chapter from config
        const chapterWordCount = batchWordCountConfig[nextId] || 3000;

        handleGenerate(nextId, { targetLength: chapterWordCount }).then(() => {
            setBatchProgress(prev => ({ ...prev, current: prev.current + 1 }));
        }).catch(err => {
            if (err.message === 'aborted' || err.name === 'AbortError') {
                setIsBatchGenerating(false);
                setBatchQueue([]);
                setBatchWordCountConfig({});
            }
        });
    }, [isBatchGenerating, batchQueue, isGenerating]);


    const getStageLabel = (stage) => {
        const map = {
            'context': '分析上下文...',
            'plan': '规划场景...',
            'writer': '正在撰写...',
            'writerComplete': '初稿完成，开始润色...',
            'stylist': '正在润色...',
            'stylistComplete': '润色完成',
            'analysis': '分析偏差...',
            'archived': '存档中...',
            'updatingCharacters': '更新角色状态...',
            'causality': '提取因果关系...'
        };
        return map[stage] || stage;
    };

    const getScenes = () => {
        if (!selectedChapter || !selectedChapter.summary) return [];
        try {
            const parsed = JSON.parse(selectedChapter.summary);
            return parsed.scenes || [];
        } catch {
            return [];
        }
    };

    // Helper components
    const VolumeItem = ({ volume }) => {
        const [open, setOpen] = useState(true);
        const chapters = chapterNodesMap[volume.id] || [];

        return (
            <Box>
                <ListItemButton onClick={() => setOpen(!open)} sx={{ py: 1 }}>
                    <Box component={open ? IconDown : IconRight} sx={{ mr: 1, fontSize: 18 }} />
                    <Typography fontWeight="bold" variant="subtitle2" noWrap>
                        {volume.name || `第 ${volume.order} 卷`}
                    </Typography>
                </ListItemButton>
                <Collapse in={open} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                        {chapters.map(chapter => (
                            <ListItemButton
                                key={chapter.id}
                                selected={selectedChapterId === chapter.id}
                                onClick={() => setSelectedChapterId(chapter.id)}
                                sx={{ pl: 4, py: 0.5 }}
                            >
                                <ListItemText
                                    primary={`第${chapter.order}章: ${chapter.title}`}
                                    primaryTypographyProps={{
                                        variant: 'body2',
                                        noWrap: true,
                                        fontWeight: selectedChapterId === chapter.id ? 'bold' : 'normal'
                                    }}
                                />
                            </ListItemButton>
                        ))}
                    </List>
                </Collapse>
            </Box>
        );
    };

    const PassionChart = ({ volumeId }) => {
        const chapters = chapterNodesMap[volumeId] || [];
        if (chapters.length === 0) return null;

        const data = chapters.map(c => ({
            id: c.id,
            order: c.order,
            level: c.passionLevel || (c.tension ? Math.ceil(c.tension / 20) : 1)
        })).sort((a, b) => a.order - b.order);

        // Use viewBox for responsive sizing
        const viewBoxWidth = 200;
        const viewBoxHeight = 60;
        const padding = 12;
        const minOrder = Math.min(...data.map(d => d.order));
        const maxOrder = Math.max(...data.map(d => d.order));
        const range = maxOrder - minOrder || 1;

        const getX = (order) => {
            if (data.length === 1) return viewBoxWidth / 2;
            return padding + ((order - minOrder) / range) * (viewBoxWidth - 2 * padding);
        };
        const getY = (level) => viewBoxHeight - padding - ((level - 1) / 4) * (viewBoxHeight - 2 * padding);

        // Create smooth path for line and area
        const linePoints = data.map(d => `${getX(d.order)},${getY(d.level)}`).join(' ');
        const areaPath = `M ${padding},${viewBoxHeight - padding} L ${linePoints} L ${viewBoxWidth - padding},${viewBoxHeight - padding} Z`;

        return (
            <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" fontWeight="medium" sx={{ mb: 1, display: 'block' }}>
                    本卷波动趋势
                </Typography>
                <Box sx={{
                    width: '100%',
                    bgcolor: 'background.default',
                    borderRadius: 2,
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider'
                }}>
                    <svg
                        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
                        style={{ width: '100%', height: 'auto', display: 'block' }}
                        preserveAspectRatio="xMidYMid meet"
                    >
                        <defs>
                            <linearGradient id="passionGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor={theme.palette.primary.main} stopOpacity="0.3" />
                                <stop offset="100%" stopColor={theme.palette.primary.main} stopOpacity="0.02" />
                            </linearGradient>
                        </defs>
                        {/* Background grid lines */}
                        {[1, 3, 5].map(l => (
                            <line
                                key={l}
                                x1={padding}
                                y1={getY(l)}
                                x2={viewBoxWidth - padding}
                                y2={getY(l)}
                                stroke={theme.palette.divider}
                                strokeWidth="0.5"
                                strokeDasharray="2,3"
                            />
                        ))}
                        {/* Area fill */}
                        <polygon
                            points={`${padding},${viewBoxHeight - padding} ${linePoints} ${viewBoxWidth - padding},${viewBoxHeight - padding}`}
                            fill="url(#passionGradient)"
                        />
                        {/* Main line */}
                        <polyline
                            points={linePoints}
                            fill="none"
                            stroke={theme.palette.primary.main}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        {/* Data points */}
                        {data.map(d => {
                            const isSelected = selectedChapterId === d.id;
                            return (
                                <g key={d.id}>
                                    <circle
                                        cx={getX(d.order)}
                                        cy={getY(d.level)}
                                        r={isSelected ? 5 : 4}
                                        fill={isSelected ? theme.palette.primary.main : theme.palette.background.paper}
                                        stroke={theme.palette.primary.main}
                                        strokeWidth="1.5"
                                    />
                                    {isSelected && (
                                        <circle
                                            cx={getX(d.order)}
                                            cy={getY(d.level)}
                                            r="7"
                                            fill="none"
                                            stroke={theme.palette.primary.main}
                                            strokeWidth="1"
                                            opacity="0.3"
                                        />
                                    )}
                                </g>
                            );
                        })}
                    </svg>
                </Box>
            </Box>
        );
    };

    return (
        <Box sx={{
            display: 'flex',
            height: '100%',
            overflow: 'hidden',
            bgcolor: 'background.default'
        }}>
            {/* Left Column: Sidebar (matches PlotArchitecture) */}
            {!sidebarCollapsed && (
                <Box sx={{
                    width: 260,
                    flexShrink: 0,
                    borderRight: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                <IconPen sx={{ mr: 1.5, color: 'primary.main' }} />
                                <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: 'inherit' }}>写作台</Typography>
                            </Box>
                            <Typography variant="caption" color="text.secondary">沉浸式创作与章节管理</Typography>
                        </Box>

                        <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
                            <List>
                                {volumes.map(vol => <VolumeItem key={vol.id} volume={vol} />)}
                            </List>
                        </Box>

                        <Divider sx={{ my: 2 }} />

                        <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                            <Typography variant="caption" color="text.secondary" fontWeight="bold">创作小贴士</Typography>
                            <Typography variant="caption" component="p" color="text.secondary" sx={{ mt: 1 }}>
                                {selectedChapter
                                    ? "使用 AI 写作功能时，可以先设置目标字数和激情水平。"
                                    : "请从左侧选择一个章节开始写作。"
                                }
                            </Typography>
                        </Box>
                    </Box>
                </Box>
            )}

            {/* Center Column: Editor */}
            <Box sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                position: 'relative'
            }}>
                <Box sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}>
                    {/* Top Header & Breadcrumbs (matches PlotArchitecture) */}
                    <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <IconButton size="small" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
                                {sidebarCollapsed ? <IconRight /> : <IconMenu />}
                            </IconButton>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }}>
                                <Typography variant="body2" sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }} onClick={() => setSelectedChapterId(null)}>
                                    写作台
                                </Typography>
                                <IconRight sx={{ fontSize: 16 }} />
                                <Typography variant="body2" color="text.primary" fontWeight="bold">
                                    {selectedChapter?.title || '未选择章节'}
                                </Typography>
                                {selectedChapter && (
                                    <Chip label={`${editorContent.length} 字`} size="small" sx={{ ml: 1, height: 20, fontSize: '0.7rem' }} />
                                )}
                            </Stack>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                            {/* Save Status Indicator */}
                            {selectedChapter && (
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: saveStatus === 'saved' ? 'success.main' : saveStatus === 'saving' ? 'text.secondary' : 'warning.main',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.5,
                                        mr: 1
                                    }}
                                >
                                    {saveStatus === 'saving' && <CircularProgress size={12} sx={{ color: 'inherit' }} />}
                                    {saveStatus === 'saved' ? '已保存' : saveStatus === 'saving' ? '保存中...' : '未保存'}
                                </Typography>
                            )}

                            <Tooltip title={bottomDrawerOpen ? "收起辅助面板" : "展开辅助面板"}>
                                <IconButton
                                    size="small"
                                    onClick={() => setBottomDrawerOpen(!bottomDrawerOpen)}
                                    color={bottomDrawerOpen ? 'primary' : 'default'}
                                >
                                    <IconInfo />
                                </IconButton>
                            </Tooltip>
                        </Stack>
                    </Box>

                    {/* Agent Status Stepper (matches PlotArchitecture exactly) */}
                    {(() => {
                        const activities = selectedChapter ? (activitiesMap[selectedChapter.id] || []) : [];

                        if (activities.length === 0 && !isGenerating) return null;

                        // Active step is the last one if generating, otherwise all complete
                        const activeStep = isGenerating ? activities.length - 1 : activities.length;

                        return (
                            <Box sx={{ px: 4, pt: 3, pb: 1, bgcolor: 'background.paper' }}>
                                <Stepper
                                    activeStep={activeStep}
                                    alternativeLabel
                                    connector={<StepConnector sx={{ '& .MuiStepConnector-line': { borderColor: 'divider' } }} />}
                                >
                                    {activities.map((activity, index) => {
                                        const isProcessing = activity.status === 'processing';
                                        return (
                                            <Step key={activity.id || index} completed={activity.status === 'success'}>
                                                <StepLabel
                                                    sx={{ cursor: 'default' }}
                                                    icon={isProcessing ? <CircularProgress size={18} sx={{ color: 'primary.main' }} /> : undefined}
                                                    StepIconProps={!isProcessing ? { sx: { fontSize: 20 } } : undefined}
                                                >
                                                    <Typography
                                                        variant="caption"
                                                        color={isProcessing ? 'primary.main' : 'text.secondary'}
                                                    >
                                                        {activity.action}
                                                    </Typography>
                                                </StepLabel>
                                            </Step>
                                        );
                                    })}
                                    {/* Placeholder step: show "preparing next..." when last activity is complete but still generating */}
                                    {isGenerating && activities.length > 0 && activities[activities.length - 1].status === 'success' && (
                                        <Step key="preparing-next">
                                            <StepLabel
                                                sx={{ cursor: 'default' }}
                                                icon={<CircularProgress size={18} sx={{ color: 'primary.main' }} />}
                                            >
                                                <Typography variant="caption" color="primary.main">
                                                    准备下一步...
                                                </Typography>
                                            </StepLabel>
                                        </Step>
                                    )}
                                </Stepper>
                            </Box>
                        );
                    })()}



                    {/* Editor Input Area */}
                    <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                        {selectedChapter ? (
                            <TextField
                                multiline
                                fullWidth
                                variant="outlined"
                                placeholder="在此输入正文..."
                                value={editorContent}
                                onChange={(e) => setEditorContent(e.target.value)}
                                sx={{
                                    flex: 1,
                                    height: '100%',
                                    '& .MuiInputBase-root': {
                                        height: '100%',
                                        alignItems: 'flex-start',
                                        borderRadius: 0,
                                        fontSize: '1.2rem',
                                        lineHeight: 1.8,
                                        bgcolor: 'background.default',
                                        padding: 0 // Remove default padding to handle it in input
                                    },
                                    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                                    '& textarea': {
                                        height: '100% !important',
                                        overflowY: 'auto !important',
                                        padding: '2rem !important',
                                        boxSizing: 'border-box' // Ensure padding keeps size correct
                                    }
                                }}
                                inputProps={{
                                    style: {
                                        fontFamily: 'Georgia, serif'
                                    }
                                }}
                            />
                        ) : (
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary' }}>
                                <Stack alignItems="center" spacing={1}>
                                    {theme.palette.mode === 'dark' ? (
                                        <IconBook sx={{ fontSize: 48, opacity: 0.2 }} />
                                    ) : (
                                        <Box component="img" src={EmptyStateWriter} sx={{ width: 280, mb: 2, mixBlendMode: 'multiply' }} />
                                    )}
                                    <Typography>请在左侧选择章节开始写作</Typography>
                                </Stack>
                            </Box>
                        )}
                    </Box>
                </Box>


            </Box>

            {/* Right Column: Aux Panel */}
            <Collapse in={bottomDrawerOpen} orientation="horizontal" sx={{ height: '100%' }}>
                <Box sx={{
                    width: 300,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    flexShrink: 0,
                    borderLeft: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper'
                }}>
                    <Box sx={{
                        p: 2,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <Box>
                            <Typography variant="subtitle2" fontWeight="bold">辅助面板</Typography>
                            <Typography variant="caption" color="text.secondary">当前章节的参考信息</Typography>
                        </Box>
                        <IconButton size="small" onClick={() => setBottomDrawerOpen(false)}>
                            <IconLeft />
                        </IconButton>
                    </Box>

                    {/* AI 写作 Buttons */}
                    <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                        {isBatchGenerating ? (
                            /* Batch generating state */
                            <Stack spacing={1}>
                                <Button
                                    startIcon={<CircularProgress size={16} />}
                                    variant="contained"
                                    size="small"
                                    color="warning"
                                    fullWidth
                                    sx={{ borderRadius: 999, boxShadow: 'none' }}
                                >
                                    批量生成中 ({batchProgress.current}/{batchProgress.total})
                                </Button>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    color="error"
                                    fullWidth
                                    onClick={handleStop}
                                    sx={{ borderRadius: 999 }}
                                >
                                    取消批量生成
                                </Button>
                            </Stack>
                        ) : isGenerating ? (
                            /* Single chapter generating state */
                            <Stack spacing={1}>
                                <Button
                                    startIcon={<CircularProgress size={16} />}
                                    variant="contained"
                                    size="small"
                                    color="warning"
                                    fullWidth
                                    sx={{ borderRadius: 999, boxShadow: 'none' }}
                                >
                                    生成中...
                                </Button>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    color="error"
                                    fullWidth
                                    onClick={handleStop}
                                    sx={{ borderRadius: 999 }}
                                >
                                    取消生成
                                </Button>
                            </Stack>
                        ) : (
                            /* Normal state */
                            <Stack spacing={1}>
                                <Button
                                    startIcon={<IconRobot />}
                                    variant="contained"
                                    size="small"
                                    fullWidth
                                    onClick={() => {
                                        setGenerationMode('full');
                                        setQuickSettingsVisible(true);
                                    }}
                                    disabled={!selectedChapter}
                                    sx={{ borderRadius: 999, boxShadow: 'none' }}
                                >
                                    生成当前章节正文
                                </Button>
                                <Button
                                    startIcon={<IconBatch />}
                                    variant="outlined"
                                    size="small"
                                    fullWidth
                                    onClick={() => setBatchModalVisible(true)}
                                    sx={{ borderRadius: 999 }}
                                >
                                    批量生成章节正文
                                </Button>
                                <Button
                                    startIcon={<IconDelete />}
                                    variant="outlined"
                                    size="small"
                                    fullWidth
                                    color="error"
                                    onClick={async () => {
                                        if (window.confirm('确定要清除当前章节的所有内容吗？此操作不可恢复。')) {
                                            setEditorContent('');
                                            setActivitiesMap(prev => {
                                                const next = { ...prev };
                                                delete next[selectedChapter.id];
                                                return next;
                                            });
                                            setDraftText('');
                                            try {
                                                await storage.clearActivitiesByChapter(selectedChapter.id);
                                            } catch (e) {
                                                console.error('Failed to clear activities from DB', e);
                                            }
                                        }
                                    }}
                                    disabled={!selectedChapter || !editorContent}
                                    sx={{ borderRadius: 999 }}
                                >
                                    清除当前章节内容
                                </Button>
                            </Stack>
                        )}
                    </Box>

                    <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                        <Tabs
                            value={bottomDrawerTab}
                            onChange={(e, v) => setBottomDrawerTab(v)}
                            variant="fullWidth"
                            sx={{
                                minHeight: 40,
                                '& .MuiTab-root': {
                                    minHeight: 40,
                                    py: 1,
                                    fontWeight: 500,
                                    fontSize: '0.75rem',
                                    color: 'text.secondary',
                                    '&.Mui-selected': {
                                        fontWeight: 700,
                                        color: 'primary.main'
                                    }
                                },
                                '& .MuiTabs-indicator': {
                                    height: 2,
                                    bgcolor: 'primary.main'
                                }
                            }}
                        >
                            <Tab label="场景" />
                            <Tab label="角色" />
                            <Tab label="生成状态" />
                        </Tabs>

                    </Box>

                    <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                        {/* Tab 0: 场景大纲 + 因果 */}
                        {bottomDrawerTab === 0 && (
                            <Box>
                                {selectedChapter && <PassionChart volumeId={selectedChapter.volumeId} />}

                                {/* 波动图下方分割线 */}
                                {selectedChapter && <Divider sx={{ my: 3 }} />}

                                {/* 因果关系信息 - 卡片式布局 */}
                                {selectedChapter && (selectedChapter.chapterGoal || selectedChapter.chapterOutcome || (Array.isArray(selectedChapter.openQuestions) && selectedChapter.openQuestions.length > 0)) && (
                                    <Stack spacing={2} sx={{ mb: 3 }}>
                                        {selectedChapter.chapterGoal && (
                                            <Card variant="outlined" sx={{ p: 2, borderRadius: '16px', bgcolor: 'background.paper' }}>
                                                <Typography variant="caption" color="primary" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>
                                                    本章目标
                                                </Typography>
                                                <Typography variant="body2" sx={{ lineHeight: 1.6 }}>{selectedChapter.chapterGoal}</Typography>
                                            </Card>
                                        )}
                                        {selectedChapter.chapterOutcome && (
                                            <Card variant="outlined" sx={{ p: 2, borderRadius: '16px', bgcolor: 'background.paper' }}>
                                                <Typography variant="caption" color="primary" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>
                                                    本章结果
                                                </Typography>
                                                <Typography variant="body2" sx={{ lineHeight: 1.6 }}>{selectedChapter.chapterOutcome}</Typography>
                                            </Card>
                                        )}
                                        {Array.isArray(selectedChapter.openQuestions) && selectedChapter.openQuestions.length > 0 && (
                                            <Card variant="outlined" sx={{ p: 2, borderRadius: '16px', bgcolor: 'background.paper' }}>
                                                <Typography variant="caption" color="primary" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>
                                                    未解决问题
                                                </Typography>
                                                <Stack spacing={0.5}>
                                                    {selectedChapter.openQuestions.map((q, i) => (
                                                        <Typography key={i} variant="body2" sx={{ lineHeight: 1.6 }}>• {q}</Typography>
                                                    ))}
                                                </Stack>
                                            </Card>
                                        )}
                                    </Stack>
                                )}

                                {/* 场景列表分割线 - 实线 */}
                                <Divider sx={{ my: 3 }} />

                                {/* 场景列表 */}
                                <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ mb: 2, display: 'block' }}>
                                    场景列表
                                </Typography>

                                {selectedChapter && selectedChapter.summary ? (
                                    <>
                                        <Stack spacing={2}>
                                            {(() => {
                                                try {
                                                    const parsed = JSON.parse(selectedChapter.summary);
                                                    const scenes = parsed.scenes || [];
                                                    return scenes.map((scene, index) => (
                                                        <Card key={index} variant="outlined" sx={{
                                                            p: 2,
                                                            bgcolor: 'background.paper',
                                                            borderRadius: '16px',
                                                            mb: 2
                                                        }}>
                                                            <Typography variant="caption" color="primary" fontWeight="bold" display="block" sx={{ mb: 1 }}>
                                                                场景 {index + 1}: {scene.location || '未知地点'}
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.7 }}>
                                                                {scene.action}
                                                            </Typography>
                                                            {scene.characters && scene.characters.length > 0 && (
                                                                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                                                    {scene.characters.map(c => (
                                                                        <Chip key={c} label={c} size="small" variant="outlined" sx={{ fontSize: '0.75rem', height: 24, borderRadius: 999 }} />
                                                                    ))}
                                                                </Stack>
                                                            )}
                                                        </Card>
                                                    ));
                                                } catch {
                                                    return <Typography variant="body2" color="text.secondary">无法解析场景信息</Typography>;
                                                }
                                            })()}
                                        </Stack>
                                    </>
                                ) : (
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                        请选择章节查看场景大纲
                                    </Typography>
                                )}
                            </Box>
                        )}
                        {/* Tab 1: 角色状态 (增强版) */}
                        {bottomDrawerTab === 1 && (
                            <Box>
                                {selectedChapter && characters.length > 0 ? (
                                    <Stack spacing={2}>
                                        {(() => {
                                            try {
                                                const parsed = JSON.parse(selectedChapter.summary || '{}');
                                                const scenes = parsed.scenes || [];
                                                const chapterCharNames = [...new Set(scenes.flatMap(s => s.characters || []))];
                                                const chapterChars = characters.filter(c => chapterCharNames.includes(c.name));
                                                const truncate = (text, max) => text && text.length > max ? text.slice(0, max) + '...' : text;

                                                if (chapterChars.length === 0) {
                                                    return <Typography variant="body2" color="text.secondary">本章无相关角色</Typography>;
                                                }

                                                return chapterChars.map(char => (
                                                    <Card key={char.id} variant="outlined" sx={{
                                                        p: 2.5,
                                                        bgcolor: 'background.paper',
                                                        borderRadius: '16px',
                                                        borderStyle: 'solid',
                                                        borderColor: 'divider'
                                                    }}>
                                                        <Stack direction="row" spacing={2} alignItems="flex-start">
                                                            <Avatar sx={{ width: 48, height: 48, bgcolor: 'primary.light' }}>
                                                                {char.avatar ? (
                                                                    <img src={char.avatar} alt={char.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                ) : (
                                                                    char.name?.[0]
                                                                )}
                                                            </Avatar>
                                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                                <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
                                                                    <Typography variant="subtitle2" fontWeight="bold">{char.name}</Typography>
                                                                    {char.age && <Chip label={`${String(char.age).includes('岁') ? char.age : char.age + '岁'}`} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />}
                                                                    {char.gender && <Chip label={char.gender} size="small" color="secondary" sx={{ height: 18, fontSize: '0.65rem' }} />}
                                                                </Stack>
                                                                <Typography variant="caption" color="text.secondary">{char.role || '角色'}</Typography>
                                                                {char.personality && (
                                                                    <Typography variant="body2" sx={{ mt: 0.5, fontSize: '0.75rem' }}>
                                                                        {truncate(char.personality, 60)}
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        </Stack>
                                                        {(char.currentState?.description || char.currentStatus) && (
                                                            <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}>
                                                                <Typography variant="caption" color="primary" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>
                                                                    目前状态
                                                                </Typography>
                                                                {char.currentState?.emotional && (
                                                                    <Box sx={{ mb: 1 }}>
                                                                        <Chip
                                                                            label={char.currentState.emotional}
                                                                            size="small"
                                                                            variant="outlined"
                                                                            color="primary"
                                                                            sx={{ height: 20, fontSize: '0.7rem' }}
                                                                        />
                                                                    </Box>
                                                                )}
                                                                <Typography variant="body2" sx={{ fontSize: '0.75rem', lineHeight: 1.6 }}>
                                                                    {char.currentState?.description || char.currentStatus}
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                    </Card>
                                                ));
                                            } catch {
                                                return <Typography variant="body2" color="text.secondary">无法解析角色信息</Typography>;
                                            }
                                        })()}
                                    </Stack>
                                ) : (
                                    <Typography variant="body2" color="text.secondary">请选择章节查看角色状态</Typography>
                                )}
                            </Box>
                        )}

                        {/* Tab 2: 生成状态 */}
                        {bottomDrawerTab === 2 && (
                            <Box>
                                {/* Agent Activity Log (Inline) */}



                                {(() => {
                                    // Extract deviation from current chapter's activities
                                    const activities = selectedChapter ? (activitiesMap[selectedChapter.id] || []) : [];
                                    const deviationActivity = activities.find(act => act.extraData?.deviation);
                                    const currentDeviation = deviationActivity?.extraData?.deviation;

                                    return currentDeviation ? (
                                        <Stack spacing={2}>
                                            <Box sx={{
                                                p: 3,
                                                bgcolor: 'action.hover',
                                                borderRadius: '16px',
                                                position: 'relative',
                                                overflow: 'hidden'
                                            }}>
                                                <Stack spacing={2}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                                        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                                                            {/* Background Track */}
                                                            <CircularProgress
                                                                variant="determinate"
                                                                value={100}
                                                                size={60}
                                                                thickness={4}
                                                                sx={{ color: 'action.disabledBackground', position: 'absolute' }}
                                                            />
                                                            {/* Actual Score */}
                                                            <CircularProgress
                                                                variant="determinate"
                                                                value={(currentDeviation.score || 0) * 10}
                                                                size={60}
                                                                thickness={4}
                                                                sx={{
                                                                    color: (currentDeviation.score || 0) >= 8 ? 'success.main'
                                                                        : (currentDeviation.score || 0) >= 5 ? 'warning.main'
                                                                            : 'error.main',
                                                                    position: 'relative',
                                                                    zIndex: 1,
                                                                    strokeLinecap: 'round'
                                                                }}
                                                            />
                                                            <Box sx={{
                                                                top: 0,
                                                                left: 0,
                                                                bottom: 0,
                                                                right: 0,
                                                                position: 'absolute',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                            }}>
                                                                <Typography variant="h5" fontWeight="800" color="text.primary" sx={{ fontFamily: 'Inter, Roboto, sans-serif' }}>
                                                                    {currentDeviation.score || '-'}
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                        <Box sx={{ flex: 1 }}>
                                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>初稿质量评分</Typography>
                                                            <Typography variant="h6" color="text.primary" fontWeight="bold">
                                                                {(currentDeviation.score || 0) >= 8 ? '优秀' : (currentDeviation.score || 0) >= 5 ? '良好' : '需改进'}
                                                            </Typography>
                                                        </Box>
                                                    </Box>

                                                    {/* 分析概述 - 集成在卡片内 */}
                                                    {currentDeviation.analysis && (
                                                        <Typography variant="body2" color="text.secondary" sx={{
                                                            whiteSpace: 'pre-wrap',
                                                            lineHeight: 1.8,
                                                            textAlign: 'justify'
                                                        }}>
                                                            {currentDeviation.analysis}
                                                        </Typography>
                                                    )}
                                                </Stack>
                                            </Box>

                                            {/* 偏差详情展开 */}
                                            {
                                                currentDeviation.deviations && currentDeviation.deviations.length > 0 && (
                                                    <Accordion
                                                        elevation={0}
                                                        variant="outlined"
                                                        sx={{
                                                            mt: 1,
                                                            bgcolor: 'background.paper',
                                                            borderRadius: 2,
                                                            '&:before': { display: 'none' }, // Remove default divider
                                                            overflow: 'hidden'
                                                        }}
                                                    >
                                                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                                            <Stack direction="row" spacing={1} alignItems="center">
                                                                <IconWarning sx={{ fontSize: 18, color: 'warning.main' }} />
                                                                <Typography variant="subtitle2">偏差详情 ({currentDeviation.deviations.length})</Typography>
                                                            </Stack>
                                                        </AccordionSummary>
                                                        <AccordionDetails>
                                                            <Stack spacing={0}>
                                                                {currentDeviation.deviations.map((d, i) => (
                                                                    <React.Fragment key={i}>
                                                                        <Box sx={{ py: 2.5 }}>
                                                                            <Stack spacing={1.5}>
                                                                                <Box>

                                                                                    {d.location && (
                                                                                        <Box sx={{ mb: 1.5 }}>
                                                                                            <Typography
                                                                                                variant="caption"
                                                                                                sx={{
                                                                                                    border: '1px solid',
                                                                                                    borderColor: 'rgba(0,0,0,0.08)',
                                                                                                    borderRadius: '4px',
                                                                                                    px: 1,
                                                                                                    py: 0.5,
                                                                                                    color: 'text.secondary',
                                                                                                    fontSize: '0.75rem',
                                                                                                    fontFamily: 'Inter, Roboto, sans-serif',
                                                                                                    display: 'inline-block',
                                                                                                    bgcolor: 'action.hover'
                                                                                                }}
                                                                                            >
                                                                                                位置：{d.location}
                                                                                            </Typography>
                                                                                        </Box>
                                                                                    )}
                                                                                    <Typography variant="body1" color="text.primary" sx={{ lineHeight: 1.8, fontSize: '0.95rem', fontWeight: 500 }}>{d.issue}</Typography>
                                                                                </Box>

                                                                                {d.suggestion && (
                                                                                    <Box sx={{
                                                                                        mt: 1,
                                                                                        p: 2,
                                                                                        bgcolor: 'rgba(76, 175, 80, 0.04)', // Very subtle green tint
                                                                                        borderRadius: '12px',
                                                                                        border: '1px solid',
                                                                                        borderColor: 'rgba(76, 175, 80, 0.1)'
                                                                                    }}>
                                                                                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, textAlign: 'justify' }}>
                                                                                            {d.suggestion}
                                                                                        </Typography>
                                                                                    </Box>
                                                                                )}
                                                                            </Stack>
                                                                        </Box>
                                                                        {i < currentDeviation.deviations.length - 1 && <Divider sx={{ opacity: 0.6 }} />}
                                                                    </React.Fragment>
                                                                ))}
                                                            </Stack>
                                                        </AccordionDetails>
                                                    </Accordion>
                                                )
                                            }

                                            {/* 润色对比 */}
                                            {
                                                draftText && (
                                                    <Accordion
                                                        elevation={0}
                                                        variant="outlined"
                                                        sx={{
                                                            mt: 1,
                                                            bgcolor: 'background.paper',
                                                            borderRadius: '16px !important', // Force 16px
                                                            '&:before': { display: 'none' },
                                                            overflow: 'hidden',
                                                            '&:first-of-type': { borderRadius: '16px !important' },
                                                            '&:last-of-type': { borderRadius: '16px !important' },
                                                        }}
                                                    >
                                                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                                            <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                                                                <IconFile sx={{ fontSize: 18, color: 'primary.main' }} />
                                                                <Typography variant="subtitle2">初稿</Typography>
                                                                <Box sx={{ flexGrow: 1 }} />
                                                                <Tooltip title="复制内容">
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            navigator.clipboard.writeText(draftText);
                                                                            setSnackbar({ open: true, message: '初稿已复制', severity: 'success' });
                                                                        }}
                                                                    >
                                                                        <IconCopy sx={{ fontSize: 16 }} />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </Stack>
                                                        </AccordionSummary>
                                                        <AccordionDetails>
                                                            <Stack spacing={1}>
                                                                <Box sx={{ maxHeight: 400, overflow: 'auto', bgcolor: 'action.hover', p: 1.5, borderRadius: 2, fontSize: '0.8rem', lineHeight: 1.6, color: 'text.secondary', whiteSpace: 'pre-wrap' }}>
                                                                    {draftText}
                                                                </Box>
                                                            </Stack>
                                                        </AccordionDetails>


                                                    </Accordion>
                                                )
                                            }

                                            {/* 生成日志 (移到底部) */}
                                            {(() => {
                                                const activities = selectedChapter ? (activitiesMap[selectedChapter.id] || []) : [];
                                                const hasActivities = activities.length > 0;

                                                return (
                                                    <Accordion
                                                        defaultExpanded={false}
                                                        elevation={0}
                                                        variant="outlined"
                                                        sx={{
                                                            mt: 1,
                                                            bgcolor: 'background.paper',
                                                            borderRadius: '16px !important',
                                                            '&:before': { display: 'none' },
                                                            overflow: 'hidden',
                                                            '&:first-of-type': { borderRadius: '16px !important' },
                                                            '&:last-of-type': { borderRadius: '16px !important' },
                                                        }}
                                                    >
                                                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                                            <Stack direction="row" spacing={1} alignItems="center">
                                                                <IconTips sx={{ fontSize: 18, color: 'primary.main' }} />
                                                                <Typography variant="subtitle2">生成日志</Typography>
                                                            </Stack>
                                                        </AccordionSummary>
                                                        <AccordionDetails>
                                                            {hasActivities ? (
                                                                <List disablePadding>
                                                                    {activities.slice().reverse().map((item) => (
                                                                        <ListItem key={item.id} sx={{
                                                                            px: 1,
                                                                            py: 1.5,
                                                                            borderBottom: '1px solid',
                                                                            borderColor: 'divider',
                                                                            '&:last-child': { borderBottom: 'none' }
                                                                        }}>
                                                                            <Stack spacing={1} sx={{ width: '100%' }}>
                                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                                                        {(() => {
                                                                                            switch (item.status) {
                                                                                                case 'success': return <IconCheckCircle sx={{ color: 'success.main', fontSize: 16 }} />;
                                                                                                case 'error': return <IconErrorCircle sx={{ color: 'error.main', fontSize: 16 }} />;
                                                                                                case 'warning': return <IconWarning sx={{ color: 'warning.main', fontSize: 16 }} />;
                                                                                                case 'processing': return <CircularProgress size={12} />;
                                                                                                default: return <IconRobot sx={{ fontSize: 16, opacity: 0.5 }} />;
                                                                                            }
                                                                                        })()}
                                                                                        <Typography variant="caption" fontWeight="bold">{item.agent}</Typography>
                                                                                    </Stack>
                                                                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>{item.time}</Typography>
                                                                                </Box>
                                                                                <Typography variant="caption" color="text.primary" sx={{ display: 'block', lineHeight: 1.4 }}>
                                                                                    {item.action}
                                                                                </Typography>
                                                                                {item.details && (
                                                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic', fontSize: '0.7rem' }}>
                                                                                        {item.details}
                                                                                    </Typography>
                                                                                )}
                                                                            </Stack>
                                                                        </ListItem>
                                                                    ))}
                                                                </List>
                                                            ) : (
                                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', py: 2 }}>暂无活动记录</Typography>
                                                            )}
                                                        </AccordionDetails>
                                                    </Accordion>
                                                );
                                            })()}
                                        </Stack>
                                    ) : (
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>暂无偏差分析数据</Typography>
                                    );
                                })()}
                            </Box>
                        )}
                    </Box>
                </Box >
            </Collapse >

            {/* Modals & Feedback */}
            < BatchGenerateModal
                visible={batchModalVisible}
                onCancel={() => setBatchModalVisible(false)}
                onOk={handleBatchStart}
                volumes={volumes}
                chapterNodesMap={chapterNodesMap}
                useAutoContinue={useAutoContinue}
                setUseAutoContinue={setUseAutoContinue}
                onClearContent={handleClearChapterContent}
            />

            <QuickSettingsModal
                visible={quickSettingsVisible}
                onCancel={() => setQuickSettingsVisible(false)}
                onOk={(settings) => {
                    setQuickSettingsVisible(false);
                    handleGenerate(null, settings);
                }}
            />

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
                    {snackbar.message}
                </Alert>
            </Snackbar>

        </Box >
    );
};
