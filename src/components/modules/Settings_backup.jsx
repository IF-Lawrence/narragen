import React, { useState, useEffect } from 'react';
import { storage } from '../../services/storage';
import { useProject } from '../../contexts/ProjectContext';
import { Card, Form, Input, Select, Button, List, Tag, Typography, Space, Divider, Popconfirm, Tooltip, Badge, Grid, Message as ArcoMessage } from '@arco-design/web-react';
import { IconEye, IconEyeInvisible, IconDelete, IconPlus, IconSave, IconEdit, IconRefresh, IconSettings } from '@arco-design/web-react/icon';
import { v4 as uuidv4 } from 'uuid';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { Row, Col } = Grid;
import { useBreakpoint } from '../../hooks/useBreakpoint';

export const Settings = () => {
    const { currentProject } = useProject();
    const [Message, messageHolder] = ArcoMessage.useMessage();

    // Data States
    const [presets, setPresets] = useState([]);
    const [featureConfig, setFeatureConfig] = useState({
        chapterGeneration: '',
        planner: '',
        writer: '',
        stylist: '',
        critic: '',
        archivist: ''
    });
    const [apiCallLogs, setApiCallLogs] = useState([]);

    // UI States
    const [isEditingPreset, setIsEditingPreset] = useState(false);
    const [editingPresetId, setEditingPresetId] = useState(null);
    const [form] = Form.useForm();
    const screens = useBreakpoint();

    const FEATURES = [
        { id: 'chapterGeneration', name: '文章生成（Writer）', desc: '用于正文章节的创作' },
        { id: 'planner', name: '主编（Planner）', desc: '用于生成核心大纲、分卷与场景计划' },
        // { id: 'writer', name: '作家（Writer）', desc: '用于根据细纲撰写初稿' }, // Redundant, replaced by chapterGeneration
        { id: 'stylist', name: '润色师（Stylist）', desc: '用于语言润色与风格统一' },
        { id: 'critic', name: '评论家（Critic）', desc: '用于多维度质量检查与反馈' },
        { id: 'archivist', name: '记忆官（Archivist）', desc: '用于上下文压缩、记忆归档与因果分析' }
    ];

    useEffect(() => {
        loadSettings();
        loadApiCallLogs();
    }, [currentProject]);

    const loadSettings = async () => {
        try {
            // Load Presets (Global)
            const presetsData = await storage.getSetting('apiPresets');
            let loadedPresets = presetsData ? JSON.parse(presetsData) : [];

            // Load Global Feature Config (as fallback or base)
            const globalFeatureConfigData = await storage.getSetting('featureConfig');
            let globalFeatureConfig = globalFeatureConfigData ? JSON.parse(globalFeatureConfigData) : {};

            // Load Project Feature Config
            let loadedFeatureConfig = {
                chapterGeneration: '',
                planner: '',
                writer: '',
                stylist: '',
                critic: '',
                archivist: ''
            };

            // Initialize with global config first (fallback)
            loadedFeatureConfig = { ...loadedFeatureConfig, ...globalFeatureConfig };

            if (currentProject) {
                const projectConfigData = await storage.getSetting(`featureConfig_${currentProject.id}`);
                if (projectConfigData) {
                    const projectConfig = JSON.parse(projectConfigData);
                    loadedFeatureConfig = { ...loadedFeatureConfig, ...projectConfig };
                }
            }

            // MIGRATION: If no presets but legacy config exists
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
                    await storage.saveSettings('apiPresets', JSON.stringify(loadedPresets));

                    // Assign default to all features for the current project (and global)
                    const newConfig = {};
                    Object.keys(loadedFeatureConfig).forEach(key => {
                        newConfig[key] = defaultPreset.id;
                    });

                    // Save global
                    await storage.saveSettings('featureConfig', JSON.stringify(newConfig));

                    // Save project specific if active
                    if (currentProject) {
                        await storage.saveSettings(`featureConfig_${currentProject.id}`, JSON.stringify(newConfig));
                    }

                    loadedFeatureConfig = newConfig;

                    Message.info('已自动迁移旧版配置');
                }
            }

            setPresets(loadedPresets);
            setFeatureConfig(loadedFeatureConfig);
        } catch (error) {
            console.error('Failed to load settings:', error);
            Message.error('加载设置失败');
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

    const handleSavePreset = async (values) => {
        const newPreset = {
            id: editingPresetId || uuidv4(),
            ...values,
            updatedAt: new Date().toISOString()
        };

        let updatedPresets;
        if (editingPresetId) {
            updatedPresets = presets.map(p => p.id === editingPresetId ? newPreset : p);
        } else {
            updatedPresets = [...presets, newPreset];
        }

        setPresets(updatedPresets);
        await storage.saveSettings('apiPresets', JSON.stringify(updatedPresets));

        // If this is the first preset, auto-assign to all features
        if (presets.length === 0) {
            const newConfig = { ...featureConfig };
            Object.keys(newConfig).forEach(key => newConfig[key] = newPreset.id);
            setFeatureConfig(newConfig);

            // Save to both global and project to ensure immediate usability
            await storage.saveSettings('featureConfig', JSON.stringify(newConfig));
            if (currentProject) {
                await storage.saveSettings(`featureConfig_${currentProject.id}`, JSON.stringify(newConfig));
            }
        }

        setIsEditingPreset(false);
        setEditingPresetId(null);
        form.resetFields();
        Message.success('预设已保存');
    };

    const handleEditPreset = (preset) => {
        form.setFieldsValue({
            name: preset.name,
            apiKey: preset.apiKey,
            baseUrl: preset.baseUrl,
            model: preset.model,
            note: preset.note || ''
        });
        setEditingPresetId(preset.id);
        setIsEditingPreset(true);
    };

    const handleDeletePreset = async (id) => {
        const updatedPresets = presets.filter(p => p.id !== id);
        setPresets(updatedPresets);
        await storage.saveSettings('apiPresets', JSON.stringify(updatedPresets));

        // Check if any feature was using this preset
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
            // Save update to project specific if active, AND global (to keep them in sync/clean)
            // Ideally we'd scan all projects but that's complex, for now updating current scope
            if (currentProject) {
                await storage.saveSettings(`featureConfig_${currentProject.id}`, JSON.stringify(updatedConfig));
            }
        }
        Message.success('预设已删除');
    };

    const handleFeatureConfigChange = async (featureId, presetId) => {
        const newConfig = { ...featureConfig, [featureId]: presetId };
        setFeatureConfig(newConfig);

        if (currentProject) {
            await storage.saveSettings(`featureConfig_${currentProject.id}`, JSON.stringify(newConfig));
            Message.success('项目配置已更新');
        } else {
            await storage.saveSettings('featureConfig', JSON.stringify(newConfig));
            Message.warning('无活跃项目，更新了全局默认配置');
        }
    };

    const clearApiCallLogs = () => {
        localStorage.removeItem('apiCallLogs');
        setApiCallLogs([]);
        Message.success('调用记录已清空');
    };

    return (
        <div style={{ padding: screens.xs ? 12 : 24, maxWidth: 800, margin: '0 auto' }}>
            {messageHolder}
            <Title heading={2}>设置</Title>

            {/* Feature Configuration Section */}
            <Card title="功能配置" style={{ marginBottom: 24 }} bodyStyle={{ padding: screens.xs ? '12px' : '24px' }}>
                <Paragraph type="secondary">为不同功能选择使用的 API 预设</Paragraph>
                <List
                    grid={{ gutter: 16, column: 1 }}
                    dataSource={FEATURES}
                    render={(feature, index) => (
                        <List.Item key={feature.id}>
                            <Card size="small">
                                <Row align="middle" justify="space-between" gutter={[0, 16]}>
                                    <Col xs={24} sm={12}>
                                        <Text bold>{feature.name}</Text>
                                        <br />
                                        <Text type="secondary" style={{ fontSize: 12 }}>{feature.desc}</Text>
                                    </Col>
                                    <Col xs={24} sm={12} style={{ textAlign: screens.xs ? 'left' : 'right' }}>
                                        <Select
                                            style={{ width: '100%' }}
                                            value={featureConfig[feature.id] || ''}
                                            onChange={(value) => handleFeatureConfigChange(feature.id, value)}
                                            placeholder="请选择预设"
                                        >
                                            {presets.map(p => (
                                                <Option key={p.id} value={p.id}>{p.name} ({p.model})</Option>
                                            ))}
                                        </Select>
                                    </Col>
                                </Row>
                            </Card>
                        </List.Item>
                    )}
                />
            </Card>

            {/* Presets Management Section */}
            <Card
                title="API 预设管理"
                extra={
                    <Button
                        type="primary"
                        icon={<IconPlus />}
                        onClick={() => {
                            setIsEditingPreset(true);
                            setEditingPresetId(null);
                            form.resetFields();
                            form.setFieldsValue({ baseUrl: 'https://api.openai.com/v1', model: 'gpt-4-turbo' });
                        }}
                        size={screens.xs ? 'small' : 'default'}
                    >
                        新建预设
                    </Button>
                }
                style={{ marginBottom: 24 }}
                bodyStyle={{ padding: screens.xs ? '0' : '24px' }}
            >
                {isEditingPreset && (
                    <Card title={editingPresetId ? '编辑预设' : '新建预设'} style={{ marginBottom: 24, background: 'var(--color-fill-2)', margin: screens.xs ? 12 : 24 }}>
                        <Form form={form} onSubmit={handleSavePreset} layout="vertical">
                            <Form.Item field="name" label="预设名称" rules={[{ required: true, message: '请输入预设名称' }]}>
                                <Input placeholder="例如：GPT-4 Turbo (主力)" />
                            </Form.Item>
                            <Form.Item field="apiKey" label="API Key" rules={[{ required: true, message: '请输入 API Key' }]}>
                                <Input.Password placeholder="sk-..." />
                            </Form.Item>
                            <Form.Item field="baseUrl" label="Base URL">
                                <Input placeholder="https://api.openai.com/v1" />
                            </Form.Item>
                            <Form.Item field="model" label="模型名称">
                                <Input placeholder="gpt-4-turbo" />
                            </Form.Item>
                            <Form.Item field="note" label="备注">
                                <Input placeholder="可选备注" />
                            </Form.Item>
                            <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
                                <Space>
                                    <Button onClick={() => setIsEditingPreset(false)}>取消</Button>
                                    <Button type="primary" htmlType="submit" icon={<IconSave />}>保存</Button>
                                </Space>
                            </Form.Item>
                        </Form>
                    </Card>
                )}

                <List
                    dataSource={presets}
                    noDataElement={<div>暂无预设配置</div>}
                    render={(preset, index) => (
                        <List.Item
                            key={preset.id}
                            style={{ padding: screens.xs ? '12px' : '16px' }}
                            actions={[
                                <Tooltip content="编辑">
                                    <Button type="text" icon={<IconEdit />} onClick={() => handleEditPreset(preset)} />
                                </Tooltip>,
                                <Popconfirm title="确定要删除此预设吗？" onOk={() => handleDeletePreset(preset.id)} okText="确定" cancelText="取消">
                                    <Button type="text" status="danger" icon={<IconDelete />} />
                                </Popconfirm>
                            ]}
                        >
                            <List.Item.Meta
                                title={<Space wrap={true}><Text bold>{preset.name}</Text><Tag>{preset.model}</Tag></Space>}
                                description={
                                    <Space direction="vertical" size={0}>
                                        {preset.note && <Text type="secondary">{preset.note}</Text>}
                                        <Text type="secondary" style={{ fontSize: 12 }}>更新于: {new Date(preset.updatedAt).toLocaleDateString()}</Text>
                                    </Space>
                                }
                            />
                        </List.Item>
                    )}
                />
            </Card>

            {/* API Call Logs */}
            <Card
                title="API 调用记录"
                extra={
                    <Space>
                        <Button icon={<IconRefresh />} onClick={loadApiCallLogs} size={screens.xs ? 'small' : 'default'}>刷新</Button>
                        <Popconfirm title="确定要清空记录吗？" onOk={clearApiCallLogs} okText="确定" cancelText="取消">
                            <Button status="danger" icon={<IconDelete />} size={screens.xs ? 'small' : 'default'}>清空</Button>
                        </Popconfirm>
                    </Space>
                }
                bodyStyle={{ padding: screens.xs ? '0' : '24px' }}
            >
                <div style={{ padding: screens.xs ? '12px' : '0 0 16px 0' }}>
                    <Paragraph type="secondary" style={{ marginBottom: 0, paddingLeft: screens.xs ? 0 : 24 }}>最近 50 次 API 调用历史</Paragraph>
                </div>
                <List
                    dataSource={apiCallLogs}
                    noDataElement={<div>暂无调用记录</div>}
                    pagination={{ pageSize: 5 }}
                    render={(log, index) => (
                        <List.Item key={index} style={{ padding: screens.xs ? '12px' : '16px' }}>
                            <List.Item.Meta
                                title={
                                    <Space wrap={true}>
                                        <Badge status={log.success ? 'success' : 'error'} text={log.success ? '成功' : '失败'} />
                                        <Text bold>{log.feature || 'Unknown'}</Text>
                                        <Tag color="blue">{log.model}</Tag>
                                    </Space>
                                }
                                description={
                                    <div style={{ marginTop: 4 }}>
                                        <Space split={<Divider type="vertical" />} wrap={true}>
                                            <Text type="secondary">{new Date(log.timestamp).toLocaleString('zh-CN')}</Text>
                                            <Text>{log.tokens} tokens</Text>
                                        </Space>
                                        {!log.success && log.error && (
                                            <div style={{ marginTop: 4, color: 'var(--color-danger-light-4)', background: 'var(--color-danger-light-1)', padding: '4px 8px', borderRadius: 4, fontSize: 12 }}>
                                                Error: {log.error}
                                            </div>
                                        )}
                                    </div>
                                }
                            />
                        </List.Item>
                    )}
                />
            </Card>
        </div>
    );
};
