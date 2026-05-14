import React, { createContext, useContext, useState, useEffect } from 'react';
import { storage } from '../services/storage';

const ProjectContext = createContext();

export const useProject = () => {
    const context = useContext(ProjectContext);
    if (!context) {
        throw new Error('useProject must be used within a ProjectProvider');
    }
    return context;
};

export const ProjectProvider = ({ children }) => {
    const [projects, setProjects] = useState([]);
    const [currentProject, setCurrentProject] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async (showLoading = true) => {
        if (showLoading) setIsLoading(true);
        try {
            const loadedProjects = await storage.getProjects();
            setProjects(loadedProjects);

            // Restore last selected project
            const lastProjectId = localStorage.getItem('lastProjectId');
            if (lastProjectId) {
                const lastProject = loadedProjects.find(p => p.id === lastProjectId);
                if (lastProject) {
                    setCurrentProject(lastProject);
                }
            }


        } catch (error) {
            console.error('Failed to load projects:', error);
        } finally {
            if (showLoading) setIsLoading(false);
        }
    };

    const createProject = async (name, options = {}) => {
        const { autoNavigate = true } = options;
        try {
            const newProject = await storage.createProject(name);
            setProjects(prev => [...prev, newProject]);
            // 只有当 autoNavigate 为 true 时才设置 currentProject（触发导航）
            if (autoNavigate) {
                setCurrentProject(newProject);
            }
            return newProject;
        } catch (error) {
            console.error('Failed to create project:', error);
            throw error;
        }
    };

    const deleteProject = async (projectId) => {
        try {
            // Use cascade delete to remove all related data
            await storage.deleteProjectCascade(projectId);
            setProjects(prev => prev.filter(p => p.id !== projectId));
            if (currentProject && currentProject.id === projectId) {
                setCurrentProject(null);
                localStorage.removeItem('lastProjectId');
            }
        } catch (error) {
            console.error('Failed to delete project:', error);
            throw error;
        }
    };

    const clearCurrentProject = () => {
        setCurrentProject(null);
        localStorage.removeItem('lastProjectId');
    };

    const selectProject = async (projectId) => {
        // 直接从存储中获取最新的项目数据，确保封面等更新后能立即生效
        const freshProject = await storage.getProject(projectId);
        if (freshProject) {
            setCurrentProject(freshProject);
            // 同时更新 projects 数组以保持一致性
            setProjects(prev => prev.map(p => p.id === projectId ? freshProject : p));
            localStorage.setItem('lastProjectId', projectId);
        }
    };

    const updateCurrentProject = async (updates) => {
        if (!currentProject) return;

        const updatedProject = await storage.updateProject(currentProject.id, updates);
        setCurrentProject(updatedProject);
        setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    };

    const reloadCurrentProject = async () => {
        if (!currentProject) return;
        const project = await storage.getProject(currentProject.id);
        setCurrentProject(project);
        setProjects(prev => prev.map(p => p.id === project.id ? project : p));
    };

    const value = {
        projects,
        currentProject,
        isLoading,
        createProject,
        selectProject,
        updateCurrentProject,
        reloadCurrentProject,
        refreshProjects: () => loadProjects(false),
        deleteProject,
        clearCurrentProject
    };

    return (
        <ProjectContext.Provider value={value}>
            {children}
        </ProjectContext.Provider>
    );
};
