import React, { useState, useEffect, useRef } from 'react';
import { Paper, Typography, IconButton, Stack, Box, List, ListItem, CircularProgress, Button } from '@mui/material';
import {
    DragIndicatorRounded as IconDragDotVertical,
    RemoveRounded as IconMinus,
    CloseRounded as IconClose,
    SmartToyRounded as IconRobot,
    CheckCircleRounded as IconCheckCircle,
    ErrorRounded as IconCloseCircle,
    WarningRounded as IconExclamationCircle
} from '@mui/icons-material';

const AgentStatusCard = ({
    activities = [],
    visible = true,
    onClose
}) => {
    const [isMinimized, setIsMinimized] = useState(false);
    const [position, setPosition] = useState({ x: window.innerWidth - 320 - 40, y: 100 });
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const cardRef = useRef(null);

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

    if (!visible) return null;

    const getStatusIcon = (status) => {
        switch (status) {
            case 'success': return <IconCheckCircle sx={{ color: 'success.main', fontSize: 16 }} />;
            case 'error': return <IconCloseCircle sx={{ color: 'error.main', fontSize: 16 }} />;
            case 'warning': return <IconExclamationCircle sx={{ color: 'warning.main', fontSize: 16 }} />;
            case 'processing': return <CircularProgress size={12} />;
            default: return <IconRobot sx={{ fontSize: 16 }} />;
        }
    };

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
                maxHeight: isMinimized ? 'auto' : '400px',
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
                    userSelect: 'none',
                    flexShrink: 0
                }}
            >
                <Stack direction="row" spacing={1} alignItems="center">
                    <IconDragDotVertical sx={{ color: 'text.secondary', fontSize: 16 }} />
                    <Typography variant="subtitle2" fontWeight="bold">
                        Agent 状态 ({activities.length})
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
                <Box sx={{ p: 0, overflow: 'auto', flex: 1 }}>
                    {activities.length === 0 ? (
                        <Box sx={{ p: 3, textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary">暂无 Agent 活动</Typography>
                        </Box>
                    ) : (
                        <List disablePadding>
                            {activities.slice().reverse().map((item) => (
                                <ListItem
                                    key={item.id}
                                    sx={{
                                        p: 1.5,
                                        borderBottom: 1,
                                        borderColor: 'divider',
                                        alignItems: 'flex-start',
                                        gap: 1.5
                                    }}
                                >
                                    <Box sx={{ mt: 0.5 }}>{getStatusIcon(item.status)}</Box>
                                    <Box sx={{ flex: 1 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                            <Typography variant="subtitle2" fontSize={12} fontWeight="bold">{item.agent}</Typography>
                                            <Typography variant="caption" color="text.secondary" fontSize={10}>{item.time}</Typography>
                                        </Box>
                                        <Typography variant="body2" fontSize={12} color="text.primary">
                                            {item.action}
                                        </Typography>
                                        {item.details && (
                                            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                                                {item.details}
                                            </Typography>
                                        )}
                                    </Box>
                                </ListItem>
                            ))}
                        </List>
                    )}
                </Box>
            )}
        </Paper>
    );

    function handleMouseDown(e) {
        if (e.target.closest('.no-drag')) return;
        setIsDragging(true);
        const rect = cardRef.current.getBoundingClientRect();
        dragOffset.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
};

export default AgentStatusCard;
