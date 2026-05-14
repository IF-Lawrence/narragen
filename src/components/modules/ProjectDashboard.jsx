import React, { useState, useEffect, useRef } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { storage, storageEx } from '../../services/storage';
import { useTheme, alpha } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import {
    Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Snackbar, Alert
} from '@mui/material';
import { AddRounded as IconAdd } from '@mui/icons-material';

import { Book3D, AddBookCard } from '../common/Book3D.legacy';

export const ProjectDashboard = ({ onStartReading }) => {
    const { projects, createProject, selectProject, deleteProject, refreshProjects, clearCurrentProject } = useProject();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [allStats, setAllStats] = useState({});
    const [allOutlines, setAllOutlines] = useState({});
    const [notice, setNotice] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        const loadAllData = async () => {
            const stats = {};
            const outlines = {};
            for (const p of projects) {
                stats[p.id] = await getProjectStats(p.id);
                const outlineRow = await storageEx.getCoreOutline(p.id);
                if (outlineRow?.content) {
                    try {
                        let text = outlineRow.content;
                        if (text.includes('```')) text = text.replace(/```json\n?|```\n?|```/g, '');
                        outlines[p.id] = JSON.parse(text);
                    } catch { outlines[p.id] = null; }
                }
            }
            setAllStats(stats);
            setAllOutlines(outlines);
        };
        if (projects.length > 0) loadAllData();
    }, [projects]);

    const getProjectStats = async (projectId) => {
        try {
            const volumes = await storageEx.getItems('volumes', { projectId });
            const chapters = await storageEx.getItems('chapter_nodes', { projectId });
            const characters = await storage.getItemsByProject('characters', projectId);
            const totalWords = chapters.reduce((sum, c) => sum + (c.content || '').length, 0);
            return { volumeCount: volumes.length, chapterCount: chapters.length, characterCount: characters.length, totalWords };
        } catch {
            return { volumeCount: 0, chapterCount: 0, characterCount: 0, totalWords: 0 };
        }
    };


    const handleCreate = async () => {
        if (!newProjectName.trim() || isCreating) return;
        setIsCreating(true);
        try {
            // 创建项目，禁用自动导航
            const newProject = await createProject(newProjectName, { autoNavigate: false });

            // 随机选择一个尺寸预设和颜色预设
            const SIZE_PRESETS = ['album', 'academic', 'social', 'novel', 'popular', 'pocket'];
            const COLOR_PRESETS = ['#F9F4EE', '#000000', '#FFF126', '#678DE2', '#DC4925'];

            const randomSize = SIZE_PRESETS[Math.floor(Math.random() * SIZE_PRESETS.length)];
            const randomColor = COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)];

            // 更新项目的书籍样式
            const updatedBookStyle = {
                ...newProject.bookStyle,
                sizePreset: randomSize,
                spineColor: randomColor,
            };
            await storage.updateProject(newProject.id, { bookStyle: updatedBookStyle });

            // 刷新项目列表以获取更新后的样式
            await refreshProjects();

            setShowCreateModal(false);
            setNewProjectName('');
            setNotice('项目创建成功');

            // 展示新书的封面（不进入项目）
            setSelectedProjectId(newProject.id);
        } catch (error) {
            setNotice('创建项目失败: ' + error.message);
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteProject = async (projectId) => {
        try {
            await deleteProject(projectId);
            setSelectedProjectId(null);
            setNotice('项目已删除');
        } catch (error) {
            setNotice('删除项目失败: ' + error.message);
        }
    };

    const handleSaveProject = async (projectId, updates) => {
        try {
            await storage.updateProject(projectId, updates);
            await refreshProjects();
            setNotice('保存成功');
        } catch (error) {
            setNotice('保存失败: ' + error.message);
        }
    };

    const handleSync = async (project) => {
        try {
            const outlineRow = await storageEx.getCoreOutline(project.id);
            if (!outlineRow?.content) { setNotice('未找到核心大纲'); return; }
            let outline = null;
            try {
                let text = outlineRow.content;
                if (text.includes('```')) text = text.replace(/```json\n?|```\n?|```/g, '');
                outline = JSON.parse(text);
            } catch { }
            if (outline?.title) {
                const updates = { name: outline.title };
                if (outline.tags && Array.isArray(outline.tags)) {
                    updates.tags = outline.tags;
                }
                await storage.updateProject(project.id, updates);
                await refreshProjects();
                setNotice('已从大纲同步信息');
            } else { setNotice('大纲中未找到标题'); }
        } catch { setNotice('同步失败'); }
    };

    const handleExport = async (project) => {
        if (isExporting) return;
        setIsExporting(true);
        try {
            const volumes = await storageEx.getItems('volumes', { projectId: project.id });
            const allChapters = await storageEx.getItems('chapter_nodes', { projectId: project.id });
            const outlineRow = await storageEx.getCoreOutline(project.id);
            let outlineData = null;
            if (outlineRow?.content) {
                try {
                    let text = outlineRow.content;
                    if (text.includes('```')) text = text.replace(/```json\n?|```\n?|```/g, '');
                    outlineData = JSON.parse(text);
                } catch { }
            }
            const sortedVolumes = volumes.sort((a, b) => a.order - b.order);

            // 只导出纯正文小说
            let content = `《${project.name}》\n`;
            if (outlineData?.author) content += `作者：${outlineData.author}\n`;
            content += `\n`;

            for (const volume of sortedVolumes) {
                const volumeChapters = allChapters
                    .filter(c => c.volumeId === volume.id)
                    .sort((a, b) => a.order - b.order);

                content += `【第${volume.order}卷 ${volume.name || volume.title || ''}】\n\n`;

                // 检查该卷是否有任何已生成的章节
                const hasGeneratedChapters = volumeChapters.some(c => c.content && c.content.trim().length > 0);

                if (volumeChapters.length === 0) {
                    content += `（本卷暂无章节）\n\n`;
                } else if (!hasGeneratedChapters) {
                    content += `（本卷暂未生成正文）\n\n`;
                } else {
                    for (const chapter of volumeChapters) {
                        content += `第 ${chapter.order} 章 ${chapter.title || ''}\n\n`;
                        if (chapter.content && chapter.content.trim().length > 0) {
                            content += `${chapter.content}\n\n`;
                        } else {
                            content += `（暂未生成）\n\n`;
                        }
                    }
                }
            }
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${project.name}.txt`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
            setNotice('导出成功');
        } catch { setNotice('导出失败'); }
        finally { setIsExporting(false); }
    };

    const handleBookClick = (projectId, e) => {
        e?.stopPropagation();
        setSelectedProjectId(prev => prev === projectId ? null : projectId);
    };

    const handleBackgroundClick = () => {
        setSelectedProjectId(null);
    };

    // Refs (保留用于未来可能的功能)
    const scrollContainerRef = useRef(null);
    const bookRefs = useRef({});

    // 初始化时将书架整体居中
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (container && projects.length > 0) {
            // 延迟执行以确保DOM已完全渲染
            setTimeout(() => {
                const scrollWidth = container.scrollWidth;
                const clientWidth = container.clientWidth;
                // 滚动到中间位置
                const centerScroll = (scrollWidth - clientWidth) / 2;
                container.scrollTo({ left: centerScroll, behavior: 'instant' });
            }, 100);
        }
    }, [projects.length]);

    return (
        <Box sx={{
            // ... (keeping existing outer box styles)
            minHeight: '100vh',
            width: '100vw',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'background.default', // Ensure background
        }}>
            <Snackbar open={!!notice} autoHideDuration={3000} onClose={() => setNotice('')} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
                <Alert onClose={() => setNotice('')} severity={notice.includes('失败') ? 'error' : 'success'}>{notice}</Alert>
            </Snackbar>

            {/* Header: Centered Top */}
            <Box sx={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                zIndex: 10,
                mb: 8,
                pt: isMobile ? 4 : 8,
            }}>
                <Box sx={{ textAlign: 'center' }}>
                    <Typography variant={isMobile ? "h3" : "h1"} fontWeight="bold" sx={{
                        color: 'text.primary',
                        letterSpacing: '-0.05em',
                        fontSize: isMobile ? '4rem' : '8rem',
                        lineHeight: 0.9,
                    }}>
                        narragen
                    </Typography>
                </Box>


                <Button
                    variant="text"
                    size="large"
                    startIcon={<IconAdd />}
                    onClick={() => setShowCreateModal(true)}
                    sx={{
                        borderRadius: 28,
                        px: 3,
                        py: 1,
                        fontSize: '1rem',
                        fontWeight: 500,
                        color: 'text.secondary',
                        '&:hover': {
                            color: 'text.primary',
                            background: alpha(theme.palette.text.primary, 0.05),
                        }
                    }}
                >
                    新建书籍
                </Button>
            </Box >

            {/* Bookshelf: Centered Bottom */}
            <Box
                ref={scrollContainerRef}
                onClick={handleBackgroundClick} // 点击空白区域关闭已打开的书籍
                sx={{
                    flex: 1,
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflowX: 'auto',
                    overflowY: 'visible',
                    pt: 20, // 为上移 80px 留出充足空间
                    pb: 10,
                    // Hide scrollbars
                    '&::-webkit-scrollbar': { display: 'none' },
                    scrollbarWidth: 'none',
                }}
            >
                <Box sx={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    mx: 'auto',
                    minWidth: 'max-content',
                    minHeight: '100%',
                    px: '10vw',
                    gap: 0,
                    overflow: 'visible', // 确保内层也不裁剪
                }}>
                    {
                        projects.map(project => (
                            <Box
                                key={project.id}
                                ref={el => bookRefs.current[project.id] = el}
                                sx={{
                                    transition: 'all 0.3s ease',
                                    display: 'flex',
                                    alignItems: 'flex-end',
                                    flexShrink: 0,
                                    mx: 0, // 重置间距，因为Book3D内部宽度计算已变紧凑
                                }}
                            >
                                <Book3D
                                    project={project}
                                    isOpen={selectedProjectId === project.id}
                                    totalWords={allStats[project.id]?.totalWords || 0}
                                    shouldTilt={false}
                                    onClick={(e) => handleBookClick(project.id, e)}
                                    onEnter={() => selectProject(project.id)}
                                    onRead={() => onStartReading?.(project.id)}
                                    onEdit={(updates) => handleSaveProject(project.id, updates)}
                                    onDelete={() => handleDeleteProject(project.id)}
                                    onSync={() => handleSync(project)}
                                    onExport={() => handleExport(project)}
                                    bookStyle={project.bookStyle}
                                    projectStats={allStats[project.id]}
                                    projectOutline={allOutlines[project.id]}
                                />
                            </Box>
                        ))
                    }
                </Box>
            </Box >

            {/* Create Dialog */}
            < Dialog open={showCreateModal} onClose={() => setShowCreateModal(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 2 } }}>
                <DialogTitle sx={{ textAlign: 'center', fontWeight: 'bold' }}>
                    <Typography variant="h6" component="span" fontWeight="bold">新建项目</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>为你的新书起一个名字</Typography>
                </DialogTitle>
                <DialogContent>
                    <TextField autoFocus margin="dense" label="项目名称" placeholder="例如：我的第一本小说" fullWidth variant="outlined" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleCreate()} sx={{ mt: 1 }} />
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'center', px: 3, pb: 2 }}>
                    <Button onClick={() => setShowCreateModal(false)}>取消</Button>
                    <Button onClick={handleCreate} variant="contained" disabled={!newProjectName.trim() || isCreating} sx={{ borderRadius: 2, px: 3 }}>创建</Button>
                </DialogActions>
            </Dialog >
        </Box >
    );
};

export default ProjectDashboard;
