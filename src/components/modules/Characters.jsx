import React, { useState, useEffect, useRef } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { storage } from '../../services/storage';
import { buildCharacterPrompt, getImageApiConfig, generatePortrait, startBackgroundGeneration, isGenerating } from '../../services/imageGeneration';
import {
    Box, Card, CardContent, CardActionArea, CardMedia, Typography,
    Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Grid, Chip, Tooltip, Snackbar, Alert, Stack,
    Avatar, Slider, Switch, Paper, Checkbox, useTheme, useMediaQuery,
    Fade, Divider, Fab, InputAdornment, Badge,
    List, ListItem, ListItemButton, ListItemIcon, ListItemText,
    Drawer, Breadcrumbs, Link, Collapse,
    Stepper, Step, StepLabel, StepConnector
} from '@mui/material';
import {
    AddRounded as IconPlus,
    EditRounded as IconEdit,
    DeleteRounded as IconDelete,
    CloudUploadRounded as IconUpload,
    SyncRounded as IconSync,
    SmartToyRounded as IconRobot,
    DescriptionRounded as IconFile,
    DownloadRounded as IconDownload,
    PersonRounded as IconUser,
    UploadFileRounded as IconImport,
    CameraAltRounded as IconCamera,
    CheckBoxRounded as IconCheckSquare,
    CloseRounded as IconClose,
    SearchRounded as IconSearch,
    ChevronRightRounded as IconChevronRight,
    ChevronLeftRounded as IconChevronLeft,
    MenuRounded as IconMenu,
    InfoRounded as IconInfoCircle,
    PeopleRounded as IconPeople,
    AccountTreeRounded as IconRelations,
    TimelineRounded as IconTimeline
} from '@mui/icons-material';
import EmptyStateCharacter from '../../assets/illustrations/empty-state-character.gif';

// 上传角色图像到服务器（支持 File 对象或 Base64 字符串）
const uploadCharacterImage = async (file, type = 'characters') => {
    // 如果是 File 对象，使用 FormData 直接上传
    if (file instanceof File || file instanceof Blob) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', type);

            const response = await fetch('/api/images/upload', {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error('Upload failed');
            const result = await response.json();
            return result.url; // 返回服务器 URL
        } catch (error) {
            console.error('Failed to upload file:', error);
            throw error;
        }
    }

    // 如果是字符串，检查是 Base64 还是已有的 URL
    if (typeof file === 'string') {
        if (!file.startsWith('data:')) {
            return file; // 已经是 URL，直接返回
        }
        // Base64 兼容模式
        const timestamp = Date.now();
        const filename = `upload_${timestamp}.png`;
        try {
            const response = await fetch('/api/images/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, filename, data: file })
            });
            if (!response.ok) throw new Error('Upload failed');
            const result = await response.json();
            return result.url;
        } catch (error) {
            console.error('Failed to upload base64:', error);
            throw error;
        }
    }

    return file;
};

// --- Sub-components ---

const CharacterCard = ({ char, isSelected, onSelect, onEdit, onDelete, isManualSort, onDragStart, onDragOver, onDrop, isSelectionMode }) => {
    const theme = useTheme();

    // Parse traits if string
    const traits = typeof char.traits === 'string'
        ? char.traits.split(/[,，、]/).filter(t => t.trim()).slice(0, 3) // Take top 3
        : [];

    if (isSelectionMode) {
        return (
            <Card
                variant={isSelected ? "outlined" : "outlined"}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    p: 1,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    bgcolor: isSelected ? 'action.selected' : 'background.paper',
                    '&:hover': {
                        bgcolor: isSelected ? 'action.selected' : 'action.hover',
                    }
                }}
                onClick={() => onSelect(char.id)}
            >
                <Avatar
                    src={char.avatar}
                    alt={char.name}
                    variant="rounded"
                    sx={{ width: 48, height: 48, mr: 2 }}
                >
                    {char.name?.[0] || '?'}
                </Avatar>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle1" fontWeight="bold" noWrap>
                        {char.name}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                        {char.role && <Chip label={char.role} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />}
                    </Stack>
                </Box>

                <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); onEdit(char); }}
                >
                    <IconEdit fontSize="small" />
                </IconButton>
            </Card>
        );
    }

    return (
        <Card
            draggable={isManualSort}
            onDragStart={(e) => isManualSort && onDragStart(e, char.id)}
            onDragOver={(e) => isManualSort && onDragOver(e, char.id)}
            onDrop={(e) => isManualSort && onDrop(e, char.id)}
            variant="outlined"
            onClick={() => onEdit(char)}
            sx={{
                width: '100%',
                height: '100%',
                minHeight: 220,
                display: 'flex',
                flexDirection: 'column',
                cursor: isManualSort ? 'move' : 'pointer',
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                position: 'relative',
                transform: isSelected ? 'scale(0.98)' : 'scale(1)',
                borderColor: isSelected ? 'primary.main' : 'divider',
                borderWidth: isSelected ? 2 : 1,
                borderRadius: 4,
                overflow: 'hidden',
                '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: theme.shadows[4]
                }
            }}
        >
            <CardActionArea sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start' }}>
                <CardContent sx={{ flex: 1, p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>

                    {/* Top: Header */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                        <Avatar
                            src={char.avatar}
                            alt={char.name}
                            sx={{ width: 64, height: 64, bgcolor: 'primary.light', fontSize: '1.5rem', fontWeight: 'bold' }}
                        >
                            {char.name?.[0] || '?'}
                        </Avatar>

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
                                <Typography variant="h6" fontWeight="bold" noWrap lineHeight={1.2}>
                                    {char.name}
                                </Typography>
                                {(char.gender || char.age) && (
                                    <Typography variant="caption" color="text.secondary" noWrap>
                                        {char.gender} {char.age && `· ${String(char.age).includes('岁') ? char.age : char.age + '岁'}`}
                                    </Typography>
                                )}
                            </Box>
                            <Typography variant="body2" color="primary.main" fontWeight="medium" noWrap>
                                {char.role || '未设定角色定位'}
                            </Typography>
                        </Box>

                        {isManualSort && (
                            <Box onClick={e => e.stopPropagation()}>
                                <Checkbox checked={isSelected} onChange={() => onSelect(char.id)} />
                            </Box>
                        )}
                    </Box>

                    {/* Middle: Info & Tags */}
                    <Box>
                        {/* Traits Chips */}
                        {traits.length > 0 && (
                            <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
                                {traits.map((trait, index) => (
                                    <Chip
                                        key={index}
                                        label={trait}
                                        size="small"
                                        sx={{
                                            height: 24,
                                            fontSize: '0.75rem',
                                            bgcolor: 'action.hover',
                                            border: '1px solid',
                                            borderColor: 'divider'
                                        }}
                                    />
                                ))}
                            </Stack>
                        )}

                        {/* Bio/Summary */}
                        <Typography variant="body2" color="text.secondary" component="div" sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.6
                        }}>
                            {char.bio || char.appearance || '暂无详细描述...'}
                        </Typography>
                    </Box>

                    <Box sx={{ flex: 1 }} />
                </CardContent>

                {/* Footer: Current State */}
                {char.currentState && char.currentState.description ? (
                    <Box sx={{
                        p: 2.5,
                        bgcolor: 'action.hover', // Slightly darker background for distinction
                        borderTop: '1px solid',
                        borderColor: 'divider',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1
                    }}>
                        {/* Meta: Chapter */}
                        <Chip
                            label={`第 ${char.currentState.chapter || 1} 章`}
                            size="small"
                            sx={{
                                height: 20,
                                fontSize: '0.7rem',
                                fontWeight: 'bold',
                                borderRadius: 1,
                                bgcolor: 'primary.main',
                                color: 'primary.contrastText',
                                alignSelf: 'flex-start' // Ensure it doesn't stretch
                            }}
                        />

                        {/* Meta: Emotional */}
                        {char.currentState.emotional && (
                            <Typography variant="subtitle2" fontWeight="bold" color="text.primary">
                                {char.currentState.emotional}
                            </Typography>
                        )}

                        {/* Description */}
                        <Typography variant="body2" color="text.secondary" sx={{
                            lineHeight: 1.6,
                            display: '-webkit-box',
                            WebkitLineClamp: 4, // Allow more text
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                        }}>
                            {char.currentState.description}
                        </Typography>
                    </Box>
                ) : (
                    <Box sx={{ p: 2, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
                        <Typography variant="caption" color="text.disabled">暂无状态更新</Typography>
                    </Box>
                )}
            </CardActionArea>
        </Card>
    );
};

// --- Image Compression Helper ---
const compressImage = (file, maxWidth = 1024, quality = 0.8) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
        };
    });
};

