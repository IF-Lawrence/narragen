import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Typography, Checkbox, FormControlLabel,
    TextField, Stack, Box
} from '@mui/material';

const QuickSettingsModal = ({ visible, onCancel, onOk, initialSettings = {} }) => {
    // Local state for form values
    const [settings, setSettings] = useState({
        targetLength: 4000,
        passionLevel: 3,
        useExistingOutline: true,
        regenerateScenes: false
    });

    useEffect(() => {
        if (visible) {
            setSettings({
                targetLength: initialSettings?.targetLength || 4000,
                passionLevel: initialSettings?.passionLevel || 3,
                useExistingOutline: initialSettings?.useExistingOutline !== false,
                regenerateScenes: initialSettings?.regenerateScenes || false
            });
        }
    }, [visible]);

    const handleChange = (field, value) => {
        setSettings(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleOk = () => {
        onOk(settings);
    };

    return (
        <Dialog
            open={!!visible}
            onClose={onCancel}
            maxWidth="xs"
            fullWidth
            PaperProps={{
                sx: { borderRadius: 4, p: 2 }
            }}
        >
            <DialogTitle sx={{ textAlign: 'center', fontWeight: 'bold' }}>AI 生成设置</DialogTitle>
            <DialogContent>
                <Stack spacing={3} sx={{ mt: 1 }}>
                    <TextField
                        label="目标字数"
                        type="number"
                        value={settings.targetLength}
                        onChange={(e) => handleChange('targetLength', Math.max(300, Math.min(15000, parseInt(e.target.value) || 3000)))}
                        fullWidth
                        size="small"
                        inputProps={{ min: 300, max: 15000, step: 500 }}
                        helperText="建议 3000-5000 字以保持最佳质量（范围：300-15000）"
                    />

                    <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={settings.useExistingOutline}
                                    onChange={(e) => handleChange('useExistingOutline', e.target.checked)}
                                />
                            }
                            label="优先使用现有场景大纲"
                            sx={{ mr: 0 }}
                        />
                        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5, ml: 3.5 }}>
                            如果勾选，AI 将严格遵循"章节情报"中的场景大纲进行写作。
                        </Typography>
                    </Box>
                </Stack>
            </DialogContent>
            <DialogActions sx={{ justifyContent: 'center', px: 3, pb: 2 }}>
                <Button onClick={onCancel} color="inherit" sx={{ borderRadius: 999 }}>取消</Button>
                <Button onClick={handleOk} variant="contained" color="primary" sx={{ borderRadius: 999 }}>开始生成</Button>
            </DialogActions>
        </Dialog>
    );
};

export default QuickSettingsModal;
