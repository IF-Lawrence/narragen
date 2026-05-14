import React, { useState, useEffect } from 'react';
import { storage } from '../../services/storage';
import { useProject } from '../../contexts/ProjectContext';
import { v4 as uuidv4 } from 'uuid';

// MUI Imports
import {
    Box, Card, CardContent, Typography,
    List, ListItem, ListItemText, ListItemButton, ListItemIcon,
    IconButton, Button, TextField, Select, MenuItem,
    FormControl, Chip, Stack,
    Dialog, DialogTitle, DialogContent, DialogActions,
    Snackbar, Alert, Grid, Paper, Tooltip, Divider,
    Drawer, Breadcrumbs, Link, Collapse,
    Stepper, Step, StepLabel, StepConnector,
    InputAdornment
} from '@mui/material';
import {
    AddRounded as IconPlus,
    SaveRounded as IconSave,
    EditRounded as IconEdit,
    DeleteRounded as IconDelete,
    RefreshRounded as IconRefresh,
    CheckCircleRounded as IconSuccess,
    ErrorRounded as IconError,
    SettingsRounded as IconSettings,
    TuneRounded as IconTune,
    KeyRounded as IconKey,
    HistoryRounded as IconHistory,
    ChevronRightRounded as IconChevronRight,
    ChevronLeftRounded as IconChevronLeft,
    MenuRounded as IconMenu,
    InfoRounded as IconInfoCircle,
    VisibilityRounded,
    VisibilityOffRounded
} from '@mui/icons-material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import EmptyStateApi from '../../assets/illustrations/empty-state-api.gif';