// --- Avatar Cropper Component ---
// --- Avatar Cropper Component ---
// --- Image Cropper Component ---
const ImageCropper = ({ visible, imageSrc, aspectRatio = 1, outputWidth = 200, maskShape = 'rect', onCancel, onConfirm, title = '裁切图片' }) => {
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const imgRef = useRef(null);
    const containerSize = 400;

    // Calculate mask dimensions
    // Max dimension within container (leaving 40px margin total)
    const maxDim = containerSize - 40;
    let maskWidth, maskHeight;

    if (aspectRatio >= 1) {
        maskWidth = maxDim;
        maskHeight = maxDim / aspectRatio;
    } else {
        maskHeight = maxDim;
        maskWidth = maxDim * aspectRatio;
    }

    useEffect(() => {
        if (visible) {
            setPosition({ x: 0, y: 0 });
        }
    }, [visible]);

    const handleImageLoad = (e) => {
        const { naturalWidth, naturalHeight } = e.currentTarget;
        // Calculate min zoom to cover mask
        const initialZoom = Math.max(maskWidth / naturalWidth, maskHeight / naturalHeight);
        setZoom(initialZoom);
    };

    // Calculate minimum zoom to cover mask fully
    const getMinZoom = () => {
        const img = imgRef.current;
        if (!img) return 0.1;
        return Math.max(maskWidth / img.naturalWidth, maskHeight / img.naturalHeight);
    };

    // Clamp position helper
    const clampPosition = (pos, currentZoom) => {
        const img = imgRef.current;
        if (!img) return pos;
        const scaledWidth = img.naturalWidth * currentZoom;
        const scaledHeight = img.naturalHeight * currentZoom;
        const maxOffsetX = Math.max(0, (scaledWidth - maskWidth) / 2);
        const maxOffsetY = Math.max(0, (scaledHeight - maskHeight) / 2);
        return {
            x: Math.min(maxOffsetX, Math.max(-maxOffsetX, pos.x)),
            y: Math.min(maxOffsetY, Math.max(-maxOffsetY, pos.y))
        };
    };

    const handleZoomChange = (newZoom) => {
        const minZoom = getMinZoom();
        const clampedZoom = Math.min(Math.max(newZoom, minZoom), 5);
        setZoom(clampedZoom);
        // Correct position if it exceeds new bounds
        setPosition(prev => clampPosition(prev, clampedZoom));
    };

    const handleWheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        handleZoomChange(zoom + delta);
    };

    const handleMouseDown = (e) => {
        setDragging(true);
        setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = (e) => {
        if (!dragging) return;
        e.preventDefault();

        const img = imgRef.current;
        if (!img) return;

        let newX = e.clientX - startPos.x;
        let newY = e.clientY - startPos.y;

        // Calculate scaled image dimensions
        const scaledWidth = img.naturalWidth * zoom;
        const scaledHeight = img.naturalHeight * zoom;

        // Calculate max allowed offset (image edge must stay within mask)
        // When centered (position=0), image center aligns with mask center.
        // Max offset = (scaledImageDimension - maskDimension) / 2
        const maxOffsetX = Math.max(0, (scaledWidth - maskWidth) / 2);
        const maxOffsetY = Math.max(0, (scaledHeight - maskHeight) / 2);

        // Clamp position
        newX = Math.min(maxOffsetX, Math.max(-maxOffsetX, newX));
        newY = Math.min(maxOffsetY, Math.max(-maxOffsetY, newY));

        setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
        setDragging(false);
    };

    const handleCrop = () => {
        const canvas = document.createElement('canvas');
        canvas.width = outputWidth;
        canvas.height = outputWidth / aspectRatio;
        const ctx = canvas.getContext('2d');
        const img = imgRef.current;
        if (!img) return;

        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Move to center of canvas
        ctx.translate(canvas.width / 2, canvas.height / 2);

        // Logic mapping:
        // Mask Center matches Canvas Center (visual)
        // Image transform (visual): translate(x, y) scale(zoom)
        // But the coordinates (x,y) are relative to the Container Center in screen pixels.
        // We need to map Screen Pixels (visual mask space) to Canvas Pixels.
        // Scale factor = outputWidth / maskWidth
        const scaleFactor = outputWidth / maskWidth;

        // Apply position offset (scaled)
        ctx.translate(position.x * scaleFactor, position.y * scaleFactor);

        // Apply zoom (scaled)
        // Zoom on screen maps image pixels to screen pixels. e.g. zoom=0.5 -> image half size on screen.
        // On canvas, we want the same relative scale.
        // If image is drawn as naturalWidth * zoom on screen.
        // On canvas we want to draw it as naturalWidth * zoom * scaleFactor.
        ctx.scale(zoom * scaleFactor, zoom * scaleFactor);

        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

        onConfirm(canvas.toDataURL('image/png'));
    };

    return (
        <Dialog
            open={visible}
            onClose={onCancel}
            maxWidth="sm"
            fullWidth
            PaperProps={{ sx: { borderRadius: 4 } }}
        >
            <DialogTitle sx={{ fontWeight: 'bold' }}>{title}</DialogTitle>
            <DialogContent dividers>
                <Box
                    sx={{
                        width: '100%',
                        height: containerSize,
                        bgcolor: '#f5f5f5',
                        position: 'relative',
                        overflow: 'hidden',
                        cursor: dragging ? 'grabbing' : 'grab',
                        borderRadius: 2,
                        touchAction: 'none'
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onWheel={handleWheel}
                >
                    <img
                        ref={imgRef}
                        src={imageSrc}
                        alt="Crop target"
                        onLoad={handleImageLoad}
                        draggable={false}
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                            transformOrigin: 'center',
                            maxWidth: 'none',
                            maxHeight: 'none',
                            userSelect: 'none'
                        }}
                    />
                    {/* Shadow Overlay */}
                    <Box sx={{
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: 'none',
                        // Use a huge box shadow to create the overlay
                        // box-shadow attaches to the mask element below
                    }} />

                    {/* Mask Element (Hole) */}
                    <Box sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: maskWidth,
                        height: maskHeight,
                        transform: 'translate(-50%, -50%)',
                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)', // The dark overlay
                        borderRadius: maskShape === 'circle' ? '50%' : 2,
                        border: '2px solid rgba(255,255,255,0.8)',
                        pointerEvents: 'none',
                        zIndex: 10
                    }} />
                </Box>

                <Stack spacing={2} sx={{ mt: 3, maxWidth: 300, mx: 'auto' }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <Typography variant="caption" color="text.secondary">缩放</Typography>
                        <Slider
                            min={0.1}
                            max={5}
                            step={0.1}
                            value={zoom}
                            onChange={(_, val) => handleZoomChange(val)}
                            sx={{ flex: 1 }}
                        />
                        <Typography variant="caption" sx={{ minWidth: 30 }} align="right">{Math.round(zoom * 100)}%</Typography>
                    </Stack>
                    <Typography variant="caption" align="center" color="text.disabled">
                        滚动鼠标滚轮可快速缩放，拖拽调整位置
                    </Typography>
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onCancel} sx={{ borderRadius: 999 }}>取消</Button>
                <Button onClick={handleCrop} variant="contained" sx={{ borderRadius: 999 }}>{title}</Button>
            </DialogActions>
        </Dialog>
    );
};

