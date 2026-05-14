import React, { useState, useEffect } from 'react';
import { storage } from '../../services/storage';
import { useProject } from '../../contexts/ProjectContext';
import {
    Box, Card, CardContent, Typography,
    Button, IconButton, TextField, List, ListItem, ListItemText, ListItemButton, ListItemIcon,
    Stack, Alert, Snackbar, Divider,
    Tooltip, Avatar, Collapse, Link, Breadcrumbs, Drawer,
    Stepper, Step, StepLabel, StepConnector
} from '@mui/material';
import {
    AddRounded as IconPlus,
    DeleteRounded as IconDelete,
    InfoRounded as IconInfoCircle,
    SecurityRounded as IconSafe,
    FlashOnRounded as IconThunderbolt,
    CodeRounded as IconCode,
    SaveRounded as IconSave,
    RestoreRounded as IconRestore,
    ChevronRightRounded as IconChevronRight,
    ChevronLeftRounded as IconChevronLeft,
    MenuRounded as IconMenu,
    TuneRounded as IconTune,
    PsychologyRounded as IconBrain
} from '@mui/icons-material';
import { PromptEditor } from './PromptEditor';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';



export const Constraints = () => {
    const { currentProject } = useProject();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    // Notification
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
    const showMessage = (message, severity = 'success') => setSnackbar({ open: true, message, severity });

    // Layout State (Matching PlotArchitecture)
    const [activeSection, setActiveSection] = useState(0); // 0: Constraints, 1: Passion, 2: Prompts
    const [showRefPanel, setShowRefPanel] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Data State
    const [constraints, setConstraints] = useState([]);
    const [newConstraint, setNewConstraint] = useState('');

    // Passion Level State
    const [passionDefinitions, setPassionDefinitions] = useState({});
    const [passionLoading, setPassionLoading] = useState(false);

    const defaultPassionDefinitions = {
        systemName: "波动等级 (Passion Level)",
        systemDescription: "定义每个等级的具体含义，AI将根据此定义生成对应尺度的内容。",
        1: "清水/铺垫：注重情感交流，氛围渲染，无直接描写。",
        2: "升温/暧昧：肢体接触增加，情感张力增强，有明显的暗示。",
        3: "激烈/直白：高强度的情感爆发，大胆的动作描写。",
        4: "极限/狂热：极致的张力与激情，突破常规的描写尺度。",
        5: "禁忌/极致：完全释放的情感表达，无保留的描写尺度。"
    };

    useEffect(() => {
        if (currentProject) {
            loadConstraints();
            loadPassionDefinitions();
        }
    }, [currentProject]);

    const loadConstraints = async () => {
        if (currentProject) {
            const cons = await storage.getItemsByProject('constraints', currentProject.id);
            setConstraints(cons);
        }
    };

    const loadPassionDefinitions = async () => {
        if (!currentProject) return;
        try {
            const saved = await storage.getItem(`passion_definitions_${currentProject.id}`);
            if (saved) {
                // 数据库存储时会将对象序列化为 JSON 字符串，读取时需要解析
                const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
                setPassionDefinitions(parsed);
            } else {
                setPassionDefinitions(defaultPassionDefinitions);
            }
        } catch (error) {
            console.error('Failed to load passion definitions', error);
            // 解析失败时使用默认值
            setPassionDefinitions(defaultPassionDefinitions);
        }
    };

    const handleAddConstraint = async () => {
        if (newConstraint.trim() && currentProject) {
            try {
                // Split by newline and filter distinct non-empty lines
                const lines = newConstraint.split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0);

                if (lines.length === 0) return;

                // Add each constraint
                await Promise.all(lines.map(content =>
                    storage.addItem('constraints', {
                        projectId: currentProject.id,
                        content: content
                    })
                ));

                setNewConstraint('');
                loadConstraints();
                showMessage(`成功添加 ${lines.length} 条创作约束`);
            } catch (error) {
                showMessage('添加失败: ' + error.message, 'error');
            }
        }
    };

    const handleDeleteConstraint = async (id) => {
        try {
            await storage.deleteItem('constraints', id);
            loadConstraints();
            showMessage('创作约束已删除');
        } catch (error) {
            showMessage('删除失败: ' + error.message, 'error');
        }
    };

    const handlePassionChange = (level, value) => {
        setPassionDefinitions(prev => ({
            ...prev,
            [level]: value
        }));
    };

    const handleSavePassion = async () => {
        if (!currentProject) return;
        try {
            setPassionLoading(true);
            for (let i = 1; i <= 5; i++) {
                if (!passionDefinitions[i]?.trim()) {
                    showMessage(`请填写 Level ${i} 的定义`, 'warning');
                    return;
                }
            }
            await storage.setItem(`passion_definitions_${currentProject.id}`, passionDefinitions);
            showMessage('Passion Level 定义已保存');
        } catch (error) {
            showMessage('保存失败', 'error');
        } finally {
            setPassionLoading(false);
        }
    };

    const handleResetPassion = () => {
        if (window.confirm('确定恢复默认定义吗？')) {
            setPassionDefinitions(defaultPassionDefinitions);
        }
    };

    // --- Helper Functions ---
    const getLevelLabel = (level) => {
        const labels = { 1: "铺垫/日常", 2: "推进/升温", 3: "转折/冲突", 4: "高潮/爆发", 5: "极致/结局" };
        return labels[level] || "";
    };

    const getRefTitle = (section) => {
        const titles = ['关于创作约束', '关于 Passion Level', '关于提示词管理'];
        return titles[section] || '参考信息';
    };

    const getSectionTitle = (section) => {
        const titles = ['创作约束', 'Passion Level', '提示词管理'];
        return titles[section] || '';
    };

    // --- Sidebar Content ---
    const sidebarContent = (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                    <IconBrain sx={{ mr: 1.5, color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: 'inherit' }}>创作调控</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">管理 AI 生成行为</Typography>
            </Box>
            <List sx={{ flexGrow: 1, p: 2 }}>
                {[
                    { icon: <IconSafe />, label: '创作约束', desc: '全局规则' },
                    { icon: <IconThunderbolt />, label: 'Passion Level', desc: '张力曲线' },
                    { icon: <IconCode />, label: '提示词管理', desc: '底层模板' },
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
    const renderConstraintsSection = () => (
        <Card variant="outlined" sx={{ p: 6, borderRadius: 4, bgcolor: 'transparent' }}>
            <Box sx={{ mb: 6 }}>
                <Typography variant="h5" color="text.primary" fontWeight="bold" sx={{ mb: 0.5 }}>创作约束</Typography>
                <Typography variant="body2" color="text.secondary">制定全局创作规则，确保 AI 在生成过程中始终遵循您的设定。</Typography>
            </Box>
            <Divider sx={{ mb: 6, opacity: 0.5 }} />

            <CardContent sx={{ p: 0 }}>
                <Stack spacing={6}>
                    {/* Add New */}
                    <Box sx={{ bgcolor: 'action.hover', p: 3, borderRadius: 3 }}>
                        <TextField
                            fullWidth
                            multiline
                            minRows={2}
                            label="添加新约束"
                            placeholder="输入一条或多条约束（支持换行批量添加）&#10;例如：&#10;主角禁止使用枪械&#10;所有魔法必须有代价"
                            value={newConstraint}
                            onChange={(e) => setNewConstraint(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    handleAddConstraint();
                                }
                            }}
                            InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                            sx={{ mb: 2, '& .MuiOutlinedInput-root': { bgcolor: 'background.paper', borderRadius: 2 } }}
                        />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box display="flex" alignItems="center" gap={0.5} color="text.secondary">
                                <IconInfoCircle sx={{ fontSize: 16 }} />
                                <Typography variant="caption">按 Ctrl/Cmd+Enter 快速添加</Typography>
                            </Box>
                            <Button variant="contained" startIcon={<IconPlus />} onClick={handleAddConstraint} disabled={!newConstraint.trim()} sx={{ borderRadius: 999, px: 4 }}>
                                添加约束
                            </Button>
                        </Box>
                    </Box>

                    {/* List */}
                    <Box>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, fontWeight: 'bold' }}>
                            已生效约束 ({constraints.length})
                        </Typography>
                        <List sx={{ px: 0 }}>
                            {constraints.length === 0 && (
                                <Box textAlign="center" py={6} sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 3 }}>
                                    <Typography color="text.secondary">暂无创作约束</Typography>
                                </Box>
                            )}
                            {constraints.map((item, index) => (
                                <React.Fragment key={item.id}>
                                    <ListItem
                                        alignItems="flex-start"
                                        sx={{ py: 2, px: 2, borderRadius: 2, '&:hover': { bgcolor: 'action.hover' } }}
                                        secondaryAction={
                                            <IconButton edge="end" color="warning" onClick={() => handleDeleteConstraint(item.id)} size="small">
                                                <IconDelete />
                                            </IconButton>
                                        }
                                    >
                                        <Box sx={{ mr: 2, mt: 0.5 }}>
                                            <Avatar sx={{ width: 24, height: 24, fontSize: 12, fontWeight: 'bold', bgcolor: 'primary.soft', color: 'primary.main', border: '1px solid', borderColor: 'primary.main' }}>
                                                {index + 1}
                                            </Avatar>
                                        </Box>
                                        <ListItemText primary={item.content} primaryTypographyProps={{ variant: 'body1', sx: { lineHeight: 1.6 } }} sx={{ pr: 5 }} />
                                    </ListItem>
                                    {index < constraints.length - 1 && <Divider component="li" sx={{ opacity: 0.5, my: 1 }} />}
                                </React.Fragment>
                            ))}
                        </List>
                    </Box>
                </Stack>
            </CardContent>
        </Card>
    );

    const renderPassionSection = () => (
        <Card variant="outlined" sx={{ p: 6, borderRadius: 4, bgcolor: 'transparent' }}>
            <Box sx={{ mb: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                    <Typography variant="h5" color="text.primary" fontWeight="bold" sx={{ mb: 0.5 }}>Passion Level 定义</Typography>
                    <Typography variant="body2" color="text.secondary">定义每个等级的具体含义，AI 将严格遵循这些标准进行创作。</Typography>
                </Box>
                <Stack direction="row" spacing={2}>
                    <Button startIcon={<IconRestore />} onClick={handleResetPassion} sx={{ borderRadius: 999 }}>恢复默认</Button>
                    <Button variant="contained" startIcon={<IconSave />} onClick={handleSavePassion} disabled={passionLoading} sx={{ borderRadius: 999, px: 3 }}>保存定义</Button>
                </Stack>
            </Box>
            <Divider sx={{ mb: 6, opacity: 0.5 }} />
            <CardContent sx={{ p: 0 }}>
                <Stack spacing={4}>
                    {[1, 2, 3, 4, 5].map(level => (
                        <TextField
                            key={level}
                            label={`Level ${level} - ${getLevelLabel(level)}`}
                            fullWidth
                            multiline
                            minRows={2}
                            value={passionDefinitions[level] || ''}
                            onChange={(e) => handlePassionChange(level, e.target.value)}
                            placeholder={`输入 Level ${level} 的具体定义...`}
                            InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                        />
                    ))}
                </Stack>
            </CardContent>
        </Card>
    );

    const renderPromptSection = () => (
        <Card variant="outlined" sx={{ p: 6, borderRadius: 4, bgcolor: 'transparent' }}>
            <Box sx={{ mb: 6 }}>
                <Typography variant="h5" color="text.primary" fontWeight="bold" sx={{ mb: 0.5 }}>提示词管理</Typography>
                <Typography variant="body2" color="text.secondary">自定义 AI 在生成各部分内容时使用的底层提示词。</Typography>
            </Box>
            <Divider sx={{ mb: 6, opacity: 0.5 }} />
            <PromptEditor />
        </Card>
    );

    const renderRefPanelContent = () => {
        if (activeSection === 0) {
            return (
                <Stack spacing={3}>
                    <Card variant="outlined" sx={{ p: 3, bgcolor: 'background.default', borderRadius: 2 }}>
                        <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>什么是创作约束？</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6, display: 'block' }}>
                            创作约束是最高优先级的指令。无论在哪个生成阶段（大纲、分卷、章节），AI 都会尝试遵循这些规则。
                        </Typography>
                    </Card>
                    <Card variant="outlined" sx={{ p: 3, bgcolor: 'background.default', borderRadius: 2 }}>
                        <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>最佳实践</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6, display: 'block' }}>
                            • 约束应该清晰、具体<br />
                            • 避免设定互相矛盾的规则<br />
                            • 数量不宜过多（建议 3-5 条）
                        </Typography>
                    </Card>
                </Stack>
            );
        }
        if (activeSection === 1) {
            return (
                <Stack spacing={3}>
                    <Card variant="outlined" sx={{ p: 3, bgcolor: 'background.default', borderRadius: 2 }}>
                        <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>什么是 Passion Level？</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6, display: 'block' }}>
                            Passion Level 控制章节生成时的"张力曲线"。您可以为不同的等级（1-5）定义具体的描写尺度、情感强度或剧情节奏。
                        </Typography>
                    </Card>
                    <Card variant="outlined" sx={{ p: 3, bgcolor: 'background.default', borderRadius: 2 }}>
                        <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>如何使用？</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6, display: 'block' }}>
                            在章节细纲阶段，您可以为每个章节指定一个 Passion Level。AI 会根据您在此定义的标准来调整写作风格。
                        </Typography>
                    </Card>
                </Stack>
            );
        }
        return (
            <Stack spacing={3}>
                <Card variant="outlined" sx={{ p: 3, bgcolor: 'background.default', borderRadius: 2 }}>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>什么是提示词？</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6, display: 'block' }}>
                        提示词是发送给 AI 的底层指令模板。修改它们可以从根本上改变 AI 的行为和输出风格。
                    </Typography>
                </Card>
                <Alert severity="warning" sx={{ fontSize: '0.75rem' }}>
                    修改底层提示词可能导致生成不稳定，请谨慎操作。
                </Alert>
            </Stack>
        );
    };

    // --- No Project State ---
    if (!currentProject) {
        return (
            <Box textAlign="center" py={8}>
                <IconSafe sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6">请先选择一个项目</Typography>
                <Typography variant="body2" color="text.secondary">创作约束是针对每个项目设置的</Typography>
            </Box>
        );
    }

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
                            <Link underline="hover" color="inherit" sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => setActiveSection(0)}>创作调控</Link>
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
                            {['约束', 'Passion', '提示词'].map((label, index) => (
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
                        {activeSection === 0 && renderConstraintsSection()}
                        {activeSection === 1 && renderPassionSection()}
                        {activeSection === 2 && renderPromptSection()}
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

            <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
                <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
            </Snackbar>
        </Box>
    );
};
