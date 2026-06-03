import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Card,
  CardContent,
  CardHeader,
  CardActions,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Collapse,
  Popover,
  Avatar,
  AvatarGroup,
  Snackbar,
  Alert,
  Autocomplete,
  Slider,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  Drawer,
  Divider,
  Paper,
  Breadcrumbs,
  Link,
  CircularProgress,
  LinearProgress,
  Skeleton,
  MenuItem,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import {
  EditRounded as IconEdit,
  DeleteRounded as IconDelete,
  ExpandMoreRounded as IconExpandMore,
  AddRounded as IconPlus,
  DownloadRounded as IconDownload,
  UploadRounded as IconUpload,
  SyncRounded as IconSync,
  CloseRounded as IconClose,
  SaveRounded as IconSave,
  SmartToyRounded as IconRobot,
  MenuRounded as IconMenu,
  AutoFixHighRounded as IconAutoFixHigh,
  AutoStoriesRounded as IconStory,
  CrisisAlertRounded as IconConflict,
  LoginRounded as IconBeginning,
  FlagRounded as IconEnding,
  PublicRounded as IconWorld,
  HistoryEduRounded as IconDraft,
  AutoFixHighRounded as IconAI,
  ListRounded as IconList,
  LibraryBooksRounded as IconLibraryBooks,
  ChevronRightRounded as IconChevronRight,
  ChevronLeftRounded as IconChevronLeft,
  CheckCircleRounded as IconCheckCircle,
  CheckRounded as IconCheck,
  RadioButtonUncheckedRounded as IconRadioButtonUnchecked,
  InfoRounded as IconInfo,
  WarningRounded as IconWarning,
  KeyboardArrowUpRounded as IconKeyboardArrowUp,
  KeyboardArrowDownRounded as IconKeyboardArrowDown,
  ArrowUpwardRounded as ArrowUpward,
  ArrowDownwardRounded as ArrowDownward,
  DragIndicatorRounded as IconDrag,
  DescriptionRounded as IconDescription,
  TrackChangesRounded as IconTarget,
  QuestionMarkRounded as IconSuspense,
  FactCheckRounded as IconResolved,
  FormatQuoteRounded as IconQuote,
  LightbulbRounded as IconLightbulb,
  AccountTreeRounded as IconTree,
  ViewQuiltRounded as IconStructure,
  TouchAppRounded as IconSelect
} from '@mui/icons-material';
import EmptyStateChapterSelect from '../../assets/illustrations/empty-state-chapter-select.gif';


import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useProject } from '../../contexts/ProjectContext';
import { useTheme, alpha } from '@mui/material/styles';
import EmptyStateStructure from '../../assets/illustrations/empty-state-structure.gif';
import EmptyStateVolume from '../../assets/illustrations/empty-state-volume.gif';
import EmptyStateChapter from '../../assets/illustrations/empty-state-chapter.gif';
import LoadingCoreOutline from '../../assets/illustrations/loading-core-outline.gif';
import LoadingTemplateGen from '../../assets/illustrations/loading-template-gen.gif';
import LoadingVolumeGen from '../../assets/illustrations/loading-volume-gen.gif';
import LoadingChapterGen from '../../assets/illustrations/loading-chapter-gen.gif';
import useMediaQuery from '@mui/material/useMediaQuery';
import { storageEx, storage } from '../../services/storage';
import { PlannerAgent } from '../../services/agents/PlannerAgent';
import { AgentCoordinator } from '../../services/AgentCoordinator';
import { outlineTemplates, templateCategories } from '../../config/outlineTemplates';
import { useChapterGeneration } from '../../contexts/ChapterGenerationContext';
import DebouncedTextField from '../common/DebouncedTextField';

// --- Helpers ---
const PassionSystemNameDefault = "章节波动等级 (Passion Level)";

const PassionDefinitionsDefault = {
  systemName: PassionSystemNameDefault,
  1: "清水/铺垫：注重情感交流，氛围渲染，无直接描写。",
  2: "升温/暧昧：肢体接触增加，情感张力增强，有明显的暗示。",
  3: "激烈/直白：高强度的情感爆发，大胆的动作描写。",
  4: "极限/狂热：极致的张力与激情，突破常规的描写尺度。",
  5: "禁忌/极致：完全释放的情感表达，无保留的描写尺度。"
};

const FLUCTUATION_PROFILES = {
  FLAT: { label: '全程平淡', value: 'flat' },
  RISING: { label: '持续升温', value: 'rising' },
  INTENSE: { label: '全程高潮', value: 'intense' },
  SMOOTH: { label: '平缓铺垫', value: 'smooth' }
};

const numberToChinese = (num) => {
  const chineseNums = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const units = ['', '十', '百', '千', '万'];
  if (num === 0) return chineseNums[0];
  let res = '';
  let strNum = num.toString();
  for (let i = 0; i < strNum.length; i++) {
    let n = parseInt(strNum[i]);
    let unit = units[strNum.length - i - 1];
    if (n !== 0) {
      if (num < 20 && unit === '十' && i === 0) {
        res += unit;
      } else {
        res += chineseNums[n] + unit;
      }
    } else {
      if (res !== '' && res[res.length - 1] !== chineseNums[0] && i !== strNum.length - 1) {
        res += chineseNums[0];
      }
    }
  }
  return res;
};

// Helper: Convert number to Chinese chapter label (e.g., 第一章, 第十二章)
const getChineseLabel = (n) => {
  const zh = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  let label = '';
  if (n === 10) label = '十章';
  else if (n < 10) label = zh[n] + '章';
  else if (n < 20) label = '十' + zh[n % 10] + '章';
  else if (n < 100) label = zh[Math.floor(n / 10)] + '十' + (n % 10 === 0 ? '' : zh[n % 10]) + '章';
  else label = n + '章';
  return '第' + label;
};