const CharacterDetailModal = ({ visible, character, onClose, onSave, onDelete }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [isEditMode, setIsEditMode] = useState(false);

    // Form state (replacing Arco Form)
    const [formValues, setFormValues] = useState({});

    const [showImportModal, setShowImportModal] = useState(false);
    const [importText, setImportText] = useState('');

    const [previewAvatar, setPreviewAvatar] = useState('');
    const [originalAvatar, setOriginalAvatar] = useState('');
    const [previewDisplayImage, setPreviewDisplayImage] = useState('');
    const [originalDisplayImage, setOriginalDisplayImage] = useState('');

    // Cropper state
    const [cropperVisible, setCropperVisible] = useState(false);
    const [cropMode, setCropMode] = useState('avatar'); // 'avatar' | 'display'
    const [tempImage, setTempImage] = useState('');

    // AI Portrait Generation state
    const [aiGenerating, setAiGenerating] = useState(false);

    // Snackbar for generation progress
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

    // Ref for hidden file inputs
    const avatarInputRef = useRef(null);
    const displayImageInputRef = useRef(null);

    useEffect(() => {
        if (visible && character) {
            setFormValues(character);
            setPreviewAvatar(character.avatar);
            setOriginalAvatar(character.originalAvatar || character.avatar);
            setPreviewDisplayImage(character.displayImage);
            setOriginalDisplayImage(character.originalDisplayImage || character.displayImage);
            setIsEditMode(false);
            setAiGenerating(false); // Reset generating state when switching characters
            setSnackbar({ open: false, message: '', severity: 'info' }); // Reset snackbar
        }
    }, [visible, character]);

    const handleInputChange = (field, value) => {
        setFormValues(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveClick = async () => {
        // Manual validation if needed, for now just required name
        if (!formValues.name) return; // Add error UI?

        // 检测是否手动删除了图像（从有值变为空）
        // 如果是，先删除物理文件
        const oldAvatar = character.avatar;
        const oldDisplayImage = character.displayImage;
        const newAvatar = previewAvatar || '';
        const newDisplayImage = previewDisplayImage === null ? '' : (previewDisplayImage || '');

        // 如果旧的是有效图像路径，新的是空，说明用户主动删除了
        if (oldAvatar && oldAvatar.startsWith('/api/images/') && !newAvatar) {
            await storage.deleteImageFile(oldAvatar);
        }
        if (oldDisplayImage && oldDisplayImage.startsWith('/api/images/') && !newDisplayImage) {
            await storage.deleteImageFile(oldDisplayImage);
        }

        // 上传所有 Base64 图片到服务器
        let finalAvatar = newAvatar;
        let finalDisplayImage = newDisplayImage;
        let finalOriginalAvatar = originalAvatar || '';
        let finalOriginalDisplayImage = previewDisplayImage === null ? '' : (originalDisplayImage || '');

        try {
            // 并行上传所有图片
            const uploads = await Promise.all([
                uploadCharacterImage(finalAvatar, 'characters'),
                uploadCharacterImage(finalDisplayImage, 'characters'),
                uploadCharacterImage(finalOriginalAvatar, 'characters'),
                uploadCharacterImage(finalOriginalDisplayImage, 'characters')
            ]);

            finalAvatar = uploads[0];
            finalDisplayImage = uploads[1];
            finalOriginalAvatar = uploads[2];
            finalOriginalDisplayImage = uploads[3];
        } catch (error) {
            console.error('Failed to upload images:', error);
            // 继续保存，使用原始值
        }

        await onSave({
            ...character,
            ...formValues,
            avatar: finalAvatar,
            displayImage: finalDisplayImage,
            originalAvatar: finalOriginalAvatar,
            originalDisplayImage: finalOriginalDisplayImage
        });
        setIsEditMode(false);
    };

    const handleExport = () => {
        const { avatar, displayImage, ...exportData } = character;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `character_${character.name || 'export'}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    // Import Logic
    const importInputRef = useRef(null);
    const handleImportClick = () => {
        setShowImportModal(true);
    };

    const handleFileImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                // Validate or Just Apply
                setFormValues(prev => ({ ...prev, ...importedData }));
                // If in view mode, maybe switch to edit mode to show changes? 
                // Or just update local state. For now, let's switch to edit mode so user sees it.
                setIsEditMode(true);
                setShowImportModal(false);
                alert('导入成功，请点击保存以应用更改。');
            } catch (err) {
                console.error("Import failed:", err);
                alert('导入失败: 文件格式不正确');
            }
        };
        reader.readAsText(file);
        // Reset input
        e.target.value = '';
    };

    // AI Portrait Generation - Auto generate and apply (no dialog)
    const handleAutoGeneratePortraits = async () => {
        // Load outline data to build prompts
        let outline = {};
        let options = {};

        try {
            if (character.projectId) {
                const outlineRow = await storage.getItem('core_outlines', character.projectId);
                if (outlineRow?.content) {
                    try {
                        outline = JSON.parse(outlineRow.content);
                    } catch (e) { /* ignore */ }
                }
                // Try to get options from localStorage
                const draftKey = `narragen_form_draft_${character.projectId}`;
                const draft = localStorage.getItem(draftKey);
                if (draft) {
                    const draftData = JSON.parse(draft);
                    options = draftData.outlineOptions || {};
                }
            }
        } catch (e) {
            console.error('Failed to load outline for prompt building:', e);
        }

        // Get API config
        try {
            const apiConfig = await getImageApiConfig(character?.projectId);
            if (!apiConfig) {
                setSnackbar({ open: true, message: '请先在设置中配置图像生成 API', severity: 'error' });
                return;
            }

            // Build prompts
            const { characterPrompt, stylePrompt } = buildCharacterPrompt(formValues || character, outline, options);

            setAiGenerating(true);
            setSnackbar({ open: true, message: '正在生成头像和立绘...', severity: 'info' });

            // Start background generation for avatar (1:1)
            startBackgroundGeneration(`${character.id}_avatar`, {
                characterPrompt,
                stylePrompt,
                size: '1:1',
                apiConfig,
                projectId: character.projectId,
                characterName: character.name
            });

            // Start background generation for display image (2:3)
            startBackgroundGeneration(`${character.id}_display`, {
                characterPrompt,
                stylePrompt,
                size: '2:3',
                apiConfig,
                projectId: character.projectId,
                characterName: character.name
            });

        } catch (err) {
            console.error('Auto generate portraits error:', err);
            setSnackbar({ open: true, message: err.message || '生成失败', severity: 'error' });
            setAiGenerating(false);
        }
    };

    // Listen for background generation events and auto-apply
    useEffect(() => {
        const handleGenStatus = (e) => {
            const { characterId, status, imageUrl, error } = e.detail;

            // Check if this event is for our character (with _avatar or _display suffix)
            const isAvatarTask = characterId === `${character?.id}_avatar`;
            const isDisplayTask = characterId === `${character?.id}_display`;

            if (!isAvatarTask && !isDisplayTask) return;

            console.log('[AI Gen] Event received:', { characterId, status, isAvatarTask, isDisplayTask });

            if (status === 'success') {
                if (isAvatarTask) {
                    // Auto-apply avatar
                    console.log('[AI Gen] Applying avatar');
                    setPreviewAvatar(imageUrl);
                    setOriginalAvatar(imageUrl);
                    setSnackbar({ open: true, message: '头像已生成', severity: 'success' });
                } else if (isDisplayTask) {
                    // Auto-apply display image
                    console.log('[AI Gen] Applying display image');
                    setPreviewDisplayImage(imageUrl);
                    setOriginalDisplayImage(imageUrl);
                    setSnackbar({ open: true, message: '立绘已生成', severity: 'success' });
                }
                // Switch to edit mode to show changes
                setIsEditMode(true);
            } else if (status === 'error') {
                const taskName = isAvatarTask ? '头像' : '立绘';
                setSnackbar({ open: true, message: `${taskName}生成失败: ${error}`, severity: 'error' });
            }

            // Check if this was the last running task for this character
            // We'll just set aiGenerating to false after each completion for simplicity
            // The button will re-enable, but that's acceptable UX
            if (status === 'success' || status === 'error') {
                setAiGenerating(false);
            }
        };

        window.addEventListener('narragen-image-gen-status', handleGenStatus);
        return () => window.removeEventListener('narragen-image-gen-status', handleGenStatus);
    }, [character]);

    if (!character) return null;

    const activeAvatar = previewAvatar || character.avatar;
    // null means explicitly deleted, so don't fallback; undefined/empty means use character data
    const activeDisplay = previewDisplayImage === null ? '' : (previewDisplayImage || character.displayImage);
    // Fallback to original (uncropped) avatar if no display image
    const activeOriginalAvatar = originalAvatar || character.originalAvatar || character.avatar;
    const showSrc = activeDisplay || activeOriginalAvatar;
    const isVideo = showSrc && (showSrc.startsWith('data:video') || showSrc.match(/\.(mp4|webm|ogg)$/i));

    return (
        <Dialog
            open={visible}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 6,
                    bgcolor: 'background.paper',
                    overflow: 'hidden',
                    height: isMobile ? '100%' : '80vh',
                    maxHeight: 800,
                    boxShadow: theme.shadows[24]
                }
            }}
            fullScreen={isMobile}
        >
            {/* Close Button - absolute top right */}
            <IconButton
                onClick={onClose}
                sx={{
                    position: 'absolute',
                    top: 24,
                    right: 24,
                    zIndex: 10,
                    bgcolor: 'background.paper',
                    boxShadow: 1,
                    '&:hover': { bgcolor: 'action.hover' }
                }}
            >
                <IconClose />
            </IconButton>

            <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: '100%' }}>
                {/* Visual Side - Card Style */}
                <Box sx={{
                    width: isMobile ? '100%' : '45%',
                    height: isMobile ? 300 : '100%',
                    // bgcolor: 'background.default', // Rmoved to eliminate gray background behind the card
                    p: isMobile ? 0 : 3, // Add padding on desktop to create "floating card" effect
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                }}>
                    <Box
                        sx={{
                            width: '100%',
                            height: '100%',
                            borderRadius: isMobile ? 0 : 3,
                            overflow: 'hidden',
                            position: 'relative',
                            boxShadow: isMobile ? 0 : theme.shadows[4],
                            cursor: isEditMode ? 'pointer' : 'default',
                            '&:hover': isEditMode ? { opacity: 0.9 } : {}
                        }}
                        onClick={() => {
                            if (!isEditMode) return;
                            if (activeDisplay && !isVideo) {
                                // Has independent display image: edit/crop
                                setTempImage(originalDisplayImage || previewDisplayImage);
                                setCropMode('display');
                                setCropperVisible(true);
                            } else {
                                // No independent display image (or showing avatar fallback): upload new
                                displayImageInputRef.current.click();
                            }
                        }}
                    >
                        {showSrc ? (
                            isVideo ? (
                                <video src={showSrc} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <img src={showSrc} alt={character.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            )
                        ) : (
                            <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover' }}>
                                <IconUser sx={{ fontSize: 120, color: 'text.disabled', opacity: 0.2 }} />
                            </Box>
                        )}

                        {/* Overlay hint when showing avatar fallback (no independent display image) */}
                        {isEditMode && showSrc && !activeDisplay && !isVideo && (
                            <Box sx={{
                                position: 'absolute',
                                inset: 0,
                                bgcolor: 'rgba(0,0,0,0.4)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                gap: 1,
                                cursor: 'pointer'
                            }}>
                                <IconUpload sx={{ fontSize: 40, opacity: 0.9 }} />
                                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                    点击上传独立立绘
                                </Typography>
                                <Typography variant="caption" sx={{ opacity: 0.6 }}>
                                    当前显示头像图片
                                </Typography>
                            </Box>
                        )}

                        {/* Delete button for display image - only when there's an independent display image */}
                        {isEditMode && activeDisplay && (
                            <IconButton
                                sx={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    bgcolor: 'error.main',
                                    color: 'white',
                                    boxShadow: 2,
                                    '&:hover': { bgcolor: 'error.dark' },
                                    width: 32, height: 32
                                }}
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // Set to null to indicate explicit deletion (prevents fallback)
                                    setPreviewDisplayImage(null);
                                    setOriginalDisplayImage('');
                                }}
                            >
                                <IconClose sx={{ fontSize: 18 }} />
                            </IconButton>
                        )}
                    </Box>
                </Box>

                {/* Content Side */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

                    {/* Toolbar - Integrated into content flow. Added pr: 7 to avoid overlap with Close Button */}
                    <Box sx={{ p: 3, pb: 0, pr: 9, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        {isEditMode ? (
                            <>
                                <Button onClick={() => setIsEditMode(false)} sx={{ borderRadius: 999 }}>取消</Button>
                                <Button variant="contained" onClick={handleSaveClick} sx={{ borderRadius: 999 }}>保存</Button>
                            </>
                        ) : (
                            <>
                                <Tooltip title="导出"><IconButton onClick={handleExport}><IconDownload /></IconButton></Tooltip>
                                <Tooltip title="导入"><IconButton onClick={handleImportClick}><IconImport /></IconButton></Tooltip>
                                <input type="file" hidden ref={importInputRef} accept=".json" onChange={handleFileImport} />
                                <Tooltip title="编辑"><IconButton onClick={() => setIsEditMode(true)}><IconEdit /></IconButton></Tooltip>
                                <Tooltip title="删除">
                                    <IconButton color="error" onClick={() => { if (window.confirm('确定删除?')) onDelete(character.id) }}>
                                        <IconDelete />
                                    </IconButton>
                                </Tooltip>
                            </>
                        )}
                    </Box>

                    {/* Scrollable Content */}
                    <Box sx={{ flex: 1, overflowY: 'auto', p: 5, pt: 2 }}>
                        {isEditMode ? (
                            <Stack spacing={4}>
                                {/* Avatar Upload Section */}
                                <Stack direction="row" spacing={3} alignItems="flex-start">
                                    <Box
                                        sx={{
                                            position: 'relative',
                                            cursor: 'pointer',
                                            '&:hover': { opacity: 0.85 }
                                        }}
                                        onClick={() => {
                                            if (previewAvatar) {
                                                // Has avatar: edit/crop
                                                setTempImage(originalAvatar || previewAvatar);
                                                setCropMode('avatar');
                                                setCropperVisible(true);
                                            } else {
                                                // No avatar: upload
                                                avatarInputRef.current.click();
                                            }
                                        }}
                                    >
                                        <Avatar src={previewAvatar} variant="rounded" sx={{ width: 80, height: 80, borderRadius: 3 }} />
                                        {/* Delete button - only when has avatar */}
                                        {previewAvatar && (
                                            <IconButton
                                                sx={{
                                                    position: 'absolute',
                                                    top: -8,
                                                    right: -8,
                                                    bgcolor: 'error.main',
                                                    color: 'white',
                                                    boxShadow: 2,
                                                    border: '2px solid',
                                                    borderColor: 'background.paper',
                                                    '&:hover': { bgcolor: 'error.dark' },
                                                    width: 24, height: 24, zIndex: 1
                                                }}
                                                size="small"
                                                onClick={(e) => {
                                                    e.stopPropagation(); // Prevent triggering parent click
                                                    setPreviewAvatar('');
                                                    setOriginalAvatar('');
                                                }}
                                            >
                                                <IconClose sx={{ fontSize: 14 }} />
                                            </IconButton>
                                        )}
                                    </Box>
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="subtitle2" gutterBottom fontWeight="bold">展示图设置</Typography>
                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                startIcon={aiGenerating ? null : <IconRobot />}
                                                onClick={handleAutoGeneratePortraits}
                                                sx={{ borderRadius: 2 }}
                                                color="secondary"
                                                disabled={aiGenerating}
                                            >
                                                {aiGenerating ? '生成中...' : 'AI 生成'}
                                            </Button>
                                        </Stack>
                                    </Box>
                                    {/* HIDDEN INPUTS */}
                                    <input type="file" hidden ref={avatarInputRef} accept="image/*" onChange={async (e) => {
                                        const file = e.target.files[0];
                                        if (file) {
                                            // Compress original efficiently (max 1280px)
                                            const original = await compressImage(file, 1280);
                                            // Don't set originalAvatar here - wait for crop confirmation
                                            setTempImage(original);
                                            setCropMode('avatar');
                                            setCropperVisible(true);
                                        }
                                    }} />
                                    <input type="file" hidden ref={displayImageInputRef} accept="image/*,video/*" onChange={async (e) => {
                                        const file = e.target.files[0];
                                        if (file) {
                                            if (file.type.startsWith('image/')) {
                                                // High res for display image
                                                const original = await compressImage(file, 1920);
                                                setOriginalDisplayImage(original);
                                                // Default to using the original directly without forcing crop
                                                setPreviewDisplayImage(original);
                                            } else {
                                                // [NEW] Add size check for video files (limit 10MB)
                                                const MAX_VIDEO_SIZE = 10 * 1024 * 1024; // 10MB
                                                if (file.size > MAX_VIDEO_SIZE) {
                                                    setSnackbar({
                                                        open: true,
                                                        message: '视频文件过大，请上传 10MB 以内的视频',
                                                        severity: 'warning'
                                                    });
                                                    // Clear the input value so the same file selection can trigger onChange again if needed (though unlikely here)
                                                    e.target.value = '';
                                                    return;
                                                }

                                                const reader = new FileReader();
                                                reader.onload = (ev) => setPreviewDisplayImage(ev.target.result);
                                                reader.readAsDataURL(file);
                                            }
                                        }
                                    }} />
                                </Stack>

                                <Divider />

                                <Box sx={{ display: 'grid', gap: 3 }}>
                                    <TextField label="姓名" fullWidth value={formValues.name || ''} onChange={(e) => handleInputChange('name', e.target.value)} required InputLabelProps={{ sx: { fontWeight: 'bold' } }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }} />

                                    <Stack direction="row" spacing={2}>
                                        <TextField label="角色定位" fullWidth value={formValues.role || ''} onChange={(e) => handleInputChange('role', e.target.value)} InputLabelProps={{ sx: { fontWeight: 'bold' } }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 }, flex: 2 }} />
                                        <TextField label="年龄" value={formValues.age || ''} onChange={(e) => handleInputChange('age', e.target.value)} InputLabelProps={{ sx: { fontWeight: 'bold' } }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 }, flex: 1 }} />
                                        <TextField label="性别" value={formValues.gender || ''} onChange={(e) => handleInputChange('gender', e.target.value)} InputLabelProps={{ sx: { fontWeight: 'bold' } }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 }, flex: 1 }} />
                                    </Stack>

                                    <TextField label="性格特征 (用逗号分隔)" fullWidth value={formValues.traits || ''} onChange={(e) => handleInputChange('traits', e.target.value)} InputLabelProps={{ sx: { fontWeight: 'bold' } }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }} />
                                    <TextField label="外貌描述" fullWidth multiline minRows={3} value={formValues.appearance || ''} onChange={(e) => handleInputChange('appearance', e.target.value)} InputLabelProps={{ sx: { fontWeight: 'bold' } }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }} />
                                    <TextField label="背景故事" fullWidth multiline minRows={5} value={formValues.bio || ''} onChange={(e) => handleInputChange('bio', e.target.value)} InputLabelProps={{ sx: { fontWeight: 'bold' } }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }} />
                                    <TextField label="角色目标" fullWidth multiline minRows={2} value={formValues.goal || ''} onChange={(e) => handleInputChange('goal', e.target.value)} InputLabelProps={{ sx: { fontWeight: 'bold' } }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }} />
                                </Box>
                            </Stack>
                        ) : (
                            <Stack spacing={4}>
                                <Box>
                                    <Typography variant="h3" fontWeight="bold" letterSpacing="-1px" gutterBottom>
                                        {character.name}
                                    </Typography>

                                    <Stack direction="row" spacing={1} alignItems="baseline" sx={{ color: 'text.secondary', mb: 1 }}>
                                        <Typography variant="h6" fontWeight="medium" color="primary.main">
                                            {character.role}
                                        </Typography>
                                        {(character.age || character.gender) && (
                                            <Typography variant="body1">
                                                · {character.age ? `${String(character.age).includes('岁') ? character.age : character.age + '岁'}` : ''} {character.gender ? `· ${character.gender}` : ''}
                                            </Typography>
                                        )}
                                    </Stack>

                                    {/* Traits Row */}
                                    {character.traits && (
                                        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 0.5 }}>
                                            {(typeof character.traits === 'string' ? character.traits.split(/[,，、]/) : []).filter(t => t.trim()).map((t, i) => (
                                                <Chip key={i} label={t.trim()} sx={{ bgcolor: 'action.hover', fontWeight: 'medium' }} />
                                            ))}
                                        </Stack>
                                    )}
                                </Box>

                                {/* Info Blocks */}
                                {character.appearance && (
                                    <Box>
                                        <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                                            外貌描述
                                        </Typography>
                                        <Typography variant="body1" lineHeight={1.8} sx={{ whiteSpace: 'pre-line' }}>
                                            {character.appearance}
                                        </Typography>
                                    </Box>
                                )}

                                {character.bio && (
                                    <Box>
                                        <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                                            背景故事
                                        </Typography>
                                        <Typography variant="body1" lineHeight={1.8} sx={{ whiteSpace: 'pre-line' }}>
                                            {character.bio}
                                        </Typography>
                                    </Box>
                                )}

                                {(character.goal || character.arc) && (
                                    <Box sx={{ p: 3, bgcolor: 'background.default', borderRadius: 4 }}>
                                        {character.goal && (
                                            <Box sx={{ mb: 2 }}>
                                                <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>角色目标</Typography>
                                                <Typography variant="body2">{character.goal}</Typography>
                                            </Box>
                                        )}
                                        {character.arc && (
                                            <Box>
                                                <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>角色弧光</Typography>
                                                <Typography variant="body2">{character.arc}</Typography>
                                            </Box>
                                        )}
                                    </Box>
                                )}
                            </Stack>
                        )}
                    </Box>
                </Box>
            </Box>

            {/* Import JSON Modal */}
            <Dialog open={showImportModal} onClose={() => setShowImportModal(false)} maxWidth="sm" fullWidth>
                <DialogTitle>导入角色数据</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
                        <Button
                            variant="outlined"
                            startIcon={<IconUpload />}
                            fullWidth
                            sx={{ py: 2, borderStyle: 'dashed', borderRadius: 2 }}
                            onClick={() => importInputRef.current?.click()}
                        >
                            点击上传 JSON 文件
                        </Button>
                        <Divider>或者直接粘贴 JSON</Divider>
                        <TextField
                            multiline
                            rows={6}
                            placeholder='{"name": "...", "role": "..."}'
                            fullWidth
                            value={importText}
                            onChange={(e) => setImportText(e.target.value)}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowImportModal(false)}>取消</Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            if (!importText.trim()) return;
                            try {
                                const data = JSON.parse(importText);
                                setFormValues(prev => ({ ...prev, ...data }));
                                setIsEditMode(true);
                                setShowImportModal(false);
                                setImportText(''); // Reset
                                alert('导入成功，请点击保存。');
                            } catch (e) {
                                alert('JSON 格式错误');
                            }
                        }}
                    >
                        确认导入
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Cropper Modal Injection */}
            {/* Cropper Modal Injection */}
            <ImageCropper
                visible={cropperVisible}
                imageSrc={tempImage}
                aspectRatio={cropMode === 'avatar' ? 1 : 0.666}
                outputWidth={cropMode === 'avatar' ? 200 : 400}
                maskShape={cropMode === 'avatar' ? 'circle' : 'rect'}
                title={cropMode === 'avatar' ? '裁切头像' : '裁切立绘'}
                onCancel={() => {
                    setCropperVisible(false);
                    setTempImage('');
                }}
                onConfirm={(croppedImage) => {
                    if (cropMode === 'avatar') {
                        // Save both original (tempImage) and cropped result
                        setOriginalAvatar(tempImage);
                        setPreviewAvatar(croppedImage);
                    } else {
                        setOriginalDisplayImage(tempImage);
                        setPreviewDisplayImage(croppedImage);
                    }
                    setCropperVisible(false);
                    setTempImage('');
                }}
            />

            {/* Snackbar for generation progress */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                    sx={{ borderRadius: 2 }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Dialog>
    );
};

export const Characters = ({ isSelectionMode, selectedIds: propSelectedIds, onSelect: propOnSelect, isVisible }) => {
    const { currentProject } = useProject();
    const theme = useTheme();
    const [characters, setCharacters] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [currentCharacter, setCurrentCharacter] = useState(null);
    const [notice, setNotice] = useState(''); // Snackbar message

    // Batch & Filter State
    const [isBatchMode, setIsBatchMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [searchTerm, setSearchTerm] = useState('');

    // Drag State
    const [draggedId, setDraggedId] = useState(null);

    // Import Modal State
    const [showImportModal, setShowImportModal] = useState(false);
    const [importText, setImportText] = useState('');
    const importFileRef = useRef(null);

    // --- Background Event Listener ---
    useEffect(() => {
        const handleGlobalGenStatus = async (e) => {
            const { characterId, status, imageUrl } = e.detail;
            if (status !== 'success' || !imageUrl) return;

            // Extract real ID (remove suffix)
            let realId = characterId;
            let fieldToUpdate = '';

            if (characterId.endsWith('_avatar')) {
                realId = characterId.replace('_avatar', '');
                fieldToUpdate = 'avatar';
            } else if (characterId.endsWith('_display')) {
                realId = characterId.replace('_display', '');
                fieldToUpdate = 'displayImage';
            } else {
                return; // Not our task
            }

            console.log('[Global Listener] Auto-saving generated image:', { realId, fieldToUpdate });

            try {
                // Get current character data directly from storage to avoid stale state
                const charData = await storage.getItemById('characters', realId);
                if (charData) {
                    const updates = { [fieldToUpdate]: imageUrl };

                    // Also update original fields if they are empty or same as old value
                    if (fieldToUpdate === 'avatar') {
                        updates.originalAvatar = imageUrl;
                    } else {
                        updates.originalDisplayImage = imageUrl;
                    }

                    await storage.updateItem('characters', { ...charData, ...updates });

                    // Trigger reload if needed
                    loadCharacters();
                    setNotice(fieldToUpdate === 'avatar' ? '头像已自动保存' : '立绘已自动保存');
                }
            } catch (err) {
                console.error('[Global Listener] Failed to auto-save:', err);
            }
        };

        window.addEventListener('narragen-image-gen-status', handleGlobalGenStatus);
        return () => window.removeEventListener('narragen-image-gen-status', handleGlobalGenStatus);
    }, []);

    useEffect(() => {
        if (currentProject && (isVisible === undefined || isVisible)) {
            loadCharacters();
        }
    }, [currentProject, isVisible]);

    // 监听跨组件角色更新事件（如从核心大纲生成角色后）
    useEffect(() => {
        const handleCharactersUpdated = (e) => {
            // 如果事件指定了 projectId，只有当前项目匹配时才刷新
            if (!currentProject) return;
            if (e.detail?.projectId && e.detail.projectId !== currentProject.id) return;
            loadCharacters();
        };

        window.addEventListener('characters-updated', handleCharactersUpdated);
        return () => {
            window.removeEventListener('characters-updated', handleCharactersUpdated);
        };
    }, [currentProject]);

    const loadCharacters = async () => {
        const chars = await storage.getItemsByProject('characters', currentProject.id);
        const sorted = chars.sort((a, b) => (a.order || 0) - (b.order || 0));
        setCharacters(sorted);
    };

    // --- CRUD Handlers ---

    const handleAddNew = () => {
        setCurrentCharacter({
            name: '',
            role: '',
            bio: '',
            traits: '',
            currentStatus: '',
            avatar: '',
            projectId: currentProject.id
        });
        setIsEditing(true);
    };

    const handleEdit = (character) => {
        setCurrentCharacter(character);
        setIsEditing(true);
    };

    const handleDelete = async (id) => {
        // 先获取角色数据以清理图像
        const char = characters.find(c => c.id === id);
        if (char) {
            if (char.avatar) await storage.deleteImageFile(char.avatar);
            if (char.displayImage) await storage.deleteImageFile(char.displayImage);
        }
        await storage.deleteItem('characters', id);
        setNotice('角色已删除');
        loadCharacters();
    };

    const handleBatchDelete = async () => {
        if (!window.confirm(`确定删除选中的 ${selectedIds.size} 个角色吗？`)) return;
        for (const id of selectedIds) {
            // 先清理图像文件
            const char = characters.find(c => c.id === id);
            if (char) {
                if (char.avatar) await storage.deleteImageFile(char.avatar);
                if (char.displayImage) await storage.deleteImageFile(char.displayImage);
            }
            await storage.deleteItem('characters', id);
        }
        setNotice(`已删除 ${selectedIds.size} 个角色`);
        setSelectedIds(new Set());
        loadCharacters();
    };

    // 清除所有角色的当前状态
    const handleClearCharacterStates = async () => {
        if (!window.confirm('确定要清除所有角色的当前状态吗？此操作会删除角色的状态历史记录，但不会删除角色本身。')) return;

        let clearedCount = 0;
        for (const char of characters) {
            if (char.currentState || char.stateHistory?.length > 0) {
                await storage.updateItem('characters', {
                    ...char,
                    currentState: null,
                    stateHistory: [],
                    chapterAppearances: [],
                    updatedAt: new Date().toISOString()
                });
                clearedCount++;
            }
        }

        setNotice(`已清除 ${clearedCount} 个角色的状态`);
        loadCharacters();
    };

    // --- Filter & Sort ---

    const filteredCharacters = characters.filter(char => {
        if (!searchTerm) return true;
        const lowerTerm = searchTerm.toLowerCase();
        return (
            char.name?.toLowerCase().includes(lowerTerm) ||
            char.role?.toLowerCase().includes(lowerTerm) ||
            char.traits?.toLowerCase().includes(lowerTerm) ||
            char.bio?.toLowerCase().includes(lowerTerm)
        );
    });

    const toggleSelection = (id) => {
        if (isSelectionMode && propOnSelect) {
            propOnSelect(id);
            return;
        }
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    // --- Import/Export ---
    const handleImport = async () => {
        // ... (Simplified Parser logic for brevity)
        try {
            const parsedData = JSON.parse(importText); // Simple JSON parse for now
            if (parsedData.name) {
                const { avatar, ...rest } = parsedData;
                await storage.addItem('characters', { ...rest, projectId: currentProject.id });
                setNotice('导入成功');
            }
            await loadCharacters();
            setShowImportModal(false);
        } catch (e) {
            setNotice('导入失败: JSON 格式错误');
        }
    };

    // --- Drag & Drop ---
    const handleDragStart = (e, id) => {
        setDraggedId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, id) => {
        e.preventDefault();
        if (draggedId === id) return;
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e, targetId) => {
        e.preventDefault();
        if (draggedId === targetId) return;
        const draggedIndex = characters.findIndex(c => c.id === draggedId);
        const targetIndex = characters.findIndex(c => c.id === targetId);
        const newCharacters = [...characters];
        const [draggedItem] = newCharacters.splice(draggedIndex, 1);
        newCharacters.splice(targetIndex, 0, draggedItem);
        setCharacters(newCharacters);
        for (let i = 0; i < newCharacters.length; i++) {
            await storage.updateItem('characters', { ...newCharacters[i], order: i });
        }
        setDraggedId(null);
    };

    // --- Layout State ---
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [activeSection, setActiveSection] = useState(0);
    const [showRefPanel, setShowRefPanel] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const getSectionTitle = () => '角色档案';

    // --- Sidebar Content ---
    const sidebarContent = (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                    <IconPeople sx={{ mr: 1.5, color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: 'inherit' }}>角色管理</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">管理人物档案与状态</Typography>
            </Box>
            <List sx={{ flexGrow: 1, p: 2 }}>
                {[
                    { icon: <IconPeople />, label: '角色档案', desc: `${characters.length} 个角色` },
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

    // --- Ref Panel Content ---
    const renderRefPanelContent = () => (
        <Stack spacing={3}>
            <Card variant="outlined" sx={{ p: 3, bgcolor: 'background.default', borderRadius: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>关于角色管理</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6, display: 'block' }}>
                    角色档案记录了小说中每个人物的基本信息、性格特征、背景故事等。AI 在生成章节时会参考这些信息。
                </Typography>
            </Card>
            <Card variant="outlined" sx={{ p: 3, bgcolor: 'background.default', borderRadius: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>角色状态</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6, display: 'block' }}>
                    每个角色卡片底部显示的是该角色在故事中的当前状态，这会随着章节生成自动更新。
                </Typography>
            </Card>
            <Card variant="outlined" sx={{ p: 3, bgcolor: 'background.default', borderRadius: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>最佳实践</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6, display: 'block' }}>
                    • 为主要角色填写详细的背景故事<br />
                    • 性格特征用逗号分隔，便于 AI 理解<br />
                    • 上传头像可以帮助可视化角色
                </Typography>
            </Card>
        </Stack>
    );

    // If in selection mode, render simplified view
    if (isSelectionMode) {
        return (
            <Box sx={{ p: 2 }}>
                <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                    gap: 2
                }}>
                    {filteredCharacters.map(char => (
                        <CharacterCard
                            key={char.id}
                            char={char}
                            isSelected={propSelectedIds?.has(char.id)}
                            onSelect={toggleSelection}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            isManualSort={false}
                            isSelectionMode={true}
                        />
                    ))}
                </Box>
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
                            <Link underline="hover" color="inherit" sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>角色管理</Link>
                            <Typography color="text.primary" fontWeight="bold">{getSectionTitle()}</Typography>
                        </Breadcrumbs>
                        <Chip label={`${characters.length} 个角色`} size="small" sx={{ ml: 1, height: 20, fontSize: '0.7rem' }} />
                    </Stack>

                    <Stack direction="row" spacing={1}>
                        <Tooltip title={showRefPanel ? "收起参考面板" : "显示参考面板"}>
                            <IconButton onClick={() => setShowRefPanel(!showRefPanel)} color={showRefPanel ? "primary" : "default"}>
                                <IconInfoCircle />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                </Box>

                {/* --- Main Scrollable Content --- */}
                <Box sx={{ flexGrow: 1, overflowY: 'auto', scrollbarGutter: 'stable', p: isMobile ? 3 : 6, pb: 20 }}>
                    <Box sx={{ maxWidth: 1200, width: '100%', mx: 'auto' }}>
                        {/* Toolbar: Search & Actions */}
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 6 }} justifyContent="space-between" alignItems="center">
                            <TextField
                                placeholder="搜索角色..."
                                size="small"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                InputProps={{
                                    startAdornment: <InputAdornment position="start"><IconSearch /></InputAdornment>,
                                }}
                                sx={{
                                    width: { xs: '100%', md: 360 },
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: 999,
                                        bgcolor: 'background.paper',
                                        pl: 2,
                                        boxShadow: theme.shadows[1],
                                        '& fieldset': { borderColor: 'transparent' },
                                        '&:hover fieldset': { borderColor: 'primary.main' },
                                        '&.Mui-focused fieldset': { borderColor: 'primary.main' }
                                    }
                                }}
                            />

                            <Stack direction="row" spacing={2}>
                                {isBatchMode ? (
                                    <>
                                        <Button variant="outlined" onClick={() => { setIsBatchMode(false); setSelectedIds(new Set()); }} sx={{ borderRadius: 999, bgcolor: 'background.paper' }}>退出</Button>
                                        <Button onClick={() => setSelectedIds(new Set(characters.map(c => c.id)))} sx={{ borderRadius: 999, bgcolor: 'background.paper' }}>全选</Button>
                                        <Button
                                            color="error"
                                            variant="contained"
                                            startIcon={<IconDelete />}
                                            disabled={selectedIds.size === 0}
                                            onClick={handleBatchDelete}
                                            sx={{ borderRadius: 999 }}
                                        >
                                            删除 ({selectedIds.size})
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button startIcon={<IconCheckSquare />} onClick={() => setIsBatchMode(true)} sx={{ borderRadius: 999, bgcolor: 'background.paper' }}>批量</Button>
                                        <Button startIcon={<IconSync />} color="warning" onClick={handleClearCharacterStates} sx={{ borderRadius: 999, bgcolor: 'background.paper' }}>清除状态</Button>
                                        <Button startIcon={<IconImport />} onClick={() => setShowImportModal(true)} sx={{ borderRadius: 999, bgcolor: 'background.paper' }}>导入</Button>
                                        <Button variant="contained" startIcon={<IconPlus />} onClick={handleAddNew} sx={{ borderRadius: 999, px: 3 }}>新建角色</Button>
                                    </>
                                )}
                            </Stack>
                        </Stack>

                        {/* Content Grid */}
                        <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                            gap: 3,
                            alignItems: 'stretch'
                        }}>
                            {filteredCharacters.map(char => (
                                <Box key={char.id} sx={{ minWidth: 0, height: '100%' }}>
                                    <CharacterCard
                                        char={char}
                                        isSelected={selectedIds.has(char.id)}
                                        onSelect={toggleSelection}
                                        onEdit={handleEdit}
                                        onDelete={handleDelete}
                                        isManualSort={isBatchMode}
                                        onDragStart={handleDragStart}
                                        onDragOver={handleDragOver}
                                        onDrop={handleDrop}
                                        isSelectionMode={false}
                                    />
                                </Box>
                            ))}
                        </Box>
                        {filteredCharacters.length === 0 && (
                            <Box textAlign="center" py={12} color="text.secondary" sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 4 }}>
                                {theme.palette.mode === 'dark' ? (
                                    <IconUser sx={{ fontSize: 64, opacity: 0.2, mb: 2 }} />
                                ) : (
                                    <Box component="img" src={EmptyStateCharacter} sx={{ width: 280, mb: 2, mixBlendMode: 'multiply' }} />
                                )}
                                <Typography>暂无角色，点击上方"新建角色"开始添加</Typography>
                            </Box>
                        )}
                    </Box>
                </Box>
            </Box>

            {/* --- Right Context Reference Panel --- */}
            <Collapse in={showRefPanel} orientation="horizontal" sx={{ height: '100%', flexShrink: 0 }}>
                <Box sx={{ width: 300, minWidth: 300, flexShrink: 0, height: '100%', borderLeft: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                            <Typography variant="subtitle2" fontWeight="bold">关于角色管理</Typography>
                            <Typography variant="caption" color="text.secondary">角色档案使用说明</Typography>
                        </Box>
                        <IconButton size="small" onClick={() => setShowRefPanel(false)}><IconChevronLeft /></IconButton>
                    </Box>
                    <Box sx={{ flexGrow: 1, overflowY: 'auto', scrollbarGutter: 'stable', p: 2 }}>
                        {renderRefPanelContent()}
                    </Box>
                </Box>
            </Collapse>


            {/* Snackbar */}
            <Snackbar
                open={!!notice}
                autoHideDuration={3000}
                onClose={() => setNotice('')}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert severity="success">{notice}</Alert>
            </Snackbar>

            {/* Modals */}
            <CharacterDetailModal
                visible={isEditing}
                character={currentCharacter}
                onClose={() => { setIsEditing(false); setCurrentCharacter(null); }}
                onSave={async (updatedChar) => {
                    if (updatedChar.id) {
                        await storage.updateItem('characters', updatedChar);
                        setNotice('更新成功');
                    } else {
                        await storage.addItem('characters', updatedChar);
                        setNotice('创建成功');
                    }
                    loadCharacters();
                }}
                onDelete={handleDelete}
            />

            <Dialog open={showImportModal} onClose={() => setShowImportModal(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
                <DialogTitle sx={{ fontWeight: 'bold' }}>导入角色</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
                        <Button
                            variant="outlined"
                            startIcon={<IconImport />}
                            fullWidth
                            sx={{ py: 2, borderStyle: 'dashed', borderRadius: 2 }}
                            onClick={() => importFileRef.current?.click()}
                        >
                            点击上传 JSON 文件
                        </Button>
                        <input
                            type="file"
                            ref={importFileRef}
                            accept=".json"
                            hidden
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                    setImportText(event.target.result);
                                };
                                reader.onerror = () => {
                                    setNotice('文件读取失败');
                                };
                                reader.readAsText(file);
                                e.target.value = '';
                            }}
                        />
                        <Divider>或者直接粘贴 JSON</Divider>
                        <TextField
                            multiline
                            rows={6}
                            fullWidth
                            placeholder='{"name": "...", "role": "...", ...}'
                            value={importText}
                            onChange={(e) => setImportText(e.target.value)}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowImportModal(false)} sx={{ borderRadius: 999 }}>取消</Button>
                    <Button onClick={handleImport} variant="contained" sx={{ borderRadius: 999 }}>确认导入</Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
};
