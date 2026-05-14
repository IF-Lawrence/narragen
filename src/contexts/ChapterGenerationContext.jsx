import React, { createContext, useContext, useState, useRef, useCallback } from 'react';

const ChapterGenerationContext = createContext();

export const useChapterGeneration = () => {
    const context = useContext(ChapterGenerationContext);
    if (!context) {
        throw new Error('useChapterGeneration must be used within a ChapterGenerationProvider');
    }
    return context;
};

export const ChapterGenerationProvider = ({ children }) => {
    // 全局生成状态
    const [globalGenerationStatus, setGlobalGenerationStatus] = useState(null);
    // { volumeName, currentChapter, totalChapters, progress, volumeId }

    const abortControllerRef = useRef(null);

    const updateGenerationStatus = useCallback((status) => {
        setGlobalGenerationStatus(status);
    }, []);

    const clearGenerationStatus = useCallback(() => {
        setGlobalGenerationStatus(null);
    }, []);

    const interruptGeneration = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    }, []);

    const value = {
        globalGenerationStatus,
        updateGenerationStatus,
        clearGenerationStatus,
        interruptGeneration,
        abortControllerRef
    };

    return (
        <ChapterGenerationContext.Provider value={value}>
            {children}
        </ChapterGenerationContext.Provider>
    );
};
