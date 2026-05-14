import React, { useState, useEffect, useRef } from 'react';
import { Paper, Typography, IconButton, Stack, Chip, Button, Box } from '@mui/material';
import {
    DragIndicatorRounded as IconDragDotVertical,
    RemoveRounded as IconMinus,
    CloseRounded as IconClose,
    ChevronLeftRounded as IconLeft,
    ChevronRightRounded as IconRight,
    LocationOnRounded as IconLocation,
    PersonRounded as IconUser,
    BoltRounded as IconThunderbolt
} from '@mui/icons-material';

const SceneHintCard = ({
    scenes = [],
    currentIndex = 0,
    onSceneChange,
    onClose,
    visible = true
}) => {
    const [isMinimized, setIsMinimized] = useState(false);
    const [position, setPosition] = useState({ x: window.innerWidth - 320 - 40, y: 100 });
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const cardRef = useRef(null);

    const currentScene = scenes[currentIndex] || {};

    const handleMouseDown = (e) => {
        if (e.target.closest('.no-drag')) return;
        setIsDragging(true);
        const rect = cardRef.current.getBoundingClientRect();
        dragOffset.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDragging) {
                const newX = e.clientX - dragOffset.current.x;
                const newY = e.clientY - dragOffset.current.y;

                // Boundary checks
                const maxX = window.innerWidth - (cardRef.current?.offsetWidth || 300);
                const maxY = window.innerHeight - (cardRef.current?.offsetHeight || 200);

                setPosition({
                    x: Math.max(0, Math.min(newX, maxX)),
                    y: Math.max(0, Math.min(newY, maxY))
                });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    if (!visible || scenes.length === 0) return null;

    return (
        <Paper
            ref={cardRef}
            elevation={4}
            sx={{
                position: 'fixed',
                left: position.x,
                top: position.y,
                width: 300,
                zIndex: 1000,
                borderRadius: 2,
                transition: isDragging ? 'none' : 'height 0.2s',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}
        >
            {/* Header - Draggable Area */}
            <Box
                onMouseDown={handleMouseDown}
                sx={{
                    p: 1,
                    px: 1.5,
                    bgcolor: 'action.hover',
                    borderBottom: isMinimized ? 'none' : 1,
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'move',
                    userSelect: 'none'
                }}
            >
                <Stack direction="row" spacing={1} alignItems="center">
                    <IconDragDotVertical sx={{ color: 'text.secondary', fontSize: 16 }} />
                    <Typography variant="subtitle2" fontWeight="bold">
                        场景 {currentIndex + 1} / {scenes.length}
                    </Typography>
                </Stack>
                <Stack direction="row" spacing={0} className="no-drag">
                    <IconButton
                        size="small"
                        onClick={() => setIsMinimized(!isMinimized)}
                    >
                        <IconMinus fontSize="small" />
                    </IconButton>
                    <IconButton
                        size="small"
                        onClick={onClose}
                    >
                        <IconClose fontSize="small" />
                    </IconButton>
                </Stack>
            </Box>

            {/* Content Body */}
            {!isMinimized && (
                <Box sx={{ p: 2 }}>
                    {/* Location */}
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <IconLocation sx={{ color: 'primary.main', fontSize: 16 }} />
                        <Typography variant="body2" fontWeight="bold">
                            {currentScene.location || '未知地点'}
                        </Typography>
                    </Stack>

                    {/* Action */}
                    <Box sx={{ mb: 1.5, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                        <Typography variant="body2" color="text.secondary" fontSize={13}>
                            {currentScene.action || '无场景描述'}
                        </Typography>
                    </Box>

                    {/* Characters */}
                    {currentScene.characters && currentScene.characters.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {currentScene.characters.map((char, idx) => (
                                    <Chip
                                        key={idx}
                                        label={char}
                                        size="small"
                                        color="primary"
                                        variant="outlined"
                                        icon={<IconUser sx={{ fontSize: '12px !important' }} />}
                                    />
                                ))}
                            </Box>
                        </Box>
                    )}

                    {/* Navigation */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                        <Button
                            size="small"
                            startIcon={<IconLeft />}
                            disabled={currentIndex === 0}
                            onClick={() => onSceneChange(currentIndex - 1)}
                        >
                            上一场景
                        </Button>
                        <Button
                            size="small"
                            endIcon={<IconRight />}
                            onClick={() => onSceneChange(currentIndex + 1)}
                            disabled={currentIndex === scenes.length - 1}
                        >
                            下一场景
                        </Button>
                    </Box>
                </Box>
            )}
        </Paper>
    );
};

export default SceneHintCard;
