import { useState, useEffect } from 'react';
import { Layout as ArcoLayout, Menu, Button, Drawer, Space } from '@arco-design/web-react';
import { IconEdit, IconSettings, IconUser, IconFile, IconSafe, IconLeft, IconMenu, IconSun, IconMoon, IconThunderbolt, IconBug, IconCode, IconBook } from '@arco-design/web-react/icon';
import { useProject } from '../../contexts/ProjectContext';

const { Sider, Content, Header } = ArcoLayout;
const MenuItem = Menu.Item;

export const Layout = ({ children, activeTab, onTabChange }) => {
    const { clearCurrentProject } = useProject();
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 767px)');
        const handleMediaQueryChange = (event) => {
            setIsMobile(event.matches);
        };

        setIsMobile(mediaQuery.matches); // Initial check

        mediaQuery.addEventListener('change', handleMediaQueryChange);

        // Check localStorage for theme
        const savedTheme = localStorage.getItem('arco-theme');
        if (savedTheme === 'dark') {
            document.body.setAttribute('arco-theme', 'dark');
        } else {
            document.body.removeAttribute('arco-theme');
        }
        // Force re-render to update icon
        setDrawerVisible(prev => prev);

        return () => {
            mediaQuery.removeEventListener('change', handleMediaQueryChange);
        };
    }, []);

    // Let's use a state for theme to ensure re-render
    const [theme, setTheme] = useState(localStorage.getItem('arco-theme') || 'light');

    useEffect(() => {
        if (theme === 'dark') {
            document.body.setAttribute('arco-theme', 'dark');
        } else {
            document.body.removeAttribute('arco-theme');
        }
    }, [theme]);

    const handleThemeToggle = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('arco-theme', newTheme);
    };

    const handleMenuClick = (key) => {
        onTabChange(key);
        setDrawerVisible(false);
    };

    const renderMenu = (mode = 'vertical') => (
        <Menu
            mode={mode}
            selectedKeys={[activeTab]}
            onClickMenuItem={handleMenuClick}
            style={{ width: '100%', border: 'none' }}
            collapse={mode === 'vertical' && !isMobile}
        >

            <MenuItem key="characters">
                <IconUser />
                {(!isMobile || mode === 'pop') && '角色'}
            </MenuItem>
            <MenuItem key="constraints">
                <IconSafe />
                {(!isMobile || mode === 'pop') && '设定'}
            </MenuItem>
            <MenuItem key="settings">
                <IconSettings />
                {(!isMobile || mode === 'pop') && '设置'}
            </MenuItem>
            <MenuItem key="plot">
                <IconFile />
                {(!isMobile || mode === 'pop') && '大纲架构'}
            </MenuItem>
            <MenuItem key="workbench">
                <IconEdit />
                {(!isMobile || mode === 'pop') && '写作台'}
            </MenuItem>
            <MenuItem key="reader">
                <IconBook />
                {(!isMobile || mode === 'pop') && '阅读'}
            </MenuItem>


            <MenuItem key="inspector">
                <IconBug />
                {(!isMobile || mode === 'pop') && '透视台'}
            </MenuItem>
        </Menu>
    );

    return (
        <ArcoLayout style={{ minHeight: '100vh' }}>
            {!isMobile ? (
                <Sider
                    width={80}
                    style={{
                        position: 'fixed',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        zIndex: 10,
                        paddingTop: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        borderRight: '1px solid var(--color-border-2)',
                        backgroundColor: 'var(--color-bg-2)'
                    }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24, width: '100%' }}>
                        <Button
                            type="text"
                            icon={<IconLeft />}
                            onClick={clearCurrentProject}
                            title="返回项目列表"
                            style={{ marginBottom: 8 }}
                        />
                        <Button
                            type="text"
                            icon={theme === 'dark' ? <IconSun /> : <IconMoon />}
                            onClick={handleThemeToggle}
                            title="切换主题"
                            style={{ marginBottom: 8 }}
                        />
                    </div>
                    {renderMenu('vertical')}
                </Sider>
            ) : (
                <Header style={{ padding: '0 16px', backgroundColor: 'var(--color-bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'fixed', width: '100%', zIndex: 10, borderBottom: '1px solid var(--color-border-2)', height: 64 }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Button
                            type="text"
                            icon={<IconMenu />}
                            onClick={() => setDrawerVisible(true)}
                            style={{ marginRight: 16 }}
                        />
                    </div>
                    <Space>
                        <Button
                            type="text"
                            icon={theme === 'dark' ? <IconSun /> : <IconMoon />}
                            onClick={handleThemeToggle}
                            title="切换主题"
                            style={{ marginBottom: 16 }}
                        />
                        <Button
                            type="text"
                            icon={<IconLeft />}
                            onClick={clearCurrentProject}
                            title="返回项目列表"
                        />
                    </Space>
                </Header>
            )}

            <Drawer
                title="导航"
                placement="left"
                visible={drawerVisible}
                onCancel={() => setDrawerVisible(false)}
                width={240}
                footer={null}
            >
                {renderMenu('pop')}
            </Drawer>

            <Content style={{
                backgroundColor: 'var(--color-fill-2)',
                overflowY: 'auto',
                height: '100vh',
                marginLeft: !isMobile ? 80 : 0,
                paddingTop: !isMobile ? 0 : 64,
            }}>
                {children}
            </Content>
        </ArcoLayout>
    );
};
