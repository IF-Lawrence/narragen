import React, { useState, useEffect, useRef } from 'react';
import {
    Box, Typography, IconButton, Button, Stack, Tooltip,
    Popover, Divider, Dialog, Fade, Backdrop, Chip, TextField, Slider, FormControlLabel, Switch, CircularProgress
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import {
    PlayArrowRounded as IconPlay,
    DeleteRounded as IconDelete,
    AutoStoriesRounded as IconBook,
    PaletteRounded as IconPalette,
    LoginRounded as IconEnter,
    SyncRounded as IconSync,
    DownloadRounded as IconExport,
    EditRounded as IconEdit,
    ImageRounded as IconImage,
    AutoFixHighRounded as IconMagic,
    ColorizeRounded as IconPicker,
    SmartToyRounded as IconAI,
    CloseRounded as IconClose,
    CheckRounded as IconCheck
} from '@mui/icons-material';
import { extractColorSync } from '../../services/dynamicColor';
import { buildCoverPrompt, generateCoverPromptWithLLM, getImageApiConfig, generatePortrait, startBackgroundCoverGeneration, isCoverGenerating, getCoverDraft, clearCoverDraft, cancelCoverGeneration } from '../../services/imageGeneration';
import { storage, storageEx } from '../../services/storage';

// 上传封面图像到服务器（支持 File 对象或 Base64 字符串）
const uploadCoverImage = async (fileOrBase64, type = 'covers') => {
    // 如果是 File 对象，使用 FormData 直接上传
    if (fileOrBase64 instanceof File || fileOrBase64 instanceof Blob) {
        try {
            const formData = new FormData();
            formData.append('file', fileOrBase64);
            formData.append('type', type);

            const response = await fetch('/api/images/upload', {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error('Upload failed');
            const result = await response.json();
            return result.url;
        } catch (error) {
            console.error('Failed to upload file:', error);
            throw error;
        }
    }

    // 如果是字符串，检查是 Base64 还是已有的 URL
    if (typeof fileOrBase64 === 'string') {
        if (!fileOrBase64.startsWith('data:')) {
            return fileOrBase64; // 已经是 URL，直接返回
        }
        // Base64 兼容模式
        const timestamp = Date.now();
        const filename = `cover_${timestamp}.png`;
        try {
            const response = await fetch('/api/images/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, filename, data: fileOrBase64 })
            });
            if (!response.ok) throw new Error('Upload failed');
            const result = await response.json();
            return result.url;
        } catch (error) {
            console.error('Failed to upload base64:', error);
            throw error;
        }
    }

    return fileOrBase64;
};

// 书脊颜色预设（精选5色）
const PRESET_COLORS = [
    '#F9F4EE', // 奶油白
    '#000000', // 纯黑
    '#FFF126', // 明黄
    '#678DE2', // 天蓝
    '#DC4925', // 朱红
];

// 书籍尺寸预设（基于中国标准开本）
// displayHeight: 按实际mm尺寸比例映射到像素（126mm→280px, 285mm→450px）
const BOOK_SIZE_PRESETS = [
    { id: 'album', name: '大型画册', width: 210, height: 285, ratio: 0.737, displayHeight: 680 },
    { id: 'academic', name: '学术著作', width: 185, height: 260, ratio: 0.712, displayHeight: 630 },
    { id: 'social', name: '社科励志', width: 170, height: 240, ratio: 0.708, displayHeight: 600 },
    { id: 'novel', name: '经典小说', width: 145, height: 210, ratio: 0.690, displayHeight: 550 },
    { id: 'popular', name: '通俗读物', width: 130, height: 184, ratio: 0.707, displayHeight: 510 },
    { id: 'pocket', name: '口袋书', width: 92, height: 126, ratio: 0.730, displayHeight: 420 },
];

// 书脊厚度快捷预设
const SPINE_THICKNESS_PRESETS = [
    { name: '薄', value: 60 },
    { name: '标准', value: 90 },
    { name: '厚', value: 135 },
    { name: '超厚', value: 180 },
];

// 判断颜色是否为浅色
const isLightColor = (color) => {
    if (!color) return false;
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 105; // 降低门槛（从155降到105），使明亮的中性色（如亮红）也能进入浅色逻辑
};

// 获取UI友好的颜色（浅色时返回深色版本，确保对比度）
const getContrastSafeColor = (color) => {
    if (!color) return '#5d4037';
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;

    // 如果颜色太浅（亮度>150），使用固定的深棕色，确保与背景和文字都有良好对比
    if (brightness > 150) {
        return '#3e2723'; // Material Design Brown 900 - 很深的棕色
    }
    return color;
};

export const Book3D = ({
    project,
    isOpen,
    totalWords = 0,
    shouldTilt = false, // 由父组件计算是否应该倾斜
    onClick,
    onEnter,
    onRead,
    onEdit,
    onDelete,
    onExport,
    onSync,
    bookStyle = {},
    projectStats,
    projectOutline
}) => {
    const theme = useTheme();
    const [isHovered, setIsHovered] = useState(false);

    // 生成确定性的随机值，用于书架布局
    const randomStyles = React.useMemo(() => {
        const hash = (project?.id || 'default').split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
        // 移除倾斜功能，所有书籍保持垂直
        const rotateZ = 0;
        const marginRight = Math.abs(hash % 6);
        return { rotateZ, marginRight };
    }, [project?.id]);

    const [showDetails, setShowDetails] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showStyleEditor, setShowStyleEditor] = useState(false);
    const [styleAnchorEl, setStyleAnchorEl] = useState(null);
    const [editingStyle, setEditingStyle] = useState(bookStyle);
    const [isBookOpened, setIsBookOpened] = useState(false); // 书籍是否翻开（封面翻转）
    const [coverRotation, setCoverRotation] = useState(-0.5); // 封面图的随机倾斜角度
    const [tilt, setTilt] = useState({ x: 0, y: 0 }); // 3D 视差倾斜角度 (打开状态)
    const [spineHoverTilt, setSpineHoverTilt] = useState({ x: 0, y: 0 }); // 书脊悬停倾斜角度 (关闭状态)
    const [isFullyOpen, setIsFullyOpen] = useState(false); // 追踪旋转动画是否完成

    const isSavingRef = useRef(false);

    // AI 封面生成状态
    const [showCoverGenModal, setShowCoverGenModal] = useState(false);
    const [coverPrompt, setCoverPrompt] = useState('');
    const [coverStylePrompt, setCoverStylePrompt] = useState('');
    const [coverGenerating, setCoverGenerating] = useState(false);
    const [coverPromptLoading, setCoverPromptLoading] = useState(false); // 提示词生成加载状态
    const [coverDesignStyle, setCoverDesignStyle] = useState(''); // LLM 选择的设计风格
    const [generatedCoverPreview, setGeneratedCoverPreview] = useState('');
    const [coverGenError, setCoverGenError] = useState('');

    // 同步 bookStyle 到 editingStyle
    // 当外部数据更新（或初始化）时更新本地状态，但在刚保存完的一瞬间跳过（防止旧数据回弹导致闪烁）
    React.useEffect(() => {
        if (showStyleEditor) return; // 编辑中不打断

        if (isSavingRef.current) {
            // 是因为保存操作导致的 Effect 触发（showStyleEditor 变 false）
            // 此时 bookStyle 还是旧的，不要覆盖 editingStyle
            isSavingRef.current = false;
            return;
        }

        setEditingStyle(bookStyle || {});
    }, [bookStyle, showStyleEditor]);

    // 3D 视差效果：鼠标移动时倾斜封面（仅在完全打开后生效）
    const handleMouseMove = (e) => {
        if (!isFullyOpen) return; // 只有完全打开后才启用
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        // 计算倾斜角度 (最大 ±8 度)
        const tiltX = ((y - centerY) / centerY) * -8;
        const tiltY = ((x - centerX) / centerX) * 8;
        setTilt({ x: tiltX, y: tiltY });
    };

    // 书脊悬停时的微动效果 (Follow cursor)
    const handleSpineHover = (e) => {
        if (isOpen) return; // 打开状态下不处理
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        // 计算微动角度 (最大 ±15 度，更灵敏)
        // 鼠标在右 -> 书脊向左转 (rotateY负值)
        const tiltY = ((x - centerX) / centerX) * 15;

        // 鼠标在下 -> 书脊向下看 (rotateX负值)
        const tiltX = ((y - centerY) / centerY) * -10;

        setSpineHoverTilt({ x: tiltX, y: tiltY });
    };

    const handleMouseLeave = () => {
        setTilt({ x: 0, y: 0 }); // 重置倾斜
        setSpineHoverTilt({ x: 0, y: 0 }); // 重置书脊倾斜
    };

    // 从样式设置中读取书脊厚度（实时预览支持）
    // 修复闪烁：始终优先取 editingStyle，只有从未编辑过才回退到 bookStyle
    const spineWidth = editingStyle?.spineWidth || bookStyle?.spineWidth || 90;
    // 实时预览：编辑模式下优先使用 editingStyle 中的临时值
    const spineColor = editingStyle?.spineColor || bookStyle?.spineColor || '#6750A4';
    const titleStyle = bookStyle?.titleStyle || 'vertical';
    const textColor = isLightColor(spineColor) ? '#212121' : '#ffffff';
    // UI 元素使用的安全颜色（浅色时自动加深，确保可读性）
    const uiColor = getContrastSafeColor(spineColor);
    // uiColor 对应的对比文字颜色
    const uiTextColor = isLightColor(uiColor) ? '#212121' : '#ffffff';

    // 从尺寸预设获取书籍尺寸（高度和宽度按实际比例）
    const currentSizePreset = editingStyle?.sizePreset || bookStyle?.sizePreset || 'novel';
    const sizePreset = BOOK_SIZE_PRESETS.find(p => p.id === currentSizePreset) || BOOK_SIZE_PRESETS[3];
    const bookHeight = sizePreset.displayHeight;
    const coverWidth = Math.round(bookHeight * sizePreset.ratio);

    // 书籍收起时重置翻开状态和悬停状态
    React.useEffect(() => {
        setIsHovered(false); // 无论进入还是退出选中状态，都先重置悬停，防止状态卡死
        if (isOpen) {
            // 等待旋转动画接近完成 (1.2s) 后启用投影和视差效果，防止过度期间随鼠标摆动
            const timer = setTimeout(() => setIsFullyOpen(true), 600);
            return () => clearTimeout(timer);
        } else {
            setIsFullyOpen(false); // 立即禁用视差效果
            setIsBookOpened(false);
            setShowDetails(false);
        }
    }, [isOpen]);

    // 自动同步大纲：当书籍详情页打开时，自动触发同步（仅首次）
    const hasSyncedRef = React.useRef(false);
    React.useEffect(() => {
        if (isBookOpened && onSync && !hasSyncedRef.current) {
            console.log('[Book3D] Auto-syncing outline on book detail open...');
            hasSyncedRef.current = true;
            onSync();
        }
        // 关闭时重置标志，下次打开时可以再次同步
        if (!isBookOpened) {
            hasSyncedRef.current = false;
        }
    }, [isBookOpened]); // 移除 onSync 依赖，避免函数引用变化触发循环

    // 每次翻开书籍时，随机生成封面的倾斜角度
    React.useEffect(() => {
        if (isBookOpened) {
            const randomRot = (Math.random() * 4 - 2).toFixed(1);
            setCoverRotation(parseFloat(randomRot));
        }
    }, [isBookOpened]);

    const handleStyleClick = (e) => {
        e.stopPropagation();
        if (showStyleEditor) {
            // 已打开，执行保存并关闭
            handleStyleSave();
        } else {
            // 未打开，打开编辑器
            setShowStyleEditor(true);
            setEditingStyle(bookStyle || {});
        }
    };

    const handleStyleClose = () => {
        setShowStyleEditor(false);
    };

    const handleStyleSave = async () => {
        isSavingRef.current = true; // 标记开始保存

        // 从editingStyle中分离封面和书籍样式
        const { coverImage, ...styleWithoutCover } = editingStyle;
        const updates = { bookStyle: styleWithoutCover };

        // 封面处理逻辑:
        // - coverImage 存在 -> 上传到服务器（函数会自动处理 Base64 和 URL）
        // - coverImage 是 null -> 用户明确要删除封面
        // - coverImage 是 undefined -> 用户没有编辑封面, 不更新
        if (coverImage) {
            try {
                const serverUrl = await uploadCoverImage(coverImage);
                updates.cover = serverUrl;
            } catch (error) {
                console.error('Failed to upload cover');
                // 不降级，不保存封面
            }
        } else if (coverImage === null) {
            // 用户明确点击了移除封面按钮
            updates.cover = null;
        }
        // 如果 coverImage === undefined 则不更新 cover 字段

        onEdit?.(updates);
        handleStyleClose();
    };

    const handleCoverClick = (e) => {
        e.stopPropagation();
        if (isOpen) {
            // 点击封面：打开3D书籍弹窗
            setIsBookOpened(true);
        }
    };

    const handleDeleteClick = (e) => {
        e.stopPropagation();
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = (e) => {
        e.stopPropagation();
        onDelete?.();
        setShowDeleteConfirm(false);
    };

    // 使用共享的 MD3 取色服务提取封面主色调
    const extractColorFromImage = async (imageSrc, autoSave = false, extraUpdates = {}) => {
        if (!imageSrc) return;
        extractColorSync(imageSrc, async (color) => {
            let updates = null;

            if (color) {
                setEditingStyle(prev => ({ ...prev, spineColor: color }));
            }

            // 自动保存不能依赖取色成功：封面生成已完成时，即使取色失败也要保存封面。
            if (autoSave) {
                const currentBookStyle = project?.bookStyle || {};
                const newBookStyle = color
                    ? { ...currentBookStyle, spineColor: color }
                    : currentBookStyle;

                updates = { ...extraUpdates, bookStyle: newBookStyle };

                if (updates.cover) {
                    try {
                        updates.cover = await uploadCoverImage(updates.cover);
                    } catch {
                        console.error('Failed to upload cover during color extraction');
                        delete updates.cover;
                    }
                }

                onEdit?.(updates);
            }
        });
    };


    // 一键生成封面（无弹窗）
    const handleOneClickCoverGeneration = async () => {
        // 检查是否已有正在进行的任务
        if (project?.id && (isCoverGenerating(project.id) || coverGenerating || coverPromptLoading)) {
            return; // 已在生成中，直接返回
        }

        // 加载大纲数据
        let outline = {};
        let options = {};

        try {
            if (project?.id) {
                const outlineData = await storageEx.getCoreOutline(project.id);
                if (outlineData?.content) {
                    try {
                        outline = JSON.parse(outlineData.content);
                    } catch (e) {
                        console.error('[Cover Gen] Failed to parse outline:', e);
                    }
                }
                const draftKey = `narragen_form_draft_${project.id}`;
                const draft = localStorage.getItem(draftKey);
                if (draft) {
                    const draftData = JSON.parse(draft);
                    options = draftData.outlineOptions || {};
                }
            }
        } catch (e) {
            console.error('Failed to load outline for cover prompt:', e);
        }

        // 第一阶段：分析提示词
        setCoverPromptLoading(true);

        let coverPromptResult = '';
        let stylePromptResult = '';

        try {
            const result = await generateCoverPromptWithLLM(project, outline, options);
            coverPromptResult = result.coverPrompt;
            stylePromptResult = result.stylePrompt;
            setCoverDesignStyle(result.designStyle || '');
            console.log('[Cover Gen] LLM generated style:', result.designStyle, result.reason);
        } catch (e) {
            console.error('[Cover Gen] LLM generation failed, using fallback:', e);
            const fallback = buildCoverPrompt(project, outline, options);
            coverPromptResult = fallback.coverPrompt;
            stylePromptResult = fallback.stylePrompt;
            setCoverDesignStyle('Fallback');
        } finally {
            setCoverPromptLoading(false);
        }

        // 第二阶段：直接启动图片生成
        try {
            const apiConfig = await getImageApiConfig(project?.id);
            if (!apiConfig) throw new Error('请先在设置中配置图像生成 API');

            setCoverGenerating(true);
            setCoverGenError('');

            const fullPrompt = stylePromptResult
                ? `${coverPromptResult}, ${stylePromptResult}`
                : coverPromptResult;

            // 使用后台任务生成
            startBackgroundCoverGeneration(project.id, {
                characterPrompt: fullPrompt,
                stylePrompt: '',
                size: '2:3', // 竖版封面
                apiConfig,
                projectId: project?.id,
                characterName: `封面: ${project?.name || '未命名'}`
            });

        } catch (err) {
            console.error('Cover generation failed:', err);
            setCoverGenError(err.message || '封面生成失败');
            setCoverGenerating(false);
        }
    };

    // 监听封面生成后台任务状态
    useEffect(() => {
        // 初始化检查：是否已有正在进行的任务
        if (project?.id) {
            if (isCoverGenerating(project.id) || getCoverDraft(project.id)?.generating) {
                setCoverGenerating(true);
            }
        }

        const handleCoverGenStatus = (e) => {
            const { projectId: evtProjectId, status, imageUrl, error } = e.detail;
            if (project?.id === evtProjectId) {
                if (status === 'start') {
                    setCoverGenerating(true);
                    setCoverGenError('');
                } else if (status === 'success') {
                    setCoverGenerating(false);
                    setGeneratedCoverPreview(imageUrl);
                    // 自动应用封面并保存
                    setEditingStyle(prev => ({ ...prev, coverImage: imageUrl }));
                    // 提取颜色并自动保存书脊颜色，同时合并保存封面更新，避免并发覆盖
                    extractColorFromImage(imageUrl, true, { cover: imageUrl });

                    clearCoverDraft(evtProjectId);
                    setShowCoverGenModal(false);
                } else if (status === 'error') {
                    setCoverGenerating(false);
                    setCoverGenError(error);
                } else if (status === 'cancelled') {
                    setCoverGenerating(false);
                    setCoverGenError('');
                    setGeneratedCoverPreview('');
                }
            }
        };

        window.addEventListener('narragen-cover-gen-status', handleCoverGenStatus);
        return () => window.removeEventListener('narragen-cover-gen-status', handleCoverGenStatus);
    }, [project]);

    const handleGenerateCover = async () => {
        try {
            const apiConfig = await getImageApiConfig(project?.id);
            if (!apiConfig) throw new Error('请先在设置中配置图像生成 API');

            setCoverGenerating(true);
            setCoverGenError('');
            setGeneratedCoverPreview('');

            const fullPrompt = coverStylePrompt
                ? `${coverPrompt}, ${coverStylePrompt}`
                : coverPrompt;

            // 使用后台任务生成
            startBackgroundCoverGeneration(project.id, {
                characterPrompt: fullPrompt,
                stylePrompt: '',
                size: '2:3', // 竖版封面
                apiConfig,
                projectId: project?.id,
                characterName: `封面: ${project?.name || '未命名'}`
            });

        } catch (err) {
            console.error('Cover generation failed:', err);
            setCoverGenError(err.message || '封面生成失败');
            setCoverGenerating(false);
        }
    };

    const handleApplyCover = () => {
        if (generatedCoverPreview) {
            setEditingStyle(prev => ({ ...prev, coverImage: generatedCoverPreview }));
            // 自动提取颜色
            extractColorFromImage(generatedCoverPreview);
            // 清除草稿
            if (project?.id) {
                clearCoverDraft(project.id);
            }
            setShowCoverGenModal(false);
        }
    };

    // 封面图片 - 实时预览：编辑模式下优先使用 editingStyle 中的临时封面
    // 封面显示逻辑:
    // - 编辑模式下, 优先使用 editingStyle.coverImage
    // - 但需要区分 undefined (未编辑) 和 null (明确删除)
    // 修复闪烁：始终检查 editingStyle（即使非 editing 模式，只要有值），优先级 editingStyle > project.cover
    let coverImage;
    // 在编辑模式下，或者有已编辑的封面（从 editingStyle 读）
    if (editingStyle?.coverImage === null) {
        // 用户明确点击了移除封面 -> 显示无封面状态
        coverImage = null;
    } else if (editingStyle?.coverImage) {
        // 用户上传了新封面 -> 显示新封面
        coverImage = editingStyle.coverImage;
    } else {
        // 用户没有编辑封面 -> 显示原封面
        coverImage = project?.cover;
    }
    const isVideo = coverImage && (coverImage.startsWith('data:video') || coverImage.match(/\.(mp4|webm|ogg)$/i));

    // 页边（书页厚度效果）
    const pageColor = '#f5f5f0';
    const pageDarkColor = '#e8e8e3';

    return (
        <Box
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => { setIsHovered(false); handleMouseLeave(); }}
            sx={{
                position: 'relative',
                height: bookHeight,
                // 使用三角函数计算倾斜后的实际水平投影宽度
                // 宽度 = 书脊宽度 × cos(θ) + 书高度 × sin(|θ|)
                width: (() => {
                    if (isOpen) return coverWidth + 150; // 增加宽度，拉大与两侧书的距离
                    const angleRad = Math.abs(randomStyles.rotateZ) * (Math.PI / 180);
                    const projectedWidth = spineWidth * Math.cos(angleRad) + bookHeight * Math.sin(angleRad);
                    return Math.ceil(projectedWidth) + 1; // 增加 1px 微调，防止厚书视觉叠加，同时保持薄书紧凑
                })(),
                perspective: '1500px',
                perspectiveOrigin: 'center bottom',
                transformOrigin: 'center bottom',
                transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                // 恢复z-index，让它浮在上面（真实物理遮挡）
                zIndex: isOpen ? 100 : (isHovered ? 10 : 2),
                flexShrink: 0,
                // 始终允许超出，避免投影过渡动画被裁剪
                overflow: 'visible',
                // hover时保持倾斜角度，添加上移效果
                transform: (() => {
                    if (isOpen) return 'none';
                    if (isHovered) {
                        // hover时：大幅度向上平移（浮起效果），不再缩放
                        return `rotateZ(${randomStyles.rotateZ}deg) translateY(-80px)`;
                    }
                    // 默认：只有倾斜
                    return `rotateZ(${randomStyles.rotateZ}deg)`;
                })(),
                // 添加transform过渡，关闭时width也延迟，避免其他书遮挡正在关闭的书
                transition: (() => {
                    const widthTrans = isOpen
                        ? 'width 0.9s cubic-bezier(0.4, 0, 0.2, 1)'
                        : 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.3s';
                    const transformTrans = isHovered
                        ? 'transform 0.3s ease-out'
                        : 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)'; // 时长进一步增加到 0.8s，让落地更从容
                    return `${widthTrans}, ${transformTrans}`;
                })(),
                // 关键：将旋转中心设为右下角（因为是向左倾斜），这样书脊底部右侧会作为锚点
                // 这样宽度增加时，左侧会延伸出去占据空间，而右侧书脊位置相对固定
                transformOrigin: 'bottom right',
                // 解决遮挡问题：展开时外层容器不响应鼠标，让点击穿透到下面的书
                pointerEvents: isOpen ? 'none' : 'auto',
            }}
        >
            {/* 书脊点击区域 - 只在未展开时显示 */}
            {!isOpen && (
                <Box
                    onClick={onClick}
                    sx={{
                        position: 'absolute',
                        // 点击区域覆盖整个容器，不超出边界
                        left: 0, right: 0, top: 0, bottom: 0,
                        zIndex: 20,
                        cursor: 'pointer',
                    }}
                />
            )}
            {/* 3D Book Container - 整个书籍立方体 */}
            <Box
                sx={{
                    // 内部容器绝对定位到右侧（因为外部容器宽度包含了倾斜区域）
                    position: 'absolute',
                    left: isOpen ? '75px' : 0,  // 展开时居中（150px额外宽度/2），收起时靠左
                    bottom: 0,
                    // 关键修改：未展开时宽度设为书脊宽度！
                    // 之前设为coverWidth会导致右对齐时，左侧的书脊被推到容器外200多像素处
                    width: isOpen ? '100%' : spineWidth,
                    height: '100%',
                    transformStyle: 'preserve-3d',
                    pointerEvents: 'none', // 3D容器本身也不响应
                    // 动画顺序优化：
                    // 展开时：先扩宽（width立即开始），再旋转（transform延迟0.4s）
                    // 收起时：先旋转（transform立即开始），再收缩（width延迟0.4s）
                    // 关键：内部width需要立即变化，否则会被overflow裁剪
                    // 只有完全打开后才用快速过渡（视差），其他情况用慢速过渡（开合动画）
                    transition: (isOpen && isFullyOpen)
                        ? 'transform 0.1s ease-out, width 0.6s cubic-bezier(0.4, 0, 0.2, 1), left 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                        : (isOpen
                            ? 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1), width 0.5s cubic-bezier(0.4, 0, 0.2, 1), left 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                            : 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), width 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.15s, left 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.15s'),
                    transformOrigin: 'center center', // 居中旋转
                    // 点击时旋转展开 + 3D视差倾斜效果（仅完全打开后生效）
                    transform: isOpen
                        ? `rotateY(0deg)${isFullyOpen ? ` rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` : ''}`
                        : 'rotateY(90deg)',
                }}
            >
                {/* ===== 书籍封面 (Front Face) ===== */}
                <Box
                    onClick={handleCoverClick}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    sx={{
                        position: 'absolute',
                        width: coverWidth,
                        height: '100%',
                        backfaceVisibility: 'hidden',
                        // 封面翻转动画：从书脊边缘旋转
                        transformOrigin: 'left center',
                        transform: `translateZ(${spineWidth / 2}px)`, // 取消 shelf 处的翻开效果
                        // 打开时无延迟，关闭时延迟0.8s（等当前书籍完全转回书脊后）
                        transition: isOpen
                            ? 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease-out'
                            : 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.4s, box-shadow 0.3s ease-out',
                        bgcolor: 'background.paper',
                        borderRadius: '0 18px 18px 0', // 左侧直角与书脊对齐，右侧大圆角
                        overflow: 'hidden',
                        cursor: 'pointer',
                        // 多层次投影：模拟真实环境光遮蔽和投射阴影
                        // 仅在完全打开（isFullyOpen）时显示完整悬浮投影，旋转中和侧面时隐藏
                        // 注意：两种状态必须有相同数量的阴影层，CSS才能平滑过渡
                        boxShadow: isFullyOpen ? `
                            rgba(0, 0, 0, 0.2) 20px 40px 50px -10px,
                            ${alpha(spineColor, 0.3)} 30px 50px 80px -20px,
                            rgba(0, 0, 0, 0.3) 10px 20px 25px -5px
                        ` : `
                            rgba(0, 0, 0, 0) 0px 0px 0px 0px,
                            rgba(0, 0, 0, 0) 0px 0px 0px 0px,
                            rgba(0, 0, 0, 0) 0px 0px 0px 0px
                        `,
                        pointerEvents: 'auto', // 显式允许交互，因为父容器设为了none
                    }}
                >
                    {/* Cover Background */}
                    <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                        {coverImage ? (
                            isVideo ? (
                                <video src={coverImage} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <img src={coverImage} alt={project?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            )
                        ) : (
                            <Box sx={{
                                width: '100%', height: '100%',
                                background: `linear-gradient(145deg, ${spineColor} 0%, ${alpha(spineColor, 0.7)} 100%)`,
                            }} />
                        )}

                        {/* 封面纹理 - 噪点 (Outer Cover Noise) */}
                        <Box sx={{
                            position: 'absolute', inset: 0, pointerEvents: 'none',
                            background: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.2'/%3E%3C/svg%3E")`,
                            zIndex: 1,
                        }} />

                        {/* 书槽 (Book Groove) - 模拟硬壳与书脊连接处的凹陷 */}
                        <Box sx={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: 18, // 距离书脊一定距离
                            width: 12,
                            background: (() => {
                                const isLight = isLightColor(spineColor);
                                const op1 = isLight ? 0.02 : 0.04;
                                const op2 = isLight ? 0.06 : 0.12;
                                return `linear-gradient(90deg, rgba(0,0,0,${op1}) 0%, rgba(0,0,0,${op2}) 40%, rgba(0,0,0,${op1 / 2}) 100%)`;
                            })(),
                            mixBlendMode: 'multiply',
                            pointerEvents: 'none',
                            zIndex: 2,
                            // 同步调整书槽高光强度
                            boxShadow: isLightColor(spineColor)
                                ? 'inset 1px 0 1px rgba(255,255,255,0.05), inset -1px 0 1px rgba(255,255,255,0.02)'
                                : 'inset 1px 0 1px rgba(255,255,255,0.1), inset -1px 0 1px rgba(255,255,255,0.05)',
                        }} />

                        {/* 左侧书脊边缘阴影 - 简洁的厚度暗示 */}
                        <Box sx={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: 0,
                            width: 8,
                            background: `linear-gradient(90deg, ${alpha('#000', isLightColor(spineColor) ? 0.06 : 0.12)} 0%, transparent 100%)`,
                            pointerEvents: 'none',
                            zIndex: 3,
                        }} />

                        {/* 右侧边缘阴影 - 微妙的厚度暗示 */}
                        <Box sx={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            right: 0,
                            width: 9,
                            background: `linear-gradient(270deg, ${alpha('#000', 0.15)} 0%, transparent 100%)`,
                            borderRadius: '0 18px 18px 0',
                            pointerEvents: 'none',
                            zIndex: 3,
                        }} />
                    </Box>

                    {/* Cover Content - 简洁版 */}
                    {!showDetails && (
                        <Box sx={{
                            position: 'absolute',
                            inset: 0,
                            zIndex: 1,
                            zIndex: 1,
                            px: 3,
                            pb: 2, // 减少底部内边距，使Logo与书脊对齐
                            pt: 4,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                        }}>
                            {(editingStyle?.showTitle !== false) && (
                                <Typography
                                    variant="h5"
                                    fontWeight="bold"
                                    sx={{
                                        color: textColor,
                                        lineHeight: 1.3,
                                        textAlign: 'center',
                                        width: '100%',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 4,
                                        WebkitBoxOrient: 'vertical',
                                    }}
                                >
                                    {project?.name}
                                </Typography>
                            )}

                            {/* 封面 Logo - 底部居中 */}
                            <Box sx={{
                                mt: 'auto',
                                width: '24px',
                                height: '24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: 0.9,
                                mb: 1,
                            }}>
                                <svg width="100%" height="100%" viewBox="0 0 768 512" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M768,512h-384c0-35.34-14.33-67.34-37.49-90.51-23.17-23.16-55.17-37.49-90.51-37.49v128H0c0-141.38,114.62-256,256-256V0c282.77,0,512,229.23,512,512Z"
                                        fill={textColor} />
                                </svg>
                            </Box>
                        </Box>
                    )}

                    {/* Cover Content - 详情版 */}
                    {showDetails && (

                        <Box sx={{
                            position: 'absolute',
                            inset: 0,
                            zIndex: 10,
                            display: 'flex',
                            flexDirection: 'column',
                            bgcolor: alpha(theme.palette.background.paper, 0.7), // 显著减弱遮罩感
                            backdropFilter: 'blur(10px)'
                        }}>
                            <Box sx={{ p: 2.5, borderBottom: 1, borderColor: 'divider' }}>
                                <Typography variant="h6" fontWeight="bold" noWrap>{project?.name}</Typography>
                                {projectOutline?.logline && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', mt: 0.5 }}>
                                        {projectOutline.logline}
                                    </Typography>
                                )}
                            </Box>
                            {projectStats && (
                                <Stack direction="row" spacing={1} sx={{ p: 2, flexWrap: 'wrap', gap: 0.5 }}>
                                    <Box sx={{ px: 1.5, py: 0.5, borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.1), fontSize: '0.75rem', fontWeight: 600, color: theme.palette.primary.main }}>
                                        {(projectStats.totalWords / 10000).toFixed(1)}万字
                                    </Box>
                                    <Box sx={{ px: 1.5, py: 0.5, borderRadius: 1, bgcolor: alpha(theme.palette.secondary.main, 0.1), fontSize: '0.75rem', fontWeight: 600, color: theme.palette.secondary.main }}>
                                        {projectStats.chapterCount}章
                                    </Box>
                                    <Box sx={{ px: 1.5, py: 0.5, borderRadius: 1, bgcolor: alpha(theme.palette.success.main, 0.1), fontSize: '0.75rem', fontWeight: 600, color: theme.palette.success.main }}>
                                        {projectStats.volumeCount}卷
                                    </Box>
                                </Stack>
                            )}
                            <Box sx={{ flex: 1 }} />
                            <Stack spacing={1.5} sx={{ p: 2 }}>
                                <Button variant="contained" size="large" fullWidth startIcon={<IconEnter />} onClick={(e) => { e.stopPropagation(); onEnter?.(); }}
                                    sx={{
                                        borderRadius: 2,
                                        backgroundColor: `${uiColor} !important`,
                                        color: `${uiTextColor} !important`,
                                        '&:hover': { backgroundColor: alpha(uiColor, 0.85) }
                                    }}>
                                    进入项目
                                </Button>
                                <Stack direction="row" spacing={0.5} justifyContent="center">
                                    <Tooltip title="阅读"><IconButton onClick={(e) => { e.stopPropagation(); onRead?.(); }}><IconPlay /></IconButton></Tooltip>
                                    <Tooltip title="编辑样式"><IconButton onClick={handleStyleClick}><IconPalette /></IconButton></Tooltip>
                                    <Tooltip title="同步大纲"><IconButton onClick={(e) => { e.stopPropagation(); onSync?.(); }}><IconSync /></IconButton></Tooltip>
                                    <Tooltip title="导出"><IconButton onClick={(e) => { e.stopPropagation(); onExport?.(); }}><IconExport /></IconButton></Tooltip>
                                    <Tooltip title="删除"><IconButton color="error" onClick={handleDeleteClick}><IconDelete /></IconButton></Tooltip>
                                </Stack>
                            </Stack>
                        </Box>
                    )}

                    {/* 封面左侧边缘阴影 */}
                    <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 8, background: `linear-gradient(90deg, ${alpha('#000', isLightColor(spineColor) ? 0.08 : 0.15)} 0%, transparent 100%)` }} />
                </Box>

                {/* ===== 书脊 (Spine - Left Face) ===== */}
                <Box
                    sx={{
                        position: 'absolute',
                        width: spineWidth,
                        height: '100%',
                        backfaceVisibility: 'hidden',
                        transformOrigin: 'right center',
                        transform: `translateX(-${spineWidth}px) rotateY(-90deg) translateX(${spineWidth / 2}px)`,
                        bgcolor: spineColor,
                        borderRadius: 0, // 全直角
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        pointerEvents: 'auto', // 显式允许交互
                    }}
                >
                    {/* 书脊光影叠加层 - 增强立体感 (哑光硬壳质感) */}
                    <Box sx={{
                        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2, // 提升层级
                        opacity: isOpen ? 0 : 1, // 展开时隐藏光影，合上时显示
                        transition: 'opacity 1.0s ease-in-out', // 配合翻转动画时长
                        background: (() => {
                            // 1. 解析当前书脊颜色 RGB
                            let r = 0, g = 0, b = 0;
                            if (spineColor && spineColor.startsWith('#')) {
                                const hex = spineColor.replace('#', '');
                                if (hex.length === 3) {
                                    r = parseInt(hex[0] + hex[0], 16);
                                    g = parseInt(hex[1] + hex[1], 16);
                                    b = parseInt(hex[2] + hex[2], 16);
                                } else if (hex.length === 6) {
                                    r = parseInt(hex.substring(0, 2), 16);
                                    g = parseInt(hex.substring(2, 4), 16);
                                    b = parseInt(hex.substring(4, 6), 16);
                                }
                            }

                            // 2. 生成自适应阴影色：基于本色极度加深 (保留15%亮度)
                            // 这样红色书会有深红阴影，黄色书会有深褐阴影，比纯黑更通透自然
                            const sR = Math.round(r * 0.15);
                            const sG = Math.round(g * 0.15);
                            const sB = Math.round(b * 0.15);
                            const shadowColor = `${sR},${sG},${sB}`;

                            const isLight = isLightColor(spineColor);
                            // 调整透明度为 0.15 (主)，边缘更淡
                            const edgeOp = isLight ? 0.08 : 0.15;
                            const innerOp = isLight ? 0.15 : 0.25;

                            return `linear-gradient(90deg, 
                                rgba(${shadowColor},${edgeOp}) 0%, 
                                rgba(${shadowColor},${edgeOp}) 2%, 
                                rgba(${shadowColor},${innerOp}) 6%,      
                                rgba(255,255,255,0.05) 12%, 
                                transparent 40%, 
                                transparent 60%, 
                                rgba(255,255,255,0.02) 88%, 
                                rgba(${shadowColor},${innerOp}) 94%,
                                rgba(${shadowColor},${edgeOp}) 98%,
                                rgba(${shadowColor},${edgeOp}) 100%)`;
                        })(),
                        boxShadow: isLightColor(spineColor)
                            ? 'inset 1px 0 2px rgba(255,255,255,0.01), inset -1px 0 2px rgba(255,255,255,0.01)'
                            : 'inset 1px 0 2px rgba(255,255,255,0.03), inset -1px 0 2px rgba(255,255,255,0.03)'
                    }} />

                    {/* 书脊纹理 - 噪点 (Noise Texture) */}
                    <Box sx={{
                        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2, // 同样提升层级
                        background: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.2'/%3E%3C/svg%3E")`,
                    }} />

                    {/* 书脊内容布局：顶部书名 + 底部Logo */}
                    <Box sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        pt: 5, // 仅增加顶部内边距
                        pb: 2, // 保持底部内边距不变
                        px: 1,
                        zIndex: 1,
                    }}>
                        {/* 书名 - 顶部对齐 */}
                        <Typography
                            variant="h5" // 统一使用 h5 字体系列，与封面保持一致
                            sx={{
                                color: textColor,
                                fontWeight: 700,
                                fontSize: spineWidth < 60 ? '1rem' : '1.4rem',
                                writingMode: titleStyle === 'vertical' ? 'vertical-rl' : 'horizontal-tb',
                                textOrientation: titleStyle === 'vertical' ? 'mixed' : 'unset',
                                transform: 'none',
                                letterSpacing: titleStyle === 'vertical' ? '0.2em' : 'normal',
                                textAlign: 'center',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                textShadow: 'none',
                                maxHeight: '60%', // 限制书名最大高度，为logo留足空间
                                lineHeight: 1.3, // 与封面行高保持一致
                            }}
                        >
                            {project?.name || '未命名'}
                        </Typography>

                        {/* Logo - 底部对齐 */}
                        <Box sx={{
                            width: '24px',  // 24px 更精致
                            height: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0.85,
                            mb: 1 // 稍微离底部远一点点
                        }}>
                            <svg width="100%" height="100%" viewBox="0 0 768 512" xmlns="http://www.w3.org/2000/svg">
                                <path d="M768,512h-384c0-35.34-14.33-67.34-37.49-90.51-23.17-23.16-55.17-37.49-90.51-37.49v128H0c0-141.38,114.62-256,256-256V0c282.77,0,512,229.23,512,512Z"
                                    fill={textColor} />
                            </svg>
                        </Box>
                    </Box>
                </Box>

                {/* ===== 内页面板 (Inner Page - 翻开封面后显示) ===== */}
                <Box
                    sx={{
                        position: 'absolute',
                        width: coverWidth,
                        height: '100%',
                        backfaceVisibility: 'hidden',
                        // 位于封面正后方，略微偏移避免z-fighting
                        transform: `translateZ(${spineWidth / 2 - 1}px)`,
                        bgcolor: 'background.paper',
                        borderRadius: '0 4px 4px 0',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        // 只有翻开时可见 - 弹出框模式下隐藏书架内页，避免透出“鬼影”
                        opacity: 0,
                        transition: 'opacity 0.4s ease-in-out 0.3s',
                        pointerEvents: 'none',
                    }}
                >
                    {/* 内页标题区 */}
                    <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', bgcolor: alpha(spineColor, 0.05) }}>
                        <Typography variant="h5" fontWeight="bold" gutterBottom>
                            {project?.name}
                        </Typography>
                        {projectOutline?.logline && (
                            <Typography variant="body2" color="text.secondary" sx={{
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                            }}>
                                {projectOutline.logline}
                            </Typography>
                        )}
                    </Box>

                    {/* 内页统计信息 */}
                    {projectStats && (
                        <Stack direction="row" spacing={2} sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                            <Box sx={{ textAlign: 'center', flex: 1 }}>
                                <Typography variant="h6" fontWeight="bold" color="primary">
                                    {(projectStats.totalWords / 10000).toFixed(1)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">万字</Typography>
                            </Box>
                            <Box sx={{ textAlign: 'center', flex: 1 }}>
                                <Typography variant="h6" fontWeight="bold" color="secondary">
                                    {projectStats.chapterCount}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">章节</Typography>
                            </Box>
                            <Box sx={{ textAlign: 'center', flex: 1 }}>
                                <Typography variant="h6" fontWeight="bold" color="success.main">
                                    {projectStats.volumeCount}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">分卷</Typography>
                            </Box>
                        </Stack>
                    )}

                    {/* 内页操作按钮 */}
                    <Box sx={{ p: 2, mt: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Button
                            variant="contained"
                            size="large"
                            fullWidth
                            startIcon={<IconPlay />}
                            onClick={(e) => { e.stopPropagation(); onRead?.(); }}
                            sx={{
                                borderRadius: 2,
                                py: 1.5,
                                background: `linear-gradient(135deg, ${spineColor}, ${alpha(spineColor, 0.7)})`,
                            }}
                        >
                            开始阅读
                        </Button>
                        <Button
                            variant="outlined"
                            size="large"
                            fullWidth
                            startIcon={<IconEdit />}
                            onClick={(e) => { e.stopPropagation(); onEnter?.(); }}
                            sx={{ borderRadius: 2, py: 1.5 }}
                        >
                            进入编辑
                        </Button>
                        <Stack direction="row" spacing={1}>
                            <Button
                                variant="text"
                                size="small"
                                startIcon={<IconSync />}
                                onClick={(e) => { e.stopPropagation(); onSync?.(); }}
                                sx={{ flex: 1 }}
                            >
                                同步
                            </Button>
                            <Button
                                variant="text"
                                size="small"
                                startIcon={<IconExport />}
                                onClick={(e) => { e.stopPropagation(); onExport?.(); }}
                                sx={{ flex: 1 }}
                            >
                                导出
                            </Button>
                        </Stack>
                    </Box>
                </Box>

                {/* ===== 书背 (Back Face) ===== */}
                <Box
                    sx={{
                        position: 'absolute',
                        width: coverWidth,
                        height: '100%',
                        backfaceVisibility: 'hidden',
                        transform: `translateZ(-${spineWidth / 2}px) rotateY(180deg)`,
                        bgcolor: alpha(spineColor, 0.85),
                        borderRadius: '4px 0 0 4px',
                    }}
                />

                {/* ===== 书页顶部边缘 (Top Edge) ===== */}
                <Box
                    sx={{
                        position: 'absolute',
                        width: coverWidth,
                        height: spineWidth,
                        backfaceVisibility: 'hidden',
                        transformOrigin: 'center top',
                        transform: `rotateX(90deg) translateY(-${spineWidth / 2}px)`,
                        background: `linear-gradient(90deg, ${pageDarkColor} 0%, ${pageColor} 5%, ${pageColor} 95%, ${pageDarkColor} 100%)`,
                        // 页面纹理
                        '&::after': {
                            content: '""',
                            position: 'absolute',
                            inset: 0,
                            background: `repeating-linear-gradient(90deg, transparent, transparent 2px, ${alpha('#000', 0.02)} 2px, ${alpha('#000', 0.02)} 3px)`,
                        }
                    }}
                />

                {/* ===== 书页底部边缘 (Bottom Edge) ===== */}
                <Box
                    sx={{
                        position: 'absolute',
                        width: coverWidth,
                        height: spineWidth,
                        bottom: 0,
                        backfaceVisibility: 'hidden',
                        transformOrigin: 'center bottom',
                        transform: `rotateX(-90deg) translateY(${spineWidth / 2}px)`,
                        background: `linear-gradient(90deg, ${pageDarkColor} 0%, ${pageColor} 5%, ${pageColor} 95%, ${pageDarkColor} 100%)`,
                        cursor: 'pointer',
                    }}
                />

                {/* ===== 书页右侧边缘 (Right Edge - 书口) ===== */}
                <Box
                    sx={{
                        position: 'absolute',
                        width: spineWidth,
                        height: '100%',
                        right: -spineWidth,
                        backfaceVisibility: 'hidden',
                        transformOrigin: 'left center',
                        transform: `rotateY(90deg) translateX(-${spineWidth / 2}px)`,
                        background: `linear-gradient(180deg, ${pageColor} 0%, ${pageDarkColor} 5%, ${pageDarkColor} 95%, ${pageColor} 100%)`,
                        // 页面纹理
                        '&::after': {
                            content: '""',
                            position: 'absolute',
                            inset: 0,
                            background: `repeating-linear-gradient(180deg, transparent, transparent 2px, ${alpha('#000', 0.03)} 2px, ${alpha('#000', 0.03)} 4px)`,
                        }
                    }}
                />
            </Box>

            {/* ===== AI Cover Generation Dialog ===== */}
            <Dialog
                open={showCoverGenModal}
                onClose={() => setShowCoverGenModal(false)}
                onClick={(e) => e.stopPropagation()}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 4,
                        overflow: 'hidden',
                    }
                }}
            >
                <Box sx={{ p: 3 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                        <Box>
                            <Typography variant="h6" fontWeight="bold">AI 生成封面</Typography>
                            {coverDesignStyle && !coverPromptLoading && (
                                <Typography variant="caption" color="text.secondary">
                                    设计风格: {coverDesignStyle}
                                </Typography>
                            )}
                        </Box>
                        <IconButton size="small" onClick={() => setShowCoverGenModal(false)}>
                            <IconClose />
                        </IconButton>
                    </Stack>

                    {/* 提示词加载状态 */}
                    {coverPromptLoading ? (
                        <Box sx={{
                            py: 6,
                            textAlign: 'center',
                            border: '2px dashed',
                            borderColor: alpha(uiColor, 0.3),
                            borderRadius: 4,
                            bgcolor: alpha(uiColor, 0.02),
                            mb: 3
                        }}>
                            <IconAI sx={{
                                fontSize: 48,
                                color: uiColor,
                                mb: 2,
                                animation: 'pulse 1.5s ease-in-out infinite',
                                '@keyframes pulse': {
                                    '0%, 100%': { opacity: 0.4 },
                                    '50%': { opacity: 1 }
                                }
                            }} />
                            <Typography variant="body2" color="text.secondary">
                                正在分析小说特点，选择最佳设计风格...
                            </Typography>
                        </Box>
                    ) : (
                        <>
                            {/* 内容提示词 */}
                            <TextField
                                label="封面内容描述"
                                fullWidth
                                multiline
                                minRows={2}
                                maxRows={4}
                                value={coverPrompt}
                                onChange={(e) => setCoverPrompt(e.target.value)}
                                sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                                helperText="描述封面的主题、场景和元素"
                            />

                            {/* 风格提示词 */}
                            <TextField
                                label="视觉风格"
                                fullWidth
                                multiline
                                minRows={2}
                                maxRows={3}
                                value={coverStylePrompt}
                                onChange={(e) => setCoverStylePrompt(e.target.value)}
                                sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                                helperText="描述艺术风格、色调和构图"
                            />
                        </>
                    )}

                    {/* 预览区域 */}
                    {(generatedCoverPreview || coverGenerating) && (
                        <Box sx={{
                            mb: 3, p: 2, borderRadius: 3,
                            bgcolor: 'action.hover',
                            display: 'flex', justifyContent: 'center', alignItems: 'center',
                            minHeight: 200,
                        }}>
                            {coverGenerating ? (
                                <Stack alignItems="center" spacing={2}>
                                    <Box sx={{
                                        width: 48, height: 48, borderRadius: '50%',
                                        border: '3px dashed',
                                        borderColor: 'primary.main',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        animation: 'pulse 1.5s infinite',
                                        '@keyframes pulse': {
                                            '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                                            '50%': { opacity: 0.6, transform: 'scale(0.95)' },
                                        }
                                    }}>
                                        <IconAI sx={{ fontSize: 24, color: 'primary.main' }} />
                                    </Box>
                                    <Typography variant="body2" color="text.secondary">正在生成封面...</Typography>
                                </Stack>
                            ) : generatedCoverPreview ? (
                                <Box
                                    component="img"
                                    src={generatedCoverPreview}
                                    alt="生成的封面"
                                    sx={{
                                        maxHeight: 300,
                                        maxWidth: '100%',
                                        borderRadius: 2,
                                        boxShadow: 3,
                                    }}
                                />
                            ) : null}
                        </Box>
                    )}

                    {/* 错误提示 */}
                    {coverGenError && (
                        <Typography variant="body2" color="error" sx={{ mb: 2 }}>
                            {coverGenError}
                        </Typography>
                    )}

                    {/* 按钮 */}
                    <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center">
                        {/* 左侧：重新生成（仅在有预览时显示，低调样式） */}
                        <Box>
                            {generatedCoverPreview && (
                                <Button
                                    size="small"
                                    onClick={handleGenerateCover}
                                    disabled={coverGenerating || !coverPrompt.trim()}
                                    sx={{ color: 'text.secondary', fontSize: '0.75rem' }}
                                >
                                    重新生成
                                </Button>
                            )}
                        </Box>

                        {/* 右侧：关闭/应用封面/生成封面 */}
                        <Stack direction="row" spacing={2}>
                            <Button
                                variant="outlined"
                                onClick={() => {
                                    if (coverGenerating && project?.id) {
                                        cancelCoverGeneration(project.id);
                                    }
                                    setShowCoverGenModal(false);
                                }}
                                sx={{ borderRadius: 999 }}
                            >
                                {coverGenerating ? '取消生成' : '关闭'}
                            </Button>
                            {generatedCoverPreview ? (
                                <Button
                                    variant="contained"
                                    color="success"
                                    onClick={handleApplyCover}
                                    sx={{ borderRadius: 999 }}
                                >
                                    应用封面
                                </Button>
                            ) : (
                                <Button
                                    variant="contained"
                                    onClick={handleGenerateCover}
                                    disabled={coverGenerating || !coverPrompt.trim()}
                                    startIcon={<IconAI />}
                                    sx={{ borderRadius: 999 }}
                                >
                                    生成封面
                                </Button>
                            )}
                        </Stack>
                    </Stack>
                </Box>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onClick={(e) => e.stopPropagation()}
                PaperProps={{
                    sx: {
                        borderRadius: 4,
                        p: 1,
                        minWidth: 320,
                    }
                }}
            >
                <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Box sx={{
                        width: 56, height: 56, borderRadius: '50%',
                        bgcolor: alpha('#d32f2f', 0.1),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        mx: 'auto', mb: 2
                    }}>
                        <IconDelete sx={{ fontSize: 28, color: '#d32f2f' }} />
                    </Box>
                    <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>确定删除项目？</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        "{project?.name}" 将被永久删除，此操作不可撤销。
                    </Typography>
                    <Stack direction="row" spacing={2} justifyContent="center">
                        <Button
                            variant="outlined"
                            onClick={() => setShowDeleteConfirm(false)}
                            sx={{ borderRadius: 2, px: 3 }}
                        >
                            取消
                        </Button>
                        <Button
                            variant="contained"
                            color="error"
                            onClick={handleConfirmDelete}
                            sx={{ borderRadius: 2, px: 3 }}
                        >
                            确认删除
                        </Button>
                    </Stack>
                </Box>
            </Dialog>

            {/* ===== 3D Book Popup Dialog ===== */}
            <Dialog
                open={isBookOpened}
                onClose={() => setIsBookOpened(false)}
                maxWidth={false}
                TransitionComponent={Fade}
                TransitionProps={{ timeout: 500 }}
                PaperProps={{
                    elevation: 0,
                    sx: {
                        bgcolor: 'transparent',
                        boxShadow: 'none',
                        overflow: 'visible',
                        backgroundImage: 'none', // 关键：去除 MUI 深色模式下的叠加背景
                    }
                }}
                BackdropProps={{
                    sx: {
                        bgcolor: 'rgba(255, 255, 255, 0)', // 背景完全透明
                        backdropFilter: 'blur(5px)', // 仅保留模糊
                    }
                }}
                onClick={() => setIsBookOpened(false)}
            >
                <Box
                    onClick={(e) => e.stopPropagation()}
                    sx={{
                        perspective: '2000px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: 4,
                    }}
                >
                    <Box sx={{
                        display: 'flex',
                        // 硬皮书壳样式
                        bgcolor: spineColor,
                        borderRadius: '6px',
                        padding: '12px 20px', // 增加水平内边距，补偿书页堆叠(Page Stack)造成的6-8px凸起，实现视觉等距
                        transformStyle: 'preserve-3d',
                        transform: 'scale(1.2)', // 默认状态放大 20%
                        animation: 'bookOpen 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
                        // 移除 border，改用更有质感的阴影组合
                        // 1. 顶部加强高光 (inset white)
                        // 2. 底部厚度感 (软化边缘，避免太锐利)
                        // 3. 悬浮阴影
                        boxShadow: 'inset 0 2px 1px rgba(255,255,255,0.4), inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 2px -1px rgba(0,0,0,0.15), 0 8px 4px -2px rgba(0,0,0,0.1), 0 30px 70px rgba(0,0,0,0.5)',
                        '@keyframes bookOpen': {
                            '0%': { transform: 'scale(1.0) translateY(20px)', opacity: 0 },
                            '100%': { transform: 'scale(1.2) translateY(0)', opacity: 1 },
                        },
                        position: 'relative',
                    }}>
                        {/* 封面内侧纹理 (模拟皮质或纸质纹理) */}
                        <Box sx={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: '6px',
                            background: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.15'/%3E%3C/svg%3E")`,
                            pointerEvents: 'none',
                        }} />

                        {/* 左侧书签页签组 (Vertical Tabs) - 与右侧对称，保持书壳宽度一致 */}
                        <Box sx={{
                            position: 'absolute',
                            left: -8,
                            top: 40,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1,
                            zIndex: 1,
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}>
                            {[
                                { icon: <IconPalette />, title: '书衣设置', onClick: handleStyleClick },
                                {
                                    icon: <IconDelete />, title: '删除项目', onClick: handleDeleteClick, color: 'error'
                                }
                            ].map((btn, i) => (
                                <Tooltip key={i} title={btn.title} placement="left">
                                    <Box
                                        onClick={(e) => { e.stopPropagation(); btn.onClick(e); }}
                                        sx={{
                                            width: 48,
                                            height: 36,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'flex-start',
                                            pl: 1,
                                            bgcolor: '#fdfbf7',
                                            borderRadius: '6px 0 0 6px',
                                            cursor: 'pointer',
                                            boxShadow: '-1px 1px 3px rgba(0,0,0,0.08)',
                                            border: '1px solid rgba(0,0,0,0.06)',
                                            borderRight: 'none',
                                            color: alpha('#2c1810', 0.18),
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            '&:hover': {
                                                transform: 'translateX(-8px)',
                                                color: btn.color === 'error' ? '#d32f2f' : spineColor,
                                                bgcolor: 'white',
                                                boxShadow: '-3px 3px 10px rgba(0,0,0,0.12)',
                                                '& .tab-icon': { transform: 'scale(1.05)' }
                                            }
                                        }}
                                    >
                                        {React.cloneElement(btn.icon, {
                                            className: 'tab-icon',
                                            sx: { fontSize: 18, transition: 'all 0.2s' }
                                        })}
                                    </Box>
                                </Tooltip>
                            ))}
                        </Box>

                        {/* Left Page (封面内侧/扉页) - 包含底页和翻转页 */}
                        <Box sx={{ width: 360, height: 520, position: 'relative', zIndex: 2 }}>


                            {/* 1. Base Layer (底页) - 左页设置 */}
                            <Box sx={{
                                position: 'absolute', inset: 0, height: '100%',
                                bgcolor: '#fdfbf7',
                                borderRadius: '2px 0 0 2px',
                                background: `linear-gradient(90deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0) 15%), #fdfbf7`,
                                border: '1px solid #e0e0e0', borderRight: 'none',
                                boxShadow: 'inset -2px 0 5px rgba(0,0,0,0.05)',
                                display: 'flex', flexDirection: 'column', py: 6, px: 5, justifyContent: 'flex-start', gap: 6,
                                zIndex: 0,
                            }}>

                                {/* 开本尺寸 */}
                                <Box>
                                    <Typography variant="body2" fontWeight="bold" sx={{ mb: 1, display: 'block', color: '#4a3b32', fontSize: '0.9rem' }}>开本尺寸</Typography>
                                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                                        {BOOK_SIZE_PRESETS.map(preset => (
                                            <Box key={preset.id} onClick={() => setEditingStyle(prev => ({ ...prev, sizePreset: preset.id }))}
                                                sx={{
                                                    py: 0.8, textAlign: 'center', fontSize: '0.8rem', borderRadius: 2, cursor: 'pointer',
                                                    border: '1.5px solid',
                                                    borderColor: (editingStyle?.sizePreset || 'novel') === preset.id ? (uiColor) : 'rgba(0,0,0,0.08)',
                                                    bgcolor: (editingStyle?.sizePreset || 'novel') === preset.id ? alpha(uiColor, 0.12) : 'white',
                                                    color: (editingStyle?.sizePreset || 'novel') === preset.id ? (uiColor) : alpha('#2c1810', 0.7),
                                                    fontWeight: (editingStyle?.sizePreset || 'novel') === preset.id ? 600 : 500,
                                                    transition: 'all 0.2s',
                                                    '&:hover': { bgcolor: alpha(uiColor, 0.08), borderColor: alpha(uiColor, 0.4), transform: 'translateY(-1px)' }
                                                }}>{preset.name}</Box>
                                        ))}
                                    </Box>
                                </Box>

                                {/* 封面显示书名 + 书脊厚度 (同一行) */}
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    {/* 封面显示书名 */}
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="body2" fontWeight="bold" sx={{ mb: 1, display: 'block', color: '#4a3b32', fontSize: '0.9rem' }}>封面显示书名</Typography>
                                        <Switch size="small"
                                            checked={editingStyle?.showTitle !== false}
                                            onChange={(e) => setEditingStyle(prev => ({ ...prev, showTitle: e.target.checked }))}
                                            sx={{
                                                '& .MuiSwitch-switchBase.Mui-checked': { color: uiColor },
                                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: uiColor }
                                            }}
                                        />
                                    </Box>
                                    {/* 书脊厚度 */}
                                    <Box sx={{ flex: 1 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                            <Typography variant="body2" fontWeight="bold" sx={{ color: '#4a3b32', fontSize: '0.9rem' }}>书脊厚度</Typography>
                                            <Typography variant="caption" sx={{ color: uiColor, fontWeight: 'bold' }}>{editingStyle?.spineWidth || 60}px</Typography>
                                        </Box>
                                        <Slider size="small" value={editingStyle?.spineWidth || 60} min={45} max={150}
                                            onChange={(_, v) => setEditingStyle(prev => ({ ...prev, spineWidth: v }))}
                                            sx={{ color: uiColor, height: 5, '& .MuiSlider-thumb': { width: 14, height: 14, transition: '0.3s cubic-bezier(.47,1.64,.41,.8)' } }} />
                                    </Box>
                                </Box>

                                {/* 色调风格 */}
                                <Box>
                                    <Typography variant="body2" fontWeight="bold" sx={{ color: '#4a3b32', mb: 1, display: 'block', fontSize: '0.9rem' }}>色调风格</Typography>
                                    <Stack direction="row" spacing={0.8} alignItems="center" sx={{ flexWrap: 'nowrap' }}>
                                        <Tooltip title="从封面读取颜色" arrow>
                                            <Box onClick={() => extractColorFromImage(editingStyle?.coverImage || coverImage)}
                                                sx={{
                                                    width: 32, height: 32, minWidth: 32, minHeight: 32, borderRadius: '50%',
                                                    bgcolor: 'white', cursor: (editingStyle?.coverImage || coverImage) ? 'pointer' : 'not-allowed',
                                                    border: `1.5px dashed ${uiColor}`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: (editingStyle?.coverImage || coverImage) ? (uiColor) : alpha(uiColor, 0.3),
                                                    transition: 'all 0.2s', flexShrink: 0,
                                                    '&:hover': { bgcolor: alpha(uiColor, 0.08), transform: 'scale(1.08)' }
                                                }}>
                                                <IconMagic sx={{ fontSize: 18 }} />
                                            </Box>
                                        </Tooltip>
                                        <Tooltip title="自定义颜色" arrow>
                                            <Box sx={{ position: 'relative', width: 32, height: 32, minWidth: 32, minHeight: 32, flexShrink: 0 }}>
                                                <Box component="input" type="color" value={editingStyle?.spineColor || '#F9F4EE'}
                                                    onChange={(e) => setEditingStyle(prev => ({ ...prev, spineColor: e.target.value }))}
                                                    sx={{
                                                        position: 'absolute', inset: 0, opacity: 0, zIndex: 1, cursor: 'pointer', width: '100%', height: '100%'
                                                    }} />
                                                <Box sx={{
                                                    width: 32, height: 32, borderRadius: '50%',
                                                    bgcolor: 'white',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: uiColor,
                                                    border: (!PRESET_COLORS.includes(editingStyle?.spineColor)) ? `2.5px solid ${uiColor}` : `1.5px dashed ${uiColor}`,
                                                    boxShadow: (!PRESET_COLORS.includes(editingStyle?.spineColor)) ? `0 0 0 2px #fdfbf7, 0 2px 10px ${alpha(uiColor, 0.35)}` : 'none',
                                                    transition: 'all 0.2s',
                                                    '&:hover': { bgcolor: alpha(uiColor, 0.08), transform: 'scale(1.08)' }
                                                }}>
                                                    <IconPicker sx={{ fontSize: 16 }} />
                                                </Box>
                                            </Box>
                                        </Tooltip>
                                        {PRESET_COLORS.map(color => (
                                            <Box key={color} onClick={() => setEditingStyle(prev => ({ ...prev, spineColor: color }))}
                                                sx={{
                                                    width: 32, height: 32, minWidth: 32, minHeight: 32, borderRadius: '50%', bgcolor: color, cursor: 'pointer',
                                                    border: editingStyle?.spineColor === color ? `2.5px solid ${uiColor}` : '2px solid rgba(0,0,0,0.06)',
                                                    boxShadow: editingStyle?.spineColor === color ? `0 0 0 2px #fdfbf7, 0 2px 10px ${alpha(uiColor, 0.35)}` : 'none',
                                                    transform: editingStyle?.spineColor === color ? 'scale(1.08)' : 'none',
                                                    transition: 'all 0.2s', flexShrink: 0, '&:hover': { transform: 'scale(1.08)' },
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}>
                                                {editingStyle?.spineColor === color && (
                                                    <IconCheck sx={{ fontSize: 16, color: isLightColor(color) ? '#212121' : '#fff' }} />
                                                )}
                                            </Box>
                                        ))}
                                    </Stack>
                                </Box>
                            </Box>

                            {/* 2. Flipping Page (翻转页) */}
                            <Box sx={{
                                width: '100%', height: '100%',
                                position: 'relative',
                                transformStyle: 'preserve-3d',
                                transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                                transform: showStyleEditor ? 'rotateY(180deg)' : 'rotateY(0deg)',
                                transformOrigin: 'right center', // 右侧为轴
                                zIndex: 2,
                            }}>
                                {/* 正面 - 封面展示 (Cover) */}
                                <Box sx={{
                                    position: 'absolute', width: '100%', height: '100%',
                                    backfaceVisibility: 'hidden',
                                    bgcolor: '#fdfbf7',
                                    borderRadius: '2px 0 0 2px',
                                    background: `linear-gradient(90deg, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0) 15%), #fdfbf7`,
                                    boxShadow: '4px 0 8px rgba(0,0,0,0.1), inset -25px 0 40px -20px rgba(0,0,0,0.15)',
                                    display: 'flex', flexDirection: 'column', overflow: 'hidden',
                                }}>
                                    {/* 封面内侧装饰 */}
                                    <Box sx={{
                                        flex: 1, p: 4, display: 'flex', flexDirection: 'column',
                                        justifyContent: 'center', alignItems: 'center',
                                        borderRight: '1px solid rgba(0,0,0,0.03)', position: 'relative',
                                    }}>
                                        {coverImage && (
                                            <Box component="img" src={coverImage} sx={{
                                                width: 260, height: 390, objectFit: 'cover', borderRadius: 1,
                                                boxShadow: '15px 15px 40px rgba(0,0,0,0.2)',
                                                transform: `rotate(${coverRotation}deg)`,
                                                border: '6px solid white',
                                                transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                            }} />
                                        )}
                                        {project?.updatedAt && (
                                            <Typography variant="caption" sx={{
                                                position: 'absolute', bottom: 24, left: '50%',
                                                transform: 'translateX(-50%)', color: alpha('#2c1810', 0.25),
                                                fontFamily: 'monospace', fontSize: '0.75rem', letterSpacing: 2,
                                            }}>
                                                {new Date(project.updatedAt).toLocaleDateString('en-GB', {
                                                    year: 'numeric', month: '2-digit', day: '2-digit'
                                                }).replace(/\//g, '.')}
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>

                                <Box sx={{
                                    position: 'absolute', width: '100%', height: '100%',
                                    backfaceVisibility: 'hidden',
                                    transform: 'rotateY(180deg)',
                                    bgcolor: '#fdfbf7',
                                    borderRadius: '0 2px 2px 0',
                                    border: '1px solid #e0e0e0',
                                    boxShadow: '-4px 0 8px rgba(0,0,0,0.1), inset 25px 0 40px -20px rgba(0,0,0,0.15)',
                                    display: 'flex', flexDirection: 'column', py: 6, px: 5,
                                }}>

                                    {/* 样式预览标题 */}
                                    <Typography variant="body2" fontWeight="bold" sx={{ mb: 2, display: 'block', color: '#4a3b32', fontSize: '0.9rem' }}>样式预览</Typography>

                                    {/* 大预览区域 */}
                                    <Box sx={{
                                        flex: 1,
                                        display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
                                        gap: '10px', p: 2, borderRadius: '12px',
                                        bgcolor: alpha('#2c1810', 0.02),
                                        border: '1px solid rgba(0,0,0,0.04)',
                                        overflow: 'hidden', mb: 2,
                                        maxHeight: 300,
                                    }}>
                                        {(() => {
                                            const preset = BOOK_SIZE_PRESETS.find(p => p.id === (editingStyle?.sizePreset || 'novel')) || BOOK_SIZE_PRESETS[3];

                                            // 原始比例系数 (与旧版一致)
                                            const BASE_HEIGHT_SCALE = 0.26;
                                            const BASE_SPINE_SCALE = 0.45;

                                            // 容器限制
                                            const maxContainerHeight = 210;
                                            const maxContainerWidth = 280;
                                            const gapSize = 10;

                                            // 以最极端情况（最大书脊 150px + 最大开本 album 680）计算固定 globalScale
                                            const MAX_SPINE_WIDTH = 150; // slider max
                                            const LARGEST_DISPLAY_HEIGHT = 680; // album
                                            const LARGEST_RATIO = 0.737; // album ratio

                                            const maxBaseHeight = LARGEST_DISPLAY_HEIGHT * BASE_HEIGHT_SCALE; // 176.8
                                            const maxBaseSpineWidth = MAX_SPINE_WIDTH * BASE_SPINE_SCALE; // 67.5
                                            const maxBaseBookWidth = maxBaseHeight * LARGEST_RATIO; // 130.3

                                            // 计算让极端情况刚好不超出的 globalScale
                                            const scaleByHeight = maxContainerHeight / maxBaseHeight; // 2.04
                                            const scaleByWidth = (maxContainerWidth - gapSize) / (maxBaseSpineWidth + maxBaseBookWidth); // 1.37
                                            const globalScale = Math.min(scaleByHeight, scaleByWidth); // 固定值，约 1.37

                                            // 当前开本的基础尺寸
                                            const baseHeight = preset.displayHeight * BASE_HEIGHT_SCALE;
                                            const baseSpineWidth = (editingStyle?.spineWidth || 60) * BASE_SPINE_SCALE;
                                            const baseBookWidth = baseHeight * preset.ratio;

                                            // 计算最终渲染尺寸 (所有配置使用相同的 globalScale)
                                            const renderHeight = baseHeight * globalScale;
                                            const renderSpineWidth = baseSpineWidth * globalScale;
                                            const renderBookWidth = baseBookWidth * globalScale;

                                            return (
                                                <>
                                                    {/* 书脊 */}
                                                    <Box sx={{
                                                        width: renderSpineWidth,
                                                        height: renderHeight,
                                                        bgcolor: editingStyle?.spineColor || '#6750A4',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        boxShadow: `2px 2px 10px ${alpha(editingStyle?.spineColor || '#6750A4', 0.3)}`,
                                                        transition: 'all 0.3s ease-out', flexShrink: 0,
                                                        borderRadius: '2px',
                                                    }}>
                                                        <Typography sx={{
                                                            color: isLightColor(editingStyle?.spineColor || '#6750A4') ? '#212121' : '#fff',
                                                            fontWeight: 700, fontSize: `${Math.max(0.5, 0.55 * globalScale)}rem`, writingMode: 'vertical-rl',
                                                            textOrientation: 'mixed', letterSpacing: '0.1em', textAlign: 'center',
                                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxHeight: '90%',
                                                        }}>
                                                            {project?.name || '小说名称'}
                                                        </Typography>
                                                    </Box>
                                                    {/* 封面 */}
                                                    <Box sx={{
                                                        width: renderBookWidth,
                                                        height: renderHeight,
                                                        borderRadius: '0 4px 4px 0', overflow: 'hidden',
                                                        boxShadow: `4px 4px 16px ${alpha('#000', 0.15)}`,
                                                        transition: 'all 0.3s ease-out', flexShrink: 0,
                                                    }}>
                                                        {(editingStyle?.coverImage || coverImage) ? (
                                                            <img src={editingStyle?.coverImage || coverImage} alt="封面预览"
                                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            <Box sx={{
                                                                width: '100%', height: '100%',
                                                                background: `linear-gradient(145deg, ${editingStyle?.spineColor || '#6750A4'} 0%, ${alpha(editingStyle?.spineColor || '#6750A4', 0.7)} 100%)`,
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            }}>
                                                                <Typography sx={{ color: 'white', fontSize: `${Math.max(0.6, 0.7 * globalScale)}rem`, fontWeight: 600, textAlign: 'center', p: 1 }}>
                                                                    {project?.name || '封面'}
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                    </Box>
                                                </>
                                            );
                                        })()}
                                    </Box>

                                    {/* 底部按钮：生成封面 / 上传封面 */}
                                    <Stack direction="row" spacing={2} sx={{ justifyContent: 'center', width: '100%' }}>
                                        {(coverPromptLoading || coverGenerating) ? (
                                            <Button
                                                variant="contained"
                                                size="small"
                                                onClick={() => { if (project?.id) cancelCoverGeneration(project.id); }}
                                                sx={{
                                                    flex: 1, borderRadius: 4, bgcolor: uiColor, color: uiTextColor,
                                                    '&:hover': { bgcolor: alpha('#d32f2f', 0.9) },
                                                }}
                                            >
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <CircularProgress size={14} color="inherit" />
                                                    生成中...
                                                </Box>
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="contained"
                                                size="small"
                                                startIcon={<IconAI />}
                                                onClick={handleOneClickCoverGeneration}
                                                disabled={!projectOutline}
                                                sx={{ flex: 1, borderRadius: 4, bgcolor: uiColor, color: uiTextColor, '&:hover': { bgcolor: alpha(uiColor, 0.85) } }}
                                            >
                                                生成封面
                                            </Button>
                                        )}
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            component="label"
                                            startIcon={<IconImage />}
                                            sx={{ flex: 1, borderRadius: 4, color: '#5d4037', borderColor: alpha('#5d4037', 0.2), '&:hover': { borderColor: uiColor, bgcolor: alpha(uiColor, 0.05) } }}
                                        >
                                            上传封面
                                            <input type="file" hidden accept="image/*" onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onload = (event) => {
                                                        const result = event.target.result;
                                                        setEditingStyle(prev => ({ ...prev, coverImage: result }));
                                                        extractColorFromImage(result);
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }} />
                                        </Button>
                                    </Stack>
                                </Box>
                            </Box>
                        </Box>

                        {/* Book Spine (中缝) - 移除空隙，仅保留细微分割线 */}
                        {/* Book Spine (中缝) - 改进版 */}
                        <Box sx={{
                            width: 0, // 视觉上不占据宽度，仅作为定位基准
                            height: 520,
                            position: 'relative',
                            zIndex: 1,
                        }}>
                            {/* 左侧书槽 (Left Groove) */}
                            <Box sx={{
                                position: 'absolute',
                                right: 0,
                                top: 0,
                                bottom: 0,
                                width: 12,
                                background: 'linear-gradient(90deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.05) 100%)',
                                zIndex: 3,
                                pointerEvents: 'none',
                                mixBlendMode: 'multiply',
                            }} />

                            {/* 分割线 */}
                            <Box sx={{
                                position: 'absolute',
                                right: 0,
                                top: 0,
                                bottom: 0,
                                width: 1,
                                bgcolor: 'rgba(0,0,0,0.1)',
                                zIndex: 4,
                            }} />

                            {/* 右侧书槽 (Right Groove) */}
                            <Box sx={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: 12,
                                background: 'linear-gradient(-90deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.05) 100%)',
                                zIndex: 3,
                                pointerEvents: 'none',
                                mixBlendMode: 'multiply',
                            }} />
                        </Box>

                        {/* 右侧书签页签组 (Vertical Tabs) - 置于所有纸层最下方，作为页面的同级元素以实现真正的“夹层”效果 */}
                        <Box sx={{
                            position: 'absolute',
                            right: -8,
                            top: 40, // 位置显著上移
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1,
                            zIndex: 1,
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}>
                            {[
                                { icon: <IconBook />, title: '开始阅读', onClick: () => { setIsBookOpened(false); onRead?.(); } },
                                { icon: <IconSync />, title: '同步大纲信息', onClick: () => onSync?.() },
                                { icon: <IconExport fontSize="small" />, title: '导出小说', onClick: () => onExport?.() }
                            ].map((btn, i) => (
                                <Tooltip key={i} title={btn.title} placement="right">
                                    <Box
                                        onClick={(e) => { e.stopPropagation(); btn.onClick(); }}
                                        sx={{
                                            width: 48,
                                            height: 36,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'flex-end',
                                            pr: 1,
                                            bgcolor: '#fdfbf7',
                                            borderRadius: '0 6px 6px 0',
                                            cursor: 'pointer',
                                            boxShadow: '1px 1px 3px rgba(0,0,0,0.08)',
                                            border: '1px solid rgba(0,0,0,0.06)',
                                            borderLeft: 'none',
                                            color: alpha('#2c1810', 0.18), // 颜色更浅，更低调优雅
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            '&:hover': {
                                                transform: 'translateX(8px)',
                                                color: spineColor,
                                                bgcolor: 'white',
                                                boxShadow: '3px 3px 10px rgba(0,0,0,0.12)',
                                                '& .tab-icon': { transform: 'scale(1.05)' }
                                            }
                                        }}
                                    >
                                        {React.cloneElement(btn.icon, {
                                            className: 'tab-icon',
                                            sx: { fontSize: 18, transition: 'all 0.2s' }
                                        })}
                                    </Box>
                                </Tooltip>
                            ))}
                        </Box>

                        {/* Right Page (内容页) - 静态页面 (被左页覆盖) */}
                        <Box sx={{
                            width: 360,
                            height: 520,
                            position: 'relative',
                            zIndex: 1, // zIndex低于左页，确保被左页翻过来时覆盖
                            // 右侧页面堆叠效果
                            '&::before': {
                                content: '""',
                                position: 'absolute',
                                right: -3,
                                top: 2,
                                bottom: 2,
                                width: 3,
                                background: '#f5f5f0',
                                border: '1px solid #e0e0e0',
                                borderLeft: 'none',
                                borderRadius: '0 2px 2px 0',
                                zIndex: -1,
                                boxShadow: '1px 1px 2px rgba(0,0,0,0.1)',
                            },
                            '&::after': {
                                content: '""',
                                position: 'absolute',
                                right: -6,
                                top: 4,
                                bottom: 4,
                                width: 3,
                                background: '#ebebe6',
                                border: '1px solid #dcdcdc',
                                borderLeft: 'none',
                                borderRadius: '0 2px 2px 0',
                                zIndex: -2,
                                boxShadow: '1px 1px 2px rgba(0,0,0,0.1)',
                            },
                        }}>
                            {/* 右侧封底内侧纹理 */}
                            <Box sx={{
                                position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: '0 2px 2px 0',
                                background: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.15'/%3E%3C/svg%3E")`,
                                zIndex: 0,
                            }} />
                            {/* 正面 - 项目信息 (始终显示) */}
                            <Box sx={{
                                width: '100%',
                                height: '100%',
                                bgcolor: '#fdfbf7',
                                borderRadius: '0 2px 2px 0',
                                background: `linear-gradient(-90deg, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0) 15%), #fdfbf7`,
                                boxShadow: '-4px 0 8px rgba(0,0,0,0.1), inset 25px 0 40px -20px rgba(0,0,0,0.15)',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                p: 3.5,
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                                {/* 标题 */}
                                <Typography variant="h4" fontWeight="bold" sx={{ color: '#2c1810', mb: 2, letterSpacing: -0.5, textAlign: 'center' }}>
                                    {project?.name}
                                </Typography>

                                {/* 标签展示 */}
                                {(() => {
                                    // 获取 tags，可能是数组或 JSON 字符串
                                    let tags = project?.tags || projectOutline?.tags;
                                    if (typeof tags === 'string') {
                                        try { tags = JSON.parse(tags); } catch { tags = null; }
                                    }
                                    if (!Array.isArray(tags) || tags.length === 0) return null;
                                    return (
                                        <Stack direction="row" spacing={1} sx={{ mb: 2.5, flexWrap: 'wrap', gap: 0.5, justifyContent: 'center' }}>
                                            {tags.map((tag, idx) => (
                                                <Box key={idx} sx={{
                                                    px: 1.2, py: 0.2, fontSize: '0.68rem', borderRadius: 4,
                                                    color: alpha('#2c1810', 0.4), bgcolor: alpha('#2c1810', 0.03),
                                                    letterSpacing: 0.5, border: '1px solid rgba(0,0,0,0.02)',
                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    '&:hover': { bgcolor: alpha(spineColor, 0.05), color: spineColor, transform: 'translateY(-1px)' }
                                                }}>
                                                    {tag}
                                                </Box>
                                            ))}
                                        </Stack>
                                    );
                                })()}

                                {/* 统计信息 */}
                                {projectStats && (
                                    <Stack direction="row" spacing={4} sx={{ mb: 3.5, py: 1.5, px: 2, borderRadius: 2 }}>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="h5" fontWeight="bold" sx={{ color: '#b8860b', lineHeight: 1 }}>
                                                {(projectStats.totalWords / 10000).toFixed(1)}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: alpha('#2c1810', 0.4), letterSpacing: 0.5, fontSize: '0.65rem' }}>万字</Typography>
                                        </Box>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="h5" fontWeight="bold" sx={{ color: '#2c1810', lineHeight: 1 }}>
                                                {projectStats.chapterCount}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: alpha('#2c1810', 0.4), letterSpacing: 0.5, fontSize: '0.65rem' }}>章节</Typography>
                                        </Box>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="h5" fontWeight="bold" sx={{ color: '#2e7d32', lineHeight: 1 }}>
                                                {projectStats.volumeCount}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: alpha('#2c1810', 0.4), letterSpacing: 0.5, fontSize: '0.65rem' }}>分卷</Typography>
                                        </Box>
                                    </Stack>
                                )}

                                {/* 简介 */}
                                {projectOutline?.logline && (
                                    <Typography variant="body2" color={alpha('#2c1810', 0.65)} fontFamily="serif" sx={{
                                        lineHeight: 1.9, fontSize: '0.95rem', fontStyle: 'italic', letterSpacing: 0.3,
                                        display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden', textAlign: 'center', maxWidth: '95%', mb: 4
                                    }}>
                                        {projectOutline.logline}
                                    </Typography>
                                )}

                                {/* 主按钮 */}
                                <Button variant="contained" disableElevation startIcon={<IconEnter />}
                                    onClick={(e) => { e.stopPropagation(); setIsBookOpened(false); onEnter?.(); }}
                                    sx={{
                                        borderRadius: 4, px: 5, py: 1.5, minWidth: '200px', whiteSpace: 'nowrap',
                                        bgcolor: uiColor, color: uiTextColor, fontSize: '1rem', fontWeight: '600', textTransform: 'none',
                                        boxShadow: `0 4px 14px ${alpha(uiColor, 0.35)}`,
                                        '&:hover': { bgcolor: alpha(uiColor, 0.85), transform: 'translateY(-2px)', boxShadow: `0 6px 20px ${alpha(uiColor, 0.45)}` },
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                    }}>
                                    打开项目
                                </Button>
                            </Box>
                        </Box>
                    </Box>
                </Box>
            </Dialog>
        </Box>
    );
};

// 添加新书按钮
export const AddBookCard = ({ onClick }) => {
    const theme = useTheme();
    const [isHovered, setIsHovered] = useState(false);

    const spineWidth = 60; // Thicker spine for Add Book card
    const bookHeight = 420;
    const coverWidth = 280;

    // 固定的轻微倾斜，让它看起来也是书架的一部分
    const randomStyles = React.useMemo(() => {
        return { rotateZ: -1.5, marginRight: 2 };
    }, []);

    return (
        <Box
            onClick={(e) => { e.stopPropagation(); onClick?.(); }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            sx={{
                position: 'relative',
                height: bookHeight,
                width: (() => {
                    const angleRad = Math.abs(randomStyles.rotateZ) * (Math.PI / 180);
                    const projectedWidth = spineWidth * Math.cos(angleRad) + bookHeight * Math.sin(angleRad);
                    return Math.ceil(projectedWidth) + 1;
                })(),
                cursor: 'pointer',
                perspective: '1500px',
                perspectiveOrigin: 'center bottom',
                transformOrigin: 'center bottom',
                zIndex: isHovered ? 10 : 1,
                flexShrink: 0,
                transform: !isHovered
                    ? `rotateZ(${randomStyles.rotateZ}deg)`
                    : 'none',
                transition: 'all 0.3s ease',
            }}
        >
            <Box
                sx={{
                    // 内部容器绝对定位到右侧
                    position: 'absolute',
                    right: 0,
                    bottom: 0,
                    // 默认宽度设为书脊宽度，防止被推到外部
                    width: isHovered ? '100%' : spineWidth,
                    height: '100%',
                    transformStyle: 'preserve-3d',
                    transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                    transformOrigin: 'left center',
                    transform: isHovered
                        ? 'rotateY(90deg) translateY(-12px)'  // 保持书脊角度，上移12px
                        : 'rotateY(90deg)',
                }}
            >
                {/* Spine */}
                <Box
                    sx={{
                        position: 'absolute',
                        width: spineWidth,
                        height: '100%',
                        transformOrigin: 'right center',
                        transform: `translateX(-${spineWidth}px) rotateY(-90deg) translateX(${spineWidth / 2}px)`,
                        border: '3px dashed',
                        borderColor: isHovered ? 'primary.main' : 'divider',
                        borderRadius: '4px 0 0 4px',
                        bgcolor: isHovered ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.3s',
                    }}
                >
                    <Typography
                        sx={{
                            writingMode: 'vertical-rl',
                            transform: 'rotate(180deg)',
                            color: isHovered ? 'primary.main' : 'text.secondary',
                            fontWeight: 700,
                            fontSize: '1rem',
                            letterSpacing: '0.2em',
                        }}
                    >
                        + 新建
                    </Typography>
                </Box>

                {/* Front Cover */}
                <Box
                    sx={{
                        position: 'absolute',
                        width: coverWidth,
                        height: '100%',
                        transform: `translateZ(${spineWidth / 2}px)`,
                        border: '3px dashed',
                        borderColor: isHovered ? 'primary.main' : 'divider',
                        borderRadius: '0 4px 4px 0',
                        bgcolor: isHovered ? alpha(theme.palette.primary.main, 0.05) : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.3s',
                    }}
                >
                    <Stack alignItems="center" spacing={1}>
                        <IconBook sx={{ fontSize: 48, color: isHovered ? 'primary.main' : 'text.disabled' }} />
                        <Typography color={isHovered ? 'primary.main' : 'text.secondary'} fontWeight={600}>
                            创建新书
                        </Typography>
                    </Stack>
                </Box>
            </Box>
        </Box >
    );
};

export default Book3D;