export const Settings = () => {
    const { currentProject } = useProject();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    // Layout State
    const [activeSection, setActiveSection] = useState(0);
    const [showRefPanel, setShowRefPanel] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Notification State
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

    // Data States
    const [presets, setPresets] = useState([]);
    const [featureConfig, setFeatureConfig] = useState({
        chapterGeneration: '',
        planner: '',
        writer: '',
        stylist: '',
        critic: '',
        archivist: '',
        coverDesign: '',
        imageGeneration: ''
    });
    const [apiCallLogs, setApiCallLogs] = useState([]);

    // UI States
    const [isEditingPreset, setIsEditingPreset] = useState(false);
    const [editingPresetId, setEditingPresetId] = useState(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [presetToDelete, setPresetToDelete] = useState(null);
    const [logsClearConfirmOpen, setLogsClearConfirmOpen] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        apiKey: '',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4-turbo',
        note: '',
        type: 'text' // 'text' or 'image'
    });

    // UI - Password Visibility
    const [showApiKey, setShowApiKey] = useState(false);

    const FEATURES = [
        { id: 'chapterGeneration', name: '文章生成（Writer）', desc: '用于正文章节的创作生成', type: 'text' },
        { id: 'planner', name: '主编（Planner）', desc: '用于核心大纲、分卷规划、章节场景等结构化内容生成', type: 'text' },
        { id: 'stylist', name: '润色师（Stylist）', desc: '用于语言润色、风格统一与文本优化', type: 'text' },
        { id: 'critic', name: '评论家（Critic）', desc: '用于多维度质量检查与改进建议', type: 'text' },
        { id: 'archivist', name: '记忆官（Archivist）', desc: '用于上下文压缩、记忆归档、因果分析与情节记忆', type: 'text' },
        { id: 'coverDesign', name: '封面设计（LLM）', desc: '用于 AI 分析小说内容并生成封面设计提示词', type: 'text' },
        { id: 'imageGeneration', name: '图像生成', desc: '用于角色头像、立绘及封面图像的实际生成', type: 'image' }
    ];

    const showMessage = (message, severity = 'info') => {
        setSnackbar({ open: true, message, severity });
    };

    const handleCloseSnackbar = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    const loadSettings = async () => {
        try {
            const presetsData = await storage.getSetting('apiPresets');
            // storage.getItem 已自动解析 JSON，无需再次 parse
            let loadedPresets = Array.isArray(presetsData) ? presetsData : [];

            const globalFeatureConfigData = await storage.getSetting('featureConfig');
            let globalFeatureConfig = (globalFeatureConfigData && typeof globalFeatureConfigData === 'object') ? globalFeatureConfigData : {};

            let loadedFeatureConfig = {
                chapterGeneration: '',
                planner: '',
                writer: '',
                stylist: '',
                critic: '',
                archivist: '',
                coverDesign: '',
                imageGeneration: ''
            };

            loadedFeatureConfig = { ...loadedFeatureConfig, ...globalFeatureConfig };

            if (currentProject) {
                const projectConfigData = await storage.getSetting(`featureConfig_${currentProject.id}`);
                if (projectConfigData && typeof projectConfigData === 'object') {
                    loadedFeatureConfig = { ...loadedFeatureConfig, ...projectConfigData };
                }
            }

            if (loadedPresets.length === 0) {
                const legacyApiKey = await storage.getSetting('apiKey');
                if (legacyApiKey) {
                    const legacyBaseUrl = await storage.getSetting('baseUrl') || 'https://api.openai.com/v1';
                    const legacyModel = await storage.getSetting('model') || 'gpt-4-turbo';

                    const defaultPreset = {
                        id: uuidv4(),
                        name: 'Default (Migrated)',
                        apiKey: legacyApiKey,
                        baseUrl: legacyBaseUrl,
                        model: legacyModel,
                        note: 'Automatically migrated from legacy settings',
                        updatedAt: new Date().toISOString()
                    };

                    loadedPresets = [defaultPreset];
                    await storage.saveSettings('apiPresets', loadedPresets);

                    const newConfig = {};
                    Object.keys(loadedFeatureConfig).forEach(key => {
                        newConfig[key] = defaultPreset.id;
                    });

                    await storage.saveSettings('featureConfig', newConfig);
                    if (currentProject) {
                        await storage.saveSettings(`featureConfig_${currentProject.id}`, newConfig);
                    }
                    loadedFeatureConfig = newConfig;
                    showMessage('已自动迁移旧版配置', 'info');
                }
            }

            setPresets(loadedPresets);
            setFeatureConfig(loadedFeatureConfig);
        } catch (error) {
            console.error('Failed to load settings:', error);
            showMessage('加载设置失败', 'error');
        }
    };

    const loadApiCallLogs = () => {
        try {
            const logs = JSON.parse(localStorage.getItem('apiCallLogs') || '[]');
            setApiCallLogs(logs);
        } catch (e) {
            console.error('Failed to load API call logs:', e);
        }
    };

    useEffect(() => {
        loadSettings();
        loadApiCallLogs();
    }, [currentProject]);

    const handleSavePreset = async () => {
        if (!formData.name || !formData.apiKey) {
            showMessage('请填写预设名称和 API Key', 'error');
            return;
        }

        const newPreset = {
            id: editingPresetId || uuidv4(),
            ...formData,
            updatedAt: new Date().toISOString()
        };

        let updatedPresets;
        if (editingPresetId) {
            updatedPresets = presets.map(p => p.id === editingPresetId ? newPreset : p);
        } else {
            updatedPresets = [...presets, newPreset];
        }

        setPresets(updatedPresets);
        await storage.saveSettings('apiPresets', updatedPresets);

        if (presets.length === 0) {
            const newConfig = { ...featureConfig };
            Object.keys(newConfig).forEach(key => newConfig[key] = newPreset.id);
            setFeatureConfig(newConfig);
            await storage.saveSettings('featureConfig', newConfig);
            if (currentProject) {
                await storage.saveSettings(`featureConfig_${currentProject.id}`, newConfig);
            }
        }

        setIsEditingPreset(false);
        setEditingPresetId(null);
        setFormData({ name: '', apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4-turbo', note: '', type: 'text' });
        showMessage('预设已保存', 'success');
    };

    const handleEditPreset = (preset) => {
        setFormData({
            name: preset.name,
            apiKey: preset.apiKey,
            baseUrl: preset.baseUrl,
            model: preset.model,
            note: preset.note || '',
            type: preset.type || 'text'
        });
        setEditingPresetId(preset.id);
        setIsEditingPreset(true);
    };

    const handleDeletePreset = async () => {
        if (!presetToDelete) return;
        const id = presetToDelete;
        const updatedPresets = presets.filter(p => p.id !== id);
        setPresets(updatedPresets);
        await storage.saveSettings('apiPresets', updatedPresets);

        const updatedConfig = { ...featureConfig };
        let configChanged = false;
        Object.keys(updatedConfig).forEach(key => {
            if (updatedConfig[key] === id) {
                updatedConfig[key] = '';
                configChanged = true;
            }
        });

        if (configChanged) {
            setFeatureConfig(updatedConfig);
            if (currentProject) {
                await storage.saveSettings(`featureConfig_${currentProject.id}`, updatedConfig);
            }
        }
        showMessage('预设已删除', 'success');
        setDeleteConfirmOpen(false);
        setPresetToDelete(null);
    };

    const handleFeatureConfigChange = async (featureId, presetId) => {
        const newConfig = { ...featureConfig, [featureId]: presetId };
        setFeatureConfig(newConfig);

        if (currentProject) {
            await storage.saveSettings(`featureConfig_${currentProject.id}`, newConfig);
            showMessage('项目配置已更新', 'success');
        } else {
            await storage.saveSettings('featureConfig', newConfig);
            showMessage('无活跃项目，更新了全局默认配置', 'warning');
        }
    };

    const clearApiCallLogs = () => {
        localStorage.removeItem('apiCallLogs');
        setApiCallLogs([]);
        showMessage('调用记录已清空', 'success');
        setLogsClearConfirmOpen(false);
    };

    // --- Helper Functions ---
    const getSectionTitle = (section) => {
        const titles = ['功能配置', 'API 预设', '调用日志'];
        return titles[section] || '';
    };

    const getRefTitle = (section) => {
        const titles = ['关于功能配置', '关于 API 预设', '关于调用日志'];
        return titles[section] || '参考信息';
    };

    // --- Sidebar Content ---
    const sidebarContent = (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                    <IconSettings sx={{ mr: 1.5, color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: 'inherit' }}>全局设置</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">管理 AI 模型配置</Typography>
            </Box>
            <List sx={{ flexGrow: 1, p: 2 }}>
                {[
                    { icon: <IconTune />, label: '功能配置', desc: 'Agent 分配' },
                    { icon: <IconKey />, label: 'API 预设', desc: '密钥管理' },
                    { icon: <IconHistory />, label: '调用日志', desc: '请求记录' },
                ].map((item, idx) => (
                    <ListItemButton
                        key={idx}
                        selected={activeSection === idx}
                        onClick={() => {
                            setActiveSection(idx);
                            if (isMobile) setDrawerOpen(false);
                        }}
                        sx={{ borderRadius: 2, mb: 1 }}
                    >
                        <ListItemIcon sx={{ minWidth: 40, color: activeSection === idx ? 'primary.main' : 'text.secondary' }}>
                            {item.icon}
                        </ListItemIcon>
                        <ListItemText
                            primary={item.label}
                            secondary={item.desc}
                            primaryTypographyProps={{ fontWeight: activeSection === idx ? 'bold' : 'normal' }}
                        />
                    </ListItemButton>
                ))}
            </List>
        </Box>
    );

    // --- Render Section Content ---
    const renderFeatureConfigSection = () => (
        <Card variant="outlined" sx={{ p: 6, borderRadius: 4, bgcolor: 'transparent' }}>
            <Box sx={{ mb: 6 }}>
                <Typography variant="h5" color="text.primary" fontWeight="bold" sx={{ mb: 0.5 }}>功能配置</Typography>
                <Typography variant="body2" color="text.secondary">为不同的系统功能指派特定的 API 预设，实现精细化控制。</Typography>
            </Box>
            <Divider sx={{ mb: 6, opacity: 0.5 }} />

            <Stack spacing={4}>
                <List disablePadding>
                    {FEATURES.map((feature, index) => (
                        <React.Fragment key={feature.id}>
                            <ListItem
                                sx={{
                                    py: 3,
                                    px: 2,
                                    borderRadius: 2,
                                    flexDirection: { xs: 'column', sm: 'row' },
                                    alignItems: { xs: 'flex-start', sm: 'center' },
                                    '&:hover': { bgcolor: 'action.hover' }
                                }}
                            >
                                <Box sx={{ flexGrow: 1, mb: { xs: 2, sm: 0 }, mr: { sm: 4 } }}>
                                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>{feature.name}</Typography>
                                    <Typography variant="body2" color="text.secondary">{feature.desc}</Typography>
                                </Box>
                                <FormControl size="small" sx={{ minWidth: 240, width: { xs: '100%', sm: 'auto' } }}>
                                    <Select
                                        value={featureConfig[feature.id] || ''}
                                        onChange={(e) => handleFeatureConfigChange(feature.id, e.target.value)}
                                        displayEmpty
                                        sx={{ borderRadius: 2 }}
                                        inputProps={{ 'aria-label': 'Without label' }}
                                    >
                                        <MenuItem value="" disabled><em>请选择 API 预设</em></MenuItem>
                                        {presets.filter(p => (p.type || 'text') === feature.type).map(p => (
                                            <MenuItem key={p.id} value={p.id}>
                                                <Stack direction="row" alignItems="center" spacing={1}>
                                                    <Typography variant="body2" fontWeight="medium">{p.name}</Typography>
                                                    <Chip label={p.model} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                                                </Stack>
                                            </MenuItem>
                                        ))}
                                        {presets.filter(p => (p.type || 'text') === feature.type).length === 0 && (
                                            <MenuItem disabled><em>暂无{feature.type === 'image' ? '图像生成' : '文本生成'}类型的预设</em></MenuItem>
                                        )}
                                    </Select>
                                </FormControl>
                            </ListItem>
                            {index < FEATURES.length - 1 && <Divider component="li" sx={{ opacity: 0.5 }} />}
                        </React.Fragment>
                    ))}
                </List>
            </Stack>
        </Card>
    );

    const renderPresetsSection = () => (
        <Card variant="outlined" sx={{ p: 6, borderRadius: 4, bgcolor: 'transparent' }}>
            <Box sx={{ mb: 6, display: 'flex', alignItems: 'flex-start', gap: 2, justifyContent: 'space-between' }}>
                <Box>
                    <Typography variant="h5" color="text.primary" fontWeight="bold" sx={{ mb: 0.5 }}>API 预设管理</Typography>
                    <Typography variant="body2" color="text.secondary">管理所有可用的 API 配置预设。</Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<IconPlus />}
                    onClick={() => {
                        setIsEditingPreset(true);
                        setEditingPresetId(null);
                        setFormData({ name: '', apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4-turbo', note: '', type: 'text' });
                        setShowApiKey(false);
                    }}
                    sx={{ borderRadius: 999, px: 3 }}
                >
                    新建预设
                </Button>
            </Box>
            <Divider sx={{ mb: 6, opacity: 0.5 }} />

            <CardContent sx={{ p: 0 }}>
                {isEditingPreset && (
                    <Paper variant="outlined" sx={{ p: 4, mb: 4, borderRadius: 4, bgcolor: 'background.default', borderStyle: 'dashed' }}>
                        <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>{editingPresetId ? '编辑预设' : '新建预设'}</Typography>
                        <Grid container spacing={3}>
                            {/* Row 1: Name, Type, API Key - Equal Width */}
                            <Grid item xs={12} md={4}>
                                <TextField
                                    label="预设名称 *"
                                    fullWidth
                                    placeholder="例如：GPT-4 Turbo"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    InputLabelProps={{ shrink: true, sx: { fontWeight: 'bold' } }}
                                />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <FormControl fullWidth>
                                    <Typography variant="caption" sx={{ mb: 0.5, ml: 1.5, color: 'text.secondary', fontWeight: 'bold' }}>预设类型</Typography>
                                    <Select
                                        value={formData.type}
                                        onChange={(e) => {
                                            const newType = e.target.value;
                                            setFormData({
                                                ...formData,
                                                type: newType,
                                                baseUrl: newType === 'image' ? 'https://api.tu-zi.com/v1' : 'https://api.openai.com/v1',
                                                model: newType === 'image' ? 'gpt-image-1.5' : 'gpt-4-turbo'
                                            });
                                        }}
                                        sx={{ borderRadius: 2, height: 53.13 }}
                                    >
                                        <MenuItem value="text">文本生成 (LLM)</MenuItem>
                                        <MenuItem value="image">图像生成</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField
                                    label="API Key *"
                                    fullWidth
                                    type={showApiKey ? 'text' : 'password'}
                                    placeholder="sk-..."
                                    value={formData.apiKey}
                                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                                    InputLabelProps={{ shrink: true, sx: { fontWeight: 'bold' } }}
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    onClick={() => setShowApiKey(!showApiKey)}
                                                    edge="end"
                                                    size="small"
                                                >
                                                    {showApiKey ? <VisibilityRounded /> : <VisibilityOffRounded />}
                                                </IconButton>
                                            </InputAdornment>
                                        )
                                    }}
                                />
                            </Grid>

                            {/* Row 2: Base URL, Model, Note - Equal Width */}
                            <Grid item xs={12} md={4}>
                                <TextField
                                    label="Base URL"
                                    fullWidth
                                    placeholder="https://api.openai.com/v1"
                                    value={formData.baseUrl}
                                    onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                                    InputLabelProps={{ shrink: true, sx: { fontWeight: 'bold' } }}
                                    helperText="默认为 https://api.openai.com/v1"
                                />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField
                                    label="模型名称 (Model)"
                                    fullWidth
                                    placeholder="gpt-4-turbo"
                                    value={formData.model}
                                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                    InputLabelProps={{ shrink: true, sx: { fontWeight: 'bold' } }}
                                />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField
                                    label="备注"
                                    fullWidth
                                    placeholder="可选备注信息"
                                    value={formData.note}
                                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                                    InputLabelProps={{ shrink: true, sx: { fontWeight: 'bold' } }}
                                />
                            </Grid>

                            {/* Action Buttons */}
                            <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-start', gap: 2, mt: 1 }}>
                                <Button onClick={() => setIsEditingPreset(false)} sx={{ borderRadius: 999, px: 4 }}>取消</Button>
                                <Button variant="contained" onClick={handleSavePreset} startIcon={<IconSave />} sx={{ borderRadius: 999, px: 4 }}>保存预设</Button>
                            </Grid>
                        </Grid>
                    </Paper>
                )}

                {presets.length === 0 && !isEditingPreset ? (
                    <Box sx={{
                        width: '100%',
                        minHeight: 500,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        color: 'text.secondary'
                    }}>
                        {theme.palette.mode === 'dark' ? (
                            <IconKey sx={{ fontSize: 60, mb: 2, opacity: 0.5, color: 'text.secondary' }} />
                        ) : (
                            <Box component="img" src={EmptyStateApi} sx={{ width: 280, mb: 2, mixBlendMode: 'multiply' }} />
                        )}
                        <Typography>暂无 api 预设，请点击右上角新建预设</Typography>
                    </Box>
                ) : (
                    <Grid container spacing={3}>
                        {presets.map((preset) => (
                            <Grid item xs={12} md={6} key={preset.id}>
                                <Paper variant="outlined" sx={{
                                    p: 3,
                                    borderRadius: 3,
                                    height: '100%',
                                    transition: 'all 0.2s',
                                    '&:hover': { bgcolor: 'background.paper', borderColor: 'primary.main', transform: 'translateY(-2px)', boxShadow: 2 }
                                }}>
                                    <Stack spacing={2}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <Stack spacing={0.5}>
                                                <Typography variant="subtitle1" fontWeight="bold">{preset.name}</Typography>
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <Chip label={preset.model} size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                                                    {preset.note && <Typography variant="caption" color="text.secondary">{preset.note}</Typography>}
                                                </Stack>
                                            </Stack>
                                            <Stack direction="row" spacing={0}>
                                                <Tooltip title="编辑">
                                                    <IconButton size="small" onClick={() => handleEditPreset(preset)}>
                                                        <IconEdit fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="删除">
                                                    <IconButton size="small" color="error" onClick={() => { setPresetToDelete(preset.id); setDeleteConfirmOpen(true); }}>
                                                        <IconDelete fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        </Box>
                                        <Divider sx={{ borderStyle: 'dashed' }} />
                                        <Stack spacing={1}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography variant="caption" sx={{ color: 'text.secondary', width: 60 }}>Endpoint</Typography>
                                                <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: 'action.hover', px: 0.5, borderRadius: 0.5 }} noWrap>{preset.baseUrl}</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography variant="caption" sx={{ color: 'text.secondary', width: 60 }}>Key</Typography>
                                                <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: 'action.hover', px: 0.5, borderRadius: 0.5 }}>{preset.apiKey ? 'sk-...' + preset.apiKey.slice(-4) : '未设置'}</Typography>
                                            </Box>
                                        </Stack>
                                    </Stack>
                                </Paper>
                            </Grid>
                        ))}
                    </Grid>
                )}
            </CardContent>
        </Card>
    );

    const renderLogsSection = () => (
        <Card variant="outlined" sx={{ p: 6, borderRadius: 4, bgcolor: 'transparent' }}>
            <Box sx={{ mb: 6, display: 'flex', alignItems: 'flex-start', gap: 2, justifyContent: 'space-between' }}>
                <Box>
                    <Typography variant="h5" color="text.primary" fontWeight="bold" sx={{ mb: 0.5 }}>API 调用日志</Typography>
                    <Typography variant="body2" color="text.secondary">查看最近的 API 调用状态与 Token 消耗。</Typography>
                </Box>
                <Stack direction="row" spacing={2}>
                    <Button size="small" startIcon={<IconRefresh />} onClick={loadApiCallLogs} sx={{ borderRadius: 999 }}>刷新</Button>
                    <Button size="small" color="error" startIcon={<IconDelete />} onClick={() => setLogsClearConfirmOpen(true)} sx={{ borderRadius: 999 }}>清空日志</Button>
                </Stack>
            </Box>
            <Divider sx={{ mb: 6, opacity: 0.5 }} />

            <CardContent sx={{ p: 0 }}>
                <Paper variant="outlined" sx={{ maxHeight: 500, overflow: 'auto', borderRadius: 3, bgcolor: 'background.default' }}>
                    <List disablePadding>
                        {apiCallLogs.length === 0 && (
                            <Box sx={{ p: 8, textAlign: 'center' }}>
                                <Typography color="text.secondary">暂无调用记录</Typography>
                            </Box>
                        )}
                        {apiCallLogs.slice(0, 100).map((log, index) => (
                            <React.Fragment key={index}>
                                <ListItem alignItems="flex-start" sx={{ px: 3, py: 2 }}>
                                    <ListItemText
                                        disableTypography
                                        primary={
                                            <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                                                {log.success ? <IconSuccess color="success" sx={{ fontSize: 18 }} /> : <IconError color="error" sx={{ fontSize: 18 }} />}
                                                <Typography variant="subtitle2" fontWeight="bold">{log.feature}</Typography>
                                                <Chip
                                                    label={log.success ? 'Success' : 'Failed'}
                                                    size="small"
                                                    color={log.success ? 'success' : 'error'}
                                                    variant="outlined"
                                                    sx={{ height: 18, fontSize: '0.65rem' }}
                                                />
                                                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                                                    {new Date(log.timestamp).toLocaleString()}
                                                </Typography>
                                            </Stack>
                                        }
                                        secondary={
                                            <Box sx={{ mt: 1 }}>
                                                <Stack direction="row" spacing={2} sx={{ mb: 1, flexWrap: 'wrap', gap: 1 }}>
                                                    <Chip icon={<Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', ml: 1 }} />} label={log.model} size="small" sx={{ height: 24 }} />
                                                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                        {log.tokens} Tokens
                                                    </Typography>
                                                    {log.cachedTokens > 0 && (
                                                        <Chip
                                                            label={`⚡ ${log.cachedTokens} cached (${Math.round(log.cachedTokens / log.promptTokens * 100)}%)`}
                                                            size="small"
                                                            color="success"
                                                            variant="outlined"
                                                            sx={{ height: 20, fontSize: '0.7rem' }}
                                                        />
                                                    )}
                                                    {log.truncated && (
                                                        <Chip
                                                            label="⚠️ 输出被截断"
                                                            size="small"
                                                            color="warning"
                                                            sx={{ height: 20, fontSize: '0.7rem', fontWeight: 'bold' }}
                                                        />
                                                    )}
                                                    {log.duration && (
                                                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                                            {log.duration}ms
                                                        </Typography>
                                                    )}
                                                </Stack>
                                                {!log.success && log.error && (
                                                    <Alert severity="error" icon={false} sx={{ mt: 1, borderRadius: 2 }}>
                                                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                                            {log.error}
                                                        </Typography>
                                                    </Alert>
                                                )}
                                            </Box>
                                        }
                                    />
                                </ListItem>
                                {index < apiCallLogs.length - 1 && <Divider component="li" sx={{ opacity: 0.5 }} />}
                            </React.Fragment>
                        ))}
                    </List>
                </Paper>
            </CardContent>
        </Card>
    );

    const renderRefPanelContent = () => {
        if (activeSection === 0) {
            return (
                <Stack spacing={3}>
                    <Card variant="outlined" sx={{ p: 3, bgcolor: 'background.default', borderRadius: 2 }}>
                        <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>什么是功能配置？</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6, display: 'block' }}>
                            功能配置允许您为不同的 AI Agent 指派特定的 API 预设。这样您可以为不同的功能使用不同的模型或 API。
                        </Typography>
                    </Card>
                    <Card variant="outlined" sx={{ p: 3, bgcolor: 'background.default', borderRadius: 2 }}>
                        <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>最佳实践</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6, display: 'block' }}>
                            • Writer 适合使用高质量模型<br />
                            • Planner 需要较强的推理能力<br />
                            • Archivist 可使用性价比高的模型
                        </Typography>
                    </Card>
                </Stack>
            );
        }
        if (activeSection === 1) {
            return (
                <Stack spacing={3}>
                    <Card variant="outlined" sx={{ p: 3, bgcolor: 'background.default', borderRadius: 2 }}>
                        <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>什么是 API 预设？</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6, display: 'block' }}>
                            API 预设是一组完整的 API 配置，包括 API Key、Base URL 和模型名称。您可以创建多个预设以适应不同的使用场景。
                        </Typography>
                    </Card>
                    <Card variant="outlined" sx={{ p: 3, bgcolor: 'background.default', borderRadius: 2 }}>
                        <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>支持的 API</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6, display: 'block' }}>
                            支持所有兼容 OpenAI API 格式的服务，包括 OpenAI、Azure OpenAI、Claude (via proxy) 等。
                        </Typography>
                    </Card>
                </Stack>
            );
        }
        return (
            <Stack spacing={3}>
                <Card variant="outlined" sx={{ p: 3, bgcolor: 'background.default', borderRadius: 2 }}>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>关于调用日志</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6, display: 'block' }}>
                        调用日志记录了所有 API 请求的状态和 Token 消耗。您可以通过日志了解 API 使用情况和排查错误。
                    </Typography>
                </Card>
                <Alert severity="info" sx={{ fontSize: '0.75rem' }}>
                    日志仅保存在本地浏览器中，清空后无法恢复。
                </Alert>
            </Stack>
        );
    };

    // --- Main Render (Three-Column Layout) ---
    return (
        <Box sx={{ display: 'flex', height: '100%', bgcolor: 'background.default', overflow: 'hidden', position: 'relative' }}>
            {/* --- Left Navigation Sidebar --- */}
            {isMobile ? (
                <Drawer
                    variant="temporary"
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    sx={{ '& .MuiDrawer-paper': { width: 280, boxSizing: 'border-box' } }}
                >
                    {sidebarContent}
                </Drawer>
            ) : (
                <Box sx={{
                    width: 260,
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

            {/* --- Main Active Canvas --- */}
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
                {/* Top Header & Breadcrumbs */}
                <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                        {isMobile && <IconButton onClick={() => setDrawerOpen(true)}><IconMenu /></IconButton>}
                        <Breadcrumbs separator={<IconChevronRight sx={{ fontSize: 16 }} />}>
                            <Link underline="hover" color="inherit" sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => setActiveSection(0)}>全局设置</Link>
                            <Typography color="text.primary" fontWeight="bold">{getSectionTitle(activeSection)}</Typography>
                        </Breadcrumbs>
                    </Stack>

                    <Stack direction="row" spacing={1}>
                        <Tooltip title={showRefPanel ? "收起参考面板" : "显示参考面板"}>
                            <IconButton onClick={() => setShowRefPanel(!showRefPanel)} color={showRefPanel ? "primary" : "default"}>
                                <IconInfoCircle />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                </Box>

                {/* Global Progress Stepper (Compact) */}
                {!isMobile && (
                    <Box sx={{ px: 4, pt: 3, pb: 1, bgcolor: 'background.paper' }}>
                        <Stepper activeStep={activeSection} alternativeLabel connector={<StepConnector sx={{ '& .MuiStepConnector-line': { borderColor: 'divider' } }} />}>
                            {['配置', '预设', '日志'].map((label, index) => (
                                <Step key={label}>
                                    <StepLabel onClick={() => setActiveSection(index)} sx={{ cursor: 'pointer' }} StepIconProps={{ sx: { fontSize: 20 } }}>
                                        <Typography variant="caption">{label}</Typography>
                                    </StepLabel>
                                </Step>
                            ))}
                        </Stepper>
                    </Box>
                )}

                {/* --- Main Scrollable Content --- */}
                <Box sx={{ flexGrow: 1, overflowY: 'auto', scrollbarGutter: 'stable', p: isMobile ? 3 : 6, pb: 20 }}>
                    <Box sx={{ maxWidth: 1000, width: '100%', mx: 'auto' }}>
                        {activeSection === 0 && renderFeatureConfigSection()}
                        {activeSection === 1 && renderPresetsSection()}
                        {activeSection === 2 && renderLogsSection()}
                    </Box>
                </Box>
            </Box>

            {/* --- Right Context Reference Panel --- */}
            <Collapse in={showRefPanel} orientation="horizontal" sx={{ height: '100%', flexShrink: 0 }}>
                <Box sx={{ width: 300, minWidth: 300, flexShrink: 0, height: '100%', borderLeft: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                            <Typography variant="subtitle2" fontWeight="bold">{getRefTitle(activeSection)}</Typography>
                            <Typography variant="caption" color="text.secondary">用于辅助当前功能的参考</Typography>
                        </Box>
                        <IconButton size="small" onClick={() => setShowRefPanel(false)}><IconChevronLeft /></IconButton>
                    </Box>
                    <Box sx={{ flexGrow: 1, overflowY: 'auto', scrollbarGutter: 'stable', p: 2 }}>
                        {renderRefPanelContent()}
                    </Box>
                </Box>
            </Collapse>

            {/* Global Snackbar */}
            <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={handleCloseSnackbar}>
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%', borderRadius: 2 }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
                PaperProps={{ sx: { borderRadius: 4, p: 2 } }}
            >
                <DialogTitle sx={{ fontWeight: 'bold' }}>确认删除</DialogTitle>
                <DialogContent>
                    <Typography>确定要永久删除此 API 预设吗？相关的配置将被重置。</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirmOpen(false)} sx={{ borderRadius: 999 }}>取消</Button>
                    <Button onClick={handleDeletePreset} color="error" variant="contained" sx={{ borderRadius: 999 }}>确认删除</Button>
                </DialogActions>
            </Dialog>

            {/* Clear Logs Confirmation Dialog */}
            <Dialog
                open={logsClearConfirmOpen}
                onClose={() => setLogsClearConfirmOpen(false)}
                PaperProps={{ sx: { borderRadius: 4, p: 2 } }}
            >
                <DialogTitle sx={{ fontWeight: 'bold' }}>确认清空</DialogTitle>
                <DialogContent>
                    <Typography>确定要清空所有 API 调用记录吗？此操作无法撤销。</Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setLogsClearConfirmOpen(false)} sx={{ borderRadius: 999 }}>取消</Button>
                    <Button onClick={clearApiCallLogs} color="error" variant="contained" sx={{ borderRadius: 999 }}>确认清空</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};
