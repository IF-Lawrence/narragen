import React from 'react';
import { Paper, Box, Typography, LinearProgress, Button, Stack, IconButton } from '@mui/material';
import { Close as IconClose, AutoAwesome as IconAI } from '@mui/icons-material';
import { useChapterGeneration } from '../../contexts/ChapterGenerationContext';
import { alpha, useTheme } from '@mui/material/styles';

export const GlobalGenerationIndicator = () => {
    const theme = useTheme();
    const { globalGenerationStatus, interruptGeneration, clearGenerationStatus } = useChapterGeneration();

    if (!globalGenerationStatus) return null;

    const { volumeName, currentChapter, totalChapters, statusText } = globalGenerationStatus;
    const progress = totalChapters > 0 ? ((currentChapter - 1) / totalChapters) * 100 : 0;

    return (
        <Paper
            elevation={8}
            sx={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                width: 320,
                p: 2,
                borderRadius: 3,
                zIndex: 9999,
                bgcolor: alpha(theme.palette.background.paper, 0.95),
                backdropFilter: 'blur(8px)',
                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
            }}
        >
            <Stack spacing={1.5}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{
                        width: 32, height: 32, borderRadius: 1.5,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <IconAI sx={{ color: 'primary.main', fontSize: 18, animation: 'pulse 2s infinite ease-in-out' }} />
                    </Box>
                    <Box flex={1}>
                        <Typography variant="subtitle2" fontWeight="bold" noWrap>
                            章节细纲生成中
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                            {volumeName}
                        </Typography>
                    </Box>
                    <IconButton size="small" onClick={interruptGeneration} sx={{ color: 'text.secondary' }}>
                        <IconClose fontSize="small" />
                    </IconButton>
                </Stack>

                <Box>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                            {statusText || `第 ${currentChapter} / ${totalChapters} 章`}
                        </Typography>
                        <Typography variant="caption" color="primary.main" fontWeight="bold">
                            {Math.round(progress)}%
                        </Typography>
                    </Stack>
                    <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{ height: 6, borderRadius: 3 }}
                    />
                </Box>
            </Stack>
        </Paper>
    );
};
