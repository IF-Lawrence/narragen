import React, { useState, useEffect } from 'react';
import DebouncedTextField from '../common/DebouncedTextField';
import {
    Box, Card, CardContent, Typography, Button, Stack,
    List, ListItem, ListItemText, IconButton, Chip,
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Divider, Accordion, AccordionSummary, AccordionDetails,
    Alert, Snackbar, CircularProgress
} from '@mui/material';
import {
    EditRounded as IconEdit,
    DeleteRounded as IconDelete,
    RefreshRounded as IconRefresh,
    DownloadRounded as IconDownload,
    UploadRounded as IconUpload,
    ExpandMoreRounded as IconExpandMore
} from '@mui/icons-material';
import { PromptManager } from '../../services/PromptManager';
import { DEFAULT_PROMPTS, getAllAgents } from '../../config/defaultPrompts';
import { useProject } from '../../contexts/ProjectContext';

export const PromptEditor = () => {
    const { currentProject } = useProject();
    const [prompts, setPrompts] = useState([]);
    const [selectedPrompt, setSelectedPrompt] = useState(null);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        system: '',
        template: ''
    });

    const showMessage = (message, severity = 'success') => setSnackbar({ open: true, message, severity });

    useEffect(() => {
        loadPrompts();
    }, [currentProject]);

    const loadPrompts = async () => {
        try {
            setLoading(true);
            console.log('[Load] Loading prompts for project:', currentProject?.id);
            const allPrompts = await PromptManager.listPrompts();
            const customPrompts = await PromptManager.listCustomPrompts(currentProject?.id);
            console.log('[Load] Custom prompts found:', customPrompts);

            const merged = allPrompts.map(p => {
                const matches = customPrompts.filter(c => c.id === p.id);
                const projectCustom = matches.find(c => c.projectId === currentProject?.id);
                const globalCustom = matches.find(c => !c.projectId);

                if (projectCustom) console.log(`[Load] Using project custom for ${p.id}:`, projectCustom.name);
                else if (globalCustom) console.log(`[Load] Using global custom for ${p.id}:`, globalCustom.name);

                return projectCustom || globalCustom || p;
            });

            console.log('[Load] Final merged prompts:', merged);
            setPrompts(merged);
        } catch (err) {
            console.error('Failed to load prompts:', err);
            showMessage('加载提示词失败', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (prompt) => {
        setSelectedPrompt(prompt);
        setFormData({
            name: prompt.name || '',
            description: prompt.description || '',
            system: prompt.system || '',
            template: prompt.template || ''
        });
        setEditModalVisible(true);
    };

    const handleSave = async () => {
        try {
            await PromptManager.savePrompt(
                selectedPrompt.agent,
                selectedPrompt.type,
                {
                    ...selectedPrompt,
                    ...formData,
                    customized: true
                },
                currentProject?.id
            );

            showMessage('保存成功');
            setEditModalVisible(false);
            loadPrompts();
        } catch (err) {
            console.error('Failed to save prompt:', err);
            showMessage('保存失败: ' + err.message, 'error');
        }
    };

    const handleReset = async (prompt) => {
        if (!window.confirm('确定要重置为默认提示词吗？')) return;

        try {
            await PromptManager.resetPrompt(prompt.agent, prompt.type, currentProject?.id);
            showMessage('已重置');
            loadPrompts();
        } catch (err) {
            console.error('Failed to reset prompt:', err);
            showMessage('重置失败', 'error');
        }
    };

    const handleExport = async (prompt) => {
        try {
            const jsonString = await PromptManager.exportPrompt(prompt.agent, prompt.type, currentProject?.id);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `prompt_${prompt.id}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            showMessage('导出成功');
        } catch (err) {
            console.error('Failed to export prompt:', err);
            showMessage('导出失败', 'error');
        }
    };

    // Import state
    const [importModalVisible, setImportModalVisible] = useState(false);
    const [importJson, setImportJson] = useState('');
    const [importTarget, setImportTarget] = useState(null);

    const handleImportClick = (prompt) => {
        setImportTarget(prompt);
        setImportJson('');
        setImportModalVisible(true);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            setImportJson(e.target.result);
        };
        reader.readAsText(file);
    };

    const handleImportConfirm = async () => {
        if (!importJson.trim()) return;

        try {
            // Pre-process: Replace smart quotes which often cause JSON parse errors
            const sanitizedJson = importJson
                .replace(/[\u201C\u201D]/g, '"') // Replace smart double quotes
                .replace(/[\u2018\u2019]/g, "'"); // Replace smart single quotes (though strictly JSON uses double)

            let data;
            try {
                data = JSON.parse(sanitizedJson);
            } catch (e) {
                throw new Error(`JSON 格式错误: ${e.message}。请检查是否有多余的逗号或引号。`);
            }

            // Basic validation
            if (!data.name && !data.system && !data.template) {
                throw new Error('无效的提示词配置文件：缺少必要字段 (name, system, template)');
            }

            // Remove system fields from imported data to prevent conflicts
            const { id, agent, type, projectId, originalId, ...cleanData } = data;

            console.log('[Import] Cleaned data:', cleanData);
            console.log('[Import] Target:', importTarget);

            // Merge with existing target to ensure we keep the correct agent/type
            const newPrompt = {
                ...importTarget,
                ...cleanData,
                // Ensure critical fields are not overwritten
                agent: importTarget.agent,
                type: importTarget.type,
                customized: true
            };

            console.log('[Import] New Prompt Object:', newPrompt);

            await PromptManager.savePrompt(
                importTarget.agent,
                importTarget.type,
                newPrompt,
                currentProject?.id
            );

            console.log('[Import] Save complete for project:', currentProject?.id);

            showMessage('导入成功');
            setImportModalVisible(false);
            loadPrompts();
        } catch (err) {
            console.error('Import failed:', err);
            showMessage('导入失败: ' + err.message, 'error');
        }
    };

    // Group prompts by agent
    const groupedPrompts = prompts.reduce((acc, prompt) => {
        if (!acc[prompt.agent]) {
            acc[prompt.agent] = [];
        }
        acc[prompt.agent].push(prompt);
        return acc;
    }, {});

    const agentNames = {
        writer: '作家（Writer）',
        planner: '主编（Planner）',
        stylist: '润色师（Stylist）',
        critic: '评论家（Critic）',
        archivist: '记忆官（Archivist）'
    };

    return (
        <Box>
            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
            </Snackbar>


            {loading ? (
                <Box textAlign="center" py={8}>
                    <CircularProgress />
                </Box>
            ) : (
                <Box sx={{ '& > .MuiAccordion-root': { mb: 3 }, '& > .MuiAccordion-root:last-child': { mb: 0 } }}>
                    {Object.entries(groupedPrompts).map(([agent, agentPrompts], agentIndex) => (
                        <Accordion
                            key={agent}
                            defaultExpanded={true}
                            disableGutters
                            sx={{
                                borderRadius: '16px !important',
                                border: '1px solid',
                                borderColor: 'divider',
                                bgcolor: 'transparent',
                                boxShadow: 'none',
                                transition: 'all 0.2s',
                                overflow: 'hidden',
                                '&:hover': { bgcolor: 'background.paper', borderColor: 'primary.main' },
                                '&:before': { display: 'none' }
                            }}
                        >
                            <AccordionSummary
                                expandIcon={<IconExpandMore />}
                                sx={{ px: 3, py: 1 }}
                            >
                                <Stack direction="row" alignItems="center" spacing={2}>
                                    <Typography variant="h6" fontWeight="bold">{agentNames[agent] || agent}</Typography>
                                    <Chip label={`${agentPrompts.length} 个提示词`} size="small" color="primary" variant="outlined" />
                                </Stack>
                            </AccordionSummary>
                            <AccordionDetails sx={{ p: 0, px: 1 }}>
                                <List disablePadding>
                                    {agentPrompts.map((prompt, index) => (
                                        <React.Fragment key={prompt.id}>
                                            <ListItem
                                                sx={{
                                                    py: 2,
                                                    px: 3,
                                                    borderRadius: 2,
                                                    transition: 'background-color 0.2s',
                                                    '&:hover': { bgcolor: 'action.hover' }
                                                }}
                                                secondaryAction={
                                                    <Stack direction="row" spacing={1}>
                                                        <Button
                                                            size="small"
                                                            startIcon={<IconEdit />}
                                                            onClick={() => handleEdit(prompt)}
                                                            sx={{ borderRadius: 999 }}
                                                        >
                                                            编辑
                                                        </Button>
                                                        <Button
                                                            size="small"
                                                            startIcon={<IconUpload />}
                                                            onClick={() => handleImportClick(prompt)}
                                                            sx={{ borderRadius: 999 }}
                                                        >
                                                            导入
                                                        </Button>
                                                        <Button
                                                            size="small"
                                                            startIcon={<IconDownload />}
                                                            onClick={() => handleExport(prompt)}
                                                            sx={{ borderRadius: 999 }}
                                                        >
                                                            导出
                                                        </Button>
                                                        {prompt.customized && (
                                                            <Button
                                                                size="small"
                                                                color="warning"
                                                                startIcon={<IconRefresh />}
                                                                onClick={() => handleReset(prompt)}
                                                                sx={{ borderRadius: 999 }}
                                                            >
                                                                重置
                                                            </Button>
                                                        )}
                                                    </Stack>
                                                }
                                            >
                                                <ListItemText
                                                    primary={
                                                        <Stack direction="row" alignItems="center" spacing={1}>
                                                            <Typography fontWeight={500}>{prompt.name}</Typography>
                                                            {prompt.customized && (
                                                                <Chip label="已自定义" size="small" color="warning" />
                                                            )}
                                                        </Stack>
                                                    }
                                                    secondary={prompt.description}
                                                    secondaryTypographyProps={{ sx: { lineHeight: 1.6 } }}
                                                />
                                            </ListItem>
                                            {index < agentPrompts.length - 1 && <Divider sx={{ opacity: 0.3, mx: 2 }} />}
                                        </React.Fragment>
                                    ))}
                                </List>
                            </AccordionDetails>
                        </Accordion>
                    ))}
                </Box>
            )}

            {/* Edit Dialog */}
            <Dialog
                open={editModalVisible}
                onClose={() => setEditModalVisible(false)}
                maxWidth="lg"
                fullWidth
            >
                <DialogTitle>编辑提示词: {selectedPrompt?.name}</DialogTitle>
                <DialogContent dividers>
                    {selectedPrompt && (
                        <Stack spacing={4} sx={{ pt: 2 }}>
                            <DebouncedTextField
                                label="名称"
                                fullWidth
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                            />

                            <DebouncedTextField
                                label="描述"
                                fullWidth
                                multiline
                                minRows={2}
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                            />

                            <Divider />

                            <DebouncedTextField
                                label="系统提示词"
                                fullWidth
                                multiline
                                minRows={3}
                                value={formData.system}
                                onChange={(e) => setFormData({ ...formData, system: e.target.value })}
                                placeholder="系统级提示词，定义 Agent 的角色和基本行为"
                                InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                            />

                            <Box>
                                <DebouncedTextField
                                    label="主提示词模板"
                                    fullWidth
                                    multiline
                                    minRows={15}
                                    value={formData.template}
                                    onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                                    placeholder="主提示词模板，使用 {{variable}} 语法插入变量"
                                    InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                                    sx={{
                                        '& .MuiInputBase-input': {
                                            fontFamily: 'monospace',
                                            fontSize: 13
                                        }
                                    }}
                                />
                                {selectedPrompt.variables && selectedPrompt.variables.length > 0 && (
                                    <Box sx={{ mt: 2 }}>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                            支持变量替换语法：
                                        </Typography>
                                        <Stack direction="row" flexWrap="wrap" gap={1}>
                                            {selectedPrompt.variables.map(v => (
                                                <Chip
                                                    key={v.name}
                                                    label={`{{${v.name}}}`}
                                                    size="small"
                                                    color="primary"
                                                    variant="outlined"
                                                />
                                            ))}
                                        </Stack>
                                    </Box>
                                )}
                            </Box>

                            {selectedPrompt.variables && selectedPrompt.variables.length > 0 && (
                                <>
                                    <Divider>
                                        <Typography variant="body2" color="text.secondary">可用变量</Typography>
                                    </Divider>
                                    <List dense>
                                        {selectedPrompt.variables.map((variable) => (
                                            <ListItem key={variable.name} sx={{ py: 0.5 }}>
                                                <ListItemText
                                                    primary={
                                                        <Chip
                                                            label={`{{${variable.name}}}`}
                                                            size="small"
                                                            color="primary"
                                                            variant="outlined"
                                                        />
                                                    }
                                                    secondary={
                                                        <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                                                            <Box component="span" sx={{ color: 'text.secondary' }}>
                                                                {variable.description}
                                                            </Box>
                                                            {variable.example && (
                                                                <Box component="span" sx={{ ml: 1, fontStyle: 'italic', color: 'text.secondary' }}>
                                                                    示例: {variable.example}
                                                                </Box>
                                                            )}
                                                        </Box>
                                                    }
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                </>
                            )}
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 3 }}>
                    <Button onClick={() => setEditModalVisible(false)} sx={{ borderRadius: 999 }}>
                        取消
                    </Button>
                    <Button variant="contained" onClick={handleSave} sx={{ borderRadius: 999, px: 4 }}>
                        保存
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Import Dialog */}
            <Dialog
                open={importModalVisible}
                onClose={() => setImportModalVisible(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>导入提示词: {importTarget?.name}</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ pt: 1 }}>
                        <Alert severity="info">
                            导入将会覆盖当前的提示词配置。支持直接从其他项目导出的 JSON 文件。
                        </Alert>

                        <Box>
                            <Button
                                variant="outlined"
                                component="label"
                                startIcon={<IconUpload />}
                                fullWidth
                                sx={{ borderRadius: 2, borderStyle: 'dashed', py: 2 }}
                            >
                                选择 JSON 文件
                                <input
                                    type="file"
                                    hidden
                                    accept=".json"
                                    onChange={handleFileUpload}
                                />
                            </Button>
                        </Box>

                        <Divider>或者粘贴 JSON 内容</Divider>

                        <DebouncedTextField
                            label="JSON 配置内容"
                            fullWidth
                            multiline
                            minRows={6}
                            maxRows={12}
                            value={importJson}
                            onChange={(e) => setImportJson(e.target.value)}
                            placeholder='{"name": "...", "system": "...", "template": "..."}'
                            InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                            sx={{
                                '& .MuiInputBase-input': {
                                    fontFamily: 'monospace',
                                    fontSize: 12
                                }
                            }}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 3 }}>
                    <Button onClick={() => setImportModalVisible(false)} sx={{ borderRadius: 999 }}>
                        取消
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleImportConfirm}
                        disabled={!importJson.trim()}
                        sx={{ borderRadius: 999, px: 4 }}
                    >
                        确认导入
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};
