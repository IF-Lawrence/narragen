import { useState } from 'react';
import { Layout } from './components/layout/Layout';
import { useProject } from './contexts/ProjectContext';
import { Settings } from './components/modules/Settings';
import { Characters } from './components/modules/Characters';
import { Constraints } from './components/modules/Constraints';
import { ProjectDashboard } from './components/modules/ProjectDashboard';
import { PlotArchitecture } from './components/modules/PlotArchitecture';
import { WriterWorkbench } from './components/modules/WriterWorkbench';
import { PromptInspector } from './components/modules/PromptInspector';
import { Reader } from './components/modules/Reader';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ThemeProvider, useThemeMode } from './contexts/ThemeContext';
import { ChapterGenerationProvider } from './contexts/ChapterGenerationContext';
// GlobalGenerationIndicator removed - duplicate of PlotArchitecture inline status
// import { GlobalGenerationIndicator } from './components/common/GlobalGenerationIndicator';
import CssBaseline from '@mui/material/CssBaseline';

// Inner component that uses theme context
function AppContent() {
  console.log('App rendering...');

  // Restore last active tab from localStorage, default to 'plot'
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('lastActiveTab') || 'plot';
  });

  const { currentProject, isLoading, selectProject } = useProject();
  const { theme } = useThemeMode(); // Get theme from our context

  // Save active tab to localStorage whenever it changes
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('lastActiveTab', tab);
  };

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  const renderContent = () => {
    return (
      <>
        <div style={{ display: activeTab === 'characters' ? 'block' : 'none', height: '100%' }}>
          <Characters />
        </div>
        <div style={{ display: activeTab === 'constraints' ? 'block' : 'none', height: '100%' }}>
          <Constraints />
        </div>
        <div style={{ display: activeTab === 'settings' ? 'block' : 'none', height: '100%' }}>
          <Settings />
        </div>
        <div style={{ display: activeTab === 'plot' ? 'block' : 'none', height: '100%' }}>
          <PlotArchitecture isVisible={activeTab === 'plot'} />
        </div>
        <div style={{ display: activeTab === 'workbench' ? 'block' : 'none', height: '100%' }}>
          <WriterWorkbench isVisible={activeTab === 'workbench'} />
        </div>
        {activeTab === 'reader' && <Reader onExit={() => handleTabChange('plot')} />}
        {activeTab === 'inspector' && <PromptInspector />}
      </>
    );
  };

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {!currentProject ? (
        <ProjectDashboard onStartReading={(projectId) => {
          handleTabChange('reader');
          selectProject(projectId);
        }} />
      ) : (
        <Layout activeTab={activeTab} onTabChange={handleTabChange}>
          {renderContent()}
        </Layout>
      )}
    </MuiThemeProvider>
  );
}

// Main App component wraps with ThemeProvider
function App() {
  return (
    <ThemeProvider>
      <ChapterGenerationProvider>
        <AppContent />
        {/* GlobalGenerationIndicator removed - duplicate of PlotArchitecture inline status */}
      </ChapterGenerationProvider>
    </ThemeProvider>
  );
}

export default App;

