import { storage } from './storage';

export const openai = {
    async isDemoMode() {
        try {
            const demo = await storage.getSetting('demoMode');
            return demo === 'true' || demo === true;
        } catch { return false; }
    },
    async getFeatureConfig(feature, projectId = null) {
        try {
            // 1. Try to get project-specific feature config
            let featureConfig = {};
            if (projectId) {
                const projectConfigData = await storage.getSetting(`featureConfig_${projectId}`);
                if (projectConfigData && typeof projectConfigData === 'object') {
                    featureConfig = projectConfigData;
                }
            }

            // 2. Fallback to global feature config if not found in project (or project not specified)
            // This ensures backwards compatibility and default behavior for new projects
            if (!featureConfig[feature]) {
                const globalConfigData = await storage.getSetting('featureConfig');
                if (globalConfigData && typeof globalConfigData === 'object') {
                    if (!featureConfig[feature]) {
                        featureConfig[feature] = globalConfigData[feature];
                    }
                }
            }

            const presetId = featureConfig[feature];

            // 3. Get all presets (Presets are still global)
            const presetsData = await storage.getSetting('apiPresets');
            const presets = Array.isArray(presetsData) ? presetsData : [];

            // 4. Find the preset
            let config = presets.find(p => p.id === presetId);

            // 5. Fallback: Use the first preset if specific one not found
            if (!config && presets.length > 0) {
                config = presets[0];
            }

            // 6. Legacy Fallback (if migration hasn't happened yet or failed)
            if (!config) {
                const apiKey = await storage.getSetting('apiKey');
                if (apiKey) {
                    return {
                        apiKey,
                        baseUrl: await storage.getSetting('baseUrl') || 'https://api.openai.com/v1',
                        model: await storage.getSetting('model') || 'gpt-4-turbo'
                    };
                }
                throw new Error('API Configuration not found. Please configure settings.');
            }

            return config;
        } catch (error) {
            console.error('Error resolving API config:', error);
            throw error;
        }
    },

    async generateText(prompt, systemPrompt = '', options = {}) {
        const { feature = 'Unknown', projectId } = options;
        const config = await this.getFeatureConfig(feature, projectId);

        if (await this.isDemoMode()) {
            const demoText = `${systemPrompt ? '' : ''}${prompt.slice(0, 200)}\n\n[Demo 输出] 段落一……\n\n段落二……\n\n段落三……`;
            this.logApiCall({ model: 'demo', endpoint: 'demo://chat', tokens: demoText.length, duration: 10, success: true, feature });
            return demoText;
        }

        if (!config.apiKey) throw new Error('API Key not configured');

        const startTime = Date.now();
        try {
            const cleanBaseUrl = config.baseUrl.endsWith('/') ? config.baseUrl.slice(0, -1) : config.baseUrl;
            const apiUrl = `${cleanBaseUrl}/chat/completions`;

            const body = {
                model: config.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                temperature: options.temperature ?? 0.7
            };

            // Only add max_tokens if explicitly specified
            if (options.max_tokens) {
                body.max_tokens = options.max_tokens;
            }

            if (options.response_format) {
                body.response_format = options.response_format;
            }
            if (options.stop) {
                body.stop = options.stop;
            }

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify(body),
                signal: options.signal
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || 'API request failed');
            }

            const result = data.choices[0].message.content;
            const finishReason = data.choices[0].finish_reason;

            // Check for truncation
            if (finishReason === 'length') {
                console.warn(`[API] Output truncated! finish_reason: length. Model: ${config.model}, Feature: ${feature}`);
            }

            // Log success
            this.logApiCall({
                model: config.model,
                endpoint: apiUrl,
                tokens: data.usage?.total_tokens || 0,
                promptTokens: data.usage?.prompt_tokens || 0,
                completionTokens: data.usage?.completion_tokens || 0,
                cachedTokens: data.usage?.prompt_tokens_details?.cached_tokens || 0,
                duration: Date.now() - startTime,
                success: true,
                feature: feature,
                finishReason: finishReason,
                truncated: finishReason === 'length'
            });

            return result;
        } catch (error) {
            // Log failure
            this.logApiCall({
                model: config.model,
                endpoint: `${config.baseUrl.endsWith('/') ? config.baseUrl.slice(0, -1) : config.baseUrl}/chat/completions`,
                tokens: 0,
                duration: Date.now() - startTime,
                success: false,
                error: error.message,
                feature: feature
            });
            throw error;
        }
    },

    /**
     * 生成文本并返回元数据（包括 finish_reason）
     * 用于需要检测截断的场景（如自动续写）
     * @returns {{ content: string, finishReason: string, truncated: boolean }}
     */
    async generateTextWithMeta(prompt, systemPrompt = '', options = {}) {
        const { feature = 'Unknown', projectId } = options;
        const config = await this.getFeatureConfig(feature, projectId);

        if (await this.isDemoMode()) {
            const demoText = `[Demo 输出] 测试内容...`;
            return { content: demoText, finishReason: 'stop', truncated: false };
        }

        if (!config.apiKey) throw new Error('API Key not configured');

        const startTime = Date.now();
        try {
            const cleanBaseUrl = config.baseUrl.endsWith('/') ? config.baseUrl.slice(0, -1) : config.baseUrl;
            const apiUrl = `${cleanBaseUrl}/chat/completions`;

            const body = {
                model: config.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                temperature: options.temperature ?? 0.7
            };

            if (options.max_tokens) {
                body.max_tokens = options.max_tokens;
            }
            if (options.response_format) {
                body.response_format = options.response_format;
            }

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify(body),
                signal: options.signal
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || 'API request failed');
            }

            const content = data.choices[0].message.content;
            const finishReason = data.choices[0].finish_reason;
            const truncated = finishReason === 'length';

            if (truncated) {
                console.warn(`[API] Output truncated! finish_reason: length. Model: ${config.model}, Feature: ${feature}`);
            }

            // Log success
            this.logApiCall({
                model: config.model,
                endpoint: apiUrl,
                tokens: data.usage?.total_tokens || 0,
                promptTokens: data.usage?.prompt_tokens || 0,
                completionTokens: data.usage?.completion_tokens || 0,
                cachedTokens: data.usage?.prompt_tokens_details?.cached_tokens || 0,
                duration: Date.now() - startTime,
                success: true,
                feature: feature,
                finishReason: finishReason,
                truncated: truncated
            });

            return { content, finishReason, truncated };
        } catch (error) {
            this.logApiCall({
                model: config.model,
                endpoint: `${config.baseUrl.endsWith('/') ? config.baseUrl.slice(0, -1) : config.baseUrl}/chat/completions`,
                tokens: 0,
                duration: Date.now() - startTime,
                success: false,
                error: error.message,
                feature: feature
            });
            throw error;
        }
    },

    async *generateTextStream(prompt, systemPrompt = '', onChunk, options = {}) {
        const { feature = 'Unknown', projectId } = options;
        const config = await this.getFeatureConfig(feature, projectId);

        if (await this.isDemoMode()) {
            const sample = `【流式Demo】\n${prompt.slice(0, 120)}\n\n正文开始：\n` +
                '第一段内容……' +
                '\n\n第二段内容……' +
                '\n\n第三段内容……';
            let idx = 0;
            while (idx < sample.length) {
                const chunk = sample.slice(idx, idx + 80);
                idx += 80;
                yield chunk;
                if (onChunk) onChunk(chunk);
                await new Promise(r => setTimeout(r, 30));
            }
            return;
        }

        if (!config.apiKey) {
            throw new Error('API Key not configured');
        }

        const startTime = Date.now();
        let totalTokens = 0;
        let success = false;
        let finishReason = null;

        const cleanBaseUrl = config.baseUrl.endsWith('/') ? config.baseUrl.slice(0, -1) : config.baseUrl;
        const apiUrl = `${cleanBaseUrl}/chat/completions`;

        try {
            // Use provided signal if available, otherwise create internal timeout controller
            let timeoutId = null;
            let internalController = null;
            let signalToUse = options.signal;

            // If no external signal provided, create an internal one with timeout
            if (!signalToUse) {
                internalController = new AbortController();
                signalToUse = internalController.signal;
                timeoutId = setTimeout(() => internalController.abort(), 60000); // 60s timeout
            }

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`,
                },
                body: JSON.stringify({
                    model: config.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt }
                    ],
                    temperature: options.temperature || 0.7,
                    stream: true,
                    // Only add max_tokens if explicitly specified
                    ...(options.max_tokens ? { max_tokens: options.max_tokens } : {})
                }),
                signal: signalToUse
            });

            // Clear timeout only if we created one
            if (timeoutId) clearTimeout(timeoutId);

            if (!response.ok) {
                const error = await response.json();
                this.logApiCall({
                    model: config.model,
                    endpoint: apiUrl,
                    tokens: 0,
                    duration: Date.now() - startTime,
                    success: false,
                    error: error.error?.message || 'API Request Failed',
                    feature: feature
                });
                throw new Error(error.error?.message || 'API Request Failed');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

                        if (trimmedLine.startsWith('data: ')) {
                            try {
                                const jsonStr = trimmedLine.slice(6);
                                const data = JSON.parse(jsonStr);
                                const content = data.choices?.[0]?.delta?.content;
                                const finishReasonData = data.choices?.[0]?.finish_reason;

                                if (finishReasonData) {
                                    finishReason = finishReasonData;
                                    console.log('Stream finished. Reason:', finishReason);
                                    if (finishReason === 'length') {
                                        console.warn(`[API Stream] Output truncated! finish_reason: length. Model: ${config.model}, Feature: ${feature}`);
                                    }
                                    success = true;
                                }

                                if (content) {
                                    yield content;
                                    if (onChunk) onChunk(content);
                                }
                            } catch (e) {
                                console.error('Failed to parse SSE data:', e);
                            }
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }
            // Log success for stream after it completes
            this.logApiCall({
                model: config.model,
                endpoint: apiUrl,
                tokens: totalTokens, // Will be 0 unless we find a way to count stream tokens
                duration: Date.now() - startTime,
                success: success,
                feature: feature,
                finishReason: finishReason,
                truncated: finishReason === 'length'
            });

            // Call onFinish callback with finishReason if provided
            if (options.onFinish) {
                options.onFinish({
                    finishReason: finishReason,
                    truncated: finishReason === 'length'
                });
            }
        } catch (error) {
            this.logApiCall({
                model: config.model,
                endpoint: apiUrl,
                tokens: 0,
                duration: Date.now() - startTime,
                success: false,
                error: error.message,
                feature: feature
            });
            throw error;
        }
    },

    logApiCall(logEntry) {
        try {
            const logs = JSON.parse(localStorage.getItem('apiCallLogs') || '[]');
            const newLog = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                ...logEntry
            };

            // Add to beginning
            logs.unshift(newLog);

            // Keep only last 50 calls
            if (logs.length > 50) {
                logs.splice(50);
            }
            localStorage.setItem('apiCallLogs', JSON.stringify(logs));
        } catch (e) {
            console.error('Failed to log API call:', e);
        }
    },

    async validateConnection() {
        try {
            await this.generateText('test', '', { feature: 'Connection Test' });
            return true;
        } catch (e) {
            console.error('Connection validation failed:', e);
            return false;
        }
    }
};