// Helper: Parse scenes from summary text (moved outside for memoization)
const parseScenes = (summaryText) => {
  if (!summaryText) return [];
  let text = summaryText;
  if (text.includes('```')) text = text.replace(/```json\n?|```\n?|```/g, '');
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed?.scenes)) return parsed.scenes;
  } catch { }
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  return lines.map(l => ({ loc: '', action: l, outcome: '' }));
};

// Helper: Parse chapter summary data (moved outside for memoization)
const parseChapterSummary = (summary) => {
  const defaultData = { oneSentence: '', summary: '', mainConflict: '', chapterGoal: '', chapterOutcome: '', openQuestions: [], resolvedQuestions: [] };
  if (!summary) return defaultData;
  try {
    const parsed = JSON.parse(summary);
    return { ...defaultData, ...parsed };
  } catch { return defaultData; }
};

// Global generation state tracker (Module-level)
const globalGenerationState = {
  projectId: null,
  type: null, // 'core_outline', 'volume_plan', etc.
  status: 'idle', // 'idle', 'loading'
  msg: ''
};

export const PlotArchitecture = ({ isVisible = true }) => {
  const { currentProject } = useProject();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const planner = new PlannerAgent();
  const { updateGenerationStatus, clearGenerationStatus } = useChapterGeneration();

  // --- State ---
  const [coreOutline, setCoreOutline] = useState('');
  const [outlineJSON, setOutlineJSON] = useState(null);
  const [volumes, setVolumes] = useState([]);
  const [subplots, setSubplots] = useState([]);
  const [foreshadowing, setForeshadowing] = useState([]);
  const [selectedVolumeId, setSelectedVolumeId] = useState(null);
  const [chapterNodes, setChapterNodes] = useState([]);

  // Selection
  const [selectedVolumeIds, setSelectedVolumeIds] = useState(new Set());
  const [selectedChapterIdsByVolume, setSelectedChapterIdsByVolume] = useState({});

  // Maps
  const [chapterNodesMap, setChapterNodesMap] = useState({});
  const [sceneRewriteMap, setSceneRewriteMap] = useState({});

  // Status
  const [coreStatus, setCoreStatus] = useState({ loading: false, msg: '' });
  const [volumeStatus, setVolumeStatus] = useState({ loading: false, msg: '' });
  const [volumePlanStatus, setVolumePlanStatus] = useState({});
  const [sceneGenStatus, setSceneGenStatus] = useState({});
  const [chapterBatchStatusByVolume, setChapterBatchStatusByVolume] = useState({});

  const abortControllerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const volumeTabsContainerRef = useRef(null);

  // --- Step & Layout State ---
  // Load saved step from localStorage, default to 0
  const [activeStep, setActiveStep] = useState(() => {
    if (!currentProject) return 0;
    const saved = localStorage.getItem(`plotarch_activeStep_${currentProject.id}`);
    return saved !== null ? parseInt(saved, 10) : 0;
  }); // 0: Idea, 1: Outline, 2: Volumes, 3: Chapters
  const [showRefPanel, setShowRefPanel] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(!isMobile);

  // Forms & Edit States (Manual Control for MUI)
  const [formIdea, setFormIdea] = useState({
    mainPlot: '', mainConflict: '', storyBeginning: '', expectedEnding: '',
    timePeriod: '', mainSettings: '', worldFeatures: '', socialRules: ''
  });

  const [editStructureVisible, setEditStructureVisible] = useState(false);
  const [moduleEditData, setModuleEditData] = useState({}); // For Outline Editing
  const [editingModule, setEditingModule] = useState(null);

  // Volume Generation
  const [genVolumeVisible, setGenVolumeVisible] = useState(false);
  const [genVolumeCount, setGenVolumeCount] = useState(1);
  const [volumeRequirements, setVolumeRequirements] = useState({}); // Map: index -> req string
  const [activeVolumeTab, setActiveVolumeTab] = useState('planning'); // 'planning' | 'subplots'



  // Volume Regen
  const [regenVolumeVisible, setRegenVolumeVisible] = useState(false);
  const [regenVolumeGuidance, setRegenVolumeGuidance] = useState('');
  const [regenTargetVolume, setRegenTargetVolume] = useState(null);

  // Chapter Generation
  const [genChaptersVisible, setGenChaptersVisible] = useState(false);
  const [genChaptersVolumeIds, setGenChaptersVolumeIds] = useState(new Set());
  const [activePreviewVid, setActivePreviewVid] = useState(null);
  const [totalChaptersInVolume, setTotalChaptersInVolume] = useState(5);
  const [batchVolumeConfigs, setBatchVolumeConfigs] = useState({}); // { [vid]: { totalChapters } }

  // Single Volume Generation
  const [singleVolumeGenVisible, setSingleVolumeGenVisible] = useState(false);
  const [singleVolumeGenConfig, setSingleVolumeGenConfig] = useState({ totalChapters: 5, fluctuationProfile: 'rising' });

  // Template Generation
  const [genTemplateVisible, setGenTemplateVisible] = useState(false);
  const [genTemplateIdea, setGenTemplateIdea] = useState('');
  const [genTemplateLoading, setGenTemplateLoading] = useState(false);
  const [customTemplates, setCustomTemplates] = useState([]);
  const [saveTemplateVisible, setSaveTemplateVisible] = useState(false);

  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [switchTemplateVisible, setSwitchTemplateVisible] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState(null);

  // Import
  const [importOutlineVisible, setImportOutlineVisible] = useState(false);
  const [importOutlineText, setImportOutlineText] = useState('');
  const importFileInputRef = useRef(null);


  // Volume Import
  const [importVolumeModalVisible, setImportVolumeModalVisible] = useState(false);
  const [importVolumeJson, setImportVolumeJson] = useState('');
  const importVolumeFileRef = useRef(null);


  // Inline Edits
  const [editingSummaryId, setEditingSummaryId] = useState(null);
  const [editingDetailedSummaryId, setEditingDetailedSummaryId] = useState(null);
  const [editingSceneId, setEditingSceneId] = useState(null); // format: `${chapterId}-${sceneIndex}`
  const [menuAnchorEl, setMenuAnchorEl] = useState(null); // Generic menu anchor
  const [editingSceneChars, setEditingSceneChars] = useState(null); // { chId, sceneIdx, anchorEl }
  const [activeMenuId, setActiveMenuId] = useState(null); // Id for active menu

  // Advanced Options
  const [outlineOptions, setOutlineOptions] = useState({
    novelType: '', targetAudience: [], tone: '', length: 'medium', characterCount: 4, narrativeStyle: '', literaryDepth: ''
  });

  const [characterPresets, setCharacterPresets] = useState([]);

  // Passion
  const [previewChapters, setPreviewChapters] = useState([]);
  const [chapterPassionLevels, setChapterPassionLevels] = useState({});
  const [passionSystemName, setPassionSystemName] = useState(PassionSystemNameDefault);

  // Data
  const [characters, setCharacters] = useState([]);

  // Interrupt Recovery
  const [generationProgress, setGenerationProgress] = useState(null);

  // 解析失败编辑器状态
  const [parseErrorVisible, setParseErrorVisible] = useState(false);
  const [rawResponseForEdit, setRawResponseForEdit] = useState('');
  const [parseErrorContext, setParseErrorContext] = useState(null); // { volumeId, chapterOrder, outline }

  const [expandedChapters, setExpandedChapters] = useState(new Set());
  const [deleteOutlineVisible, setDeleteOutlineVisible] = useState(false);
  const [confirmOverwriteVisible, setConfirmOverwriteVisible] = useState(false);
  const [deleteVolumeConfirm, setDeleteVolumeConfirm] = useState({ visible: false, type: 'single', data: null });
  const [reviewDialogVisible, setReviewDialogVisible] = useState(false);

  // Core Outline Refinement
  const [refineDialogVisible, setRefineDialogVisible] = useState(false);
  const [refineFeedback, setRefineFeedback] = useState('');
  const [refineLoading, setRefineLoading] = useState(false);

  // Volume Plan Refinement
  const [refineVolumeDialogVisible, setRefineVolumeDialogVisible] = useState(false);
  const [refineVolumeFeedback, setRefineVolumeFeedback] = useState('');
  const [refineVolumeLoading, setRefineVolumeLoading] = useState(false);

  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  // --- Helpers ---
  const showMessage = (msg, type = 'info') => {
    setSnackbar({ open: true, message: msg, severity: type });
  };

  const messageApi = {
    success: (msg) => showMessage(msg, 'success'),
    error: (msg) => showMessage(msg, 'error'),
    info: (msg) => showMessage(msg, 'info'),
    warning: (msg) => showMessage(msg, 'warning')
  };

  const loadCustomTemplates = async () => {
    try {
      const templates = await storageEx.getItems('custom_templates');
      setCustomTemplates(templates || []);
    } catch (err) {
      console.error('Failed to load custom templates:', err);
    }
  };

  const deleteCustomTemplate = async (tid) => {
    if (!window.confirm('确定要删除这个模板吗？')) return;
    try {
      await storage.deleteItem('custom_templates', tid);
      await loadCustomTemplates();
      messageApi.success('模板已删除');
    } catch (err) {
      console.error('Failed to delete template:', err);
      messageApi.error('删除失败');
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!saveTemplateName.trim()) {
      messageApi.warning('请输入模板名称');
      return;
    }
    const template = {
      id: `custom_${Date.now()}`,
      name: saveTemplateName,
      icon: '📝',
      description: '用户自定义模板',
      storyFields: { ...formIdea },
      worldFields: {
        timePeriod: formIdea.timePeriod,
        mainSettings: formIdea.mainSettings,
        worldFeatures: formIdea.worldFeatures,
        socialRules: formIdea.socialRules
      },
      characters: [...characterPresets],
      options: { ...outlineOptions },
      createdAt: new Date().toISOString()
    };

    try {
      await storage.addItem('custom_templates', template);
      await loadCustomTemplates();
      setSaveTemplateVisible(false);
      setSaveTemplateName('');
      messageApi.success('模板已保存');
    } catch (err) {
      console.error('Failed to save template:', err);
      messageApi.error(`保存失败: ${err.message || '未知错误'}`);
    }
  };

  useEffect(() => {
    if (genChaptersVisible && activePreviewVid) {
      const specificTotal = batchVolumeConfigs[activePreviewVid]?.totalChapters || totalChaptersInVolume;
      calculatePreviewChapters(specificTotal, activePreviewVid);
    }
  }, [genChaptersVisible, activePreviewVid, batchVolumeConfigs, totalChaptersInVolume]);

  // Persist activeStep to localStorage
  useEffect(() => {
    if (currentProject) {
      localStorage.setItem(`plotarch_activeStep_${currentProject.id}`, activeStep.toString());
    }
  }, [activeStep, currentProject]);

  // Memoized parsed chapter data - avoids re-parsing JSON on every render
  const parsedChapterData = useMemo(() => {
    const result = {};
    for (const ch of chapterNodes) {
      result[ch.id] = {
        scenes: parseScenes(ch.summary),
        summaryData: parseChapterSummary(ch.summary)
      };
    }
    return result;
  }, [chapterNodes]);

  const cleanJSON = (text) => {
    let cleaned = text
      // Remove trailing commas
      .replace(/,(\s*[}\]])/g, '$1')
      // Remove single-line comments
      .replace(/\/\/.*$/gm, '')
      // Remove multi-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();
    // Handle unquoted age values like "age": 35岁
    cleaned = cleaned.replace(/("age"\s*:\s*)([\d]+[\u4e00-\u9fa5\(\)（）\w\s]+)(?=[,}])/g, '$1"$2"');
    return cleaned;
  };

  const getPassionDefinitions = async () => {
    if (!currentProject) return null;
    const definitions = await storage.getItem(`passion_definitions_${currentProject.id}`);
    return definitions || PassionDefinitionsDefault;
  };

  // --- Logic : Load Data ---
  const loadData = async () => {
    if (!currentProject) return;

    // Passion
    const defs = await getPassionDefinitions();
    setPassionSystemName(defs.systemName || PassionSystemNameDefault);

    // Outline
    const outlineRow = await storageEx.getCoreOutline(currentProject.id);
    setCoreOutline(outlineRow ? outlineRow.content : '');
    try {
      let text = outlineRow ? outlineRow.content : '';
      if (text && typeof text === 'string') {
        if (text.includes('```json')) text = text.replace(/```json\n?|\n?```/g, '');
        else if (text.includes('```')) text = text.replace(/```\n?|\n?```/g, '');
        const parsed = JSON.parse(cleanJSON(text));
        setOutlineJSON(parsed);
        if (activeStep === 0) setActiveStep(1);
      } else {
        setOutlineJSON(null);
      }
    } catch { setOutlineJSON(null); }

    // Volumes
    const vols = (await storageEx.getVolumes(currentProject.id)).sort((a, b) => a.order - b.order);
    setVolumes(vols);

    // Load subplots and foreshadowing
    try {
      const subplotsData = await storage.getItem(`volumePlan_subplots_${currentProject.id}`);
      const foreshadowingData = await storage.getItem(`volumePlan_foreshadowing_${currentProject.id}`);
      if (subplotsData) setSubplots(JSON.parse(subplotsData));
      if (foreshadowingData) setForeshadowing(JSON.parse(foreshadowingData));
    } catch (e) { console.warn('Failed to load subplots/foreshadowing', e); }

    if (vols.length > 0) {
      // Only auto-navigate if no saved step exists
      const savedStep = localStorage.getItem(`plotarch_activeStep_${currentProject.id}`);
      if (savedStep === null) {
        setActiveStep(2);
      }
      setSelectedVolumeId(vols[0].id);
      const map = {};
      for (const v of vols) {
        let nodes = await storageEx.getChapterNodesByVolume(v.id);
        // 清理无内容的残留节点（由取消任务后刷新页面导致）
        const emptyNodes = nodes.filter(n => !n.summary || n.summary === '{}' || n.summary === 'null');
        if (emptyNodes.length > 0) {
          for (const emptyNode of emptyNodes) {
            await storage.deleteItem('chapter_nodes', emptyNode.id);
          }
          nodes = nodes.filter(n => n.summary && n.summary !== '{}' && n.summary !== 'null');
          console.log(`已清理 ${emptyNodes.length} 个空章节节点`);
        }
        map[v.id] = nodes.sort((a, b) => a.order - b.order);
      }
      setChapterNodesMap(map);
      setChapterNodes(map[vols[0].id] || []);
    } else {
      setSelectedVolumeId(null);
      setChapterNodes([]);
    }

    // Characters
    const chars = await storage.getItemsByProject('characters', currentProject.id);
    setCharacters(chars);

    // Idea Draft
    const draftIdea = await storage.getItem(`form_idea_${currentProject.id}`);
    if (draftIdea) setFormIdea(draftIdea);

    const draftOptions = await storage.getItem(`outline_options_${currentProject.id}`);
    if (draftOptions && typeof draftOptions === 'object') {
      // Ensure default fields exist
      setOutlineOptions(prev => ({ ...prev, ...draftOptions }));
    }

    const draftPresets = await storage.getItem(`character_presets_${currentProject.id}`);
    if (Array.isArray(draftPresets)) {
      setCharacterPresets(draftPresets);
    } else {
      setCharacterPresets([]);
    }
  };

  useEffect(() => {
    if (isVisible && currentProject) {
      loadData();
      loadCustomTemplates();
    }
  }, [currentProject, isVisible]);

  // Interrupt Check
  useEffect(() => {
    if (currentProject && volumes.length > 0) {
      for (const v of volumes) {
        const saved = localStorage.getItem(`chapter_gen_progress_${currentProject.id}_${v.id}`);
        const progress = saved ? JSON.parse(saved) : null;
        if (progress && progress.completedChapters < progress.totalChapters) {
          setGenerationProgress(progress);
          // 改为内嵌恢复卡片，不再使用弹窗
          break;
        }
      }
    }
  }, [currentProject, volumes]);

  // Draft Auto-save with debounce
  const formIdeaSaveTimeoutRef = useRef(null);
  useEffect(() => {
    if (currentProject) {
      if (formIdeaSaveTimeoutRef.current) {
        clearTimeout(formIdeaSaveTimeoutRef.current);
      }
      formIdeaSaveTimeoutRef.current = setTimeout(() => {
        storage.setItem(`form_idea_${currentProject.id}`, formIdea);
      }, 500);
    }
    return () => {
      if (formIdeaSaveTimeoutRef.current) {
        clearTimeout(formIdeaSaveTimeoutRef.current);
      }
    };
  }, [formIdea, currentProject]);

  const outlineOptionsSaveTimeoutRef = useRef(null);
  useEffect(() => {
    if (currentProject) {
      if (outlineOptionsSaveTimeoutRef.current) {
        clearTimeout(outlineOptionsSaveTimeoutRef.current);
      }
      outlineOptionsSaveTimeoutRef.current = setTimeout(() => {
        storage.setItem(`outline_options_${currentProject.id}`, outlineOptions);
      }, 500);
    }
    return () => {
      if (outlineOptionsSaveTimeoutRef.current) {
        clearTimeout(outlineOptionsSaveTimeoutRef.current);
      }
    };
  }, [outlineOptions, currentProject]);

  const characterPresetsSaveTimeoutRef = useRef(null);
  useEffect(() => {
    if (currentProject) {
      if (characterPresetsSaveTimeoutRef.current) {
        clearTimeout(characterPresetsSaveTimeoutRef.current);
      }
      characterPresetsSaveTimeoutRef.current = setTimeout(() => {
        storage.setItem(`character_presets_${currentProject.id}`, characterPresets);
      }, 500);
    }
    return () => {
      if (characterPresetsSaveTimeoutRef.current) {
        clearTimeout(characterPresetsSaveTimeoutRef.current);
      }
    };
  }, [characterPresets, currentProject]);

  useEffect(() => {
    if (selectedVolumeId) {
      // 优先使用缓存数据，避免不必要的异步加载导致卡顿
      const cached = chapterNodesMap[selectedVolumeId];
      if (cached) {
        setChapterNodes(cached);
      } else {
        refreshChapters(selectedVolumeId);
      }
    }
  }, [selectedVolumeId]);

  // 滚动选中的分卷 Tab 到容器中心
  useEffect(() => {
    if (selectedVolumeId && activeStep === 3) {
      const scrollToCenter = () => {
        const container = volumeTabsContainerRef.current;
        const selectedTab = container?.querySelector(`[data-volume-id="${selectedVolumeId}"]`);
        if (container && selectedTab) {
          const containerWidth = container.offsetWidth;
          const tabOffsetLeft = selectedTab.offsetLeft;
          const tabWidth = selectedTab.offsetWidth;
          const scrollLeft = tabOffsetLeft - (containerWidth / 2) + (tabWidth / 2);
          container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
        }
      };
      // 增加延时确保 DOM 渲染完成
      const timer = setTimeout(scrollToCenter, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedVolumeId, activeStep]);

  const refreshVolumes = async () => {
    const vols = (await storageEx.getVolumes(currentProject.id)).sort((a, b) => a.order - b.order);
    setVolumes(vols);
  };

  const refreshChapters = async (vid) => {
    const nodes = await storageEx.getChapterNodesByVolume(vid);
    const sorted = nodes.sort((a, b) => a.order - b.order);
    setChapterNodes(sorted);
    setChapterNodesMap(prev => ({ ...prev, [vid]: sorted }));
  };



  // --- Logic : Core Outline ---
  // Debounce ref for save operations
  const saveOutlineTimeoutRef = useRef(null);

  const handleUpdateOutlineField = (path, value) => {
    if (!currentProject || !outlineJSON) return;

    const newJSON = { ...outlineJSON };
    const parts = path.split('.');
    let current = newJSON;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;

    // Update state immediately for responsive UI
    setOutlineJSON(newJSON);

    // Clear previous timeout
    if (saveOutlineTimeoutRef.current) {
      clearTimeout(saveOutlineTimeoutRef.current);
    }

    // Debounced persist - wait 500ms after last keystroke
    // Note: We don't call setCoreOutline here to avoid extra re-render
    const updatedContent = JSON.stringify(newJSON, null, 2);
    saveOutlineTimeoutRef.current = setTimeout(async () => {
      try {
        await storageEx.saveCoreOutline(currentProject.id, updatedContent);
        // Only update coreOutline state after successful save
        setCoreOutline(updatedContent);
      } catch (e) {
        console.error('Failed to save core outline:', e);
      }
    }, 500);
  };
  const handleCancelTemplateGen = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      messageApi.info('已取消生成');
    }
    setGenTemplateVisible(false);
  };

  const handleGenerateTemplate = async () => {
    if (!genTemplateIdea.trim()) {
      messageApi.warning('请输入您的想法');
      return;
    }

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    setGenTemplateLoading(true);
    try {
      const template = await planner.generateTemplate(genTemplateIdea, { signal: abortControllerRef.current.signal, projectId: currentProject?.id });
      setFormIdea({
        mainPlot: template.storyFields?.mainPlot || '',
        mainConflict: template.storyFields?.mainConflict || '',
        storyBeginning: template.storyFields?.storyBeginning || '',
        expectedEnding: template.storyFields?.expectedEnding || '',
        timePeriod: template.worldFields?.timePeriod || '',
        mainSettings: template.worldFields?.mainSettings || '',
        worldFeatures: template.worldFields?.worldFeatures || '',
        socialRules: template.worldFields?.socialRules || ''
      });
      setOutlineOptions(template.options || { novelType: '', targetAudience: [], tone: '', length: 'medium', characterCount: 4, narrativeStyle: '', literaryDepth: '' });
      setCharacterPresets(Array.isArray(template.characters) ? template.characters : []);

      // Auto-save to custom templates
      try {
        const customTpl = {
          ...template,
          id: `ai_${Date.now()}`,
          icon: template.icon || '🤖',
          description: template.description || 'AI 生成模板',
          createdAt: new Date().toISOString()
        };
        await storage.addItem('custom_templates', customTpl);
        await loadCustomTemplates();
      } catch (err) {
        console.error('Failed to auto-save AI template:', err);
      }

      messageApi.success(`已生成并在应用模板: ${template.name}`);
      setGenTemplateVisible(false);
      setGenTemplateIdea('');
    } catch (error) {
      if (error.name === 'AbortError') {
        // Handled in cancel function mostly, but ensure state reset
      } else {
        console.error(error);
        messageApi.error('模板生成失败');
      }
    } finally {
      if (abortControllerRef.current) abortControllerRef.current = null;
      setGenTemplateLoading(false);
    }
  };

  useEffect(() => {
    // Check global state on mount/project change
    if (globalGenerationState.projectId === currentProject?.id && globalGenerationState.type === 'core_outline' && globalGenerationState.status === 'loading') {
      setCoreStatus({ loading: true, msg: globalGenerationState.msg || '后台生成中...' });
    }

    const handleStatusUpdate = (e) => {
      const state = e.detail;
      if (state.projectId === currentProject?.id && state.type === 'core_outline') {
        setCoreStatus({ loading: state.status === 'loading', msg: state.msg });
        // If finished successfully, reload data
        if (state.status === 'idle' && !state.msg.includes('失败')) {
          loadData();
        }
      }
    };

    window.addEventListener('narragen-core-status', handleStatusUpdate);
    return () => window.removeEventListener('narragen-core-status', handleStatusUpdate);
  }, [currentProject]);

  // 注意：formIdea、outlineOptions、characterPresets 的保存/加载由以下机制统一处理：
  // - 加载：loadData() 中从 form_idea_${projectId}、outline_options_${projectId}、character_presets_${projectId} 加载
  // - 保存：下方独立的 useEffect 防抖保存到相应的键


  const handleGenerateCoreOutline = async () => {
    try {
      // 检查是否已存在核心大纲，提示覆盖确认
      if (coreOutline && coreOutline.trim() !== '') {
        setConfirmOverwriteVisible(true);
        return;
      }
      await doGenerateCoreOutline();
    } catch (err) {
      console.error('handleGenerateCoreOutline error', err);
    }
  };

  const doGenerateCoreOutline = async () => {
    try {
      // Set Global State
      globalGenerationState.projectId = currentProject.id;
      globalGenerationState.type = 'core_outline';
      globalGenerationState.status = 'loading';
      globalGenerationState.msg = '正在生成...';
      window.dispatchEvent(new CustomEvent('narragen-core-status', { detail: { ...globalGenerationState } }));

      // Set Local State
      setCoreStatus({ loading: true, msg: '正在生成...' });

      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      const { mainPlot, mainConflict, storyBeginning, expectedEnding, timePeriod, mainSettings, worldFeatures, socialRules } = formIdea;
      const idea = `${mainPlot || ''}${mainConflict ? '。主要冲突：' + mainConflict : ''}${storyBeginning ? '。故事开端：' + storyBeginning : ''}${expectedEnding ? '。预期结局：' + expectedEnding : ''}`;
      const world = `时代背景：${timePeriod || ''}。主要场景：${mainSettings || ''}${worldFeatures ? '。世界特色：' + worldFeatures : ''}${socialRules ? '。社会规则：' + socialRules : ''}`;

      const constraintsRows = await storageEx.getItems('constraints', { projectId: currentProject.id });
      const constraints = constraintsRows.map(x => x.content).join('\n');

      const result = await planner.generateCoreOutline({
        idea, world,
        characters: characterPresets,
        constraints,
        projectId: currentProject.id,
        options: outlineOptions,
        signal: abortControllerRef.current.signal
      });

      setCoreOutline(result);

      let parsedOutline = null;
      try {
        let text = result;
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) text = jsonMatch[1];
        text = cleanJSON(text);
        console.log('Attempting to parse cleaned JSON:', text);
        parsedOutline = JSON.parse(text);
        setOutlineJSON(parsedOutline);
      } catch (e) {
        console.error('Core outline parse failed', e);
        console.log('Raw result was:', result);
        // Fix typo and set error context for Core Outline
        setRawResponseForEdit(result);
        setParseErrorContext({ type: 'core_outline' });
        setParseErrorVisible(true);
      }

      await storageEx.updateCoreOutline(currentProject.id, { title: '核心大纲', content: result });

      // Auto create characters
      if (parsedOutline?.characters && Array.isArray(parsedOutline.characters)) {
        let createdCount = 0;

        // 先删除所有旧角色（重新生成大纲时清理旧数据）
        const existingChars = await storage.getItemsByProject('characters', currentProject.id);
        for (const oldChar of existingChars) {
          await storage.deleteItem('characters', oldChar.id);
        }

        // 创建新角色
        for (const char of parsedOutline.characters) {
          try {
            const charData = {
              projectId: currentProject.id,
              name: char.name || '未命名',
              role: char.role || '角色',
              age: char.age || '',
              gender: char.gender || '',
              traits: char.personality || char.description || char.traits || '',
              bio: char.background || char.bio || '',
              goal: char.goal || '',
              arc: char.arc || '',
              appearance: char.appearance || '',
              currentState: { chapter: 0, emotional: char.personality || '', description: '初始状态' },
              stateHistory: [],
              relationships: char.relationships || {},
              chapterAppearances: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            await storage.addItem('characters', charData);
            createdCount++;
          } catch (err) {
            console.error(`Failed to sync character ${char.name}:`, err);
          }
        }
        await loadData(); // Refresh local character list
        // 派发自定义事件通知其他组件（如角色管理页面）刷新数据
        window.dispatchEvent(new CustomEvent('characters-updated', { detail: { projectId: currentProject.id } }));
        messageApi.success(`已生成核心大纲并同步 ${createdCount} 个角色卡`);
      }

      // Reset Global State - Success
      globalGenerationState.status = 'idle';
      globalGenerationState.msg = '已生成并保存';
      window.dispatchEvent(new CustomEvent('narragen-core-status', { detail: { ...globalGenerationState } }));

      setCoreStatus({ loading: false, msg: '已生成并保存' });
    } catch (e) {
      console.error('handleGenerateCoreOutline error:', e);

      const errMsg = e.name === 'AbortError' ? '已取消生成' : (e.message || '生成中途出错');

      // Reset Global State - Error/Abort
      globalGenerationState.status = 'idle';
      globalGenerationState.msg = errMsg;
      window.dispatchEvent(new CustomEvent('narragen-core-status', { detail: { ...globalGenerationState } }));

      if (e.name !== 'AbortError') {
        messageApi.error(`生成失败: ${errMsg}`);
      }
      setCoreStatus({ loading: false, msg: '生成失败' });
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleExportCoreOutline = () => {
    let content = coreOutline;
    if (!content) {
      const defaultTemplate = {
        title: currentProject?.name || "未命名小说",
        logline: "",
        theme: "",
        coreConflict: "",
        tone: "",
        pacing: "",
        targetAudience: "",
        tags: [],
        worldSetting: { description: "", rules: "" },
        characters: characters.map(c => ({
          name: c.name, role: c.role, age: c.age, gender: c.gender,
          personality: c.traits, background: c.bio, goal: c.goal, arc: c.arc,
          appearance: c.appearance, relationships: c.relationships
        })),
        plotProgression: outlineJSON?.plotProgression || [],
        ending: outlineJSON?.ending || ""
      };
      content = JSON.stringify(defaultTemplate, null, 2);
    }
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `core_outline_${currentProject?.name || 'project'}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 核心大纲优化（基于用户反馈）
  const handleRefineCoreOutline = async () => {
    if (!refineFeedback.trim()) {
      messageApi.warning('请输入您的修改建议');
      return;
    }

    if (!outlineJSON) {
      messageApi.error('未检测到核心大纲');
      return;
    }

    try {
      setRefineLoading(true);
      setCoreStatus({ loading: true, msg: '正在优化大纲...' });

      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      const result = await planner.refineCoreOutline({
        existingOutline: outlineJSON,
        feedback: refineFeedback,
        projectId: currentProject.id,
        signal: abortControllerRef.current.signal
      });

      // 解析结果
      let parsedOutline = null;
      try {
        let text = result;
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) text = jsonMatch[1];
        text = cleanJSON(text);
        parsedOutline = JSON.parse(text);
        setOutlineJSON(parsedOutline);
      } catch (e) {
        console.error('优化大纲解析失败', e);
        messageApi.error('优化结果解析失败，请重试');
        return;
      }

      setCoreOutline(result);
      await storageEx.updateCoreOutline(currentProject.id, { title: '核心大纲', content: result });

      // 同步角色数据（如果大纲中的角色有更新）
      if (parsedOutline?.characters && Array.isArray(parsedOutline.characters)) {
        const existingChars = await storage.getItemsByProject('characters', currentProject.id);
        const existingCharNames = new Set(existingChars.map(c => c.name));
        let newCount = 0;

        for (const char of parsedOutline.characters) {
          if (!existingCharNames.has(char.name)) {
            // 新角色，添加
            const charData = {
              projectId: currentProject.id,
              name: char.name || '未命名',
              role: char.role || '角色',
              age: char.age || '',
              gender: char.gender || '',
              traits: char.personality || char.description || char.traits || '',
              bio: char.background || char.bio || '',
              goal: char.goal || '',
              arc: char.arc || '',
              appearance: char.appearance || '',
              currentState: { chapter: 0, emotional: char.personality || '', description: '初始状态' },
              stateHistory: [],
              relationships: char.relationships || {},
              chapterAppearances: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            await storage.addItem('characters', charData);
            newCount++;
          }
        }
        if (newCount > 0) {
          await loadData();
          window.dispatchEvent(new CustomEvent('characters-updated', { detail: { projectId: currentProject.id } }));
        }
      }

      messageApi.success('核心大纲已优化');
      setRefineDialogVisible(false);
      setRefineFeedback('');
      setCoreStatus({ loading: false, msg: '已优化' });
    } catch (e) {
      console.error('handleRefineCoreOutline error:', e);
      if (e.name !== 'AbortError') {
        messageApi.error(`优化失败: ${e.message || '未知错误'}`);
      }
      setCoreStatus({ loading: false, msg: '优化失败' });
    } finally {
      setRefineLoading(false);
      abortControllerRef.current = null;
    }
  };


  // Handle Volume Plan Refinement
  const handleRefineVolumePlan = async () => {
    if (volumes.length === 0) {
      messageApi.error('未检测到分卷规划');
      return;
    }

    try {
      setRefineVolumeLoading(true);
      setVolumeStatus({ loading: true, msg: '正在优化分卷规划...' });

      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      // Construct existing plan
      const existingPlan = {
        volumes: volumes.map(v => ({
          order: v.order,
          name: v.name,
          description: v.description,
          mainGoal: v.mainGoal,
          keyEvents: v.keyEvents,
          cliffhanger: v.cliffhanger
        })),
        subplots: subplots,
        foreshadowing: foreshadowing
      };

      const result = await planner.refineVolumePlan({
        existingPlan,
        feedback: refineVolumeFeedback,
        coreOutline: outlineJSON,
        projectId: currentProject.id,
        signal: abortControllerRef.current.signal
      });

      // Process & Save volumes
      if (result.volumes && Array.isArray(result.volumes)) {
        // Delete old volumes
        for (const v of volumes) {
          await storage.deleteItem('volumes', v.id);
        }

        // Create new volumes
        const newVolumes = [];
        for (const vData of result.volumes) {
          const { title, name, summary, description, goal, mainGoal, events, keyEvents, ...rest } = vData;
          const finalName = name || title || `第${vData.order || newVolumes.length + 1}卷`;
          const finalDesc = description || summary || '';
          const finalGoal = mainGoal || goal || '';
          const finalEvents = keyEvents || events || [];

          const allowedRest = {
            order: rest.order,
            startChapter: rest.startChapter,
            endChapter: rest.endChapter,
            cliffhanger: rest.cliffhanger
          };

          const newVol = {
            ...allowedRest,
            name: finalName,
            description: finalDesc,
            mainGoal: finalGoal,
            keyEvents: finalEvents,
            id: uuidv4(),
            projectId: currentProject.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await storage.addItem('volumes', newVol);
          newVolumes.push(newVol);
        }
        setVolumes(newVolumes.sort((a, b) => a.order - b.order));
      }

      // Update subplots
      if (result.subplots && Array.isArray(result.subplots)) {
        setSubplots(result.subplots);
        await storage.setItem(`volumePlan_subplots_${currentProject.id}`, JSON.stringify(result.subplots));
      }

      // Update foreshadowing
      if (result.foreshadowing && Array.isArray(result.foreshadowing)) {
        setForeshadowing(result.foreshadowing);
        await storage.setItem(`volumePlan_foreshadowing_${currentProject.id}`, JSON.stringify(result.foreshadowing));
      }

      messageApi.success('分卷规划已优化');
      setRefineVolumeDialogVisible(false);
      setRefineVolumeFeedback('');
      setVolumeStatus({ loading: false, msg: '已优化' });
    } catch (e) {
      console.error('handleRefineVolumePlan error:', e);
      if (e.name !== 'AbortError') {
        messageApi.error(`优化失败: ${e.message || '未知错误'}`);
      }
      setVolumeStatus({ loading: false, msg: '优化失败' });
    } finally {
      setRefineVolumeLoading(false);
      abortControllerRef.current = null;
    }
  };


  // --- Logic : Scene Gen & Progress ---
  const saveProgress = (volumeId, progress) => {
    if (!currentProject) return;
    localStorage.setItem(`chapter_gen_progress_${currentProject.id}_${volumeId}`, JSON.stringify(progress));
  };
  const loadProgress = (volumeId) => {
    if (!currentProject) return null;
    const saved = localStorage.getItem(`chapter_gen_progress_${currentProject.id}_${volumeId}`);
    return saved ? JSON.parse(saved) : null;
  };
  const clearProgress = (volumeId) => {
    if (!currentProject) return;
    localStorage.removeItem(`chapter_gen_progress_${currentProject.id}_${volumeId}`);
  };

  const generateScenesWithRetry = async (context, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const text = await planner.generateChapterScenes(context);
        let clean = typeof text === 'string' ? text : JSON.stringify(text);
        if (clean.includes('```')) clean = clean.replace(/```json\n?|```\n?|```/g, '');

        let scenesObj = { scenes: [] };
        try {
          scenesObj = JSON.parse(clean);
          if (!Array.isArray(scenesObj.scenes)) scenesObj.scenes = [];
        } catch {
          scenesObj = { scenes: [] };
        }

        if (scenesObj.scenes && scenesObj.scenes.length > 0) return scenesObj;

        if (attempt < maxRetries) {
          console.warn(`Scenes empty, retry ${attempt}/${maxRetries}`);
          setVolumePlanStatus(prev => ({ ...prev, [context.volumeId]: `场景为空，重试中 (${attempt}/${maxRetries})...` }));
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Scene Gen Failed (${attempt}/${maxRetries}):`, error);
        if (attempt === maxRetries) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    throw new Error('Scene generation failed: Empty scenes after retries');
  };

  const handleResumeGeneration = async () => {
    if (!generationProgress) return;
    const { volumeId } = generationProgress;
    const v = volumes.find(vol => vol.id === volumeId);
    if (v) {
      messageApi.info('正在恢复章节生成任务...');
      setGenerationProgress(null); // 清除恢复卡片显示
      await handlePlanNextChapterVolume(volumeId, { totalChaptersInVolume: generationProgress.totalChapters });
    }
  };

  // 重新解析用户编辑后的 JSON
  const handleRetryParse = async () => {
    if (!parseErrorContext) return;

    // Handle Core Outline retry
    if (parseErrorContext.type === 'core_outline') {
      try {
        const cleaned = cleanJSON(rawResponseForEdit);
        const parsed = JSON.parse(cleaned);
        setOutlineJSON(parsed);
        setCoreOutline(JSON.stringify(parsed, null, 2));
        await storageEx.saveCoreOutline(currentProject.id, JSON.stringify(parsed, null, 2));

        setParseErrorVisible(false);
        setParseErrorContext(null);
        setRawResponseForEdit('');
        messageApi.success('核心大纲已修复并保存');
      } catch (e) {
        messageApi.error('JSON 格式仍有错误，请检查后重试');
      }
      return;
    }

    // Handle Chapter Node retry
    const { volumeId, chapterOrder, outline, title, passionLevel } = parseErrorContext;

    try {
      const scenesObj = JSON.parse(rawResponseForEdit);
      if (outline) {
        scenesObj.chapterTitle = outline.title;
        scenesObj.oneSentence = outline.oneSentence || '';
        scenesObj.summary = outline.summary || '';
        scenesObj.mainConflict = outline.mainConflict;
      }

      // 创建章节节点
      await storageEx.addChapterNode(currentProject.id, volumeId, {
        order: chapterOrder,
        title,
        passionLevel,
        summary: JSON.stringify(scenesObj)
      });

      // 刷新数据
      const updated = await storageEx.getChapterNodesByVolume(volumeId);
      setChapterNodesMap(prev => ({ ...prev, [volumeId]: updated.sort((a, b) => a.order - b.order) }));
      if (selectedVolumeId === volumeId) setChapterNodes(updated.sort((a, b) => a.order - b.order));

      // 关闭编辑器并继续任务
      setParseErrorVisible(false);
      setParseErrorContext(null);
      setRawResponseForEdit('');
      messageApi.success(`第 ${chapterOrder} 章已保存，正在继续生成...`);

      // 继续生成剩余章节
      const progress = loadProgress(volumeId);
      if (progress) {
        await handlePlanNextChapterVolume(volumeId, { totalChaptersInVolume: progress.totalChapters });
      }
    } catch (e) {
      messageApi.error('JSON 格式仍有错误，请检查后重试');
    }
  };

  // 跳过解析失败的章节
  const handleSkipParseError = () => {
    if (!parseErrorContext) return;

    if (parseErrorContext.type === 'core_outline') {
      setParseErrorVisible(false);
      setParseErrorContext(null);
      setRawResponseForEdit('');
      messageApi.warning('已跳过核心大纲解析，请手动检查生成内容');
      return;
    }

    const { volumeId, chapterOrder } = parseErrorContext;

    setParseErrorVisible(false);
    setParseErrorContext(null);
    setRawResponseForEdit('');
    setVolumePlanStatus(prev => { const n = { ...prev }; delete n[volumeId]; return n; });
    messageApi.info(`已跳过第 ${chapterOrder} 章`);

    // 继续生成剩余章节
    const progress = loadProgress(volumeId);
    if (progress) {
      handlePlanNextChapterVolume(volumeId, { totalChaptersInVolume: progress.totalChapters });
    }
  };

  // --- Logic: Volumes ---
  const handleGenerateVolumes = async () => {
    if (!outlineJSON && !coreOutline) {
      messageApi.error('核心大纲缺失，无法生成分卷');
      return;
    }
    try {
      setVolumeStatus({ loading: true, msg: '正在规划分卷...' });
      setGenVolumeVisible(false);

      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      const volumeConfigs = [];
      for (let i = 0; i < genVolumeCount; i++) {
        volumeConfigs.push({ requirements: volumeRequirements[i] || '' });
      }

      const coordinator = new AgentCoordinator();
      await coordinator.createVolumePlanFlow(currentProject.id, genVolumeCount, volumeConfigs, { signal: abortControllerRef.current.signal });

      await refreshVolumes();
      setVolumeStatus({ loading: false, msg: '已生成' });
    } catch (e) {
      setVolumeStatus({ loading: false, msg: '生成失败' });
    } finally { abortControllerRef.current = null; }
  };

  const handleUpdateVolumeField = async (vid, field, value) => {
    const v = volumes.find(x => x.id === vid);
    if (!v) return;

    // Update local state immediately for responsiveness
    setVolumes(prev => prev.map(vol => vol.id === vid ? { ...vol, [field]: value } : vol));

    // Persist to storage
    try {
      await storage.updateItem('volumes', { ...v, [field]: value, updatedAt: new Date().toISOString() });
    } catch (err) {
      console.error('Failed to update volume:', err);
      messageApi.error('保存失败');
    }
  };

  const calculatePreviewChapters = (total, vid) => {
    if (!vid) return;
    const v = volumes.find(vol => vol.id === vid);
    if (!v) return;

    let startChapter = v.startChapter;
    if (!startChapter) {
      if (v.order === 1) startChapter = 1;
      else {
        const prevVol = volumes.find(vol => vol.order === v.order - 1);
        if (prevVol && prevVol.endChapter) startChapter = prevVol.endChapter + 1;
        else startChapter = 1; // Fallback
      }
    }
    const endChapter = startChapter + total - 1;
    const existingOrders = new Set((chapterNodesMap[vid] || []).map(n => n.order));
    const toGenerate = [];
    for (let order = startChapter; order <= endChapter; order++) {
      if (!existingOrders.has(order)) toGenerate.push(order);
    }
    setPreviewChapters(toGenerate);
    // Init passion logic (simplified)
    setChapterPassionLevels(prev => {
      const next = { ...prev };
      toGenerate.forEach(o => { if (next[o] === undefined) next[o] = Math.random() < 0.7 ? 1 : 2; });
      return next;
    });
  };

  const applyFluctuationProfile = (vid, profileValue, totalChapters, volumeConfigs = null) => {
    const v = volumes.find(vol => vol.id === vid);
    if (!v) return;

    // 使用传入的配置或当前批量配置状态
    const configs = volumeConfigs || batchVolumeConfigs;

    let startChapter = v.startChapter;
    if (!startChapter) {
      if (v.order === 1) startChapter = 1;
      else {
        const prevVol = volumes.find(vol => vol.order === v.order - 1);
        if (prevVol && prevVol.endChapter) startChapter = prevVol.endChapter + 1;
        else {
          const prevNodes = chapterNodesMap[volumes.find(vol => vol.order === v.order - 1)?.id] || [];
          if (prevNodes.length > 0) startChapter = Math.max(...prevNodes.map(n => n.order)) + 1;
          else {
            // 基于批量配置累加计算，而非固定值
            startChapter = 1;
            for (let i = 1; i < v.order; i++) {
              const vol = volumes.find(vol => vol.order === i);
              if (vol) {
                startChapter += configs[vol.id]?.totalChapters || 5;
              }
            }
          }
        }
      }
    }
    const endChapter = startChapter + totalChapters - 1;

    const levels = {};
    const range = [];
    for (let c = startChapter; c <= endChapter; c++) range.push(c);

    range.forEach((c, idx) => {
      let level = 1;
      const progress = idx / range.length;

      switch (profileValue) {
        case 'rising':
          if (progress < 0.2) level = 1;
          else if (progress < 0.4) level = 2;
          else if (progress < 0.6) level = 3;
          else if (progress < 0.8) level = 4;
          else level = 5;
          if (Math.random() > 0.8) level = Math.max(1, Math.min(5, level + (Math.random() > 0.5 ? 1 : -1)));
          break;
        case 'intense':
          const rI = Math.random();
          level = rI < 0.2 ? 3 : rI < 0.6 ? 4 : 5;
          break;
        case 'flat':
          level = 1; // 全程平淡，所有章节都是等级1
          break;
        case 'smooth':
          const rS = Math.random();
          level = rS < 0.6 ? 1 : rS < 0.9 ? 2 : 3;
          break;
        case 'random':
        default:
          const r = Math.random();
          level = r < 0.7 ? 1 : r < 0.9 ? 2 : 3;
          if (idx > 2 && idx < range.length - 2 && level < 4 && Math.random() > 0.9) level = 4;
          break;
      }
      levels[c] = level;
    });

    setChapterPassionLevels(prev => ({ ...prev, ...levels }));
  };

  const handleInterruptChapterGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      messageApi.info('正在中断批量生成任务...');
    }
  };

  const handleBatchGenerateChapters = async (vids, explicitConfigs = null) => {
    if (!vids || vids.length === 0) return;

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      for (let i = 0; i < vids.length; i++) {
        const vid = vids[i];
        const v = volumes.find(x => x.id === vid);
        if (!v) continue;

        // 更新全局状态，显示总进度
        const batchProgressPrefix = vids.length > 1 ? `[全部分卷 ${i + 1}/${vids.length}] ` : '';
        const specificTotal = (explicitConfigs && explicitConfigs[vid]?.totalChapters) || batchVolumeConfigs[vid]?.totalChapters || totalChaptersInVolume;

        // 我们需要传递 signal 到 handlePlanNextChapterVolume
        await handlePlanNextChapterVolume(vid, {
          totalChaptersInVolume: specificTotal,
          signal,
          batchProgressPrefix
        });

        if (signal.aborted) break;
      }
      if (!signal.aborted) messageApi.success('批量生成任务已完成');
    } catch (e) {
      if (e.name === 'AbortError') {
        messageApi.info('生成任务已中断');
      } else {
        console.error('Batch gen failed', e);
        messageApi.error('批量生成过程中出现错误');
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handlePlanNextChapterVolume = async (vid, cfg = {}) => {
    const v = volumes.find(x => x.id === vid);
    if (!v) return;

    const chars = await storage.getItemsByProject('characters', currentProject.id);
    const totalChaptersInVolume = Number(cfg.totalChaptersInVolume) > 0 ? Number(cfg.totalChaptersInVolume) : 20;
    const signal = cfg.signal; // 外部传入的 signal
    const batchPrefix = cfg.batchProgressPrefix || '';

    let startChapter = 1;
    if (v.order > 1) {
      // 直接从数据库获取最新数据，避免 React 状态延迟导致批量生成时读取到旧值
      const latestVolumes = await storageEx.getVolumes(currentProject.id);
      const prevVol = latestVolumes.find(vol => vol.order === v.order - 1);
      if (prevVol && prevVol.endChapter) startChapter = prevVol.endChapter + 1;
      else {
        // Fallback: 从章节数据推断
        const prevNodes = await storageEx.getChapterNodesByVolume(prevVol?.id);
        if (prevNodes?.length > 0) startChapter = Math.max(...prevNodes.map(n => n.order)) + 1;
      }
    }
    const endChapter = startChapter + totalChaptersInVolume - 1;

    await storage.updateItem('volumes', { ...v, startChapter, endChapter, updatedAt: new Date().toISOString() });
    await refreshVolumes();

    const nodes = await storageEx.getChapterNodesByVolume(vid);
    const existingOrders = new Set(nodes.map(n => n.order));
    const ordersToGenerate = [];
    for (let order = startChapter; order <= endChapter; order++) {
      if (!existingOrders.has(order)) ordersToGenerate.push(order);
    }

    if (ordersToGenerate.length === 0) {
      if (!batchPrefix) messageApi.info(`本卷已有 ${nodes.length} 章，达到或超过计划的 ${totalChaptersInVolume} 章`);
      return;
    }

    // Progress Init
    const progress = {
      volumeId: vid, totalChapters: ordersToGenerate.length,
      completedChapters: 0, currentOrder: ordersToGenerate[0], startTime: Date.now()
    };
    saveProgress(vid, progress);

    // 如果不是批量模式（没有传入 signal），则自己创建一个
    let internalController = null;
    if (!signal) {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
      internalController = abortControllerRef.current;
    }
    const activeSignal = signal || internalController.signal;
    const generatedNodeIds = [];

    let generatedCount = 0;
    for (const nextOrder of ordersToGenerate) {
      if (activeSignal.aborted) break;
      generatedCount++;
      const statusText = `${batchPrefix}正在规划第 ${nextOrder} 章 (${generatedCount}/${ordersToGenerate.length})...`;
      setVolumePlanStatus(prev => ({ ...prev, [vid]: statusText }));

      // 更新全局状态，让用户在任何页面都能看到进度
      updateGenerationStatus({
        volumeName: v.name,
        currentChapter: generatedCount,
        totalChapters: ordersToGenerate.length,
        statusText,
        volumeId: vid
      });

      const safeCoreOutline = coreOutline?.length > 10 ? coreOutline : (v.description || '无详细大纲');

      // Context building
      let previousChaptersSummary = '';
      if (nextOrder > 1) {
        try {
          const allNodes = await storageEx.getItems('chapter_nodes', { projectId: currentProject.id });
          const recentOrders = [nextOrder - 3, nextOrder - 2, nextOrder - 1].filter(o => o > 0);
          previousChaptersSummary = recentOrders.map(o => {
            const n = allNodes.find(x => x.order === o);
            if (!n) return null;
            let sum = n.summary;
            try { const s = JSON.parse(n.summary); sum = s.oneSentence || s.summary || n.summary; } catch { }
            return `Chapter ${o}: ${sum}`;
          }).filter(Boolean).join('\n');
        } catch { }
      }

      let nextChapterSummary = '';
      try {
        const allNodes = await storageEx.getItems('chapter_nodes', { projectId: currentProject.id });
        const nextNode = allNodes.find(n => n.order === nextOrder + 1);
        if (nextNode) {
          try { const s = JSON.parse(nextNode.summary); nextChapterSummary = s.oneSentence || s.summary || nextNode.summary; } catch { nextChapterSummary = nextNode.summary; }
        }
      } catch { }

      const isLastChapterOfVolume = nextOrder === endChapter;
      const passionLevel = chapterPassionLevels[nextOrder] || 1;
      const passionDefinitions = await getPassionDefinitions();

      try {
        const outlinesData = await planner.generateVolumeChapterOutlines({
          volumeTitle: v.name, volumeDesc: v.description,
          mainGoal: v.mainGoal || '',
          keyEvents: v.keyEvents || [],
          cliffhanger: v.cliffhanger || '',
          volumeOrder: v.order || 1,
          subplots,
          foreshadowing,
          startChapter: nextOrder, count: 1,
          coreOutline: safeCoreOutline,
          previousChaptersSummary, nextChapterSummary,
          characters: chars,
          currentChapterCount: nodes.length + generatedCount - 1,
          totalChaptersInVolume, isLastChapterOfVolume,
          passionLevel, passionDefinitions,
          projectId: currentProject.id,
          signal: activeSignal
        });

        const outline = outlinesData.chapters?.[0];
        const title = outline ? outline.title : `第${nextOrder}章`;

        const constraintsRows = await storageEx.getItems('constraints', { projectId: currentProject.id });
        const constraintsText = constraintsRows.map(x => x.content).join('\n');

        const text = await generateScenesWithRetry({
          volumeTheme: v.description || v.name || '',
          chapterOrder: nextOrder,
          constraints: constraintsText,
          characters: chars,
          desiredCount: 0,
          chapterSummary: outline ? outline.summary : '',
          coreOutline: safeCoreOutline,
          isLastChapterOfVolume, totalChaptersInVolume,
          nextChapterSummary, passionLevel, passionDefinitions,
          projectId: currentProject.id,
          volumeId: vid,
          signal: activeSignal
        });

        // 尝试解析 JSON
        let scenesObj;
        const rawText = typeof text === 'string' ? (text.includes('```') ? text.replace(/```json\n?|```\n?|```/g, '') : text) : JSON.stringify(text);
        try {
          scenesObj = JSON.parse(rawText);
        } catch (parseError) {
          // 解析失败：保存上下文并显示编辑器
          setRawResponseForEdit(rawText);
          setParseErrorContext({ volumeId: vid, chapterOrder: nextOrder, outline, title, passionLevel });
          setParseErrorVisible(true);
          setVolumePlanStatus(prev => ({ ...prev, [vid]: `第 ${nextOrder} 章解析失败，等待手动修复...` }));
          // 保存进度以便恢复
          saveProgress(vid, progress);
          return; // 暂停任务，等待用户操作
        }

        if (outline) {
          scenesObj.chapterTitle = outline.title;
          scenesObj.oneSentence = outline.oneSentence || '';
          scenesObj.summary = outline.summary || '';
          scenesObj.mainConflict = outline.mainConflict;
        }

        // 延迟节点创建：只有在 AI 响应成功且解析完成后才创建节点，避免空节点残留
        const node = await storageEx.addChapterNode(currentProject.id, vid, {
          order: nextOrder,
          title,
          passionLevel,
          summary: JSON.stringify(scenesObj)
        });
        generatedNodeIds.push(node.id);

        const updated = await storageEx.getChapterNodesByVolume(vid);
        setChapterNodesMap(prev => ({ ...prev, [vid]: updated.sort((a, b) => a.order - b.order) }));
        if (selectedVolumeId === vid) setChapterNodes(updated.sort((a, b) => a.order - b.order));

      } catch (e) {
        if (e.name === 'AbortError') break;
        // API 超时或其他网络错误也暂停任务
        if (e.message?.includes('timeout') || e.message?.includes('network') || e.code === 'ECONNABORTED') {
          setVolumePlanStatus(prev => ({ ...prev, [vid]: `第 ${nextOrder} 章生成超时，请稍后重试` }));
          saveProgress(vid, progress);
          messageApi.error('API 请求超时，任务已暂停');
          return; // 暂停任务
        }
        console.error(e);
        setVolumePlanStatus(prev => ({ ...prev, [vid]: `错误：生成第 ${nextOrder} 章失败` }));
      }

      progress.completedChapters = generatedCount;
      if (generatedCount < ordersToGenerate.length) {
        progress.currentOrder = ordersToGenerate[generatedCount];
        saveProgress(vid, progress);
      } else {
        clearProgress(vid);
      }
    }

    // Manual Cancel Cleanup
    if (activeSignal.aborted) {
      clearProgress(vid);
      if (generatedNodeIds.length > 0) {
        if (window.confirm(`检测到任务已取消。本次已生成 ${generatedNodeIds.length} 个章节，是否删除？`)) {
          for (const nodeId of generatedNodeIds) {
            await storage.deleteItem('chapter_nodes', nodeId);
          }
          const updated = await storageEx.getChapterNodesByVolume(vid);
          setChapterNodesMap(prev => ({ ...prev, [vid]: updated.sort((a, b) => a.order - b.order) }));
          if (selectedVolumeId === vid) setChapterNodes(updated.sort((a, b) => a.order - b.order));
          messageApi.success('已清理未完成的章节');
        }
      }
    }

    setVolumePlanStatus(prev => { const n = { ...prev }; delete n[vid]; return n; });
    clearGenerationStatus(); // 清除全局进度指示器
    clearGenerationStatus(); // 清除全局进度指示器
    if (!signal) abortControllerRef.current = null;
  };

  const handleImportVolumeConfirm = async () => {
    if (!importVolumeJson.trim()) return;

    try {
      let data;
      try {
        let jsonStr = importVolumeJson;
        // Simple cleanup for potential markdown
        if (jsonStr.includes('```')) {
          jsonStr = jsonStr.replace(/```json\n?|```\n?|```/g, '');
        }
        data = JSON.parse(jsonStr);
      } catch (e) {
        throw new Error('JSON 格式错误: ' + e.message);
      }

      if (!data.volumes || !Array.isArray(data.volumes)) {
        throw new Error('无效的格式：缺少 volumes 数组');
      }

      setVolumeStatus({ loading: true, msg: '正在导入分卷...' });

      // 1. Clear existing volumes
      for (const v of volumes) {
        await storage.deleteItem('volumes', v.id);
      }

      // 2. Create new volumes
      const newVolumes = [];
      for (const vData of data.volumes) {
        // Sanitize: Map fields and remove unknown columns to avoid SQL error
        // Mappings: title->name, summary->description, goal->mainGoal, events->keyEvents
        const { title, name, summary, description, goal, mainGoal, events, keyEvents, ...rest } = vData;

        const finalName = name || title || `第${vData.order || newVolumes.length + 1}卷`;
        const finalDesc = description || summary || '';
        const finalGoal = mainGoal || goal || '';
        const finalEvents = keyEvents || events || [];

        // Whitelist allowed fields to prevent SQL errors (ignore extra fields like emotionalTone)
        const allowedRest = {
          order: rest.order,
          startChapter: rest.startChapter,
          endChapter: rest.endChapter,
          cliffhanger: rest.cliffhanger
        };

        const newVol = {
          ...allowedRest,
          name: finalName,
          description: finalDesc,
          mainGoal: finalGoal,
          keyEvents: finalEvents,
          id: uuidv4(),
          projectId: currentProject.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await storage.addItem('volumes', newVol);
        newVolumes.push(newVol);
      }

      // 3. Update Subplots & Foreshadowing
      if (data.subplots && Array.isArray(data.subplots)) {
        setSubplots(data.subplots);
        await storage.setItem(`volumePlan_subplots_${currentProject.id}`, JSON.stringify(data.subplots));
      }

      if (data.foreshadowing && Array.isArray(data.foreshadowing)) {
        setForeshadowing(data.foreshadowing);
        await storage.setItem(`volumePlan_foreshadowing_${currentProject.id}`, JSON.stringify(data.foreshadowing));
      }

      // Refresh state
      setVolumes(newVolumes.sort((a, b) => a.order - b.order));
      setImportVolumeModalVisible(false);
      setImportVolumeJson('');
      messageApi.success('分卷规划导入成功');

    } catch (err) {
      console.error('Import volume failed:', err);
      messageApi.error('导入失败: ' + err.message);
    } finally {
      setVolumeStatus({ loading: false, msg: '' });
    }
  };

  const handleVolumeFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImportVolumeJson(ev.target.result);
    reader.readAsText(file);
  };

  // parseScenes is now defined at module scope for memoization

  // Memoized callback for toggling chapter expansion - avoids recreating function on each render
  const handleToggleChapterExpand = useCallback((chapterId) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  }, []);

  const stringifyScenes = (scenes) => JSON.stringify({ scenes });

  const deleteScene = async (chapter, idx) => {
    const scenes = parseScenes(chapter.summary || '');
    const next = scenes.filter((_, i) => i !== idx);
    // Need to preserve other fields in summary json
    let parsed = {};
    try { parsed = JSON.parse(chapter.summary || '{}'); } catch { }
    parsed.scenes = next;

    await storage.updateItem('chapter_nodes', { ...chapter, summary: JSON.stringify(parsed), updatedAt: new Date().toISOString() });
    await refreshChapters(chapter.volumeId);
  };

  const regenerateScenes = async (chapter, rewritePrompt = '') => {
    const vol = volumes.find(v => v.id === chapter.volumeId);
    const constraintsRows = await storageEx.getItems('constraints', { projectId: currentProject.id });
    const constraintsText = constraintsRows.map(x => x.content).join('\n');
    const chars = await storage.getItemsByProject('characters', currentProject.id); // Load chars

    setSceneGenStatus(prev => ({ ...prev, [chapter.id]: 'generating' }));

    // Re-build context (simplified here compared to full implementation but functional)
    let safeCoreOutline = coreOutline?.length > 10 ? coreOutline : '';
    const passionDefinitions = await getPassionDefinitions();
    const passionLevel = chapter.passionLevel || 1;

    try {
      const planner = new PlannerAgent();
      // Step 1: Summary Refine
      const outlinesData = await planner.generateVolumeChapterOutlines({
        volumeTitle: vol?.name, volumeDesc: vol?.description,
        mainGoal: vol?.mainGoal || '',
        keyEvents: vol?.keyEvents || [],
        cliffhanger: vol?.cliffhanger || '',
        volumeOrder: vol?.order || 1,
        subplots,
        foreshadowing,
        startChapter: chapter.order, count: 1,
        coreOutline: safeCoreOutline,
        characters: chars,
        passionLevel, passionDefinitions, projectId: currentProject.id
      });
      const outline = outlinesData.chapters?.[0];

      // Step 2: Scenes
      const text = await generateScenesWithRetry({
        volumeTheme: vol?.description || vol?.name,
        chapterOrder: chapter.order,
        constraints: constraintsText,
        characters: chars, // Pass characters
        rewritePrompt,
        chapterSummary: outline?.summary,
        coreOutline: safeCoreOutline,
        passionLevel, passionDefinitions, projectId: currentProject.id
      });

      let scenesObj = JSON.parse(typeof text === 'string' ? (text.includes('```') ? text.replace(/```json\n?|```\n?|```/g, '') : text) : JSON.stringify(text));
      if (!Array.isArray(scenesObj.scenes)) scenesObj.scenes = [];
      if (outline) {
        scenesObj.chapterTitle = outline.title;
        scenesObj.oneSentence = outline.oneSentence;
        scenesObj.summary = outline.summary;
        scenesObj.mainConflict = outline.mainConflict;
      }

      await storage.updateItem('chapter_nodes', { ...chapter, summary: JSON.stringify(scenesObj), updatedAt: new Date().toISOString() });
      await refreshChapters(chapter.volumeId);
      setSceneGenStatus(prev => { const n = { ...prev }; delete n[chapter.id]; return n; });
      messageApi.success('场景已重新生成');
    } catch (e) {
      console.error(e);
      setSceneGenStatus(prev => { const n = { ...prev }; delete n[chapter.id]; return n; });
      messageApi.error('生成失败');
    }
  };

  const handleDeleteChapter = async (node) => {
    // Optimistic
    setChapterNodesMap(prev => ({ ...prev, [node.volumeId]: (prev[node.volumeId] || []).filter(n => n.id !== node.id) }));
    if (selectedVolumeId === node.volumeId) setChapterNodes(prev => prev.filter(n => n.id !== node.id));

    try {
      await storage.deleteItem('chapter_nodes', node.id);
      messageApi.success('已删除');
    } catch {
      await refreshChapters(node.volumeId);
    }
  };

  const toggleSelectChapter = (vid, cid, checked) => {
    setSelectedChapterIdsByVolume(prev => {
      const set = new Set(prev[vid] || []);
      if (checked) set.add(cid); else set.delete(cid);
      return { ...prev, [vid]: set };
    });
  };
  const handleSelectAllChapters = (vid) => {
    setSelectedChapterIdsByVolume(prev => {
      const nodes = chapterNodesMap[vid] || [];
      const ids = new Set(nodes.map(n => n.id));
      return { ...prev, [vid]: ids };
    });
  };
  const handleInvertSelectChapters = (vid) => {
    setSelectedChapterIdsByVolume(prev => {
      const current = prev[vid] || new Set();
      const nodes = chapterNodesMap[vid] || [];
      const next = new Set();
      nodes.forEach(n => {
        if (!current.has(n.id)) next.add(n.id);
      });
      return { ...prev, [vid]: next };
    });
  };

  const handleBatchDeleteChapters = async (vid) => {
    const sel = selectedChapterIdsByVolume[vid] || new Set();
    if (sel.size === 0) return;
    if (!window.confirm(`确定要删除选中的 ${sel.size} 个章节吗？`)) return;
    setChapterBatchStatusByVolume(prev => ({ ...prev, [vid]: 'Deleting...' }));
    for (const id of Array.from(sel)) {
      await storage.deleteItem('chapter_nodes', id);
    }
    await refreshChapters(vid);
    setSelectedChapterIdsByVolume(prev => ({ ...prev, [vid]: new Set() }));
    setChapterBatchStatusByVolume(prev => ({ ...prev, [vid]: '' }));
    messageApi.success('已批量删除章节');
  };

  const toggleSelectVolume = (vid, checked) => {
    setSelectedVolumeIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(vid); else next.delete(vid);
      return next;
    });
  };
  const handleSelectAllVolumes = () => {
    setSelectedVolumeIds(new Set(volumes.map(v => v.id)));
  };
  const handleInvertSelectVolumes = () => {
    setSelectedVolumeIds(prev => {
      const next = new Set();
      volumes.forEach(v => {
        if (!prev.has(v.id)) next.add(v.id);
      });
      return next;
    });
  };
  const handleDeleteSelectedVolumes = () => {
    if (selectedVolumeIds.size === 0) return;
    setDeleteVolumeConfirm({ visible: true, type: 'batch', data: selectedVolumeIds.size });
  };

  const handleDoDeleteSelectedVolumes = async () => {
    setDeleteVolumeConfirm({ ...deleteVolumeConfirm, visible: false });
    setVolumeStatus({ loading: true, msg: '正在批量删除分卷...' });
    try {
      for (const vid of Array.from(selectedVolumeIds)) {
        // Delete chapters first
        const chaptersToDelete = await storageEx.getChapterNodesByVolume(vid);
        for (const chapter of chaptersToDelete) {
          await storage.deleteItem('chapter_nodes', chapter.id);
        }
        await storage.deleteItem('volumes', vid);
      }
      await refreshVolumes();
      setSelectedVolumeIds(new Set());
      messageApi.success('已批量删除分卷');
    } catch (err) {
      console.error('Batch delete failed:', err);
      messageApi.error('批量删除失败');
    } finally {
      setVolumeStatus({ loading: false, msg: '' });
    }
  };

  const handleDeleteVolume = (v) => {
    setDeleteVolumeConfirm({ visible: true, type: 'single', data: v });
  };

  const handleDoDeleteVolume = async () => {
    const v = deleteVolumeConfirm.data;
    if (!v) return;
    setDeleteVolumeConfirm({ ...deleteVolumeConfirm, visible: false });
    try {
      const chaptersToDelete = await storageEx.getChapterNodesByVolume(v.id);
      for (const chapter of chaptersToDelete) {
        await storage.deleteItem('chapter_nodes', chapter.id);
      }
      await storage.deleteItem('volumes', v.id);
      if (selectedVolumeId === v.id) {
        setSelectedVolumeId(null);
        setChapterNodes([]);
      }
      await refreshVolumes();
      messageApi.success('分卷及其所属章节已删除');
    } catch (err) {
      console.error('Delete volume failed:', err);
      messageApi.error('删除失败');
    }
  };


  const handleRegenerateVolume = async () => {
    if (!regenTargetVolume) return;
    try {
      setVolumeStatus({ loading: true, msg: '正在重新生成分卷...' });
      setRegenVolumeVisible(false);
      const coordinator = new AgentCoordinator();
      await coordinator.regenerateVolumeFlow(currentProject.id, regenTargetVolume.id, regenVolumeGuidance);

      await refreshVolumes();
      messageApi.success('分卷已重新生成');
      setRegenTargetVolume(null);
      setRegenVolumeGuidance('');
      setVolumeStatus({ loading: false, msg: '' });
    } catch (e) {
      console.error(e);
      messageApi.error('重生成失败');
      setVolumeStatus({ loading: false, msg: '' });
    }
  };


  const handleUpdateChapterSummaryJSON = async (chapter, field, value) => {
    try {
      let parsed = {};
      try { parsed = JSON.parse(chapter.summary || '{}'); } catch { }
      parsed[field] = value;
      await storage.updateItem('chapter_nodes', {
        ...chapter,
        summary: JSON.stringify(parsed),
        updatedAt: new Date().toISOString()
      });
      await refreshChapters(chapter.volumeId);
    } catch (err) {
      console.error('Failed to update chapter field:', err);
      messageApi.error('更新失败');
    }
  };

  const handleUpdateChapterScene = async (chapter, sceneIndex, field, value) => {
    try {
      let parsed = {};
      try { parsed = JSON.parse(chapter.summary || '{}'); } catch { }
      const scenes = [...(parsed.scenes || [])];

      if (scenes[sceneIndex]) {
        let finalValue = value;
        // Special handling for characters if they are coming from a comma-separated string
        if (field === 'characters' && typeof value === 'string') {
          finalValue = value.split(/[、,，\s]+/).filter(Boolean);
        }
        scenes[sceneIndex] = { ...scenes[sceneIndex], [field]: finalValue };
      }

      parsed.scenes = scenes;
      await storage.updateItem('chapter_nodes', {
        ...chapter,
        summary: JSON.stringify(parsed),
        updatedAt: new Date().toISOString()
      });
      await refreshChapters(chapter.volumeId);
    } catch (err) {
      console.error('Failed to update scene field:', err);
      messageApi.error('更新失败');
    }
  };

  // --- Render Components ---
  const renderStructuredOutline = () => {
    if (!outlineJSON) return <Typography color="text.secondary">暂无结构化大纲</Typography>;
    const { title, logline, theme: storyTheme, coreConflict, tone, pacing, targetAudience: audienceRaw, tags: tagsRaw, worldSetting, ending } = outlineJSON;
    const audience = Array.isArray(audienceRaw) ? audienceRaw.join(', ') : audienceRaw;
    const tags = Array.isArray(tagsRaw) ? tagsRaw : [];

    const isEditing = editingModule === 'all';

    // Note: This matches the "Structure" editing mode
    if (isEditing) {
      // Render large edit form here? 
      // For simplicity, we are using the Modal `editStructureVisible` for editing.
      // So this view is primarily read-only.
      // We will stick to the modal for editing to avoid cluttering this view.
      return null; // Should check usage below
    }

    return (
      <Stack spacing={8}>
        <Box>
          <Card variant="outlined" sx={{
            p: 6,
            borderRadius: 4,
            bgcolor: 'transparent',
            transition: 'all 0.2s',
            '&:hover': { bgcolor: 'background.paper', borderColor: 'primary.main' }
          }}>
            <Box sx={{ mb: 6, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Typography variant="h2" color="primary" sx={{ opacity: 1, fontWeight: 900, lineHeight: 0.8 }}>01</Typography>
              <Box>
                <Typography variant="h5" color="text.primary" fontWeight="bold" sx={{ display: 'block', mb: 0.5 }}>基本信息</Typography>
                <Typography variant="body2" color="text.secondary">定义故事的官方命名及摘要。</Typography>
              </Box>
            </Box>
            <Divider sx={{ mb: 4, opacity: 0.5 }} />
            <Stack spacing={4}>
              <DebouncedTextField
                fullWidth
                multiline
                label="标题"
                variant="outlined"
                value={outlineJSON.title || ''}
                onChange={(e) => handleUpdateOutlineField('title', e.target.value)}
                placeholder="项目标题"
                InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                debounceMs={300}
              />
              <DebouncedTextField
                fullWidth
                multiline
                label="一句话摘要"
                variant="outlined"
                value={outlineJSON.logline || outlineJSON.oneSentence || ''}
                onChange={(e) => handleUpdateOutlineField('logline', e.target.value)}
                placeholder="用一句话概括故事核心"
                InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                debounceMs={300}
              />
              <DebouncedTextField
                fullWidth
                label="核心主题"
                variant="outlined"
                value={outlineJSON.primaryTheme || outlineJSON.theme || ''}
                onChange={(e) => handleUpdateOutlineField('primaryTheme', e.target.value)}
                placeholder="故事要探讨的核心命题"
                InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                debounceMs={300}
              />
              {(outlineJSON.secondaryThemes && outlineJSON.secondaryThemes.length > 0) && (
                <Autocomplete
                  multiple
                  freeSolo
                  options={[]}
                  value={outlineJSON.secondaryThemes || []}
                  onChange={(e, newValue) => handleUpdateOutlineField('secondaryThemes', newValue)}
                  renderTags={(tagValue, getTagProps) =>
                    tagValue.map((option, index) => {
                      const { key, ...tagProps } = getTagProps({ index });
                      return (
                        <Chip
                          key={key}
                          label={option}
                          {...tagProps}
                          size="small"
                          variant="outlined"
                          color="primary"
                          sx={{ borderRadius: 1 }}
                        />
                      );
                    })
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="次要主题"
                      variant="outlined"
                      placeholder="输入并回车以添加"
                      InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                    />
                  )}
                />
              )}
              <Box>
                <DebouncedTextField
                  fullWidth
                  multiline
                  label="核心冲突"
                  variant="outlined"
                  value={outlineJSON.coreConflict || ''}
                  onChange={(e) => handleUpdateOutlineField('coreConflict', e.target.value)}
                  placeholder="描述驱动故事发展的核心矛盾"
                  InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                  debounceMs={300}
                />
              </Box>
            </Stack>
          </Card>
        </Box>

        <Box>
          <Card variant="outlined" sx={{
            p: 6,
            borderRadius: 4,
            bgcolor: 'transparent',
            transition: 'all 0.2s',
            '&:hover': { bgcolor: 'background.paper', borderColor: 'primary.main' }
          }}>
            <Box sx={{ mb: 6, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Typography variant="h2" color="primary" sx={{ opacity: 1, fontWeight: 900, lineHeight: 0.8 }}>02</Typography>
              <Box>
                <Typography variant="h5" color="text.primary" fontWeight="bold" sx={{ display: 'block', mb: 0.5 }}>文学属性</Typography>
                <Typography variant="body2" color="text.secondary">确立作品在市场与文学层面的感官定位与技术指标。</Typography>
              </Box>
            </Box>
            <Divider sx={{ mb: 4, opacity: 0.5 }} />
            <Stack spacing={4}>
              <DebouncedTextField
                fullWidth
                label="基调"
                variant="outlined"
                value={outlineJSON.tone || ''}
                onChange={(e) => handleUpdateOutlineField('tone', e.target.value)}
                placeholder="故事的整体情感色彩"
                InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                debounceMs={300}
              />
              <DebouncedTextField
                fullWidth
                label="节奏"
                variant="outlined"
                value={outlineJSON.pacing || ''}
                onChange={(e) => handleUpdateOutlineField('pacing', e.target.value)}
                placeholder="叙事推进的速度与张力调节"
                InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                debounceMs={300}
              />
              <DebouncedTextField
                fullWidth
                label="受众"
                variant="outlined"
                value={outlineJSON.targetAudience || ''}
                onChange={(e) => handleUpdateOutlineField('targetAudience', e.target.value)}
                placeholder="作品面向的核心读者群体"
                InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                debounceMs={300}
              />
              <Autocomplete
                multiple
                freeSolo
                options={[]}
                value={tags}
                onChange={(e, newValue) => handleUpdateOutlineField('tags', newValue)}
                renderTags={(tagValue, getTagProps) =>
                  tagValue.map((option, index) => {
                    const { key, ...tagProps } = getTagProps({ index });
                    return (
                      <Chip
                        key={key}
                        label={option}
                        {...tagProps}
                        size="small"
                        variant="outlined"
                        sx={{ borderRadius: 1, fontWeight: 'bold' }}
                      />
                    );
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="标签"
                    variant="outlined"
                    placeholder="输入并回车以添加新标签"
                    InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                  />
                )}
              />

              {/* 叙事策略 - 仅在有 narrativeStrategy 时显示 */}
              {outlineJSON.narrativeStrategy && (
                <Box sx={{ mt: 2, p: 3, bgcolor: 'action.hover', borderRadius: 2, border: '1px dashed', borderColor: 'divider' }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="text.primary" fontWeight="bold">叙事策略</Typography>
                    <Typography variant="caption" color="text.secondary">解构故事形态</Typography>
                  </Stack>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={2}>
                      <TextField
                        label="结构"
                        size="small"
                        fullWidth
                        value={outlineJSON.narrativeStrategy.structure || ''}
                        onChange={(e) => {
                          const newStrategy = { ...outlineJSON.narrativeStrategy, structure: e.target.value };
                          handleUpdateOutlineField('narrativeStrategy', newStrategy);
                        }}
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        label="视角"
                        size="small"
                        fullWidth
                        value={outlineJSON.narrativeStrategy.perspective || ''}
                        onChange={(e) => {
                          const newStrategy = { ...outlineJSON.narrativeStrategy, perspective: e.target.value };
                          handleUpdateOutlineField('narrativeStrategy', newStrategy);
                        }}
                        sx={{ flex: 1 }}
                      />
                    </Stack>
                    <TextField
                      label="表现形式"
                      size="small"
                      fullWidth
                      multiline
                      rows={2}
                      value={outlineJSON.narrativeStrategy.presentation || ''}
                      onChange={(e) => {
                        const newStrategy = { ...outlineJSON.narrativeStrategy, presentation: e.target.value };
                        handleUpdateOutlineField('narrativeStrategy', newStrategy);
                      }}
                      helperText="如：采用过去与现在交替叙事，两条线索在最终大高潮汇合"
                    />
                  </Stack>
                </Box>
              )}
            </Stack>
          </Card>
        </Box>

        <Box>
          <Card variant="outlined" sx={{
            p: 6,
            borderRadius: 4,
            bgcolor: 'transparent',
            transition: 'all 0.2s',
            '&:hover': { bgcolor: 'background.paper', borderColor: 'primary.main' }
          }}>
            <Box sx={{ mb: 6, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Typography variant="h2" color="primary" sx={{ opacity: 1, fontWeight: 900, lineHeight: 0.8 }}>03</Typography>
              <Box>
                <Typography variant="h5" color="text.primary" fontWeight="bold" sx={{ display: 'block', mb: 0.5 }}>世界观设定</Typography>
                <Typography variant="body2" color="text.secondary">架构故事的物理极限与道德准则，确立沉浸式的舞台背景。</Typography>
              </Box>
            </Box>
            <Divider sx={{ mb: 4, opacity: 0.5 }} />
            <Stack spacing={4}>
              {/* 兼容新旧结构：新结构使用 timePeriod/location，旧结构使用 description */}
              {outlineJSON.worldSetting?.timePeriod ? (
                <>
                  <Stack direction="row" spacing={2}>
                    <DebouncedTextField
                      fullWidth
                      label="时代背景"
                      variant="outlined"
                      value={outlineJSON.worldSetting?.timePeriod || ''}
                      onChange={(e) => handleUpdateOutlineField('worldSetting.timePeriod', e.target.value)}
                      placeholder="当代/架空/未来..."
                      InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                      debounceMs={300}
                    />
                    <DebouncedTextField
                      fullWidth
                      label="主要地点"
                      variant="outlined"
                      value={outlineJSON.worldSetting?.location || ''}
                      onChange={(e) => handleUpdateOutlineField('worldSetting.location', e.target.value)}
                      placeholder="北京/架空江湖/废土城市..."
                      InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                      debounceMs={300}
                    />
                  </Stack>
                  <Stack direction="row" spacing={2}>
                    <DebouncedTextField
                      fullWidth
                      label="社会结构"
                      variant="outlined"
                      value={outlineJSON.worldSetting?.socialStructure || ''}
                      onChange={(e) => handleUpdateOutlineField('worldSetting.socialStructure', e.target.value)}
                      placeholder="门阀世家/公司财阀/修仙宗门..."
                      InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                      debounceMs={300}
                    />
                    <DebouncedTextField
                      fullWidth
                      label="科技/力量体系"
                      variant="outlined"
                      value={outlineJSON.worldSetting?.technology || ''}
                      onChange={(e) => handleUpdateOutlineField('worldSetting.technology', e.target.value)}
                      placeholder="现实科技/灵气修炼/赛博义体..."
                      InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                      debounceMs={300}
                    />
                  </Stack>
                  {(outlineJSON.worldSetting?.supernaturalRules || outlineJSON.worldSetting?.keyRules) && (
                    <Stack direction="row" spacing={2}>
                      <DebouncedTextField
                        fullWidth
                        multiline
                        label="超自然规则"
                        variant="outlined"
                        value={outlineJSON.worldSetting?.supernaturalRules || ''}
                        onChange={(e) => handleUpdateOutlineField('worldSetting.supernaturalRules', e.target.value)}
                        placeholder="修炼境界/魔法体系..."
                        InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                        debounceMs={300}
                      />
                      <DebouncedTextField
                        fullWidth
                        multiline
                        label="核心规则/禁区"
                        variant="outlined"
                        value={outlineJSON.worldSetting?.keyRules || ''}
                        onChange={(e) => handleUpdateOutlineField('worldSetting.keyRules', e.target.value)}
                        placeholder="世界观的铁律与禁忌..."
                        InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                        debounceMs={300}
                      />
                    </Stack>
                  )}
                </>
              ) : (
                <>
                  <DebouncedTextField
                    fullWidth
                    multiline
                    label="背景描述"
                    variant="outlined"
                    value={outlineJSON.worldSetting?.description || outlineJSON.worldNotes || ''}
                    onChange={(e) => handleUpdateOutlineField('worldSetting.description', e.target.value)}
                    placeholder="构建世界观的基础设施与氛围"
                    InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                    debounceMs={300}
                  />
                  <DebouncedTextField
                    fullWidth
                    multiline
                    label="运作规则"
                    variant="outlined"
                    value={outlineJSON.worldSetting?.rules || ''}
                    onChange={(e) => handleUpdateOutlineField('worldSetting.rules', e.target.value)}
                    placeholder="这个世界不可逾越的红线与运行机制"
                    InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                    debounceMs={300}
                  />
                </>
              )}
            </Stack>
          </Card>
        </Box>

        <Box>
          <Card variant="outlined" sx={{
            p: 6,
            borderRadius: 4,
            bgcolor: 'transparent',
            transition: 'all 0.2s',
            '&:hover': { bgcolor: 'background.paper', borderColor: 'primary.main' }
          }}>
            <Box sx={{ mb: 6, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Typography variant="h2" color="primary" sx={{ opacity: 1, fontWeight: 900, lineHeight: 0.8 }}>04</Typography>
              <Box>
                <Typography variant="h5" color="text.primary" fontWeight="bold" sx={{ display: 'block', mb: 0.5 }}>角色设定</Typography>
                <Typography variant="body2" color="text.secondary">由 AI 深度补全的灵魂群像，已同步至您的角色个人档案。</Typography>
              </Box>
            </Box>
            <Grid container spacing={3}>
              {outlineJSON.characters && outlineJSON.characters.length > 0 ? (
                outlineJSON.characters.map((char, i) => {
                  // Try to find sync character data from DB
                  const syncedChar = characters.find(c => c.name === char.name);
                  const avatarSrc = syncedChar?.avatar || '';
                  const displayName = syncedChar?.name || char.name;
                  const displayRole = syncedChar?.role || char.role || '角色';

                  return (
                    <Grid size={{ xs: 6, sm: 6 }} key={i}>
                      <Card variant="outlined" sx={{
                        p: 3,
                        bgcolor: 'background.default',
                        transition: 'all 0.2s',
                        borderColor: 'divider',
                        '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderColor: 'primary.light' }
                      }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Avatar src={avatarSrc} sx={{ bgcolor: 'primary.main', width: 44, height: 44, fontWeight: 'bold' }}>
                            {!avatarSrc && (displayName ? displayName[0] : '?')}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle2" fontWeight="bold" noWrap>{displayName}</Typography>
                            <Typography variant="caption" color="primary" sx={{ fontWeight: 'bold', display: 'block' }}>{displayRole}</Typography>
                          </Box>
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{
                          lineHeight: 1.6, whiteSpace: 'normal', mt: 1,
                          overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical'
                        }}>
                          {char.personality || char.description || syncedChar?.traits || '-'}
                        </Typography>
                      </Card>
                    </Grid>
                  )
                })
              ) : (
                <Grid size={12}>
                  <Typography variant="body2" color="text.secondary">暂无角色设定</Typography>
                </Grid>
              )}
            </Grid>
          </Card>
        </Box >

        {/* 关系网络 - 仅在有 relationshipMap 时显示 */}
        {outlineJSON.relationshipMap && Object.keys(outlineJSON.relationshipMap).length > 0 && (
          <Box>
            <Card variant="outlined" sx={{
              p: 6,
              borderRadius: 4,
              bgcolor: 'transparent',
              transition: 'all 0.2s',
              '&:hover': { bgcolor: 'background.paper', borderColor: 'primary.main' }
            }}>
              <Box sx={{ mb: 6, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Typography variant="h2" color="primary" sx={{ opacity: 1, fontWeight: 900, lineHeight: 0.8 }}>05</Typography>
                <Box>
                  <Typography variant="h5" color="text.primary" fontWeight="bold" sx={{ display: 'block', mb: 0.5 }}>人物关系</Typography>
                  <Typography variant="body2" color="text.secondary">角色之间的情感纽带与冲突脉络。</Typography>
                </Box>
              </Box>
              <Divider sx={{ mb: 4, opacity: 0.5 }} />
              <Stack spacing={2}>
                {Object.entries(outlineJSON.relationshipMap).map(([key, value], i) => {
                  // 尝试解析角色名 (支持更多分隔符)
                  const parts = key.split(/\s*(?:&|vs|VS|和|与|->|<->|↔|\||\/|、)\s*/).filter(p => p && p.trim());
                  const isPair = parts.length === 2;

                  // 查找角色对应信息 (如果找不到，创建临时对象)
                  const findChar = (name) => {
                    const found = (outlineJSON.characters || []).find(c => c.name === name || c.name.includes(name) || name.includes(c.name));
                    return found || { name: name.trim(), avatar: null, image: null, isTemp: true };
                  };

                  const char1 = isPair ? findChar(parts[0]) : null;
                  const char2 = isPair ? findChar(parts[1]) : null;

                  // 提取关系标签 - 移除角色名后剩下的部分，或者默认显示符号
                  let relationLabel = '关系';
                  if (isPair) {
                    // 尝试找到原始字符串中的连接符
                    const keyWithoutNames = key.replace(parts[0], '').replace(parts[1], '').trim();
                    if (keyWithoutNames) relationLabel = keyWithoutNames;
                  }

                  // 只要解析出两个名字，就启用可视化模式
                  const visualMode = isPair;

                  return (
                    <Card key={i} variant="outlined" sx={{
                      p: 2,
                      borderRadius: 3,
                      bgcolor: visualMode ? 'background.default' : 'transparent',
                      border: visualMode ? '1px solid' : 'none',
                      borderColor: 'divider',
                      boxShadow: visualMode ? '0 2px 8px rgba(0,0,0,0.02)' : 'none'
                    }}>
                      {visualMode ? (
                        <Box sx={{ mb: 1.5 }}>
                          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                            {/* Char 1 */}
                            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ width: '35%' }}>
                              <Avatar
                                src={char1.avatar || char1.image}
                                sx={{
                                  width: 36, height: 36,
                                  bgcolor: char1.isTemp ? 'grey.300' : 'primary.light',
                                  fontSize: '0.9rem',
                                  fontWeight: 'bold',
                                  color: char1.isTemp ? 'grey.700' : 'primary.contrastText'
                                }}
                              >
                                {char1.name[0]}
                              </Avatar>
                              <Typography variant="subtitle2" noWrap fontWeight="bold" title={char1.name}>{char1.name}</Typography>
                            </Stack>

                            {/* Connection Line */}
                            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                              <Box sx={{ position: 'absolute', left: 0, right: 0, height: '1px', bgcolor: 'divider', zIndex: 0 }} />
                              <Chip
                                label={relationLabel}
                                size="small"
                                color="primary"
                                variant="outlined"
                                sx={{
                                  zIndex: 1,
                                  bgcolor: 'background.paper',
                                  height: 22,
                                  fontSize: '0.75rem',
                                  fontWeight: 'bold',
                                  maxWidth: '100%',
                                  borderStyle: 'dashed'
                                }}
                              />
                            </Box>

                            {/* Char 2 */}
                            <Stack direction="row" alignItems="center" spacing={1.5} justifyContent="flex-end" sx={{ width: '35%' }}>
                              <Typography variant="subtitle2" noWrap fontWeight="bold" title={char2.name}>{char2.name}</Typography>
                              <Avatar
                                src={char2.avatar || char2.image}
                                sx={{
                                  width: 36, height: 36,
                                  bgcolor: char2.isTemp ? 'grey.300' : 'secondary.light',
                                  fontSize: '0.9rem',
                                  fontWeight: 'bold',
                                  color: char2.isTemp ? 'grey.700' : 'secondary.contrastText'
                                }}
                              >
                                {char2.name[0]}
                              </Avatar>
                            </Stack>
                          </Stack>
                        </Box>
                      ) : (
                        <Box sx={{ mb: visualMode ? 0 : 0.5, display: visualMode ? 'none' : 'block' }}>
                          <Chip label={key} size="small" variant="filled" color="primary" sx={{ fontWeight: 'bold', mb: 1 }} />
                        </Box>
                      )}

                      <TextField
                        fullWidth
                        multiline
                        minRows={1}
                        size="small"
                        variant="standard"
                        placeholder="描述人物关系..."
                        value={value}
                        onChange={(e) => {
                          const newMap = { ...outlineJSON.relationshipMap, [key]: e.target.value };
                          handleUpdateOutlineField('relationshipMap', newMap);
                        }}
                        InputProps={{
                          disableUnderline: true,
                          sx: {
                            fontSize: '0.875rem',
                            color: 'text.secondary',
                            bgcolor: visualMode ? 'action.hover' : 'transparent',
                            p: visualMode ? 1.5 : 0,
                            borderRadius: 2
                          }
                        }}
                      />
                    </Card>
                  );
                })}
              </Stack>
            </Card>
          </Box>
        )}


        <Box>
          <Card variant="outlined" sx={{
            p: 6,
            borderRadius: 4,
            bgcolor: 'transparent',
            transition: 'all 0.2s',
            '&:hover': { bgcolor: 'background.paper', borderColor: 'primary.main' }
          }}>
            <Box sx={{ mb: 6, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Typography variant="h2" color="primary" sx={{ opacity: 1, fontWeight: 900, lineHeight: 0.8 }}>06</Typography>
              <Box>
                <Typography variant="h5" color="text.primary" fontWeight="bold" sx={{ display: 'block', mb: 0.5 }}>剧情走向</Typography>
                <Typography variant="body2" color="text.secondary">大纲层级的叙事脉络，为后续的分卷和章节细化提供骨架。</Typography>
              </Box>
            </Box>
            <Divider sx={{ mb: 4, opacity: 0.5 }} />
            <Box sx={{ ml: 2, position: 'relative' }}>
              <DragDropContext onDragEnd={(result) => {
                if (!result.destination) return;
                const nextSteps = [...(outlineJSON.plotProgression || [])];
                const [reorderedItem] = nextSteps.splice(result.source.index, 1);
                nextSteps.splice(result.destination.index, 0, reorderedItem);
                handleUpdateOutlineField('plotProgression', nextSteps);
              }}>
                <Droppable droppableId="plot-progression">
                  {(provided) => (
                    <Stack
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      spacing={4}
                    >
                      {(outlineJSON.plotProgression || []).map((step, i) => {
                        const content = typeof step === 'string' ? step : (step.summary || JSON.stringify(step));
                        const isLast = i === ((outlineJSON.plotProgression || []).length - 1);

                        return (
                          <Draggable key={`step-${i}`} draggableId={`step-${i}`} index={i}>
                            {(provided, snapshot) => (
                              <Box
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                sx={{
                                  position: 'relative',
                                  ...provided.draggableProps.style
                                }}
                              >
                                {/* Timeline Connection Line Segment - Dotted Theme Color */}
                                {!isLast && (
                                  <Box sx={{
                                    position: 'absolute',
                                    left: 11,
                                    top: '50%',
                                    height: 'calc(100% + 32px)',
                                    width: 0,
                                    borderLeft: '2px dotted',
                                    borderColor: alpha(theme.palette.primary.main, 0.3),
                                    zIndex: 0
                                  }} />
                                )}

                                <Stack direction="row" spacing={3} alignItems="center" sx={{ position: 'relative', zIndex: 1 }}>
                                  {/* Index Indicator */}
                                  <Box sx={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: '50%',
                                    bgcolor: 'background.default',
                                    border: '2px solid',
                                    borderColor: 'primary.main',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                  }}>
                                    <Typography variant="caption" sx={{ fontWeight: 1000, color: 'primary.main', fontSize: 10, lineHeight: 1 }}>
                                      {i + 1}
                                    </Typography>
                                  </Box>

                                  {/* Editable Card */}
                                  <Card variant="outlined" sx={{
                                    flexGrow: 1,
                                    p: 3,
                                    bgcolor: snapshot.isDragging ? 'background.paper' : 'background.default',
                                    boxShadow: snapshot.isDragging ? theme.shadows[8] : 'none',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    '&:hover': {
                                      borderColor: 'primary.light',
                                      bgcolor: 'background.paper',
                                      transform: 'translateX(4px)',
                                      '& .step-actions': { opacity: 1 }
                                    }
                                  }}>
                                    {/* Drag Handle */}
                                    <Box {...provided.dragHandleProps} sx={{ display: 'flex', mr: 2, cursor: 'grab', color: 'text.disabled', '&:hover': { color: 'primary.main' } }}>
                                      <IconDrag fontSize="small" />
                                    </Box>

                                    {/* Multi-line / Phase Tag Chip */}
                                    {content.match(/^\[(.*?)\]/) && (
                                      <Chip
                                        label={content.match(/^\[(.*?)\]/)[1]}
                                        size="small"
                                        color={content.includes('线索') ? 'secondary' : 'primary'}
                                        variant="outlined"
                                        sx={{ mr: 1.5, fontWeight: 'bold', flexShrink: 0 }}
                                      />
                                    )}

                                    <TextField
                                      fullWidth
                                      multiline
                                      variant="standard"
                                      value={content}
                                      onChange={(e) => {
                                        const nextSteps = [...(outlineJSON.plotProgression || [])];
                                        nextSteps[i] = e.target.value;
                                        handleUpdateOutlineField('plotProgression', nextSteps);
                                      }}
                                      placeholder={`剧情步骤 ${i + 1}`}
                                      InputProps={{
                                        disableUnderline: true,
                                        sx: { fontSize: '0.875rem', lineHeight: 1.8 }
                                      }}
                                    />

                                    {/* Step Actions (Delete Only) */}
                                    <Stack direction="row" spacing={1} className="step-actions" sx={{ opacity: 0, transition: 'opacity 0.2s', ml: 2 }}>
                                      <IconButton size="small" color="error" onClick={() => {
                                        const nextSteps = [...(outlineJSON.plotProgression || [])].filter((_, idx) => idx !== i);
                                        handleUpdateOutlineField('plotProgression', nextSteps);
                                      }}>
                                        <IconDelete fontSize="inherit" />
                                      </IconButton>
                                    </Stack>
                                  </Card>
                                </Stack>
                              </Box>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}

                      {/* Add Step Button */}
                      <Box sx={{ pl: 6 }}>
                        <Button
                          variant="outlined"
                          startIcon={<IconPlus />}
                          size="small"
                          onClick={() => {
                            const nextSteps = [...(outlineJSON.plotProgression || []), ""];
                            handleUpdateOutlineField('plotProgression', nextSteps);
                          }}
                          sx={{
                            borderRadius: 4,
                            borderStyle: 'dashed',
                            color: 'text.secondary',
                            borderColor: 'divider',
                            '&:hover': { borderColor: 'primary.main', color: 'primary.main', bgcolor: 'transparent' }
                          }}
                        >
                          添加剧情步骤
                        </Button>
                      </Box>
                    </Stack>
                  )}
                </Droppable>
              </DragDropContext>
            </Box>
          </Card>
        </Box>


        <Box>
          <Card variant="outlined" sx={{
            p: 6,
            borderRadius: 4,
            bgcolor: 'transparent',
            transition: 'all 0.2s',
            '&:hover': { bgcolor: 'background.paper', borderColor: 'primary.main' }
          }}>
            <Box sx={{ mb: 6, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Typography variant="h2" color="primary" sx={{ opacity: 1, fontWeight: 900, lineHeight: 0.8 }}>07</Typography>
              <Box>
                <Typography variant="h5" color="text.primary" fontWeight="bold" sx={{ display: 'block', mb: 0.5 }}>预期结局</Typography>
                <Typography variant="body2" color="text.secondary">旅途的终点，解答核心冲突并确立故事的最终余韵。</Typography>
              </Box>
            </Box>
            <Divider sx={{ mb: 4, opacity: 0.5 }} />
            <Box>
              <TextField
                fullWidth
                multiline
                label="核心结局"
                variant="outlined"
                value={outlineJSON.ending || ''}
                onChange={(e) => handleUpdateOutlineField('ending', e.target.value)}
                placeholder="故事最终走向的终点"
                InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                    color: 'primary.dark'
                  }
                }}
              />
            </Box>
          </Card>
        </Box>
      </Stack >
    );
  };

  // --- Handlers (Stubs for brevity used in JSX but declared here) ---
  const handleOpenEditStructure = () => {
    if (!outlineJSON) return;
    setEditStructureVisible(true);
    setModuleEditData({
      title: outlineJSON.title || '',
      logline: outlineJSON.logline || '',
      theme: outlineJSON.theme || outlineJSON.primaryTheme || '',
      coreConflict: outlineJSON.coreConflict || '',
      tone: outlineJSON.tone || '',
      pacing: outlineJSON.pacing || '',
      targetAudience: outlineJSON.targetAudience || '',
      tags: outlineJSON.tags || [],
      worldSettingDescription: outlineJSON.worldSetting?.description || outlineJSON.worldNotes || '',
      worldSettingRules: outlineJSON.worldSetting?.rules || '',
      plotProgression: outlineJSON.plotProgression || [],
      characters: outlineJSON.characters || [],
      ending: outlineJSON.ending || '',
      worldNotes: outlineJSON.worldNotes || ''
    });
  };

  const handleSaveStructure = async () => {
    const newJSON = {
      ...outlineJSON, ...moduleEditData,
      worldSetting: { description: moduleEditData.worldSettingDescription, rules: moduleEditData.worldSettingRules }
    };
    // Clean flat fields
    delete newJSON.worldSettingDescription;
    delete newJSON.worldSettingRules;

    setOutlineJSON(newJSON);
    const content = JSON.stringify(newJSON, null, 2);
    setCoreOutline(content);
    setEditStructureVisible(false);
    await storageEx.updateCoreOutline(currentProject.id, { title: '核心大纲', content });

    // Proactively sync characters to DB if modified
    if (newJSON.characters) {
      const existingChars = await storage.getItemsByProject('characters', currentProject.id);
      for (const char of newJSON.characters) {
        const existing = existingChars.find(c => c.name === char.name);
        if (existing) {
          await storage.updateItem('characters', {
            ...existing,
            role: char.role || existing.role,
            traits: char.personality || char.description || existing.traits,
            updatedAt: new Date().toISOString()
          });
        }
      }
      await loadData();
    }

    messageApi.success('已保存');
  };

  const handleDeleteCoreOutline = () => {
    setDeleteOutlineVisible(true);
  };

  const handleConfirmDeleteCoreOutline = async () => {
    setDeleteOutlineVisible(false);
    try {
      // 1. 获取所有分卷
      const allVolumes = await storageEx.getVolumes(currentProject.id);

      // 2. 删除每个分卷及其章节细纲
      for (const volume of allVolumes) {
        const chaptersToDelete = await storageEx.getChapterNodesByVolume(volume.id);
        for (const chapter of chaptersToDelete) {
          await storage.deleteItem('chapter_nodes', chapter.id);
        }
        await storage.deleteItem('volumes', volume.id);
      }

      // 3. 删除所有角色
      const allCharacters = await storage.getItemsByProject('characters', currentProject.id);
      for (const char of allCharacters) {
        await storage.deleteItem('characters', char.id);
      }

      // 4. 删除核心大纲
      await storageEx.deleteCoreOutline(currentProject.id);

      // 5. 清空所有相关状态
      setCoreOutline('');
      setOutlineJSON(null);
      setVolumes([]);
      setSelectedVolumeId(null);
      setChapterNodes([]);
      setChapterNodesMap({});
      setCharacters([]);
      setActiveStep(0);

      // 6. 通知其他组件（如角色管理页）刷新
      window.dispatchEvent(new CustomEvent('characters-updated', { detail: { projectId: currentProject.id } }));

      messageApi.success('核心大纲、分卷、章节细纲及角色已全部删除');
      await loadData();
    } catch (err) {
      console.error('Failed to delete core outline:', err);
      messageApi.error('删除失败');
    }
  };

  // --- Render Sections ---
  const renderStep0Proposal = () => (
    <Box sx={{ py: 6 }}>
      {/* --- Main Header Section --- */}
      <Box sx={{ mb: 10, textAlign: 'center' }}>
        <Typography variant="h2" sx={{ fontWeight: 'bold', mb: 2, letterSpacing: -1 }}>
          核心构思
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto', mb: 4, lineHeight: 1.8 }}>
          这是您创作的基石。在这里确立故事的核心矛盾、世界运作的底层规则，以及最初活跃在舞台上的角色群像。
        </Typography>

      </Box>

      <Stack spacing={8}>
        {/* --- Section 1: Story Concept --- */}
        <Box>
          <Card variant="outlined" sx={{
            p: 6,
            borderRadius: 4,
            bgcolor: 'transparent',
            transition: 'all 0.2s',
            '&:hover': { bgcolor: 'background.paper', borderColor: 'primary.main' }
          }}>
            <Box sx={{ mb: 6, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Typography variant="h2" color="primary" sx={{ opacity: 1, fontWeight: 900, lineHeight: 0.8 }}>01</Typography>
              <Box>
                <Typography variant="h5" color="text.primary" fontWeight="bold" sx={{ display: 'block', mb: 0.5 }}>故事构思</Typography>
                <Typography variant="body2" color="text.secondary">确立故事的主线任务与核心冲突，这是驱动剧情发展的引擎。</Typography>
              </Box>
            </Box>
            <Divider sx={{ mb: 4, opacity: 0.5 }} />
            <Stack spacing={4}>
              <DebouncedTextField
                fullWidth
                multiline
                minRows={1}
                label="故事主线"
                placeholder="描述故事的主要线索与核心脉络"
                value={formIdea.mainPlot}
                onChange={(e) => setFormIdea({ ...formIdea, mainPlot: e.target.value })}
                InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                debounceMs={300}
              />
              <DebouncedTextField
                fullWidth
                multiline
                minRows={1}
                label="主要冲突"
                placeholder="内外冲突：阻止目标实现的核心阻力"
                value={formIdea.mainConflict}
                onChange={(e) => setFormIdea({ ...formIdea, mainConflict: e.target.value })}
                InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                debounceMs={300}
              />
              <DebouncedTextField
                fullWidth
                multiline
                minRows={1}
                label="故事开端"
                placeholder="序幕：故事平衡是如何被打破的"
                value={formIdea.storyBeginning}
                onChange={(e) => setFormIdea({ ...formIdea, storyBeginning: e.target.value })}
                InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                debounceMs={300}
              />
              <DebouncedTextField
                fullWidth
                multiline
                minRows={1}
                label="预计结局 (可选)"
                placeholder="终局：故事矛盾最终如何解决"
                value={formIdea.expectedEnding}
                onChange={(e) => setFormIdea({ ...formIdea, expectedEnding: e.target.value })}
                InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                debounceMs={300}
              />
            </Stack>
          </Card>
        </Box>

        {/* --- Section 2: World Building --- */}
        <Box>
          <Card variant="outlined" sx={{
            p: 6,
            borderRadius: 4,
            bgcolor: 'transparent',
            transition: 'all 0.2s',
            '&:hover': { bgcolor: 'background.paper', borderColor: 'primary.main' }
          }}>
            <Box sx={{ mb: 6, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Typography variant="h2" color="primary" sx={{ opacity: 1, fontWeight: 900, lineHeight: 0.8 }}>02</Typography>
              <Box>
                <Typography variant="h5" color="text.primary" fontWeight="bold" sx={{ display: 'block', mb: 0.5 }}>世界设定</Typography>
                <Typography variant="body2" color="text.secondary">构建故事发生的地理、时代与运作规则。完善的世界观是剧情沉浸感的来源。</Typography>
              </Box>
            </Box>
            <Divider sx={{ mb: 4, opacity: 0.5 }} />
            <Stack spacing={4}>
              <DebouncedTextField
                fullWidth
                multiline
                minRows={1}
                label="时代背景"
                placeholder="例如：现代都市或古代仙侠世界"
                value={formIdea.timePeriod}
                onChange={(e) => setFormIdea({ ...formIdea, timePeriod: e.target.value })}
                InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                debounceMs={300}
              />
              <DebouncedTextField
                fullWidth
                multiline
                minRows={1}
                label="主要场景"
                placeholder="例如：校园、职场或奇幻帝国"
                value={formIdea.mainSettings}
                onChange={(e) => setFormIdea({ ...formIdea, mainSettings: e.target.value })}
                InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                debounceMs={300}
              />
              <DebouncedTextField
                fullWidth
                multiline
                minRows={1}
                label="世界特色与规则"
                placeholder="独特设定：力量体系与社会规则"
                value={formIdea.worldFeatures}
                onChange={(e) => setFormIdea({ ...formIdea, worldFeatures: e.target.value })}
                InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                debounceMs={300}
              />
            </Stack>
          </Card>
        </Box>

        {/* --- Section 3: Character Dossier --- */}
        <Box>
          <Card variant="outlined" sx={{
            p: 6,
            borderRadius: 4,
            bgcolor: 'transparent',
            transition: 'all 0.2s',
            '&:hover': { bgcolor: 'background.paper', borderColor: 'primary.main' }
          }}>
            <Box sx={{ mb: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', pl: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Typography variant="h2" color="primary" sx={{ opacity: 1, fontWeight: 900, lineHeight: 0.8 }}>03</Typography>
                <Box>
                  <Typography variant="h5" color="text.primary" fontWeight="bold" sx={{ display: 'block', mb: 0.5 }}>角色预设</Typography>
                  <Typography variant="body2" color="text.secondary">活跃在剧院中的各个灵魂。在这里添加您的初始角色设定。</Typography>
                </Box>
              </Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={<IconPlus />}
                onClick={() => setCharacterPresets([...characterPresets, { name: '', role: '', description: '' }])}
                sx={{ borderRadius: 999, px: 3 }}
              >
                添加新角色
              </Button>
            </Box>
            <Divider sx={{ mb: 4, opacity: 0.5 }} />

            {Array.isArray(characterPresets) && characterPresets.length > 0 ? (
              <Stack spacing={4}>
                {characterPresets.map((char, index) => (
                  <Card variant="outlined" key={index} sx={{
                    p: 4,
                    bgcolor: 'background.default',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': {
                      bgcolor: 'background.paper',
                      borderColor: 'primary.main',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
                    }
                  }}>
                    <Stack spacing={4}>
                      {/* Row 1: Identity Profile */}
                      <Box sx={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
                        <TextField
                          sx={{ flex: 2 }}
                          multiline
                          minRows={1}
                          label="角色名称"
                          placeholder="姓名"
                          value={char.name}
                          onChange={(e) => {
                            const next = [...characterPresets];
                            next[index].name = e.target.value;
                            setCharacterPresets(next);
                          }}
                          InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                        />
                        <TextField
                          sx={{ flex: 3 }}
                          multiline
                          minRows={1}
                          label="角色定位"
                          placeholder="定位"
                          value={char.role}
                          onChange={(e) => {
                            const next = [...characterPresets];
                            next[index].role = e.target.value;
                            setCharacterPresets(next);
                          }}
                          InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                        />
                        <Tooltip title="删除角色">
                          <IconButton
                            size="small"
                            sx={{ mt: 1, color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: 'error.lighter' } }}
                            onClick={() => setCharacterPresets(characterPresets.filter((_, i) => i !== index))}
                          >
                            <IconDelete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>

                      {/* Row 2: Behavioral Specs */}
                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        maxRows={10}
                        label="特质与动机"
                        placeholder="描述角色的核心欲望、性格弱点或背景简述"
                        value={char.description || char.traits || ''}
                        onChange={(e) => {
                          const next = [...characterPresets];
                          next[index].description = e.target.value;
                          setCharacterPresets(next);
                        }}
                        InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                      />
                    </Stack>
                  </Card>
                ))}
              </Stack>
            ) : (
              <Paper variant="outlined" sx={{ py: 6, textAlign: 'center', borderStyle: 'dashed', bgcolor: 'transparent' }}>
                <Typography variant="body2" color="text.secondary">
                  档案库尚空。您可以手动添加，或应用下方模板。
                </Typography>
              </Paper>
            )}
          </Card>
        </Box>

        {/* --- Section 4: Advanced Specs --- */}
        <Box>
          <Card variant="outlined" sx={{
            p: 6,
            borderRadius: 4,
            bgcolor: 'transparent',
            transition: 'all 0.2s',
            '&:hover': { bgcolor: 'background.paper', borderColor: 'primary.main' }
          }}>
            <Box sx={{ mb: 6, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Typography variant="h2" color="primary" sx={{ opacity: 1, fontWeight: 900, lineHeight: 0.8 }}>04</Typography>
              <Box>
                <Typography variant="h5" color="text.primary" fontWeight="bold" sx={{ display: 'block', mb: 0.5 }}>进阶参数设定</Typography>
                <Typography variant="body2" color="text.secondary">微调文学体裁、受众定位及预期篇幅等关键元数据。</Typography>
              </Box>
            </Box>
            <Divider sx={{ mb: 4, opacity: 0.5 }} />
            <Stack spacing={4}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  类型编目
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {(() => {
                    const presetTypes = ['现实主义', '成长小说', '悬疑犯罪', '言情', '玄幻', '科幻', '历史', '其他'];
                    const currentType = outlineOptions.novelType;
                    const isCustomType = currentType && !presetTypes.includes(currentType);
                    return (
                      <>
                        {presetTypes.map(type => (
                          <Chip
                            key={type}
                            label={type}
                            clickable
                            variant={currentType === type ? 'filled' : 'outlined'}
                            color={currentType === type ? 'primary' : 'default'}
                            onClick={() => setOutlineOptions({ ...outlineOptions, novelType: type })}
                            sx={{ borderRadius: 1.5, px: 0.5 }}
                          />
                        ))}
                        {isCustomType && (
                          <Chip
                            label={currentType}
                            clickable
                            variant="filled"
                            color="primary"
                            onDelete={() => setOutlineOptions({ ...outlineOptions, novelType: '' })}
                            sx={{ borderRadius: 1.5, px: 0.5 }}
                          />
                        )}
                      </>
                    );
                  })()}
                </Box>
              </Box>

              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  情感基调
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {(() => {
                    const presetTones = ['轻松幽默', '温馨治愈', '紧张悬疑', '深沉内敛', '厚重史诗', '细腻抒情'];
                    const currentTone = outlineOptions.tone;
                    const isCustomTone = currentTone && !presetTones.includes(currentTone);
                    return (
                      <>
                        {presetTones.map(tone => (
                          <Chip
                            key={tone}
                            label={tone}
                            clickable
                            variant={currentTone === tone ? 'filled' : 'outlined'}
                            color={currentTone === tone ? 'primary' : 'default'}
                            onClick={() => setOutlineOptions({ ...outlineOptions, tone })}
                            sx={{ borderRadius: 1.5, px: 0.5 }}
                          />
                        ))}
                        {isCustomTone && (
                          <Chip
                            label={currentTone}
                            clickable
                            variant="filled"
                            color="primary"
                            onDelete={() => setOutlineOptions({ ...outlineOptions, tone: '' })}
                            sx={{ borderRadius: 1.5, px: 0.5 }}
                          />
                        )}
                      </>
                    );
                  })()}
                </Box>
              </Box>

              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  目标受众
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {(() => {
                    const presetAudiences = ['青年读者', '成熟读者', '通俗大众', '文学爱好者'];
                    const currentAudiences = outlineOptions.targetAudience || [];
                    const customAudiences = currentAudiences.filter(a => !presetAudiences.includes(a));
                    return (
                      <>
                        {presetAudiences.map(aud => (
                          <Chip
                            key={aud}
                            label={aud}
                            clickable
                            variant={currentAudiences.includes(aud) ? 'filled' : 'outlined'}
                            color={currentAudiences.includes(aud) ? 'primary' : 'default'}
                            onClick={() => {
                              const next = currentAudiences.includes(aud)
                                ? currentAudiences.filter(a => a !== aud)
                                : [...currentAudiences, aud];
                              setOutlineOptions({ ...outlineOptions, targetAudience: next });
                            }}
                            sx={{ borderRadius: 1.5, px: 0.5 }}
                          />
                        ))}
                        {customAudiences.map(aud => (
                          <Chip
                            key={aud}
                            label={aud}
                            clickable
                            variant="filled"
                            color="primary"
                            onDelete={() => {
                              const next = currentAudiences.filter(a => a !== aud);
                              setOutlineOptions({ ...outlineOptions, targetAudience: next });
                            }}
                            sx={{ borderRadius: 1.5, px: 0.5 }}
                          />
                        ))}
                      </>
                    );
                  })()}
                </Box>
              </Box>

              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  预期体量
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {[
                    { label: '短篇', value: 'short' },
                    { label: '中篇', value: 'medium' },
                    { label: '长篇', value: 'long' }
                  ].map(item => (
                    <Chip
                      key={item.value}
                      label={item.label}
                      clickable
                      variant={outlineOptions.length === item.value ? 'filled' : 'outlined'}
                      color={outlineOptions.length === item.value ? 'primary' : 'default'}
                      onClick={() => setOutlineOptions({ ...outlineOptions, length: item.value })}
                      sx={{ borderRadius: 1.5, px: 0.5 }}
                    />
                  ))}
                </Box>
              </Box>

              <Box sx={{ p: 4, bgcolor: 'background.default', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                    主要叙事角色席位 (2-10)
                  </Typography>
                  <Box sx={{ px: 2, py: 0.5, bgcolor: 'primary.lighter', borderRadius: 1, border: '1px solid', borderColor: 'primary.light' }}>
                    <Typography variant="caption" color="primary" fontWeight="bold">
                      {outlineOptions.characterCount === 2 && '双雄 / 羁绊对决'}
                      {outlineOptions.characterCount === 3 && '铁三角 / 稳固核心'}
                      {outlineOptions.characterCount === 4 && '经典小队 / 职能互补'}
                      {outlineOptions.characterCount === 5 && '核心群像 / 丰富脉络'}
                      {outlineOptions.characterCount >= 6 && '宏大群像 / 多元视角'}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                    const isSelected = outlineOptions.characterCount === num;
                    return (
                      <Box
                        key={num}
                        onClick={() => setOutlineOptions({ ...outlineOptions, characterCount: num })}
                        sx={{
                          width: 44,
                          height: 44,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          borderRadius: 1.5,
                          border: '2px solid',
                          borderColor: isSelected ? 'primary.main' : 'divider',
                          bgcolor: isSelected ? 'primary.main' : 'background.paper',
                          color: isSelected ? 'common.white' : 'text.secondary',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: isSelected ? '0 4px 12px rgba(var(--mui-palette-primary-mainChannel), 0.3)' : 'none',
                          '&:hover': {
                            borderColor: 'primary.main',
                            color: isSelected ? 'common.white' : 'primary.main',
                            transform: 'translateY(-2px)'
                          }
                        }}
                      >
                        <Typography variant="subtitle1" fontWeight="bold">{num}</Typography>
                      </Box>
                    );
                  })}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                  💡 预设角色数量决定了 AI 生成大纲时的聚焦深度。建议核心剧组成员控制在 3-5 人以获得最佳戏剧张力。
                </Typography>
              </Box>
            </Stack>
          </Card>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 10 }}>
          <Button
            variant="contained"
            size="large"
            onClick={() => setReviewDialogVisible(true)}
            disabled={coreStatus.loading}
            sx={{
              px: 8,
              py: 1.2,
              borderRadius: 999,
              fontSize: '1.1rem',
              bgcolor: 'primary.main',
              boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.3)}`,
              '&:hover': { bgcolor: 'primary.dark', boxShadow: `0 10px 25px ${alpha(theme.palette.primary.main, 0.4)}` }
            }}
          >
            {coreStatus.loading ? '正在构思核心逻辑...' : '下一步'}
          </Button>
        </Box>
      </Stack>
    </Box>
  );

  const renderStep1Outline = () => (
    <Box sx={{ py: 6 }}>
      {/* --- Step 2 Header --- */}
      <Box sx={{ mb: 10, textAlign: 'center' }}>
        <Typography variant="h2" sx={{ fontWeight: 'bold', mb: 2, letterSpacing: -1 }}>
          核心大纲
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto', mb: 4, lineHeight: 1.8 }}>
          AI 已经根据您的构思基因，完成了全篇章的逻辑编织。在这里审阅、修改并确认您的故事生命结构。
        </Typography>
      </Box>

      {coreStatus.loading ? (
        <Paper variant="outlined" sx={{ py: 10, textAlign: 'center', borderStyle: 'dashed', bgcolor: 'background.default', borderRadius: 4 }}>
          {theme.palette.mode === 'dark' ? (
            <Box sx={{ position: 'relative', display: 'inline-flex', mb: 3 }}>
              <CircularProgress size={64} thickness={2} sx={{ color: 'primary.main', opacity: 0.3 }} />
              <IconAI sx={{ fontSize: 32, color: 'primary.main', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', animation: 'pulse 2s infinite ease-in-out' }} />
            </Box>
          ) : (
            <Box component="img" src={LoadingCoreOutline} sx={{ width: 280, mb: 3, mixBlendMode: 'multiply' }} />
          )}
          <Typography variant="h6" fontWeight="bold" gutterBottom>正在深度构思核心大纲...</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>AI 正在根据您的核心构思编织故事网格</Typography>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => abortControllerRef.current?.abort()}
            sx={{ borderRadius: 999, px: 4 }}
          >
            取消生成
          </Button>
        </Paper>
      ) : !outlineJSON ? (
        <Paper variant="outlined" sx={{ py: 10, textAlign: 'center', borderStyle: 'dashed', bgcolor: 'transparent' }}>
          {theme.palette.mode === 'dark' ? (
            <IconWarning color="warning" sx={{ fontSize: 48, mb: 2 }} />
          ) : (
            <Box component="img" src={EmptyStateStructure} alt="未检测到结构化大纲" sx={{ width: 280, mb: 2, display: 'inline-block', mixBlendMode: 'multiply' }} />
          )}
          <Typography variant="h6" gutterBottom>未检测到结构化大纲</Typography>
          <Typography variant="body2" color="text.secondary">请返回上一步生成大纲。</Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {renderStructuredOutline()}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 10 }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => setActiveStep(2)}
              sx={{
                borderRadius: 999,
                px: 8,
                py: 1.2,
                bgcolor: 'primary.main',
                fontSize: '1.1rem',
                boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.3)}`,
                '&:hover': { bgcolor: 'primary.dark', boxShadow: `0 10px 25px ${alpha(theme.palette.primary.main, 0.4)}` }
              }}
            >
              下一步
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );

  const renderStep2Volumes = () => {
    const sortedVols = [...volumes].sort((a, b) => a.order - b.order);
    return (
      <Box sx={{ py: 6 }}>
        {/* --- Step Header --- */}
        <Box sx={{ mb: 10, textAlign: 'center' }}>
          <Typography variant="h2" sx={{ fontWeight: 'bold', mb: 2, letterSpacing: -1 }}>
            分卷规划
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto', mb: 4, lineHeight: 1.8 }}>
            分卷能帮您把控长篇小说的节奏。在这里将核心大纲转化为具体的叙事阶段。
          </Typography>
        </Box>



        {
          volumeStatus.loading ? (
            <Paper variant="outlined" sx={{ py: 10, textAlign: 'center', borderStyle: 'dashed', bgcolor: 'background.default', borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {theme.palette.mode === 'dark' ? (
                <Box sx={{ position: 'relative', display: 'inline-flex', mb: 3 }}>
                  <CircularProgress size={64} thickness={2} sx={{ color: 'primary.main', opacity: 0.3 }} />
                  <IconAI sx={{ fontSize: 32, color: 'primary.main', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', animation: 'pulse 2s infinite ease-in-out' }} />
                </Box>
              ) : (
                <Box component="img" src={LoadingVolumeGen} alt="正在生成分卷" sx={{ width: 280, mb: 2, mixBlendMode: 'multiply' }} />
              )}
              <Typography variant="h6" fontWeight="bold" gutterBottom>正在拆解叙事阶段，规划分卷...</Typography>
              <Typography variant="body2" color="text.secondary">正在将核心逻辑转化为可落地的创作阶段，请稍候。</Typography>
            </Paper>
          ) : sortedVols.length === 0 ? (
            <Paper variant="outlined" sx={{ py: 10, textAlign: 'center', borderStyle: 'dashed', bgcolor: 'transparent', borderRadius: 4 }}>
              {theme.palette.mode === 'dark' ? (
                <IconRobot color="disabled" sx={{ fontSize: 60, mb: 2 }} />
              ) : (
                <Box component="img" src={EmptyStateVolume} alt="尚未进行分卷规划" sx={{ width: 280, mb: 2, mixBlendMode: 'multiply' }} />
              )}
              <Typography variant="h6" gutterBottom>尚未进行分卷规划</Typography>
              <Typography variant="body2" color="text.secondary">点击上方按钮，让 AI 为您的宏大叙事规划合理的阶段性目标。</Typography>
            </Paper>
          ) : (
            <>
              {/* Tabs Navigation */}
              <Box sx={{
                position: 'sticky',
                top: -48,
                zIndex: 100,
                bgcolor: alpha(theme.palette.background.default, 0.9),
                backdropFilter: 'blur(10px)',
                mx: { xs: -2, sm: -4 },
                px: { xs: 2, sm: 4 },
                py: 2,
                mb: 6,
                display: 'flex',
                justifyContent: 'center',
                gap: 2
              }}>
                {[
                  { id: 'planning', label: '分卷规划' },
                  { id: 'subplots', label: '支线与伏笔' }
                ].map(tab => {
                  const isSelected = activeVolumeTab === tab.id;
                  return (
                    <Box
                      key={tab.id}
                      onClick={() => setActiveVolumeTab(tab.id)}
                      sx={{
                        cursor: 'pointer',
                        px: 3,
                        py: 1,
                        borderRadius: 999,
                        border: '1px solid',
                        borderColor: isSelected ? 'primary.main' : 'divider',
                        bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.background.paper, 0.8),
                        transition: 'all 0.2s ease',
                        boxShadow: isSelected ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
                        '&:hover': {
                          bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.12) : 'background.paper',
                          borderColor: isSelected ? 'primary.main' : 'primary.light',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                        }
                      }}
                    >
                      <Typography variant="body2" sx={{
                        fontWeight: isSelected ? 'bold' : 500,
                        color: isSelected ? 'primary.main' : 'text.primary',
                        fontSize: '0.9rem'
                      }}>
                        {tab.label}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>

              <Box sx={{ pb: 10 }}>
                {/* Tab 1: Volume Planning */}
                {activeVolumeTab === 'planning' && (
                  <Stack spacing={6} sx={{ mb: 6 }}>
                    {sortedVols.map(v => (
                      <Card
                        key={v.id}
                        variant="outlined"
                        sx={{
                          p: 6,
                          cursor: 'pointer',
                          bgcolor: selectedVolumeId === v.id ? 'background.paper' : 'transparent',
                          borderColor: selectedVolumeId === v.id ? 'primary.main' : 'divider',
                          borderWidth: 1,
                          boxShadow: selectedVolumeId === v.id ? '0 12px 40px rgba(0, 0, 0, 0.04)' : 'none',
                          transition: 'all 0.2s',
                          '&:hover': { bgcolor: 'background.paper', borderColor: 'primary.main' },
                          textAlign: 'center',
                          position: 'relative',
                          borderRadius: 4
                        }}
                        onClick={() => setSelectedVolumeId(v.id)}
                      >
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => { e.stopPropagation(); handleDeleteVolume(v); }}
                          sx={{
                            position: 'absolute',
                            top: 16,
                            right: 16,
                            opacity: 0.3,
                            transition: 'opacity 0.2s',
                            '&:hover': { opacity: 1 }
                          }}
                        >
                          <IconDelete fontSize="small" />
                        </IconButton>

                        <Box sx={{ maxWidth: 800, mx: 'auto' }}>
                          <Typography variant="subtitle2" color="primary" sx={{ mb: 2, fontWeight: 'bold', letterSpacing: 4, opacity: 1, textTransform: 'uppercase' }}>
                            第 {v.order} 卷
                          </Typography>

                          <TextField
                            fullWidth
                            multiline
                            variant="standard"
                            value={v.name}
                            onChange={(e) => handleUpdateVolumeField(v.id, 'name', e.target.value)}
                            placeholder="点击输入卷名..."
                            sx={{ mb: 4 }}
                            inputProps={{
                              style: { textAlign: 'center' }
                            }}
                            InputProps={{
                              disableUnderline: true,
                              sx: {
                                fontSize: '2.5rem',
                                fontWeight: 'bold',
                                letterSpacing: -1,
                                fontFamily: "'ZhuqueFangsong', serif",
                                color: selectedVolumeId === v.id ? 'text.primary' : 'primary.main',
                                p: 0,
                                lineHeight: 1.2
                              }
                            }}
                          />

                          <Divider sx={{ mb: 6, width: 60, mx: 'auto', borderBottomWidth: 2, opacity: 0.1 }} />

                          <TextField
                            fullWidth
                            multiline
                            minRows={3}
                            label="本卷大纲"
                            variant="outlined"
                            value={v.description}
                            onChange={(e) => handleUpdateVolumeField(v.id, 'description', e.target.value)}
                            placeholder="描述本卷的核心剧情、节奏起伏及预期高潮..."
                            sx={{
                              textAlign: 'left',
                              '& .MuiOutlinedInput-root': {
                                '& fieldset': { borderColor: 'divider', opacity: 0.5 },
                                '&:hover fieldset': { borderColor: 'primary.main', opacity: 1 },
                              }
                            }}
                            InputLabelProps={{
                              sx: {
                                fontWeight: 'bold',
                                fontSize: '0.875rem',
                                textAlign: 'left',
                                px: 0.5
                              }
                            }}
                            inputProps={{
                              style: { textAlign: 'left', fontSize: '1rem', lineHeight: 1.8 }
                            }}
                          />

                          {/* 叙事目标 */}
                          <Box sx={{ mt: 4 }}>
                            <TextField
                              fullWidth
                              multiline
                              label="叙事目标"
                              variant="outlined"
                              value={v.mainGoal || ''}
                              onChange={(e) => handleUpdateVolumeField(v.id, 'mainGoal', e.target.value)}
                              placeholder="描述本卷的核心叙事目标..."
                              sx={{
                                textAlign: 'left',
                                '& .MuiOutlinedInput-root': {
                                  '& fieldset': { borderColor: 'divider', opacity: 0.5 },
                                  '&:hover fieldset': { borderColor: 'primary.main', opacity: 1 },
                                }
                              }}
                              InputLabelProps={{
                                sx: { fontWeight: 'bold', fontSize: '0.875rem', px: 0.5 }
                              }}
                              inputProps={{
                                style: { textAlign: 'left', fontSize: '0.95rem', lineHeight: 1.6 }
                              }}
                            />
                          </Box>

                          {/* 关键事件 (可视化列表) */}
                          <Box sx={{ mt: 4 }}>
                            <Typography variant="caption" color="primary" fontWeight="bold" sx={{ display: 'block', mb: 1, px: 0.5 }}>
                              关键事件
                            </Typography>
                            <Stack spacing={1}>
                              {(v.keyEvents || []).map((event, idx) => (
                                <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                  <Typography variant="body2" sx={{
                                    color: 'primary.main',
                                    fontWeight: 'bold',
                                    minWidth: 20,
                                    pt: 1
                                  }}>
                                    {idx + 1}.
                                  </Typography>
                                  <TextField
                                    fullWidth
                                    multiline
                                    size="small"
                                    variant="outlined"
                                    value={event}
                                    onChange={(e) => {
                                      const newEvents = [...(v.keyEvents || [])];
                                      newEvents[idx] = e.target.value;
                                      handleUpdateVolumeField(v.id, 'keyEvents', newEvents);
                                    }}
                                    sx={{
                                      '& .MuiOutlinedInput-root': {
                                        bgcolor: 'background.paper',
                                        borderRadius: 2
                                      }
                                    }}
                                    inputProps={{ style: { fontSize: '0.9rem' } }}
                                  />
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      const newEvents = [...(v.keyEvents || [])];
                                      newEvents.splice(idx, 1);
                                      handleUpdateVolumeField(v.id, 'keyEvents', newEvents);
                                    }}
                                    sx={{ mt: 0.5, color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                                  >
                                    <IconDelete fontSize="small" />
                                  </IconButton>
                                </Box>
                              ))}
                              <Button
                                startIcon={<IconPlus />}
                                size="small"
                                onClick={() => {
                                  const newEvents = [...(v.keyEvents || []), ''];
                                  handleUpdateVolumeField(v.id, 'keyEvents', newEvents);
                                }}
                                sx={{ alignSelf: 'flex-start', mt: 1, borderRadius: 2 }}
                              >
                                添加关键事件
                              </Button>
                            </Stack>
                          </Box>

                          {/* 悬念/Cliffhanger */}
                          <Box sx={{ mt: 4 }}>
                            <TextField
                              fullWidth
                              multiline
                              label="本卷悬念"
                              variant="outlined"
                              value={v.cliffhanger || ''}
                              onChange={(e) => handleUpdateVolumeField(v.id, 'cliffhanger', e.target.value)}
                              placeholder="本卷结尾留下的核心悬念..."
                              sx={{
                                textAlign: 'left',
                                '& .MuiOutlinedInput-root': {
                                  bgcolor: alpha(theme.palette.warning.main, 0.02),
                                  '& fieldset': { borderColor: alpha(theme.palette.warning.main, 0.3) },
                                  '&:hover fieldset': { borderColor: theme.palette.warning.main },
                                }
                              }}
                              InputLabelProps={{
                                sx: { fontWeight: 'bold', fontSize: '0.875rem', color: 'warning.dark', px: 0.5 }
                              }}
                              inputProps={{
                                style: { textAlign: 'left', fontSize: '0.95rem', lineHeight: 1.6, fontStyle: 'italic' }
                              }}
                            />
                          </Box>
                        </Box>
                      </Card>
                    ))}
                  </Stack>
                )}





                {/* Tab 2: Subplots & Foreshadowing */}
                {/* Tab 2: Subplots & Foreshadowing */}
                {activeVolumeTab === 'subplots' && (
                  <Box sx={{ mt: 4, mb: 10 }}>
                    <Stack direction="row" spacing={6} alignItems="flex-start">
                      {/* Left Column: Subplots */}
                      <Box sx={{ flex: 1 }}>
                        {/* 支线剧情 */}
                        <Box sx={{ mb: 6 }}>
                          <Typography variant="h6" sx={{ mb: 4, fontWeight: 'bold' }}>
                            支线剧情
                          </Typography>
                          {subplots.length === 0 ? (
                            <Paper variant="outlined" sx={{ py: 10, textAlign: 'center', borderStyle: 'dashed', borderRadius: 4, bgcolor: 'transparent' }}>
                              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>暂无支线剧情规划</Typography>
                              <Button variant="outlined" startIcon={<IconPlus />} onClick={() => setSubplots([...subplots, {}])} sx={{ borderRadius: 999 }}>添加支线</Button>
                            </Paper>
                          ) : (
                            <Stack spacing={4}>
                              {subplots.map((sp, idx) => {
                                const volMatch = (sp.volumeRange || '').match(/第(\d+)卷.*第(\d+)卷/);
                                const volStart = volMatch ? parseInt(volMatch[1]) : 1;
                                const volEnd = volMatch ? parseInt(volMatch[2]) : 1;
                                return (
                                  <Card
                                    key={idx}
                                    variant="outlined"
                                    sx={{
                                      p: 4,
                                      borderRadius: 4,
                                      position: 'relative',
                                      border: '1px solid',
                                      borderColor: 'divider',
                                      transition: 'all 0.3s ease',
                                      '&:hover': {
                                        borderColor: 'primary.main',
                                        boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
                                      }
                                    }}
                                  >
                                    <Tooltip title="删除支线">
                                      <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => {
                                          const updated = subplots.filter((_, i) => i !== idx);
                                          setSubplots(updated);
                                          storage.setItem(`volumePlan_subplots_${currentProject.id}`, JSON.stringify(updated));
                                        }}
                                        sx={{ position: 'absolute', top: 12, right: 12, opacity: 0.5, '&:hover': { opacity: 1 }, zIndex: 1 }}
                                      >
                                        <IconDelete fontSize="small" />
                                      </IconButton>
                                    </Tooltip>

                                    <Box sx={{ maxWidth: 800, textAlign: 'left' }}>
                                      <TextField
                                        fullWidth
                                        multiline
                                        variant="standard"
                                        value={sp.name || ''}
                                        onChange={(e) => {
                                          const updated = [...subplots];
                                          updated[idx] = { ...sp, name: e.target.value };
                                          setSubplots(updated);
                                          storage.setItem(`volumePlan_subplots_${currentProject.id}`, JSON.stringify(updated));
                                        }}
                                        placeholder="支线名称"
                                        InputProps={{
                                          disableUnderline: true,
                                          sx: {
                                            fontSize: '1.25rem',
                                            fontWeight: 'bold',
                                            textAlign: 'left',
                                            color: 'primary.main',
                                            fontFamily: "'ZhuqueFangsong', serif"
                                          }
                                        }}
                                        inputProps={{ style: { textAlign: 'left' } }}
                                        sx={{ mb: 0.5, pr: 6 }}
                                      />

                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5, bgcolor: alpha(theme.palette.background.default, 0.5), px: 1.5, py: 0.5, borderRadius: 999, width: 'fit-content' }}>
                                        <Typography variant="caption" color="text.secondary">从第</Typography>
                                        <TextField
                                          variant="standard"
                                          type="number"
                                          value={volStart}
                                          onChange={(e) => {
                                            const newStart = Math.max(1, parseInt(e.target.value) || 1);
                                            const newEnd = Math.max(newStart, volEnd);
                                            const updated = [...subplots];
                                            updated[idx] = { ...sp, volumeRange: `第${newStart}卷-第${newEnd}卷` };
                                            setSubplots(updated);
                                            storage.setItem(`volumePlan_subplots_${currentProject.id}`, JSON.stringify(updated));
                                          }}
                                          sx={{ width: 30, '& input': { textAlign: 'center', p: 0, fontSize: '0.85rem' } }}
                                          InputProps={{ disableUnderline: true }}
                                        />
                                        <Typography variant="caption" color="text.secondary">卷 至 第</Typography>
                                        <TextField
                                          variant="standard"
                                          type="number"
                                          value={volEnd}
                                          onChange={(e) => {
                                            const newEnd = Math.max(volStart, parseInt(e.target.value) || volStart);
                                            const updated = [...subplots];
                                            updated[idx] = { ...sp, volumeRange: `第${volStart}卷-第${newEnd}卷` };
                                            setSubplots(updated);
                                            storage.setItem(`volumePlan_subplots_${currentProject.id}`, JSON.stringify(updated));
                                          }}
                                          sx={{ width: 30, '& input': { textAlign: 'center', p: 0, fontSize: '0.85rem' } }}
                                          InputProps={{ disableUnderline: true }}
                                        />
                                        <Typography variant="caption" color="text.secondary">卷</Typography>
                                      </Box>

                                      <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.background.default, 0.4), borderRadius: 2, mb: 2 }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 'bold' }}>剧情概要</Typography>
                                        <TextField
                                          fullWidth
                                          multiline
                                          variant="standard"
                                          value={sp.description || ''}
                                          onChange={(e) => {
                                            const updated = [...subplots];
                                            updated[idx] = { ...sp, description: e.target.value };
                                            setSubplots(updated);
                                            storage.setItem(`volumePlan_subplots_${currentProject.id}`, JSON.stringify(updated));
                                          }}
                                          placeholder="描述这条支线的主要情节发展..."
                                          InputProps={{ disableUnderline: true }}
                                          inputProps={{ style: { lineHeight: 1.6, fontSize: '0.9rem' } }}
                                        />
                                      </Box>

                                      <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.background.default, 0.4), borderRadius: 2 }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 'bold' }}>收尾方式</Typography>
                                        <TextField
                                          fullWidth
                                          multiline
                                          variant="standard"
                                          value={sp.resolution || ''}
                                          onChange={(e) => {
                                            const updated = [...subplots];
                                            updated[idx] = { ...sp, resolution: e.target.value };
                                            setSubplots(updated);
                                            storage.setItem(`volumePlan_subplots_${currentProject.id}`, JSON.stringify(updated));
                                          }}
                                          placeholder="这条支线将如何结束或汇入主线？"
                                          InputProps={{ disableUnderline: true }}
                                          inputProps={{ style: { lineHeight: 1.6, fontSize: '0.9rem' } }}
                                        />
                                      </Box>
                                    </Box>
                                  </Card>
                                );
                              })}
                              <Button
                                variant="dashed"
                                startIcon={<IconPlus />}
                                onClick={() => setSubplots([...subplots, {}])}
                                sx={{
                                  py: 2,
                                  borderStyle: 'dashed',
                                  borderColor: 'divider',
                                  color: 'text.secondary',
                                  '&:hover': { borderColor: 'primary.main', color: 'primary.main' }
                                }}
                              >
                                新增一条支线
                              </Button>
                            </Stack>
                          )}
                        </Box>
                      </Box>

                      {/* Right Column: Foreshadowing */}
                      <Box sx={{ flex: 1 }}>
                        {/* 伏笔规划 */}
                        <Box sx={{ mb: 6 }}>
                          <Typography variant="h6" sx={{ mb: 4, fontWeight: 'bold' }}>
                            伏笔规划
                          </Typography>
                          {foreshadowing.length === 0 ? (
                            <Paper variant="outlined" sx={{ py: 10, textAlign: 'center', borderStyle: 'dashed', borderRadius: 4, bgcolor: 'transparent' }}>
                              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>暂无伏笔规划</Typography>
                              <Button variant="outlined" startIcon={<IconPlus />} onClick={() => setForeshadowing([...foreshadowing, {}])} sx={{ borderRadius: 999 }}>添加伏笔</Button>
                            </Paper>
                          ) : (
                            <Stack spacing={4}>
                              {foreshadowing.map((f, idx) => (
                                <Card
                                  key={idx}
                                  variant="outlined"
                                  sx={{
                                    p: 4,
                                    borderRadius: 4,
                                    position: 'relative',
                                    border: '1px solid',
                                    borderColor: alpha(theme.palette.warning.main, 0.2),
                                    bgcolor: alpha(theme.palette.warning.main, 0.01),
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                      borderColor: 'warning.main',
                                      boxShadow: `0 4px 20px ${alpha(theme.palette.warning.main, 0.08)}`
                                    }
                                  }}
                                >
                                  <Tooltip title="删除伏笔">
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() => {
                                        const updated = foreshadowing.filter((_, i) => i !== idx);
                                        setForeshadowing(updated);
                                        storage.setItem(`volumePlan_foreshadowing_${currentProject.id}`, JSON.stringify(updated));
                                      }}
                                      sx={{ position: 'absolute', top: 12, right: 12, opacity: 0.5, '&:hover': { opacity: 1 }, zIndex: 1 }}
                                    >
                                      <IconDelete fontSize="small" />
                                    </IconButton>
                                  </Tooltip>

                                  <Box sx={{ maxWidth: 800, textAlign: 'left' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 2, mb: 1, pr: 7 }}>
                                      <TextField
                                        multiline
                                        variant="standard"
                                        value={f.hint || ''}
                                        onChange={(e) => {
                                          const updated = [...foreshadowing];
                                          updated[idx] = { ...f, hint: e.target.value };
                                          setForeshadowing(updated);
                                          storage.setItem(`volumePlan_foreshadowing_${currentProject.id}`, JSON.stringify(updated));
                                        }}
                                        placeholder="核心伏笔内容"
                                        fullWidth
                                        InputProps={{
                                          disableUnderline: true,
                                          sx: {
                                            fontSize: '1.1rem',
                                            fontWeight: 'bold',
                                            textAlign: 'left',
                                            color: 'text.primary',
                                            fontFamily: "'ZhuqueFangsong', serif"
                                          }
                                        }}
                                      />
                                    </Box>

                                    <Box sx={{ display: 'flex', justifyContent: 'flex-start', gap: 1, mb: 3 }}>
                                      <TextField
                                        size="small"
                                        select
                                        value={f.importance || 'minor'}
                                        onChange={(e) => {
                                          const updated = [...foreshadowing];
                                          updated[idx] = { ...f, importance: e.target.value };
                                          setForeshadowing(updated);
                                          storage.setItem(`volumePlan_foreshadowing_${currentProject.id}`, JSON.stringify(updated));
                                        }}
                                        sx={{ width: 100, '& .MuiOutlinedInput-root': { borderRadius: 999, fontSize: '0.85rem' } }}
                                        SelectProps={{ native: true }}
                                      >
                                        <option value="major">主线关键</option>
                                        <option value="minor">细节铺垫</option>
                                      </TextField>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: 'background.paper', px: 1.5, py: 0.25, borderRadius: 999, border: '1px solid', borderColor: 'divider' }}>
                                        <Typography variant="caption" color="text.secondary">埋设于</Typography>
                                        <TextField
                                          variant="standard"
                                          type="number"
                                          value={f.plantVolume || 1}
                                          onChange={(e) => {
                                            const updated = [...foreshadowing];
                                            updated[idx] = { ...f, plantVolume: Number(e.target.value) };
                                            setForeshadowing(updated);
                                            storage.setItem(`volumePlan_foreshadowing_${currentProject.id}`, JSON.stringify(updated));
                                          }}
                                          sx={{ width: 40 }}
                                          InputProps={{ disableUnderline: true, sx: { fontSize: '0.9rem', fontWeight: 'bold' } }}
                                          inputProps={{ min: 1, style: { textAlign: 'center' } }}
                                        />
                                        <Typography variant="caption" color="text.secondary">卷</Typography>
                                      </Box>

                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: 'background.paper', px: 1.5, py: 0.25, borderRadius: 999, border: '1px solid', borderColor: 'divider' }}>
                                        <Typography variant="caption" color="text.secondary">揭示于</Typography>
                                        <TextField
                                          variant="standard"
                                          type="number"
                                          value={f.revealVolume || 1}
                                          onChange={(e) => {
                                            const updated = [...foreshadowing];
                                            updated[idx] = { ...f, revealVolume: Number(e.target.value) };
                                            setForeshadowing(updated);
                                            storage.setItem(`volumePlan_foreshadowing_${currentProject.id}`, JSON.stringify(updated));
                                          }}
                                          sx={{ width: 40 }}
                                          InputProps={{ disableUnderline: true, sx: { fontSize: '0.9rem', fontWeight: 'bold' } }}
                                          inputProps={{ min: 1, style: { textAlign: 'center' } }}
                                        />
                                        <Typography variant="caption" color="text.secondary">卷</Typography>
                                      </Box>
                                    </Box>
                                  </Box>
                                </Card>
                              ))}
                              <Button
                                variant="dashed"
                                startIcon={<IconPlus />}
                                onClick={() => setForeshadowing([...foreshadowing, {}])}
                                sx={{
                                  py: 2,
                                  borderStyle: 'dashed',
                                  borderColor: 'divider',
                                  color: 'text.secondary',
                                  '&:hover': { borderColor: 'primary.main', color: 'primary.main' }
                                }}
                              >
                                新增一个伏笔
                              </Button>
                            </Stack>
                          )}
                        </Box>
                      </Box>
                    </Stack>
                  </Box>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => setActiveStep(3)}
                    sx={{
                      borderRadius: 999,
                      px: 8,
                      py: 1.2,
                      bgcolor: 'primary.main',
                      fontSize: '1.1rem',
                      boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.3)}`,
                      '&:hover': { bgcolor: 'primary.dark', boxShadow: `0 10px 25px ${alpha(theme.palette.primary.main, 0.4)}` }
                    }}
                  >
                    下一步
                  </Button>
                </Box>
              </Box>
            </>
          )
        }
      </Box >
    );
  };

  const renderStep3Chapters = () => (
    <Box sx={{ py: 6 }}>
      {/* --- Step Header --- */}
      <Box sx={{ mb: 10, textAlign: 'center' }}>
        <Typography variant="h2" sx={{ fontWeight: 'bold', mb: 2, letterSpacing: -1 }}>
          章节细纲
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto', mb: 4, lineHeight: 1.8 }}>
          这是创作的最后一公里。将分卷规划拆解为具体的章节场景，为正式动笔提供最详实的导航图。
        </Typography>
      </Box>

      {/* Volume Selector - Sticky Navigation */}
      <Box
        ref={volumeTabsContainerRef}
        sx={{
          position: 'sticky',
          top: -48,
          zIndex: 100,
          bgcolor: alpha(theme.palette.background.default, 0.9),
          backdropFilter: 'blur(10px)',
          mx: { xs: -2, sm: -4 },
          px: 0,
          py: 2,
          mb: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          scrollSnapType: 'x mandatory',
          '&::-webkit-scrollbar': { display: 'none' }
        }}
      >
        {/* 左侧占位空间，让第一个 Tab 能居中 */}
        <Box sx={{ flexShrink: 0, width: 'calc(50% - 80px)' }} />

        {volumes.map(v => {
          const isSelected = selectedVolumeId === v.id;
          return (
            <Box
              key={v.id}
              data-volume-id={v.id}
              onClick={() => setSelectedVolumeId(v.id)}
              sx={{
                flexShrink: 0,
                cursor: 'pointer',
                px: 2.5,
                py: 1,
                borderRadius: 999,
                border: '1px solid',
                borderColor: isSelected ? 'primary.main' : 'divider',
                bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.background.paper, 0.8),
                transition: 'all 0.2s ease',
                scrollSnapAlign: 'center',
                boxShadow: isSelected ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
                '&:hover': {
                  bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.12) : 'background.paper',
                  borderColor: isSelected ? 'primary.main' : 'primary.light',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                }
              }}
            >
              <Typography variant="body2" sx={{
                fontWeight: isSelected ? 'bold' : 500,
                color: isSelected ? 'primary.main' : 'text.primary',
                fontSize: '0.875rem',
                whiteSpace: 'nowrap'
              }}>
                第 {v.order} 卷 · {v.name}
              </Typography>
            </Box>
          );
        })}

        {/* 右侧占位空间，让最后一个 Tab 能居中 */}
        <Box sx={{ flexShrink: 0, width: 'calc(50% - 80px)' }} />
      </Box>

      {/* 内嵌恢复卡片 - 检测到未完成任务时显示（独立于分卷选择） */}
      {generationProgress && Object.keys(volumePlanStatus).length === 0 && (
        <Paper
          variant="outlined"
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 3,
            bgcolor: alpha(theme.palette.warning.main, 0.08),
            borderColor: 'warning.main',
            borderWidth: 1.5
          }}
        >
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box sx={{
              width: 48, height: 48, borderRadius: 2,
              bgcolor: alpha(theme.palette.warning.main, 0.15),
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <IconWarning sx={{ color: 'warning.main', fontSize: 28 }} />
            </Box>
            <Box flex={1}>
              <Typography variant="subtitle1" fontWeight="bold">
                检测到未完成的生成任务
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {volumes.find(v => v.id === generationProgress.volumeId)?.name || '未知分卷'}：
                已生成 {generationProgress.completedChapters} / {generationProgress.totalChapters} 章
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                color="inherit"
                onClick={() => {
                  clearProgress(generationProgress.volumeId);
                  setGenerationProgress(null);
                  messageApi.info('已放弃未完成的任务');
                }}
                sx={{ borderRadius: 2 }}
              >
                放弃
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleResumeGeneration}
                sx={{ borderRadius: 2 }}
              >
                继续生成
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      {selectedVolumeId ? (
        <Box sx={{ pb: 10 }}>
          <Stack spacing={6}>

            {/* 生成进度卡片 - 如果有生成任务在进行,显示在顶部 */}
            {Object.keys(volumePlanStatus).length > 0 && (
              <Paper variant="outlined" sx={{ py: 6, textAlign: 'center', borderStyle: 'dashed', bgcolor: alpha(theme.palette.primary.main, 0.02), borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                {theme.palette.mode === 'dark' ? (
                  <Box sx={{ position: 'relative', display: 'inline-flex', mb: 2 }}>
                    <CircularProgress size={48} thickness={2} sx={{ color: 'primary.main', opacity: 0.3 }} />
                    <IconAI sx={{ fontSize: 24, color: 'primary.main', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', animation: 'pulse 2s infinite ease-in-out' }} />
                  </Box>
                ) : (
                  <Box component="img" src={LoadingChapterGen} alt="正在规划章节细纲" sx={{ width: 280, mb: 2, mixBlendMode: 'multiply' }} />
                )}
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>正在规划章节细纲...</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {/* 优先显示当前选中分卷的状态,如果没有,则显示第一个正在生成的分卷状态 */}
                  {volumePlanStatus[selectedVolumeId] || Object.values(volumePlanStatus)[0]}
                </Typography>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={<IconClose />}
                  onClick={handleInterruptChapterGeneration}
                  sx={{ borderRadius: 999, px: 3 }}
                >
                  取消生成
                </Button>
              </Paper>
            )}

            {/* 空状态提示 - 仅在没有章节且没有生成任务时显示 */}
            {chapterNodes.length === 0 && Object.keys(volumePlanStatus).length === 0 && (
              <Paper variant="outlined" sx={{ py: 10, textAlign: 'center', borderStyle: 'dashed', bgcolor: 'transparent', borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                {theme.palette.mode === 'dark' ? (
                  <IconRobot color="disabled" sx={{ fontSize: 60, mb: 2 }} />
                ) : (
                  <Box component="img" src={EmptyStateChapter} alt="本卷尚无章节数据" sx={{ width: 280, mb: 2, mixBlendMode: 'multiply' }} />
                )}
                <Typography variant="h6" gutterBottom>本卷尚无章节数据</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>让 AI 为您生成详细的章节场景,为正式动笔提供最详实的导航图。</Typography>
                <Button
                  variant="contained"
                  startIcon={<IconAI />}
                  onClick={() => {
                    const config = { totalChapters: 20, fluctuationProfile: 'rising' };
                    setSingleVolumeGenConfig(config);

                    // Calculate correct start chapter
                    const v = volumes.find(vol => vol.id === selectedVolumeId);
                    if (v) {
                      let startChapter = v.startChapter;
                      if (!startChapter) {
                        if (v.order === 1) {
                          startChapter = 1;
                        } else {
                          const prevVol = volumes.find(vol => vol.order === v.order - 1);
                          if (prevVol && prevVol.endChapter) {
                            startChapter = prevVol.endChapter + 1;
                          } else {
                            startChapter = (v.order - 1) * 20 + 1;
                          }
                        }
                      }
                      // Apply initial fluctuation profile
                      applyFluctuationProfile(selectedVolumeId, 'rising', 20);
                    }

                    setSingleVolumeGenVisible(true);
                  }}
                  sx={{ borderRadius: 999, px: 4 }}
                >
                  为本卷生成章节细纲
                </Button>
              </Paper>
            )}

            {/* 章节列表 - 只要有章节就显示 */}
            {chapterNodes.length > 0 && (
              <>
                {chapterNodes.map(ch => {
                  // Use memoized parsed data instead of parsing on every render
                  const cached = parsedChapterData[ch.id] || {};
                  const scenes = cached.scenes || [];
                  const summaryData = cached.summaryData || { oneSentence: '', summary: '', mainConflict: '', chapterGoal: '', chapterOutcome: '', openQuestions: [], resolvedQuestions: [] };

                  const isExpanded = expandedChapters.has(ch.id);

                  return (
                    <Accordion
                      key={ch.id}
                      expanded={isExpanded}
                      disableGutters
                      onChange={() => handleToggleChapterExpand(ch.id)}
                      TransitionProps={{ timeout: 150, unmountOnExit: true }}
                      sx={{
                        borderRadius: '32px !important',
                        '&:before': { display: 'none' },
                        boxShadow: 'none',
                        transition: (theme) => theme.transitions.create(['background-color', 'border-color'], {
                          duration: theme.transitions.duration.shortest,
                          easing: theme.transitions.easing.easeOut,
                        }),
                        bgcolor: 'transparent',
                        border: '1px solid',
                        borderColor: isExpanded ? 'primary.main' : 'divider',
                        overflow: 'hidden',
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02), borderColor: 'primary.main' }
                      }}
                    >
                      <AccordionSummary
                        expandIcon={<IconExpandMore />}
                        sx={{
                          px: 6,
                          py: 2,
                          minHeight: '64px !important',
                          '& .MuiAccordionSummary-content': {
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            margin: '12px 0 !important'
                          },
                          '&.Mui-expanded': {
                            minHeight: '64px !important'
                          }
                        }}
                      >
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Typography variant="h2" color="primary" sx={{
                            opacity: 1,
                            fontWeight: 900,
                            fontSize: '1.4rem',
                            minWidth: 70,
                            mt: '2px',
                            fontFamily: "'ZhuqueFangsong', serif"
                          }}>
                            {getChineseLabel(ch.order)}
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'text.primary', flexShrink: 0 }}>
                            {ch.title}
                          </Typography>
                          {ch.passionLevel && (
                            <Chip
                              label={`L${ch.passionLevel}`}
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: '0.7rem',
                                borderRadius: 10,
                                bgcolor: alpha(theme.palette.primary.main, 0.08),
                                color: 'primary.main',
                                border: 'none',
                                fontWeight: 'bold',
                                flexShrink: 0,
                                '& .MuiChip-label': { px: 1.5 }
                              }}
                            />
                          )}
                          <Typography
                            variant="body2"
                            sx={{
                              color: 'text.secondary',
                              ml: 2,
                              flex: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              opacity: isExpanded ? 0 : 0.7,
                              transition: 'opacity 0.2s',
                              pointerEvents: 'none'
                            }}
                          >
                            {summaryData.oneSentence}
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} onClick={(e) => e.stopPropagation()}>
                          {sceneGenStatus[ch.id] && <CircularProgress size={16} color="primary" sx={{ mr: 1 }} />}
                          <Box
                            component="span"
                            onClick={() => regenerateScenes(ch)}
                            sx={{
                              p: 0.5,
                              borderRadius: 1,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              '&:hover': { bgcolor: 'action.hover' }
                            }}
                          >
                            <IconSync fontSize="small" />
                          </Box>
                          <Box
                            component="span"
                            onClick={() => handleDeleteChapter(ch)}
                            sx={{
                              p: 0.5,
                              borderRadius: 1,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              color: 'error.main',
                              '&:hover': { bgcolor: 'action.hover' }
                            }}
                          >
                            <IconDelete fontSize="small" />
                          </Box>
                        </Stack>
                      </AccordionSummary>

                      <AccordionDetails sx={{ px: 6, pb: 6, pt: 6 }}>
                        <Stack spacing={4}>
                          {/* 摘要与冲突 */}
                          <TextField
                            fullWidth
                            multiline
                            label="一句话摘要"
                            variant="outlined"
                            value={summaryData.oneSentence || ''}
                            onChange={(e) => handleUpdateChapterSummaryJSON(ch, 'oneSentence', e.target.value)}
                            placeholder="描述章节一句话核心"
                            InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                          />

                          <TextField
                            fullWidth
                            multiline
                            label="核心冲突"
                            variant="outlined"
                            value={summaryData.mainConflict || ''}
                            onChange={(e) => handleUpdateChapterSummaryJSON(ch, 'mainConflict', e.target.value)}
                            placeholder="描述章节驱动冲突"
                            InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                          />

                          <TextField
                            fullWidth
                            multiline
                            label="详细内容"
                            variant="outlined"
                            minRows={3}
                            value={summaryData.summary || ''}
                            onChange={(e) => handleUpdateChapterSummaryJSON(ch, 'summary', e.target.value)}
                            placeholder="章节细纲详细叙事流程..."
                            InputLabelProps={{ sx: { fontWeight: 'bold' } }}
                          />

                          {/* 场景明细 */}
                          <Box>
                            <Divider sx={{ mb: 6, opacity: 0.5 }} />
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 4 }}>
                              <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'primary.main', opacity: 0.6 }} />
                              <Typography variant="caption" color="primary" fontWeight="bold" sx={{ fontSize: '0.75rem', letterSpacing: 2 }}>场景分镜 ({(scenes || []).length})</Typography>
                            </Box>

                            <Stack spacing={0} sx={{ ml: 0.2 }}>
                              {(scenes || []).map((s, idx) => {
                                const isLast = idx === scenes.length - 1;
                                const chars = Array.isArray(s.characters) ? s.characters.join('、') : s.characters;

                                return (
                                  <Box key={idx} sx={{
                                    position: 'relative',
                                    pb: 4,
                                    '&:hover .scene-actions': { opacity: 1 }
                                  }}>
                                    <Card variant="outlined" sx={{
                                      flexGrow: 1,
                                      p: 3,
                                      bgcolor: 'background.default',
                                      borderRadius: 4,
                                      transition: 'all 0.2s',
                                      border: '1px solid',
                                      borderColor: 'divider',
                                      '&:hover': {
                                        borderColor: 'primary.light',
                                        bgcolor: 'background.paper',
                                        transform: 'translateX(4px)',
                                        '& .scene-actions': { opacity: 1 }
                                      }
                                    }}>
                                      <Box sx={{ flexGrow: 1 }}>
                                        {/* Scene Title (Location & Characters) - Editable */}
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                                          <Stack direction="row" spacing={1.5} alignItems="center">
                                            <Typography variant="body2" sx={{
                                              fontWeight: 1000,
                                              color: 'primary.main',
                                              fontSize: '0.85rem',
                                              minWidth: 24,
                                              mr: 0.5
                                            }}>
                                              {String(idx + 1).padStart(2, '0')}
                                            </Typography>
                                            <TextField
                                              variant="standard"
                                              placeholder="地点"
                                              value={s.location || s.loc || ''}
                                              onChange={(e) => handleUpdateChapterScene(ch, idx, 'location', e.target.value)}
                                              sx={{ width: 'auto', minWidth: 80, maxWidth: 240 }}
                                              InputProps={{
                                                disableUnderline: true,
                                                sx: { fontSize: '0.875rem', fontWeight: 'bold', color: 'text.primary' }
                                              }}
                                            />

                                            {/* Character Avatars */}
                                            <Box
                                              onClick={(e) => setEditingSceneChars({ chId: ch.id, sceneIdx: idx, anchorEl: e.currentTarget })}
                                              sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1,
                                                ml: 1.5,
                                                cursor: 'pointer',
                                                p: 0.5,
                                                borderRadius: 2,
                                                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) }
                                              }}
                                            >
                                              <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: '0.7rem', border: '1.5px solid #fff' } }}>
                                                {(Array.isArray(s.characters) ? s.characters : (s.characters ? s.characters.split(/[、,，\s]+/).filter(Boolean) : [])).map((name, cidx) => {
                                                  const charObj = characters.find(c => c.name === name);
                                                  return (
                                                    <Tooltip key={cidx} title={name}>
                                                      <Avatar src={charObj?.avatar} sx={{ bgcolor: charObj?.color || 'primary.main', fontWeight: 'bold' }}>
                                                        {name[0]}
                                                      </Avatar>
                                                    </Tooltip>
                                                  );
                                                })}
                                              </AvatarGroup>
                                              {(!s.characters || s.characters.length === 0) && (
                                                <Typography variant="caption" color="text.disabled">添加角色...</Typography>
                                              )}
                                            </Box>
                                          </Stack>

                                          {/* Scene Actions */}
                                          <Box className="scene-actions" sx={{ opacity: 0, transition: 'opacity 0.2s' }}>
                                            <IconButton size="small" color="error" sx={{ opacity: 0.6, '&:hover': { opacity: 1 } }} onClick={async () => {
                                              if (!window.confirm('确定要删除这个场景吗？')) return;
                                              const nextScenes = scenes.filter((_, sIdx) => sIdx !== idx);
                                              let parsed = {};
                                              try { parsed = JSON.parse(ch.summary || '{}'); } catch { }
                                              parsed.scenes = nextScenes;
                                              await storage.updateItem('chapter_nodes', { ...ch, summary: JSON.stringify(parsed), updatedAt: new Date().toISOString() });
                                              await refreshChapters(ch.volumeId);
                                              messageApi.success('已删除场景');
                                            }}>
                                              <IconDelete sx={{ fontSize: 16 }} />
                                            </IconButton>
                                          </Box>
                                        </Box>

                                        {/* Action - Editable */}
                                        <TextField
                                          fullWidth
                                          multiline
                                          variant="standard"
                                          placeholder="记录场景的主要行动..."
                                          value={s.action || ''}
                                          onChange={(e) => handleUpdateChapterScene(ch, idx, 'action', e.target.value)}
                                          InputProps={{
                                            disableUnderline: true,
                                            sx: { fontSize: '0.9rem', lineHeight: 1.7, color: 'text.primary', mb: 1.5 }
                                          }}
                                        />

                                        {/* Conflict & Outcome - Minimalist Style */}
                                        <Stack direction="row" spacing={3}>
                                          <Box sx={{
                                            flex: 1,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 0.5,
                                            pl: 1.5,
                                            borderLeft: '3px solid',
                                            borderColor: alpha(theme.palette.error.main, 0.3)
                                          }}>
                                            <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 'bold', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                                              冲突
                                            </Typography>
                                            <TextField
                                              fullWidth
                                              multiline
                                              variant="standard"
                                              placeholder="本场冲突点..."
                                              value={s.conflict || ''}
                                              onChange={(e) => handleUpdateChapterScene(ch, idx, 'conflict', e.target.value)}
                                              InputProps={{
                                                disableUnderline: true,
                                                sx: { fontSize: '0.8rem', color: 'text.primary', lineHeight: 1.5 }
                                              }}
                                            />
                                          </Box>
                                          <Box sx={{
                                            flex: 1,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 0.5,
                                            pl: 1.5,
                                            borderLeft: '3px solid',
                                            borderColor: alpha(theme.palette.success.main, 0.3)
                                          }}>
                                            <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 'bold', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                                              结果
                                            </Typography>
                                            <TextField
                                              fullWidth
                                              multiline
                                              variant="standard"
                                              placeholder="场景结果..."
                                              value={s.outcome || ''}
                                              onChange={(e) => handleUpdateChapterScene(ch, idx, 'outcome', e.target.value)}
                                              InputProps={{
                                                disableUnderline: true,
                                                sx: { fontSize: '0.8rem', color: 'text.primary', lineHeight: 1.5 }
                                              }}
                                            />
                                          </Box>
                                        </Stack>
                                      </Box>
                                    </Card>
                                  </Box>
                                );
                              })}

                              {scenes.length === 0 && (
                                <Box sx={{ py: 6, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
                                  <Typography variant="caption" color="text.disabled">暂无场景分镜数据</Typography>
                                </Box>
                              )}
                            </Stack>
                          </Box>
                        </Stack>
                      </AccordionDetails>
                    </Accordion>
                  );
                })
                }
              </>
            )}
          </Stack>
        </Box>
      ) : (
        <Paper variant="outlined" sx={{ py: 10, textAlign: 'center', borderStyle: 'dashed', bgcolor: 'transparent', borderRadius: 4 }}>
          {theme.palette.mode === 'dark' ? (
            <IconSelect sx={{ fontSize: 60, mb: 2, opacity: 0.5, color: 'text.secondary' }} />
          ) : (
            <Box component="img" src={EmptyStateChapterSelect} alt="请选择分卷" sx={{ width: 280, mb: 2, mixBlendMode: 'multiply' }} />
          )}
          <Typography color="text.secondary">请从上方选择一个分卷以查看章节内容</Typography>
        </Paper>
      )}
    </Box>
  );

  const getRefTitle = (step) => {
    switch (step) {
      case 2: return "核心大纲参考";
      case 3: return "当前进度参考";
      default: return "核心设想参考";
    }
  };

  // Helper: Apply template
  // Helper: Apply template (Internal)
  const doApplyTemplate = (t) => {
    setFormIdea({
      ...formIdea,
      mainPlot: t.storyFields?.mainPlot || '',
      mainConflict: t.storyFields?.mainConflict || '',
      storyBeginning: t.storyFields?.storyBeginning || '',
      expectedEnding: t.storyFields?.expectedEnding || '',
      timePeriod: t.worldFields?.timePeriod || '',
      mainSettings: t.worldFields?.mainSettings || '',
      worldFeatures: t.worldFields?.worldFeatures || '',
      socialRules: t.worldFields?.socialRules || ''
    });
    setOutlineOptions(t.options || { novelType: '', targetAudience: [], tone: '', length: 'medium', characterCount: 4, narrativeStyle: '', literaryDepth: '' });
    setCharacterPresets(Array.isArray(t.characters) ? t.characters : []);
    messageApi.success(`已应用模板: ${t.name}`);
    setSwitchTemplateVisible(false);
    setPendingTemplate(null);
  };

  // Helper: Entry point for template application
  const applyTemplate = (t) => {
    // Check if form has content
    const hasContent = formIdea.mainPlot || formIdea.mainConflict || formIdea.storyBeginning || formIdea.expectedEnding ||
      characterPresets.length > 0;

    if (hasContent) {
      setPendingTemplate(t);
      setSwitchTemplateVisible(true);
    } else {
      doApplyTemplate(t);
    }
  };

  // Step 0: Template Library
  const renderTemplateLibrary = () => {
    // Clear template handler
    const handleClearTemplate = () => {
      setFormIdea({
        mainPlot: '',
        mainConflict: '',
        storyBeginning: '',
        expectedEnding: '',
        timePeriod: '',
        mainSettings: '',
        worldFeatures: '',
        socialRules: ''
      });
      setOutlineOptions({
        novelType: '',
        targetAudience: [],
        tone: '',
        length: '',
        characterCount: 0,
        narrativeStyle: '',
        literaryDepth: ''
      });
      setCharacterPresets([]);
      messageApi.success('已清空模板');
    };

    return (
      <Stack spacing={3} sx={{ p: 2 }}>
        {/* AI Generate Template */}
        <Button
          variant="contained"
          size="small"
          startIcon={<IconAI />}
          onClick={() => setGenTemplateVisible(true)}
          sx={{ borderRadius: 2 }}
        >
          AI 生成模板
        </Button>

        {/* Clear Template */}
        <Button
          variant="outlined"
          size="small"
          startIcon={<IconClose />}
          onClick={handleClearTemplate}
          sx={{ borderRadius: 2 }}
        >
          清空模板
        </Button>

        {/* Save as Template */}
        <Button
          variant="outlined"
          size="small"
          startIcon={<IconSave />}
          onClick={() => setSaveTemplateVisible(true)}
          sx={{ borderRadius: 2 }}
        >
          保存为模板
        </Button>

        <Divider />

        {/* Custom Templates */}
        {customTemplates.length > 0 && (
          <>
            <Box>
              <Typography variant="overline" color="primary" fontWeight="bold" sx={{ letterSpacing: 1 }}>
                自定义模板
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, lineHeight: 1.4 }}>
                你保存的个性化模板
              </Typography>
            </Box>
            <Stack spacing={1.5}>
              {customTemplates.map(t => (
                <Paper
                  key={t.id}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' }
                  }}
                  onClick={() => applyTemplate(t)}
                >
                  <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flex: 1 }}>
                      <Typography fontSize={24}>{t.icon || '📝'}</Typography>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" fontWeight="bold" display="block">{t.name}</Typography>
                        {t.description && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', lineHeight: 1.2 }}>
                            {t.description}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); deleteCustomTemplate(t.id); }}>
                      <IconDelete sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </Paper>
              ))}
            </Stack>
            <Divider />
          </>
        )}

        {/* Template Library Header */}
        <Box>
          <Typography variant="overline" color="primary" fontWeight="bold" sx={{ letterSpacing: 1 }}>
            叙事模板库
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, lineHeight: 1.4 }}>
            快速应用预设模板开始创作
          </Typography>
        </Box>

        {/* Built-in Templates by Category */}
        <Stack spacing={1}>
          {templateCategories.map(cat => {
            const templatesInCategory = outlineTemplates.filter(t => t.category === cat.key);
            if (templatesInCategory.length === 0) return null;
            return (
              <Accordion
                key={cat.key}
                defaultExpanded={cat.key === 'serious'}
                disableGutters
                elevation={0}
                sx={{
                  bgcolor: 'transparent',
                  '&:before': { display: 'none' },
                  '& .MuiAccordionSummary-root': {
                    minHeight: 'unset',
                    px: 1.5,
                    py: 1,
                    borderRadius: 1.5,
                    '&:hover': { bgcolor: 'action.hover' }
                  },
                  '& .MuiAccordionSummary-content': { my: 0.5 }
                }}
              >
                <AccordionSummary
                  expandIcon={<IconExpandMore sx={{ fontSize: 18 }} />}
                >
                  <Box>
                    <Typography variant="caption" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {cat.label}
                      <Chip size="small" label={templatesInCategory.length} sx={{ height: 16, fontSize: '0.65rem', ml: 0.5 }} />
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                      {cat.description}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 1, pb: 1 }}>
                  <Stack spacing={1}>
                    {templatesInCategory.map(t => (
                      <Paper
                        key={t.id}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' }
                        }}
                        onClick={() => applyTemplate(t)}
                      >
                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                          <Typography fontSize={24}>{t.icon || '📝'}</Typography>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" fontWeight="bold" display="block">{t.name}</Typography>
                            {t.description && (
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', lineHeight: 1.2 }}>
                                {t.description}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </Paper>
                    ))}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Stack>
      </Stack>
    );
  };

  // Step 1: Idea Summary
  const renderIdeaSummary = () => (
    <Stack spacing={3} sx={{ p: 2 }}>
      {/* Action Buttons */}
      <Stack spacing={1.5}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => setImportOutlineVisible(true)}
          startIcon={<IconUpload />}
          sx={{ borderRadius: 2 }}
        >
          导入核心大纲
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={handleExportCoreOutline}
          startIcon={<IconDownload />}
          sx={{ borderRadius: 2 }}
          disabled={!outlineJSON}
        >
          导出核心大纲
        </Button>
        <Button
          variant="outlined"
          size="small"
          color="error"
          onClick={handleDeleteCoreOutline}
          startIcon={<IconDelete />}
          sx={{ borderRadius: 2 }}
          disabled={!outlineJSON}
        >
          删除核心大纲
        </Button>
        <Divider sx={{ my: 0.5 }} />
        <Button
          variant="contained"
          size="small"
          onClick={() => setRefineDialogVisible(true)}
          startIcon={<IconAI />}
          sx={{ borderRadius: 2 }}
          disabled={!outlineJSON || coreStatus.loading}
        >
          重新生成大纲
        </Button>
      </Stack>

      <Divider />

      {/* Story Concept */}
      <Box>
        <Typography variant="overline" color="primary" fontWeight="bold" sx={{ mb: 2, letterSpacing: 1 }}>
          故事构思
        </Typography>
        <Stack spacing={2}>
          <Box>
            <Typography variant="caption" color="primary" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>故事主线</Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.6 }}>{formIdea.mainPlot || '待补完'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="primary" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>主要冲突</Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.6 }}>{formIdea.mainConflict || '待补完'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="primary" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>故事开端</Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.6 }}>{formIdea.storyBeginning || '待补完'}</Typography>
          </Box>
          {formIdea.expectedEnding && (
            <Box>
              <Typography variant="caption" color="primary" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>预计结局</Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.6 }}>{formIdea.expectedEnding}</Typography>
            </Box>
          )}
        </Stack>
      </Box>

      <Divider />

      {/* World Setting */}
      <Box>
        <Typography variant="overline" color="primary" fontWeight="bold" sx={{ mb: 2, letterSpacing: 1 }}>
          世界设定
        </Typography>
        <Stack spacing={2}>
          <Box>
            <Typography variant="caption" color="primary" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>时代背景</Typography>
            <Typography variant="body2">{formIdea.timePeriod || '待定'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="primary" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>主要场景</Typography>
            <Typography variant="body2">{formIdea.mainSettings || '待定'}</Typography>
          </Box>
          {formIdea.worldFeatures && (
            <Box>
              <Typography variant="caption" color="primary" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>世界特色</Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.6 }}>{formIdea.worldFeatures}</Typography>
            </Box>
          )}
        </Stack>
      </Box>

      <Divider />

      {/* Character Presets */}
      <Box>
        <Typography variant="overline" color="primary" fontWeight="bold" sx={{ mb: 2, letterSpacing: 1 }}>
          角色预设 ({characterPresets.length})
        </Typography>
        <Stack spacing={1.5}>
          {characterPresets.map((c, i) => (
            <Box key={i} sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" fontWeight="bold" display="block">{c.name} · {c.role}</Typography>
              {c.description && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', lineHeight: 1.4 }}>
                  {c.description}
                </Typography>
              )}
            </Box>
          ))}
          {characterPresets.length === 0 && (
            <Typography variant="caption" color="text.secondary">尚未添加预设角色</Typography>
          )}
        </Stack>
      </Box>
    </Stack>
  );

  // Step 2: Outline Summary
  const renderOutlineSummary = () => {
    if (!outlineJSON) {
      return (
        <Box sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary">暂无核心大纲数据</Typography>
        </Box>
      );
    }

    return (
      <Stack spacing={3} sx={{ p: 2 }}>
        {/* Action Buttons */}
        <Stack spacing={1.5}>
          <Button
            variant="contained"
            size="small"
            onClick={() => setGenVolumeVisible(true)}
            startIcon={<IconAI />}
            sx={{ borderRadius: 2 }}
          >
            自动规划分卷
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<IconPlus />}
            onClick={() => {
              const newOrder = volumes.length + 1;
              storage.addItem('volumes', {
                projectId: currentProject.id,
                name: `第 ${newOrder} 卷`,
                description: '',
                order: newOrder,
                createdAt: new Date().toISOString()
              }).then(() => refreshVolumes());
            }}
            sx={{ borderRadius: 2 }}
          >
            手动添加分卷
          </Button>
        </Stack>

        {/* Import & AI Optimize Buttons */}
        <Stack spacing={1.5}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<IconUpload />}
            onClick={() => setImportVolumeModalVisible(true)}
            sx={{ borderRadius: 2 }}
          >
            导入分卷配置
          </Button>
          {volumes.length > 0 && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<IconAI />}
              onClick={() => setRefineVolumeDialogVisible(true)}
              disabled={volumeStatus.loading || refineVolumeLoading}
              sx={{ borderRadius: 2 }}
            >
              AI 优化分卷
            </Button>
          )}
        </Stack>

        <Divider />
        <Stack spacing={4} sx={{ p: 2 }}>
          {/* Story Overview */}
          <Box>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
              {outlineJSON.title || '未命名小说'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
              {outlineJSON.logline || '暂无概括'}
            </Typography>
          </Box>

          <Divider />

          {/* Plot Progression */}
          <Box>
            <Typography variant="overline" color="primary" fontWeight="bold" sx={{ mb: 2, letterSpacing: 1 }}>
              剧情走向
            </Typography>
            <List dense>
              {(outlineJSON.plotProgression || []).map((p, i) => (
                <ListItem key={i} disablePadding sx={{ mb: 1 }}>
                  <Typography variant="caption" sx={{ lineHeight: 1.4 }}>
                    {i + 1}. {typeof p === 'string' ? p : p.summary || p}
                  </Typography>
                </ListItem>
              ))}
            </List>
          </Box>

          <Divider />

          {/* Main Characters */}
          <Box>
            <Typography variant="overline" color="primary" fontWeight="bold" sx={{ mb: 2, letterSpacing: 1 }}>
              主要角色
            </Typography>
            <Stack spacing={1.5}>
              {(outlineJSON.characters || characters).slice(0, 6).map((c, i) => (
                <Box key={i} sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="caption" fontWeight="bold" display="block">
                    {c.name} · {c.role}
                  </Typography>
                  {(c.personality || c.traits) && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', lineHeight: 1.4 }}>
                      {c.personality || c.traits}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          </Box>
        </Stack>
      </Stack>
    );
  };

  // Step 3: Volume Summary
  const renderVolumeSummary = () => {
    const selectedVolume = volumes.find(v => v.id === selectedVolumeId);

    if (!selectedVolume) {
      return (
        <Box sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary">请选择一个分卷查看详情</Typography>
        </Box>
      );
    }

    return (
      <Stack spacing={4} sx={{ p: 2 }}>
        {/* Action Button */}
        <Box>
          <Button
            fullWidth
            variant="contained"
            size="small"
            disabled={!!Object.keys(volumePlanStatus).length}
            onClick={() => {
              const ids = new Set();
              const configs = {};
              if (selectedVolumeId) ids.add(selectedVolumeId);
              else volumes.forEach(v => ids.add(v.id));

              const defaultChapters = totalChaptersInVolume || 5;
              volumes.forEach(v => {
                configs[v.id] = { totalChapters: defaultChapters };
              });

              setGenChaptersVolumeIds(ids);
              setBatchVolumeConfigs(configs);
              setActivePreviewVid(selectedVolumeId || (volumes[0]?.id));
              setGenChaptersVisible(true);
              if (!totalChaptersInVolume) setTotalChaptersInVolume(5);
            }}
            startIcon={<IconAI />}
            sx={{ borderRadius: 2 }}
          >
            批量生成章节细纲
          </Button>
        </Box>

        <Divider />

        {/* Volume Title */}
        <Box>
          <Typography variant="overline" color="text.secondary">第 {selectedVolume.order} 卷</Typography>
          <Typography variant="h6" fontWeight="bold" sx={{ mt: 0.5 }}>{selectedVolume.name}</Typography>
        </Box>

        <Divider />

        {/* Volume Outline (Description) */}
        <Box>
          <Typography variant="overline" color="primary" fontWeight="bold" sx={{ mb: 1, letterSpacing: 1 }}>
            本卷大纲
          </Typography>
          {selectedVolume.description ? (
            <Typography variant="body2" sx={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {selectedVolume.description}
            </Typography>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              暂无本卷大纲,请在分卷规划中填写
            </Typography>
          )}
        </Box>

        {/* Summary (if exists) */}
        {selectedVolume.summary && (
          <Box>
            <Typography variant="overline" color="primary" fontWeight="bold" sx={{ mb: 1, letterSpacing: 1 }}>
              分卷摘要
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
              {selectedVolume.summary}
            </Typography>
          </Box>
        )}

        {/* Volume Goal */}
        {selectedVolume.mainGoal && (
          <Box>
            <Typography variant="overline" color="primary" fontWeight="bold" sx={{ mb: 1, letterSpacing: 1 }}>
              本卷目标
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
              {selectedVolume.mainGoal}
            </Typography>
          </Box>
        )}

        {/* Key Events */}
        {selectedVolume.keyEvents && selectedVolume.keyEvents.length > 0 && (
          <Box>
            <Typography variant="overline" color="primary" fontWeight="bold" sx={{ mb: 1, letterSpacing: 1 }}>
              关键事件
            </Typography>
            <List dense>
              {selectedVolume.keyEvents.map((event, i) => (
                <ListItem key={i} disablePadding sx={{ mb: 1 }}>
                  <Typography variant="caption" sx={{ lineHeight: 1.4 }}>• {event}</Typography>
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </Stack>
    );
  };

  const renderRefPanelContent = () => {
    // Step 0: Core Idea - Show Template Library
    if (activeStep === 0) {
      return renderTemplateLibrary();
    }

    // Step 1: Core Outline - Show Idea Summary
    if (activeStep === 1) {
      return renderIdeaSummary();
    }

    // Step 2: Volume Planning - Show Outline Summary
    if (activeStep === 2) {
      return renderOutlineSummary();
    }

    // Step 3: Chapter Outlines - Show Volume Summary
    if (activeStep === 3) {
      return renderVolumeSummary();
    }

    return null;
  };

  const renderReviewDialog = () => (
    <Dialog
      open={reviewDialogVisible}
      onClose={() => setReviewDialogVisible(false)}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          bgcolor: 'background.default',
          boxShadow: '0 20px 50px rgba(0,0,0,0.12)',
          overflow: 'hidden',
          position: 'relative'
        }
      }}
    >
      <DialogTitle sx={{
        textAlign: 'center',
        pt: 6,
        pb: 6,
        fontFamily: "'ZhuqueFangsong', serif",
        fontSize: '2.8rem',
        fontWeight: 'bold',
        color: 'text.primary',
        letterSpacing: 1
      }}>
        核心构思审阅
      </DialogTitle>
      <DialogContent sx={{
        px: 8,
        py: 4,
        position: 'relative'
      }}>
        <Stack spacing={8} sx={{ fontFamily: "'ZhuqueFangsong', serif", position: 'relative', zIndex: 1 }}>
          {/* Section 01: Story Concept */}
          <Box>
            <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 2.5 }}>
              <Typography variant="h5" color="primary" sx={{ opacity: 0.8, fontWeight: 900, lineHeight: 1, fontSize: '1.8rem' }}>01</Typography>
              <Typography variant="h5" color="text.primary" fontWeight="bold" sx={{ letterSpacing: 2 }}>故事构思</Typography>
            </Box>
            <Divider sx={{ mb: 3, borderColor: alpha(theme.palette.primary.main, 0.2) }} />
            <Stack spacing={2.5}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1 }}>
                  <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'primary.main', opacity: 0.6 }} />
                  <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'primary.main', fontWeight: 'bold', letterSpacing: 2 }}>故事主线</Typography>
                </Box>
                <Typography variant="body2" sx={{
                  pl: 1.7,
                  lineHeight: 1.5,
                  letterSpacing: '0.03em',
                  color: 'text.primary'
                }}>
                  {formIdea.mainPlot || '待补完'}
                </Typography>
              </Box>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1 }}>
                  <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'primary.main', opacity: 0.6 }} />
                  <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'primary.main', fontWeight: 'bold', letterSpacing: 2 }}>主要冲突</Typography>
                </Box>
                <Typography variant="body2" sx={{
                  pl: 1.7,
                  lineHeight: 1.5,
                  letterSpacing: '0.03em',
                  color: 'text.primary'
                }}>
                  {formIdea.mainConflict || '待补完'}
                </Typography>
              </Box>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1 }}>
                  <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'primary.main', opacity: 0.6 }} />
                  <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'primary.main', fontWeight: 'bold', letterSpacing: 2 }}>故事开端</Typography>
                </Box>
                <Typography variant="body2" sx={{
                  pl: 1.7,
                  lineHeight: 1.5,
                  letterSpacing: '0.03em',
                  color: 'text.primary'
                }}>
                  {formIdea.storyBeginning || '待补完'}
                </Typography>
              </Box>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1 }}>
                  <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'primary.main', opacity: 0.6 }} />
                  <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'primary.main', fontWeight: 'bold', letterSpacing: 2 }}>预计结局 (可选)</Typography>
                </Box>
                <Typography variant="body2" sx={{
                  pl: 1.7,
                  lineHeight: 1.5,
                  letterSpacing: '0.03em',
                  color: 'text.primary'
                }}>
                  {formIdea.expectedEnding || '待补完'}
                </Typography>
              </Box>
            </Stack>
          </Box>

          {/* Section 02: World Setting */}
          <Box>
            <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 2.5 }}>
              <Typography variant="h5" color="primary" sx={{ opacity: 0.8, fontWeight: 900, lineHeight: 1, fontSize: '1.8rem' }}>02</Typography>
              <Typography variant="h5" color="text.primary" fontWeight="bold" sx={{ letterSpacing: 2 }}>世界设定</Typography>
            </Box>
            <Divider sx={{ mb: 3, borderColor: alpha(theme.palette.primary.main, 0.2) }} />
            <Stack spacing={2.5}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1 }}>
                  <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'primary.main', opacity: 0.6 }} />
                  <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'primary.main', fontWeight: 'bold', letterSpacing: 2 }}>时代背景 与 主要场景</Typography>
                </Box>
                <Typography variant="body2" sx={{
                  pl: 1.7,
                  lineHeight: 1.5,
                  letterSpacing: '0.03em',
                  color: 'text.primary'
                }}>
                  <strong>{formIdea.timePeriod || '待定'}</strong> · {formIdea.mainSettings || '待定'}
                </Typography>
              </Box>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1 }}>
                  <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'primary.main', opacity: 0.6 }} />
                  <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'primary.main', fontWeight: 'bold', letterSpacing: 2 }}>世界特色与规则</Typography>
                </Box>
                <Typography variant="body2" sx={{
                  pl: 1.7,
                  lineHeight: 1.5,
                  letterSpacing: '0.03em',
                  color: 'text.primary'
                }}>
                  {formIdea.worldFeatures || '待补完'}
                </Typography>
              </Box>
            </Stack>
          </Box>

          {/* Section 03: Specifications */}
          <Box>
            <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 2.5 }}>
              <Typography variant="h5" color="primary" sx={{ opacity: 0.8, fontWeight: 900, lineHeight: 1, fontSize: '1.8rem' }}>03</Typography>
              <Typography variant="h5" color="text.primary" fontWeight="bold" sx={{ letterSpacing: 2 }}>角色预设与规格</Typography>
            </Box>
            <Divider sx={{ mb: 3, borderColor: alpha(theme.palette.primary.main, 0.2) }} />

            <Stack spacing={3}>
              {/* Row 1: Character Presets */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1 }}>
                  <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'primary.main', opacity: 0.6 }} />
                  <Typography variant="caption" sx={{
                    fontSize: '0.75rem',
                    color: 'primary.main',
                    fontWeight: 'bold',
                    letterSpacing: 2
                  }}>
                    角色预设 ({(Array.isArray(characterPresets) ? characterPresets : []).length})
                  </Typography>
                </Box>
                <Grid container spacing={3} sx={{ pl: 1.7 }}>
                  {(Array.isArray(characterPresets) ? characterPresets : []).map((c, i) => (
                    <Grid size={6} key={i}>
                      <Box sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.03), borderRadius: 2, border: `0.5px solid ${alpha(theme.palette.primary.main, 0.1)}` }}>
                        <Typography variant="body2" sx={{ fontSize: '0.95rem', mb: 0.5, color: 'text.primary' }}>
                          <strong>{c.name}</strong> · <span style={{ color: 'var(--mui-palette-primary-main)', opacity: 0.9 }}>{c.role}</span>
                        </Typography>
                        {c.description && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic', opacity: 0.7, lineHeight: 1.2 }}>
                            {c.description.slice(0, 60)}{c.description.length > 60 ? '...' : ''}
                          </Typography>
                        )}
                      </Box>
                    </Grid>
                  ))}
                  {(Array.isArray(characterPresets) ? characterPresets : []).length === 0 && <Grid size={12}><Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.disabled' }}>暂无预设角色数据</Typography></Grid>}
                </Grid>
              </Box>

              {/* Row 2: Parameters (Single Row Align) */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1 }}>
                  <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'primary.main', opacity: 0.6 }} />
                  <Typography variant="caption" sx={{
                    fontSize: '0.75rem',
                    color: 'primary.main',
                    fontWeight: 'bold',
                    letterSpacing: 2
                  }}>
                    叙事规格参数
                  </Typography>
                </Box>
                <Box sx={{ pl: 1.7 }}>
                  <Grid container columnSpacing={10} rowSpacing={4}>
                    <Grid size={2}>
                      <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.disabled', fontWeight: 'bold', letterSpacing: 2, display: 'block', mb: 0.8, height: 20 }}>文学体裁</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 32 }}>
                        <Chip
                          label={outlineOptions.novelType || '未指定'}
                          size="small"
                          variant="outlined"
                          sx={{ borderColor: alpha(theme.palette.primary.main, 0.4), color: 'primary.main', borderRadius: 1, fontWeight: 'bold' }}
                        />
                      </Box>
                    </Grid>
                    <Grid size={2}>
                      <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.disabled', fontWeight: 'bold', letterSpacing: 2, display: 'block', mb: 0.8, height: 20 }}>预期体量</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 32 }}>
                        <Chip
                          label={outlineOptions.length === 'short' ? '短篇' : outlineOptions.length === 'long' ? '长篇' : '中篇'}
                          size="small"
                          variant="outlined"
                          sx={{ borderColor: alpha(theme.palette.primary.main, 0.4), color: 'primary.main', borderRadius: 1, fontWeight: 'bold' }}
                        />
                      </Box>
                    </Grid>
                    <Grid size={2}>
                      <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.disabled', fontWeight: 'bold', letterSpacing: 2, display: 'block', mb: 0.8, height: 20 }}>叙事席位</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 32 }}>
                        <Chip
                          label={`${outlineOptions.characterCount} 人`}
                          size="small"
                          variant="outlined"
                          sx={{ borderColor: alpha(theme.palette.primary.main, 0.4), color: 'primary.main', borderRadius: 1, fontWeight: 'bold' }}
                        />
                      </Box>
                    </Grid>
                    <Grid size={2}>
                      <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.disabled', fontWeight: 'bold', letterSpacing: 2, display: 'block', mb: 0.8, height: 20 }}>情感基调</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 32 }}>
                        <Chip
                          label={outlineOptions.tone || '未指定'}
                          size="small"
                          variant="outlined"
                          sx={{ borderColor: alpha(theme.palette.primary.main, 0.4), color: 'primary.main', borderRadius: 1, fontWeight: 'bold' }}
                        />
                      </Box>
                    </Grid>
                    <Grid size={4}>
                      <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.disabled', fontWeight: 'bold', letterSpacing: 2, display: 'block', mb: 0.8, height: 20 }}>目标受众</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, minHeight: 32, alignItems: 'center' }}>
                        {(outlineOptions.targetAudience || []).length > 0 ? (outlineOptions.targetAudience || []).map(a => (
                          <Chip
                            key={a}
                            label={a}
                            size="small"
                            variant="outlined"
                            sx={{ borderColor: alpha(theme.palette.primary.main, 0.4), color: 'primary.main', borderRadius: 1, fontWeight: 'bold' }}
                          />
                        )) : (
                          <Chip
                            label="未指定"
                            size="small"
                            variant="outlined"
                            sx={{ borderColor: 'rgba(0, 0, 0, 0.1)', color: 'text.disabled', borderRadius: 1, fontWeight: 'bold' }}
                          />
                        )}
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
              </Box>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center', pb: 10, pt: 6, gap: 6, position: 'relative', zIndex: 1 }}>
        <Button
          onClick={() => setReviewDialogVisible(false)}
          variant="outlined"
          sx={{
            borderRadius: 999,
            px: 8,
            py: 1.2,
            borderColor: 'primary.main',
            color: 'primary.main',
            '&:hover': { borderColor: 'primary.dark', bgcolor: alpha(theme.palette.primary.main, 0.05) }
          }}
        >
          返回重修
        </Button>
        <Button
          onClick={() => {
            setReviewDialogVisible(false);
            handleGenerateCoreOutline();
            setActiveStep(1);
          }}
          variant="contained"
          sx={{
            borderRadius: 999,
            px: 8,
            py: 1.2,
            bgcolor: 'primary.main',
            boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.3)}`,
            '&:hover': { bgcolor: 'primary.dark', boxShadow: `0 10px 25px ${alpha(theme.palette.primary.main, 0.4)}` }
          }}
        >
          确认无误，开始构思
        </Button>
      </DialogActions>
    </Dialog>
  );

  const sidebarContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <IconStructure sx={{ mr: 1.5, color: 'primary.main' }} />
          <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: 'inherit' }}>大纲架构</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">从核心灵感到章节细纲</Typography>
      </Box>

      <List sx={{ flexGrow: 1, py: 2 }}>
        {[
          { label: '核心构思', icon: <IconLightbulb />, step: 0 },
          { label: '核心大纲', icon: <IconList />, step: 1 },
          { label: '分卷规划', icon: <IconLibraryBooks />, step: 2 },
          { label: '章节细纲', icon: <IconAutoFixHigh />, step: 3 },
        ].map((item) => (
          <ListItem key={item.step} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={activeStep === item.step}
              onClick={() => setActiveStep(item.step)}
              sx={{
                borderRadius: 2,
                py: 1.5,
                px: 2,
                gap: 1.5
              }}
            >
              <ListItemIcon sx={{
                minWidth: 'auto',
                color: activeStep === item.step ? 'primary.main' : 'text.disabled'
              }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  variant: 'body2',
                  fontWeight: activeStep === item.step ? 'bold' : 'medium',
                  whiteSpace: 'nowrap'
                }}
              />
              {activeStep > item.step && (
                <IconCheckCircle sx={{ fontSize: 18, color: 'success.main', flexShrink: 0 }} />
              )}
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
        <Typography variant="caption" color="text.secondary" fontWeight="bold">创作小贴士</Typography>
        <Typography variant="caption" component="p" color="text.secondary" sx={{ mt: 1 }}>
          {activeStep === 0 && "先定基调，再谈剧情。手动输入能提供更精准的 AI 导向。"}
          {activeStep === 1 && "核心大纲是骨架，您可以点击右侧查看之前的设定。"}
          {activeStep === 2 && "分卷能帮您把控长篇小说的节奏，建议每卷都有明确的高潮。"}
          {activeStep === 3 && "章节生成的质量取决于分卷描述以及前文的逻辑连贯性。"}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100%', bgcolor: 'background.default', overflow: 'hidden', position: 'relative' }}>
      {/* --- Left Navigation Sidebar --- */}
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          sx={{
            '& .MuiDrawer-paper': { width: 280, boxSizing: 'border-box' },
          }}
        >
          {sidebarContent}
        </Drawer>
      ) : (
        <Box sx={{
          width: 260,
          flexShrink: 0,
          borderRight: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {sidebarContent}
        </Box>
      )}

      {/* --- Main Active Canvas --- */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
        {/* Top Header & Breadcrumbs */}
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={2} alignItems="center">
            {isMobile && <IconButton onClick={() => setDrawerOpen(true)}><IconMenu /></IconButton>}
            <Breadcrumbs separator={<IconChevronRight sx={{ fontSize: 16 }} />}>
              <Link underline="hover" color="inherit" sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => setActiveStep(0)}>大纲架构</Link>
              <Typography color="text.primary" fontWeight="bold">
                {activeStep === 0 && "核心构思"}
                {activeStep === 1 && "核心大纲"}
                {activeStep === 2 && "分卷规划"}
                {activeStep === 3 && "章节细纲"}
              </Typography>
            </Breadcrumbs>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Tooltip title={showRefPanel ? "收起参考面板" : "显示参考面板"}>
              <IconButton onClick={() => setShowRefPanel(!showRefPanel)} color={showRefPanel ? "primary" : "default"}>
                <IconInfo />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        {/* Global Progress Stepper (Compact) */}
        {!isMobile && (
          <Box sx={{ px: 4, pt: 3, pb: 1, bgcolor: 'background.paper' }}>
            <Stepper activeStep={activeStep} alternativeLabel connector={<StepConnector sx={{ '& .MuiStepConnector-line': { borderColor: 'divider' } }} />}>
              {['构想', '大纲', '分卷', '章节'].map((label, index) => (
                <Step key={label}>
                  <StepLabel
                    onClick={() => setActiveStep(index)}
                    sx={{ cursor: 'pointer' }}
                    StepIconProps={{ sx: { fontSize: 20 } }}
                  >
                    <Typography variant="caption">{label}</Typography>
                  </StepLabel>
                </Step>
              ))}
            </Stepper>
          </Box>
        )}

        {/* --- Main Scrollable Content --- */}
        <Box sx={{ flexGrow: 1, overflowY: 'auto', scrollbarGutter: 'stable', p: isMobile ? 3 : 6, pb: 20 }}>
          <Box sx={{
            maxWidth: 1000,
            width: '100%',
            mx: 'auto'
          }}>
            {activeStep === 0 && renderStep0Proposal()}
            {activeStep === 1 && renderStep1Outline()}
            {activeStep === 2 && renderStep2Volumes()}
            {activeStep === 3 && renderStep3Chapters()}
          </Box>
        </Box>

        {/* Floating status bar removed - cancel button is now in loading card */}
      </Box>

      {/* --- Right Context Reference Panel --- */}
      <Collapse in={showRefPanel} orientation="horizontal" sx={{ height: '100%', flexShrink: 0 }}>
        <Box sx={{ width: 300, minWidth: 300, flexShrink: 0, height: '100%', borderLeft: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="subtitle2" fontWeight="bold">{getRefTitle(activeStep)}</Typography>
              <Typography variant="caption" color="text.secondary">用于辅助当前阶段的生成参考</Typography>
            </Box>
            <IconButton size="small" onClick={() => setShowRefPanel(false)}><IconChevronLeft /></IconButton>
          </Box>
          <Box sx={{ flexGrow: 1, overflowY: 'auto', scrollbarGutter: 'stable', p: 2 }}>
            {renderRefPanelContent()}
          </Box>
        </Box>
      </Collapse>


      {/* Dialogs */}
      <Dialog open={genTemplateVisible} onClose={() => setGenTemplateVisible(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 4, p: 2 } }}>
        <DialogTitle sx={{ fontWeight: 'bold', textAlign: 'center' }}>AI 生成模板</DialogTitle>
        <DialogContent>
          {genTemplateLoading ? (
            <Box sx={{ py: 8, minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {theme.palette.mode === 'dark' ? (
                <Box sx={{ position: 'relative', display: 'inline-flex', mb: 3 }}>
                  <CircularProgress size={64} thickness={2} sx={{ color: 'primary.main', opacity: 0.3 }} />
                  <IconAI sx={{ fontSize: 32, color: 'primary.main', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', animation: 'pulse 2s infinite ease-in-out' }} />
                </Box>
              ) : (
                <Box component="img" src={LoadingTemplateGen} sx={{ width: 240, mb: 2, mixBlendMode: 'multiply' }} />
              )}
              <Typography variant="body2" color="text.secondary">AI 正在根据您的想法生成模板...</Typography>
            </Box>
          ) : (
            <DebouncedTextField
              fullWidth
              multiline
              minRows={3}
              maxRows={10}
              label="您的想法"
              value={genTemplateIdea}
              onChange={(e) => setGenTemplateIdea(e.target.value)}
              placeholder="例如：哈利波特风格魔法学校"
              sx={{ mt: 1 }}
              debounceMs={300}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', px: 3, pb: 2 }}>
          <Button onClick={handleCancelTemplateGen} sx={{ borderRadius: 999, px: 3 }}>取消</Button>
          <Button
            variant="contained"
            onClick={handleGenerateTemplate}
            disabled={genTemplateLoading}
            startIcon={genTemplateLoading ? <CircularProgress size={20} color="inherit" /> : null}
            sx={{ borderRadius: 999, px: 3 }}
          >
            {genTemplateLoading ? '生成中...' : '生成'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={saveTemplateVisible} onClose={() => setSaveTemplateVisible(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 4, p: 2 } }}>
        <DialogTitle sx={{ textAlign: 'center', fontWeight: 'bold' }}>保存为我的模板</DialogTitle>
        <DialogContent>
          <DebouncedTextField
            fullWidth
            multiline
            minRows={3}
            label="模板名称"
            value={saveTemplateName}
            onChange={(e) => setSaveTemplateName(e.target.value)}
            placeholder="例如：我的末世生存模本"
            sx={{ mt: 1 }}
            debounceMs={300}
          />
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', px: 3, pb: 2 }}>
          <Button onClick={() => setSaveTemplateVisible(false)}>取消</Button>
          <Button variant="contained" onClick={handleSaveAsTemplate} disabled={!saveTemplateName.trim()}>保存</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={switchTemplateVisible} onClose={() => setSwitchTemplateVisible(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 4, p: 2 } }}>
        <DialogTitle sx={{ fontWeight: 'bold', textAlign: 'center' }}>切换模板确认</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mt: 1 }}>
            切换模板将覆盖当前的所有构思内容，确定要继续吗？
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            建议先将当前内容保存为新模板，以免数据丢失。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexDirection: 'column', gap: 1, alignItems: 'stretch' }}>
          <Button
            variant="contained"
            color="primary" // Changed from error to primary/warning or keep usage context
            onClick={() => doApplyTemplate(pendingTemplate)}
            sx={{ borderRadius: 999 }}
          >
            直接覆盖 (Abandon Changes)
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              setSwitchTemplateVisible(false);
              setSaveTemplateVisible(true);
            }}
            sx={{ borderRadius: 999 }}
          >
            另存为新模板 (Save as Template)
          </Button>
          <Button
            onClick={() => setSwitchTemplateVisible(false)}
            sx={{ borderRadius: 999, color: 'text.secondary' }}
          >
            取消
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={genVolumeVisible} onClose={() => setGenVolumeVisible(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 4, p: 3 } }}>
        <DialogTitle sx={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.25rem' }}>生成分卷</DialogTitle>
        <DialogContent>
          <TextField
            type="number"
            label="分卷数量"
            value={genVolumeCount}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (val > 5) setGenVolumeCount(5);
              else if (val < 1) setGenVolumeCount(1);
              else setGenVolumeCount(val);
            }}
            inputProps={{ min: 1, max: 5 }}
            helperText="建议分卷数量：1-5卷"
            fullWidth
            sx={{
              mt: 2, mb: 4,
              '& .MuiOutlinedInput-root': { borderRadius: 3 }
            }}
          />
          <Stack spacing={3}>
            {Array.from({ length: genVolumeCount }).map((_, i) => (
              <TextField
                key={i}
                fullWidth
                label={`第 ${i + 1} 卷要求`}
                multiline
                minRows={3}
                value={volumeRequirements[i] || ''}
                onChange={(e) => setVolumeRequirements({ ...volumeRequirements, [i]: e.target.value })}
                sx={{
                  '& .MuiOutlinedInput-root': { borderRadius: 3 }
                }}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'center', gap: 2 }}>
          <Button onClick={() => setGenVolumeVisible(false)} sx={{ borderRadius: 999, px: 3 }}>取消</Button>
          <Button variant="contained" onClick={handleGenerateVolumes} sx={{ borderRadius: 999, px: 4 }}>开始规划</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editStructureVisible} onClose={() => setEditStructureVisible(false)} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: 4, p: 2 } }}>
        <DialogTitle sx={{ fontWeight: 'bold', textAlign: 'center' }}>✍️ 编辑大纲结构</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} sx={{ mt: 0.5 }}>
            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="标题"
                value={moduleEditData.title || ''}
                onChange={(e) => setModuleEditData({ ...moduleEditData, title: e.target.value })}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="一句话摘要"
                value={moduleEditData.logline || ''}
                onChange={(e) => setModuleEditData({ ...moduleEditData, logline: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="主题"
                value={moduleEditData.theme || ''}
                onChange={(e) => setModuleEditData({ ...moduleEditData, theme: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="核心冲突"
                value={moduleEditData.coreConflict || ''}
                onChange={(e) => setModuleEditData({ ...moduleEditData, coreConflict: e.target.value })}
              />
            </Grid>
            <Grid size={12}>
              <Typography variant="overline" color="primary" fontWeight="bold" sx={{ mb: 2, display: 'block' }}>角色列表</Typography>
              <Stack spacing={4}>
                {(moduleEditData.characters || []).map((char, charIdx) => (
                  <Card variant="outlined" key={charIdx} sx={{ p: 4, bgcolor: 'background.default' }}>
                    <Stack spacing={4}>
                      {/* Identity Row */}
                      <Box sx={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
                        <TextField
                          sx={{ flex: 2 }}
                          multiline
                          minRows={1}
                          label="姓名"
                          value={char.name || ''}
                          onChange={(e) => {
                            const next = [...(moduleEditData.characters || [])];
                            next[charIdx] = { ...next[charIdx], name: e.target.value };
                            setModuleEditData({ ...moduleEditData, characters: next });
                          }}
                        />
                        <TextField
                          sx={{ flex: 3 }}
                          multiline
                          minRows={1}
                          label="定位"
                          value={char.role || ''}
                          onChange={(e) => {
                            const next = [...(moduleEditData.characters || [])];
                            next[charIdx] = { ...next[charIdx], role: e.target.value };
                            setModuleEditData({ ...moduleEditData, characters: next });
                          }}
                        />
                        <IconButton size="small" color="error" sx={{ mt: 1 }} onClick={() => {
                          const newChars = moduleEditData.characters.filter((_, i) => i !== charIdx);
                          setModuleEditData({ ...moduleEditData, characters: newChars });
                        }}><IconDelete fontSize="small" /></IconButton>
                      </Box>
                      {/* Specs Row */}
                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        maxRows={10}
                        label="特质"
                        value={char.personality || char.description || ''}
                        onChange={(e) => {
                          const next = [...(moduleEditData.characters || [])];
                          next[charIdx] = { ...next[charIdx], personality: e.target.value, description: e.target.value };
                          setModuleEditData({ ...moduleEditData, characters: next });
                        }}
                      />
                    </Stack>
                  </Card>
                ))}
                <Button size="small" startIcon={<IconPlus />} sx={{ alignSelf: 'flex-start' }} onClick={() => {
                  setModuleEditData({ ...moduleEditData, characters: [...(moduleEditData.characters || []), { name: '', role: '', description: '' }] });
                }}>添加角色</Button>
              </Stack>
            </Grid>

            <Grid size={12}>
              <Typography variant="overline" color="primary" fontWeight="bold" sx={{ mt: 4, mb: 2, display: 'block' }}>剧情走向</Typography>
              <Stack spacing={4}>
                {(moduleEditData.plotProgression || []).map((step, idx) => (
                  <Stack key={idx} direction="row" spacing={3} alignItems="flex-start">
                    <TextField
                      fullWidth
                      multiline
                      minRows={3}
                      value={typeof step === 'string' ? step : (step.summary || '')}
                      onChange={(e) => {
                        const newPlot = [...moduleEditData.plotProgression];
                        newPlot[idx] = e.target.value;
                        setModuleEditData({ ...moduleEditData, plotProgression: newPlot });
                      }}
                    />
                    <IconButton sx={{ mt: 1 }} size="small" color="error" onClick={() => {
                      const newPlot = moduleEditData.plotProgression.filter((_, i) => i !== idx);
                      setModuleEditData({ ...moduleEditData, plotProgression: newPlot });
                    }}><IconDelete fontSize="small" /></IconButton>
                  </Stack>
                ))}
                <Button size="small" startIcon={<IconPlus />} sx={{ alignSelf: 'flex-start' }} onClick={() => {
                  setModuleEditData({ ...moduleEditData, plotProgression: [...(moduleEditData.plotProgression || []), ''] });
                }}>添加剧情节点</Button>
              </Stack>
            </Grid>

            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="预期结局"
                value={moduleEditData.ending || ''}
                onChange={(e) => setModuleEditData({ ...moduleEditData, ending: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditStructureVisible(false)}>取消</Button>
          <Button variant="contained" onClick={handleSaveStructure}>保存</Button>
        </DialogActions>
      </Dialog>

      {/* Single Volume Generation Dialog */}
      <Dialog open={singleVolumeGenVisible} onClose={() => setSingleVolumeGenVisible(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 4, p: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, fontWeight: 'bold' }}>
          <IconAI color="primary" />
          为本卷生成章节细纲
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 2 }}>
            {(() => {
              const v = volumes.find(vol => vol.id === selectedVolumeId);
              if (v && v.order > 1) {
                const prevVol = volumes.find(vol => vol.order === v.order - 1);
                const prevNodes = chapterNodesMap[prevVol?.id] || [];
                if (prevNodes.length === 0) {
                  return (
                    <Box sx={{ p: 2, bgcolor: 'warning.light', borderRadius: 2, border: '1px solid', borderColor: 'warning.main' }}>
                      <Typography variant="body2" color="warning.dark" fontWeight="bold">
                        ⚠️ 需要先为第 {v.order - 1} 卷生成章节
                      </Typography>
                      <Typography variant="caption" color="warning.dark">
                        章节必须按顺序生成,请先完成前一卷的章节生成。
                      </Typography>
                    </Box>
                  );
                }
              }
              return null;
            })()}
            <Tooltip title="开发人员摆烂，章节数量上限为 5 章">
              <TextField
                type="number"
                label="计划总章数"
                value={singleVolumeGenConfig.totalChapters}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSingleVolumeGenConfig(prev => ({ ...prev, totalChapters: val }));
                  if (selectedVolumeId) {
                    applyFluctuationProfile(selectedVolumeId, singleVolumeGenConfig.fluctuationProfile, val);
                  }
                }}
                inputProps={{ min: 1, max: 5 }}
                fullWidth
              />
            </Tooltip>

            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                select
                label="波动等级"
                value={singleVolumeGenConfig.fluctuationProfile}
                onChange={(e) => {
                  const val = e.target.value;
                  setSingleVolumeGenConfig(prev => ({ ...prev, fluctuationProfile: val }));
                  if (selectedVolumeId) {
                    applyFluctuationProfile(selectedVolumeId, val, singleVolumeGenConfig.totalChapters);
                  }
                }}
                sx={{ flex: 1 }}
              >
                {Object.values(FLUCTUATION_PROFILES).map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="outlined"
                onClick={() => {
                  if (selectedVolumeId) {
                    applyFluctuationProfile(selectedVolumeId, 'random', singleVolumeGenConfig.totalChapters);
                  }
                }}
                sx={{ borderRadius: 2 }}
              >
                随机波动
              </Button>
            </Stack>

            {/* Preview Chart */}
            {selectedVolumeId && (() => {
              const v = volumes.find(vol => vol.id === selectedVolumeId);
              if (!v) return null;

              let startChapter = v.startChapter;
              if (!startChapter) {
                if (v.order === 1) {
                  startChapter = 1;
                } else {
                  const prevVol = volumes.find(vol => vol.order === v.order - 1);
                  if (prevVol && prevVol.endChapter) {
                    startChapter = prevVol.endChapter + 1;
                  } else {
                    const prevNodes = chapterNodesMap[volumes.find(vol => vol.order === v.order - 1)?.id] || [];
                    if (prevNodes.length > 0) {
                      startChapter = Math.max(...prevNodes.map(n => n.order)) + 1;
                    } else {
                      startChapter = (v.order - 1) * 20 + 1;
                    }
                  }
                }
              }
              const endChapter = startChapter + singleVolumeGenConfig.totalChapters - 1;
              const localRange = [];
              for (let c = startChapter; c <= endChapter; c++) localRange.push(c);

              return (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    波动预览
                  </Typography>
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 0.5,
                    overflowX: 'auto',
                    p: 2,
                    border: '1px dashed',
                    borderColor: 'divider',
                    borderRadius: 2
                  }}>
                    {localRange.map(c => {
                      const level = chapterPassionLevels[c] || 1;
                      return (
                        <Box
                          key={c}
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            flex: 1,
                            minWidth: 20
                          }}
                        >
                          <Box
                            sx={{
                              width: '100%',
                              height: level * 12,
                              bgcolor: 'primary.light',
                              borderRadius: '2px 2px 0 0',
                              opacity: 0.8,
                              cursor: 'pointer',
                              '&:hover': {
                                bgcolor: 'primary.main',
                                opacity: 1
                              }
                            }}
                            onClick={() => {
                              setChapterPassionLevels(prev => ({
                                ...prev,
                                [c]: (prev[c] || 1) >= 5 ? 1 : (prev[c] || 1) + 1
                              }));
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              fontSize: '0.65rem',
                              color: 'text.secondary',
                              mt: 0.5
                            }}
                          >
                            {c}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              );
            })()}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', px: 3, pb: 3 }}>
          <Button onClick={() => setSingleVolumeGenVisible(false)} sx={{ borderRadius: 999 }}>取消</Button>
          <Button
            variant="contained"
            disabled={(() => {
              const v = volumes.find(vol => vol.id === selectedVolumeId);
              if (!v || v.order === 1) return false;
              const prevVol = volumes.find(vol => vol.order === v.order - 1);
              const prevNodes = chapterNodesMap[prevVol?.id] || [];
              return prevNodes.length === 0;
            })()}
            onClick={async () => {
              setSingleVolumeGenVisible(false);
              await handleBatchGenerateChapters([selectedVolumeId], { [selectedVolumeId]: singleVolumeGenConfig });
            }}
            sx={{ borderRadius: 999, px: 4 }}
          >
            开始生成
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={genChaptersVisible} onClose={() => setGenChaptersVisible(false)} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: 4, p: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, fontWeight: 'bold' }}>
          <IconAI color="primary" />
          批量配置章节细纲任务
          <Tooltip title="开发人员摆烂，章节数量上限为 5 章">
            <Alert severity="info" icon={<IconInfo />} sx={{ py: 0, px: 1, minWidth: 'auto', '& .MuiAlert-icon': { py: 0, px: 0.5 } }}>
              每卷上限5章
            </Alert>
          </Tooltip>
        </DialogTitle>
        <DialogContent>

          <Box sx={{
            p: 2,
            mb: 3,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            maxHeight: '60vh',
            overflowY: 'auto',
            bgcolor: 'background.default'
          }}>

            <Stack spacing={2}>
              {volumes.map(v => {
                const isSelected = genChaptersVolumeIds.has(v.id);
                const volConfig = batchVolumeConfigs[v.id] || {};
                const totalChapters = volConfig.totalChapters || 5;

                // Calculate local preview data
                let startChapter = v.startChapter;
                if (!startChapter) {
                  if (v.order === 1) {
                    startChapter = 1;
                  } else {
                    // Try to get from previous volume's endChapter
                    const prevVol = volumes.find(vol => vol.order === v.order - 1);
                    if (prevVol && prevVol.endChapter) {
                      startChapter = prevVol.endChapter + 1;
                    } else {
                      // Check if previous volume has generated chapters
                      const prevNodes = chapterNodesMap[prevVol?.id] || [];
                      if (prevNodes.length > 0) {
                        startChapter = Math.max(...prevNodes.map(n => n.order)) + 1;
                      } else {
                        // Calculate by accumulating all previous volumes' configured chapters
                        startChapter = 1;
                        for (let i = 1; i < v.order; i++) {
                          const vol = volumes.find(vol => vol.order === i);
                          if (vol) {
                            const cfg = batchVolumeConfigs[vol.id];
                            const chaptersToAdd = cfg?.totalChapters || 5;
                            console.log(`Volume ${v.order}: Adding ${chaptersToAdd} chapters from volume ${i}, startChapter now: ${startChapter + chaptersToAdd}`);
                            startChapter += chaptersToAdd;
                          }
                        }
                      }
                    }
                  }
                }
                const endChapter = startChapter + totalChapters - 1;
                const localRange = [];
                for (let c = startChapter; c <= endChapter; c++) localRange.push(c);

                // Check if this volume needs previous volumes to be generated first
                let needsPrevious = false;
                let infoMessage = '';
                let isDisabled = false;

                if (v.order > 1) {
                  const prevVol = volumes.find(vol => vol.order === v.order - 1);
                  const prevNodes = chapterNodesMap[prevVol?.id] || [];
                  const isPrevGenerated = prevNodes.length > 0;
                  const isPrevSelected = genChaptersVolumeIds.has(prevVol?.id);

                  if (!isPrevGenerated) {
                    needsPrevious = true;
                    infoMessage = `需先勾选第 ${v.order - 1} 卷`; // Update message to be clearer about action

                    if (!isPrevSelected) {
                      isDisabled = true;
                    }
                  }
                }

                return (
                  <Card key={v.id} variant="outlined" sx={{
                    p: 3,
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.02) : 'transparent'
                  }}>
                    <Stack spacing={3}>
                      {/* Header Row */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Checkbox
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={(e) => {
                            const next = new Set(genChaptersVolumeIds);
                            if (e.target.checked) {
                              next.add(v.id);
                            } else {
                              next.delete(v.id);
                              // Recursive uncheck subsequent volumes that depend on this one
                              let currOrder = v.order + 1;
                              while (true) {
                                const nextVol = volumes.find(vol => vol.order === currOrder);
                                if (!nextVol) break;
                                const isNextGen = (chapterNodesMap[nextVol.id] || []).length > 0;
                                if (isNextGen) break; // Dependency chain broken by generated content
                                next.delete(nextVol.id);
                                currOrder++;
                              }
                            }
                            setGenChaptersVolumeIds(next);
                            if (e.target.checked && !batchVolumeConfigs[v.id]) {
                              setBatchVolumeConfigs(prev => ({
                                ...prev,
                                [v.id]: { totalChapters: totalChaptersInVolume || 5, fluctuationProfile: 'rising' }
                              }));
                            }
                          }}
                        />
                        <Typography variant="subtitle1" fontWeight="bold">
                          第 {v.order} 卷：{v.name}
                        </Typography>
                        {needsPrevious && (
                          <Chip size="small" label={infoMessage} color="info" sx={{ ml: 1 }} />
                        )}
                        {chapterNodesMap[v.id]?.length > 0 && (
                          <Chip size="small" label={`已生成 ${chapterNodesMap[v.id].length} 章`} sx={{ ml: 'auto' }} />
                        )}
                      </Box>

                      {/* Config Row */}
                      {isSelected && (
                        <>
                          <Divider sx={{ borderStyle: 'dashed', my: 1 }} />
                          <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
                            <Tooltip title="开发人员摆烂，章节数量上限为 5 章">
                            <TextField
                              size="small"
                              type="number"
                              label="计划总章数"
                              value={totalChapters}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                const updatedConfigs = { ...batchVolumeConfigs, [v.id]: { ...batchVolumeConfigs[v.id], totalChapters: val } };
                                setBatchVolumeConfigs(updatedConfigs);

                                // 重新应用该卷及所有后续卷的波动配置，确保起始章节号正确
                                const currentVolOrder = v.order;
                                volumes.forEach(vol => {
                                  if (vol.order >= currentVolOrder && genChaptersVolumeIds.has(vol.id)) {
                                    const volProfile = updatedConfigs[vol.id]?.fluctuationProfile || 'rising';
                                    const volChapters = vol.id === v.id ? val : (updatedConfigs[vol.id]?.totalChapters || 5);
                                    applyFluctuationProfile(vol.id, volProfile, volChapters, updatedConfigs);
                                  }
                                });
                              }}
                              inputProps={{ min: 1, max: 5 }}
                              sx={{ width: 140 }}
                            />
                            </Tooltip>
                            <TextField
                              select
                              size="small"
                              label="波动等级"
                              value={volConfig.fluctuationProfile || 'rising'}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBatchVolumeConfigs(prev => ({
                                  ...prev,
                                  [v.id]: { ...prev[v.id], fluctuationProfile: val }
                                }));
                                applyFluctuationProfile(v.id, val, totalChapters, batchVolumeConfigs);
                              }}
                              sx={{ width: 140 }}
                            >
                              {Object.values(FLUCTUATION_PROFILES).map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                  {option.label}
                                </MenuItem>
                              ))}
                            </TextField>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                applyFluctuationProfile(v.id, 'random', totalChapters, batchVolumeConfigs);
                              }}
                              sx={{ borderRadius: 2 }}
                            >
                              随机波动
                            </Button>
                          </Stack>

                          {/* Embedded Preview Chart */}
                          <Box sx={{
                            display: 'flex',
                            alignItems: 'flex-end',
                            gap: 0.5,
                            pt: 2,
                            overflowX: 'auto',
                            height: 85, // 固定高度，防止波动等级变化影响弹窗高度（留出圆角空间）
                            minHeight: 85
                          }}>
                            {localRange.map(c => {
                              const level = chapterPassionLevels[c] || 1;
                              return (
                                <Box
                                  key={c}
                                  sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    flex: 1,
                                    minWidth: 20
                                  }}
                                >
                                  <Box
                                    sx={{
                                      width: '100%',
                                      height: level * 12,
                                      bgcolor: 'primary.light',
                                      borderRadius: '2px 2px 0 0',
                                      opacity: 0.8,
                                      cursor: 'pointer',
                                      '&:hover': {
                                        bgcolor: 'primary.main',
                                        opacity: 1
                                      }
                                    }}
                                    onClick={() => {
                                      setChapterPassionLevels(prev => ({
                                        ...prev,
                                        [c]: (prev[c] || 1) >= 5 ? 1 : (prev[c] || 1) + 1
                                      }));
                                    }}
                                  />
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontSize: '0.65rem',
                                      color: 'text.secondary',
                                      mt: 0.5
                                    }}
                                  >
                                    {c}
                                  </Typography>
                                </Box>
                              );
                            })}
                          </Box>
                        </>
                      )}
                    </Stack>
                  </Card>
                );
              })}
            </Stack>
          </Box>


        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', px: 3, pb: 3 }}>
          <Button onClick={() => setGenChaptersVisible(false)} sx={{ borderRadius: 999 }}>取消</Button>
          <Button
            variant="contained"
            disabled={genChaptersVolumeIds.size === 0}
            onClick={async () => {
              setGenChaptersVisible(false);
              // 按卷顺序排序，确保生成顺序正确
              const sortedVids = [...genChaptersVolumeIds].sort((a, b) => {
                const volA = volumes.find(v => v.id === a);
                const volB = volumes.find(v => v.id === b);
                return (volA?.order || 0) - (volB?.order || 0);
              });
              // 传递配置，确保使用用户设置的章节数
              await handleBatchGenerateChapters(sortedVids, batchVolumeConfigs);
            }}
            sx={{ borderRadius: 999, px: 4 }}
          >
            开始批量生成 ({genChaptersVolumeIds.size} 卷)
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={regenVolumeVisible} onClose={() => setRegenVolumeVisible(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 4, p: 2 } }}>
        <DialogTitle sx={{ fontWeight: 'bold', textAlign: 'center' }}>🔄 重新生成分卷</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            minRows={3}
            maxRows={10}
            label="重新生成要求"
            value={regenVolumeGuidance}
            onChange={(e) => setRegenVolumeGuidance(e.target.value)}
            placeholder="例如：让本卷冲突更加激烈"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRegenVolumeVisible(false)}>取消</Button>
          <Button variant="contained" onClick={handleRegenerateVolume}>生成</Button>
        </DialogActions>
      </Dialog>


      <Dialog open={importOutlineVisible} onClose={() => setImportOutlineVisible(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 4, p: 2 } }}>
        <DialogTitle sx={{ fontWeight: 'bold', textAlign: 'center' }}>导入大纲</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
            <Button
              variant="outlined"
              startIcon={<IconUpload />}
              fullWidth
              sx={{ py: 2, borderStyle: 'dashed', borderRadius: 2 }}
              onClick={() => importFileInputRef.current?.click()}
            >
              点击上传 JSON 文件
            </Button>
            <input
              type="file"
              ref={importFileInputRef}
              accept=".json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                  setImportOutlineText(event.target.result);
                };
                reader.onerror = () => {
                  messageApi.error('文件读取失败');
                };
                reader.readAsText(file);
                // 重置 input，允许重复选择同一文件
                e.target.value = '';
              }}
            />
            <Divider>或者直接粘贴 JSON</Divider>
            <TextField
              fullWidth
              multiline
              rows={8}
              value={importOutlineText}
              onChange={(e) => setImportOutlineText(e.target.value)}
              placeholder='{"title": "...", "theme": "...", "characters": [...], ...}'
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', px: 3, pb: 2 }}>
          <Button onClick={() => setImportOutlineVisible(false)} sx={{ borderRadius: 999 }}>取消</Button>
          <Button onClick={async () => {
            setCoreOutline(importOutlineText);
            let parsedOutline = null;
            try {
              const cleanedText = cleanJSON(importOutlineText);
              parsedOutline = JSON.parse(cleanedText);
              setOutlineJSON(parsedOutline);
            } catch (e) {
              console.error('Import parse failed', e);
            }
            await storageEx.updateCoreOutline(currentProject.id, { title: '核心大纲', content: importOutlineText });

            // Auto sync characters from import
            if (parsedOutline?.characters && Array.isArray(parsedOutline.characters)) {
              let syncedCount = 0;
              const existingChars = await storage.getItemsByProject('characters', currentProject.id);
              for (const char of parsedOutline.characters) {
                try {
                  const charData = {
                    projectId: currentProject.id,
                    name: char.name || '未命名',
                    role: char.role || '角色',
                    age: char.age || '',
                    gender: char.gender || '',
                    traits: char.personality || char.description || char.traits || '',
                    bio: char.background || char.bio || '',
                    goal: char.goal || '',
                    arc: char.arc || '',
                    appearance: char.appearance || '',
                    relationships: char.relationships || {},
                    updatedAt: new Date().toISOString()
                  };
                  const existing = existingChars.find(c => c.name === char.name);
                  if (existing) {
                    await storage.updateItem('characters', { ...existing, ...charData });
                  } else {
                    await storage.addItem('characters', { ...charData, createdAt: new Date().toISOString() });
                  }
                  syncedCount++;
                } catch (err) {
                  console.error('Character sync failed:', err);
                }
              }
              await loadData();
              if (syncedCount > 0) messageApi.success(`大纲已导入并同步 ${syncedCount} 个角色`);
              else messageApi.success('大纲已导入');
            } else {
              messageApi.success('大纲已导入');
            }
            setImportOutlineVisible(false);
          }} variant="contained" sx={{ borderRadius: 999 }}>确认导入</Button>
        </DialogActions>
      </Dialog>

      {/* 解析失败编辑器弹窗 */}
      <Dialog open={parseErrorVisible} onClose={() => { }} fullWidth maxWidth="lg" PaperProps={{ sx: { borderRadius: 4, p: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <IconWarning color="warning" />
          {parseErrorContext?.type === 'core_outline' ? '核心大纲解析失败' : `JSON 解析失败 - 第 ${parseErrorContext?.chapterOrder} 章`}
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            AI 返回的内容无法解析为 JSON 格式。请手动修复下方内容后点击「重新解析」，或点击「跳过此章」继续生成。
          </Alert>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            常见问题：多余的逗号、缺少引号、特殊字符未转义等
          </Typography>
          <TextField
            multiline
            fullWidth
            rows={18}
            value={rawResponseForEdit}
            onChange={(e) => setRawResponseForEdit(e.target.value)}
            sx={{
              fontFamily: 'monospace',
              '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: 13 }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', px: 3, pb: 3 }}>
          <Button
            onClick={handleSkipParseError}
            color="inherit"
            sx={{ borderRadius: 2 }}
          >
            {parseErrorContext?.type === 'core_outline' ? '放弃解析' : '跳过此章'}
          </Button>
          <Button
            onClick={handleRetryParse}
            variant="contained"
            sx={{ borderRadius: 2 }}
          >
            重新解析
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
      {/* Core Outline Delete Confirmation */}
      <Dialog
        open={deleteOutlineVisible}
        onClose={() => setDeleteOutlineVisible(false)}
        PaperProps={{
          sx: { borderRadius: 4, p: 2 }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, color: 'error.main' }}>
          <IconWarning /> 确定要删除核心大纲吗？
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            这将清除所有已生成的结构化大纲数据（包括世界设定细化、分卷规划等）。<strong>核心构思及预设角色将会保留。</strong>此操作无法撤销。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteOutlineVisible(false)} color="inherit">取消</Button>
          <Button onClick={handleConfirmDeleteCoreOutline} variant="contained" color="error" autoFocus>
            确定删除
          </Button>
        </DialogActions>
      </Dialog>
      {/* Core Outline Overwrite Confirmation */}
      <Dialog
        open={confirmOverwriteVisible}
        onClose={() => setConfirmOverwriteVisible(false)}
        PaperProps={{
          sx: { borderRadius: 3, p: 1 }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'warning.main' }}>
          <IconWarning /> 覆盖现有核心大纲？
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            当前已存在核心大纲，重新生成将会<strong>覆盖现有大纲及所有角色数据</strong>。是否继续？
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOverwriteVisible(false)} color="inherit">取消</Button>
          <Button
            onClick={async () => {
              setConfirmOverwriteVisible(false);
              await doGenerateCoreOutline();
            }}
            variant="contained"
            color="warning"
            autoFocus
          >
            确定覆盖
          </Button>
        </DialogActions>
      </Dialog>
      {/* Core Outline Refinement Dialog */}
      <Dialog
        open={refineDialogVisible}
        onClose={() => !refineLoading && setRefineDialogVisible(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 4, p: 2 }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, color: 'primary.main' }}>
          <IconAI /> 重新生成大纲
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            您可以选择完全重新生成，或输入修改建议让 AI 针对性优化。
          </Typography>
          <DebouncedTextField
            fullWidth
            multiline
            rows={4}
            label="修改建议（可选）"
            placeholder="留空则完全重新生成。&#10;&#10;或输入建议，例如：&#10;- 希望角色动机更清晰&#10;- 增加更多悬念"
            value={refineFeedback}
            onChange={(e) => setRefineFeedback(e.target.value)}
            disabled={refineLoading}
            sx={{
              '& .MuiOutlinedInput-root': { borderRadius: 2 }
            }}
            debounceMs={300}
          />
          {!refineFeedback.trim() && (
            <Typography variant="caption" color="warning.main" sx={{ mt: 1.5, display: 'block' }}>
              ⚠️ 未输入修改建议，将完全重新生成大纲，现有角色数据会被覆盖。
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', px: 3, pb: 2 }}>
          <Button
            onClick={() => { setRefineDialogVisible(false); setRefineFeedback(''); }}
            color="inherit"
            disabled={refineLoading}
          >
            取消
          </Button>
          <Button
            onClick={async () => {
              if (refineFeedback.trim()) {
                await handleRefineCoreOutline();
              } else {
                setRefineDialogVisible(false);
                setRefineFeedback('');
                await doGenerateCoreOutline();
              }
            }}
            variant="contained"
            color={refineFeedback.trim() ? 'primary' : 'warning'}
            disabled={refineLoading}
            startIcon={refineLoading ? <CircularProgress size={16} /> : <IconAI />}
          >
            {refineLoading ? '生成中...' : (refineFeedback.trim() ? '优化大纲' : '重新生成')}
          </Button>
        </DialogActions>
      </Dialog>
      <Popover
        open={Boolean(editingSceneChars)}
        anchorEl={editingSceneChars?.anchorEl}
        onClose={() => setEditingSceneChars(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { p: 2, width: 320, borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', border: '1px solid', borderColor: 'divider' } }}
      >
        <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 'bold', color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconList fontSize="small" /> 管理登场角色
        </Typography>
        <Autocomplete
          multiple
          freeSolo
          options={characters.map(c => c.name)}
          value={(() => {
            if (!editingSceneChars) return [];
            const ch = (chapterNodesMap[selectedVolumeId] || []).find(c => c.id === editingSceneChars.chId);
            const parsed = JSON.parse(ch?.summary || '{}');
            const scene = (parsed.scenes || [])[editingSceneChars.sceneIdx];
            return Array.isArray(scene?.characters) ? scene.characters : (scene?.characters ? scene.characters.split(/[、,，\s]+/).filter(Boolean) : []);
          })()}
          onChange={(e, newValue) => {
            if (!editingSceneChars) return;
            const ch = (chapterNodesMap[selectedVolumeId] || []).find(c => c.id === editingSceneChars.chId);
            handleUpdateChapterScene(ch, editingSceneChars.sceneIdx, 'characters', newValue);
          }}
          renderInput={(params) => (
            <TextField {...params} placeholder="输入并回车，或从列表选择" variant="outlined" size="small" autoFocus />
          )}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip label={option} size="small" {...getTagProps({ index })} sx={{ borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.08), color: 'primary.main', fontWeight: 'bold' }} />
            ))
          }
        />
        <Typography variant="caption" color="text.disabled" sx={{ mt: 1.5, display: 'block' }}>
          * 输入新角色名按回车可快速添加
        </Typography>
      </Popover>

      {renderReviewDialog()}

      {/* Volume Delete Confirmation */}
      <Dialog
        open={deleteVolumeConfirm.visible}
        onClose={() => setDeleteVolumeConfirm({ ...deleteVolumeConfirm, visible: false })}
        PaperProps={{
          sx: { borderRadius: 4, p: 3, maxWidth: 480 } // Increased border radius and padding
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'error.main', justifyContent: 'center' }}>
          <IconWarning sx={{ fontSize: 32 }} />
          <Typography variant="h5" fontWeight="bold">确认删除操作</Typography>
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', mt: 1 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'normal', lineHeight: 1.6 }}>
            {deleteVolumeConfirm.type === 'batch'
              ? `确定要删除选中的 ${deleteVolumeConfirm.data} 个分卷及其所属的所有章节吗？`
              : `确定要删除分卷“${deleteVolumeConfirm.data?.name || ''}”及其所属的所有章节吗？`}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            此操作无法撤销。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 1, justifyContent: 'center', gap: 2 }}>
          <Button
            onClick={() => setDeleteVolumeConfirm({ ...deleteVolumeConfirm, visible: false })}
            color="inherit"
            variant="text"
            size="large"
            sx={{ borderRadius: 999, px: 3 }}
          >
            取消
          </Button>
          <Button
            onClick={deleteVolumeConfirm.type === 'batch' ? handleDoDeleteSelectedVolumes : handleDoDeleteVolume}
            variant="contained"
            color="error"
            size="large"
            autoFocus
            sx={{ borderRadius: 999, px: 4 }}
          >
            确定删除
          </Button>
        </DialogActions>
      </Dialog>

      {/* Volume Import Dialog */}
      <Dialog
        open={importVolumeModalVisible}
        onClose={() => setImportVolumeModalVisible(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, p: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', textAlign: 'center' }}>导入分卷规划</DialogTitle>
        <DialogContent dividers sx={{ borderColor: 'divider' }}>
          <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
            导入将清空当前项目的所有分卷、支线和伏笔数据，并替换为导入内容。此操作不可撤销。
          </Alert>
          <Stack spacing={3}>
            <Button
              variant="outlined"
              component="label"
              startIcon={<IconUpload />}
              sx={{ py: 3, borderStyle: 'dashed', borderRadius: 3, borderWidth: 2 }}
            >
              选择 JSON 文件
              <input
                type="file"
                hidden
                accept=".json"
                ref={importVolumeFileRef}
                onChange={handleVolumeFileUpload}
              />
            </Button>
            <Divider sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>或粘贴 JSON 内容</Divider>
            <TextField
              multiline
              minRows={8}
              maxRows={16}
              value={importVolumeJson}
              onChange={(e) => setImportVolumeJson(e.target.value)}
              placeholder='{"volumes": [...], "subplots": [...], "foreshadowing": [...] }'
              fullWidth
              sx={{
                fontFamily: 'monospace',
                '& .MuiOutlinedInput-root': { borderRadius: 3, fontFamily: 'monospace' }
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, justifyContent: 'center', gap: 2 }}>
          <Button onClick={() => setImportVolumeModalVisible(false)} sx={{ borderRadius: 999, px: 3 }}>取消</Button>
          <Button
            variant="contained"
            onClick={handleImportVolumeConfirm}
            disabled={!importVolumeJson.trim()}
            color="primary"
            sx={{ borderRadius: 999, px: 4 }}
          >
            确认导入
          </Button>
        </DialogActions>
      </Dialog>

      {/* Volume Plan Refinement Dialog */}
      <Dialog
        open={refineVolumeDialogVisible}
        onClose={() => { setRefineVolumeDialogVisible(false); setRefineVolumeFeedback(''); }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, p: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, fontWeight: 'bold' }}>
          <IconAI color="primary" /> AI 优化分卷规划
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            请输入您对分卷规划的修改建议，AI 将根据您的反馈优化当前规划。留空则完全重新生成。
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="修改建议（可选）"
            placeholder="留空则完全重新生成。&#10;&#10;或输入建议，例如：&#10;- 第二卷节奏太慢，希望更紧凑&#10;- 增加更多悬念"
            value={refineVolumeFeedback}
            onChange={(e) => setRefineVolumeFeedback(e.target.value)}
            disabled={refineVolumeLoading}
            sx={{
              '& .MuiOutlinedInput-root': { borderRadius: 3 }
            }}
          />
          {!refineVolumeFeedback.trim() && (
            <Typography variant="caption" color="warning.main" sx={{ mt: 1.5, display: 'block' }}>
              ⚠️ 未输入修改建议，将完全重新生成分卷规划。
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'center', gap: 2 }}>
          <Button
            onClick={() => { setRefineVolumeDialogVisible(false); setRefineVolumeFeedback(''); }}
            color="inherit"
            disabled={refineVolumeLoading}
            sx={{ borderRadius: 999, px: 3 }}
          >
            取消
          </Button>
          <Button
            onClick={handleRefineVolumePlan}
            variant="contained"
            color={refineVolumeFeedback.trim() ? 'primary' : 'warning'}
            disabled={refineVolumeLoading}
            startIcon={refineVolumeLoading ? <IconAI className="rotating" /> : <IconAI />}
            sx={{ borderRadius: 999, px: 4 }}
          >
            {refineVolumeLoading ? '优化中...' : (refineVolumeFeedback.trim() ? '开始优化' : '重新生成')}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};
