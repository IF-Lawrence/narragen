import { theme } from 'antd';

const themeConfig = {
    algorithm: theme.darkAlgorithm,
    token: {
        colorPrimary: '#8b5cf6', // Violet-500
        colorBgBase: '#0f172a', // Slate-950
        colorBgContainer: '#1e293b', // Slate-800
        borderRadius: 8,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    },
    components: {
        Button: {
            controlHeight: 40,
            borderRadius: 8,
        },
        Card: {
            borderRadiusLG: 12,
        },
        Modal: {
            borderRadiusLG: 12,
        },
    },
};

export default themeConfig;
