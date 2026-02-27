/**
 * TUI Zustand store.
 *
 * Single flat store — the TUI has one view at a time with no tabs,
 * so slice-based decomposition adds no value here.
 *
 * Data flow:
 *   loadProjects()     → projectScanner.scan()
 *   selectProject(id)  → projectScanner.listSessions(id)
 *   selectSession(id)  → sessionParser → subagentResolver → chunkBuilder
 *                       → transformChunksToConversation → enhanceAIGroup
 */

import { decodePath, extractBaseDir } from '@main/utils/pathDecoder';
import { getTaskCalls } from '@main/utils/jsonl';
import { enhanceAIGroup } from '@renderer/utils/aiGroupEnhancer';
import { processSessionContextWithPhases } from '@renderer/utils/contextTracker';
import { transformChunksToConversation } from '@renderer/utils/groupTransformer';
import { create } from 'zustand';

import type { ServiceContext } from '@main/services';
import type { Process } from '@main/types/chunks';
import type { Project, Session } from '@main/types/domain';
import type { ContextPhaseInfo, ContextStats } from '@renderer/types/contextInjection';
import type { ChatItem } from '@renderer/types/groups';

// =============================================================================
// ServiceContext singleton
// =============================================================================

let serviceContext: ServiceContext | null = null;

export function setServiceContext(ctx: ServiceContext): void {
  serviceContext = ctx;
}

export function getServiceContext(): ServiceContext {
  if (!serviceContext) {
    throw new Error('ServiceContext not initialized — call setServiceContext() first');
  }
  return serviceContext;
}

// =============================================================================
// State interface
// =============================================================================

export type FocusMode = 'projects' | 'sessions' | 'chat';

/** Saved parent state for subagent breadcrumb navigation */
export interface SubagentStackEntry {
  chatItems: ChatItem[];
  chatScrollOffset: number;
  expandedAIGroupIds: Set<string>;
  expandedAIGroupScrollOffsets: Map<string, number>;
  expandedToolIds: Set<string>;
  expandedUserIds: Set<string>;
  expandedSystemIds: Set<string>;
  expandedSystemScrollOffsets: Map<string, number>;
  contextStatsMap: Map<string, ContextStats>;
  contextPhaseInfo: ContextPhaseInfo | null;
  sessionIsOngoing: boolean;
  label: string; // breadcrumb display label
}

export interface ChatSearchMatch {
  itemIndex: number;
  itemId: string;
  matchIndexInItem: number;
  globalIndex: number;
}

export interface TuiState {
  // Focus
  focusMode: FocusMode;

  // Projects
  projects: Project[];
  selectedProjectIndex: number;
  selectedProjectId: string | null;
  projectsLoading: boolean;
  projectsError: string | null;
  projectSessionCounts: Map<string, number>;

  // Sessions
  sessions: Session[];
  selectedSessionIndex: number;
  selectedSessionId: string | null;
  sessionsLoading: boolean;
  sessionsError: string | null;

  // Chat
  chatItems: ChatItem[];
  chatScrollOffset: number;
  expandedAIGroupIds: Set<string>;
  /** Per-group display item scroll offset for expanded AI groups */
  expandedAIGroupScrollOffsets: Map<string, number>;
  /** Set of tool IDs whose output is expanded in-place */
  expandedToolIds: Set<string>;
  /** Set of user group IDs whose text is fully expanded */
  expandedUserIds: Set<string>;
  /** Set of system group IDs whose output is fully expanded */
  expandedSystemIds: Set<string>;
  /** Per-group line scroll offset for expanded system groups */
  expandedSystemScrollOffsets: Map<string, number>;
  chatLoading: boolean;
  chatError: string | null;
  sessionIsOngoing: boolean;

  // Subagent drill-down
  subagentStack: SubagentStackEntry[];
  /** Label of the currently-viewed subagent (null = root session) */
  subagentLabel: string | null;

  // Context tracking
  contextStatsMap: Map<string, ContextStats>;
  contextPhaseInfo: ContextPhaseInfo | null;
  showContextPanel: boolean;
  showHelp: boolean;

  // Session filter
  sessionFilterActive: boolean;
  sessionFilter: string;

  // Chat search
  chatSearchActive: boolean;
  chatSearchQuery: string;
  chatSearchMatches: ChatSearchMatch[];
  currentChatSearchIndex: number;

  // Context panel navigation
  contextPanelCursorIndex: number;
  expandedContextCategory: string | null;
  contextPanelScrollOffset: number;

  // Actions
  loadProjects: () => Promise<void>;
  selectProject: (projectId: string) => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  refreshCurrentSession: () => Promise<void>;
  refreshSessionList: () => Promise<void>;
  setFocusMode: (mode: FocusMode) => void;
  goBackToProjects: () => void;
  goBackToSessions: () => void;
  drillDownSubagent: (process: Process) => Promise<void>;
  goBackFromSubagent: () => void;
  scrollChat: (delta: number) => void;
  toggleAIGroupExpanded: (id: string) => void;
  toggleToolExpanded: (id: string) => void;
  toggleUserExpanded: (id: string) => void;
  toggleSystemExpanded: (id: string) => void;
  toggleContextPanel: () => void;
  toggleHelp: () => void;
  navigateList: (panel: 'projects' | 'sessions', delta: number, listLength?: number) => void;

  // Session filter actions
  activateSessionFilter: () => void;
  deactivateSessionFilter: () => void;
  setSessionFilter: (text: string) => void;

  // Chat search actions
  activateChatSearch: () => void;
  deactivateChatSearch: () => void;
  setChatSearchQuery: (query: string) => void;
  nextChatSearchMatch: () => void;
  previousChatSearchMatch: () => void;

  // Context panel navigation actions
  navigateContextPanel: (delta: number) => void;
  toggleContextCategory: (category: string) => void;
  scrollContextPanel: (delta: number) => void;
}

// =============================================================================
// Store
// =============================================================================

export const useTuiStore = create<TuiState>((set, get) => ({
  // Initial state
  focusMode: 'projects',

  projects: [],
  selectedProjectIndex: 0,
  selectedProjectId: null,
  projectsLoading: false,
  projectsError: null,
  projectSessionCounts: new Map(),

  sessions: [],
  selectedSessionIndex: 0,
  selectedSessionId: null,
  sessionsLoading: false,
  sessionsError: null,

  chatItems: [],
  chatScrollOffset: 0,
  expandedAIGroupIds: new Set<string>(),
  expandedAIGroupScrollOffsets: new Map(),
  expandedToolIds: new Set<string>(),
  expandedUserIds: new Set<string>(),
  expandedSystemIds: new Set<string>(),
  expandedSystemScrollOffsets: new Map(),
  chatLoading: false,
  chatError: null,
  sessionIsOngoing: false,

  subagentStack: [],
  subagentLabel: null,

  contextStatsMap: new Map(),
  contextPhaseInfo: null,
  showContextPanel: false,
  showHelp: false,

  sessionFilterActive: false,
  sessionFilter: '',

  chatSearchActive: false,
  chatSearchQuery: '',
  chatSearchMatches: [],
  currentChatSearchIndex: -1,

  contextPanelCursorIndex: 0,
  expandedContextCategory: null,
  contextPanelScrollOffset: 0,

  // ─── Actions ───

  loadProjects: async (): Promise<void> => {
    set({ projectsLoading: true, projectsError: null });
    try {
      const ctx = getServiceContext();
      const projects = await ctx.projectScanner.scan();
      // Sort by most recent session
      projects.sort((a, b) => {
        const aTime = a.mostRecentSession ?? 0;
        const bTime = b.mostRecentSession ?? 0;
        return bTime - aTime;
      });
      // Compute filtered session counts (listSessions filters noise)
      const counts = new Map<string, number>();
      await Promise.all(
        projects.map(async (p) => {
          try {
            const sessions = await ctx.projectScanner.listSessions(p.id);
            counts.set(p.id, sessions.length);
          } catch {
            counts.set(p.id, p.sessions.length); // fallback to raw count
          }
        }),
      );
      set({ projects, projectsLoading: false, selectedProjectIndex: 0, projectSessionCounts: counts });
    } catch (error) {
      set({
        projectsError: error instanceof Error ? error.message : String(error),
        projectsLoading: false,
      });
    }
  },

  selectProject: async (projectId: string): Promise<void> => {
    set({
      selectedProjectId: projectId,
      sessionsLoading: true,
      sessionsError: null,
      sessions: [],
      selectedSessionIndex: 0,
      selectedSessionId: null,
      chatItems: [],
      focusMode: 'sessions',
    });
    try {
      const ctx = getServiceContext();
      const sessions = await ctx.projectScanner.listSessions(projectId);
      // Sort by creation date (unix timestamp), newest first
      sessions.sort((a, b) => b.createdAt - a.createdAt);
      set({ sessions, sessionsLoading: false });
    } catch (error) {
      set({
        sessionsError: error instanceof Error ? error.message : String(error),
        sessionsLoading: false,
      });
    }
  },

  selectSession: async (sessionId: string): Promise<void> => {
    const { selectedProjectId } = get();
    if (!selectedProjectId) return;

    set({
      selectedSessionId: sessionId,
      chatLoading: true,
      chatError: null,
      chatItems: [],
      chatScrollOffset: 0,
      expandedAIGroupIds: new Set<string>(),
      expandedAIGroupScrollOffsets: new Map(),
      expandedToolIds: new Set<string>(),
      expandedUserIds: new Set<string>(),
      expandedSystemIds: new Set<string>(),
      expandedSystemScrollOffsets: new Map(),
      contextStatsMap: new Map(),
      contextPhaseInfo: null,
      focusMode: 'chat',
      chatSearchActive: false,
      chatSearchQuery: '',
      chatSearchMatches: [],
      currentChatSearchIndex: -1,
      contextPanelCursorIndex: 0,
      expandedContextCategory: null,
      contextPanelScrollOffset: 0,
    });

    try {
      const ctx = getServiceContext();

      // 1. Parse session
      const parsed = await ctx.sessionParser.parseSession(selectedProjectId, sessionId);

      // 2. Resolve subagents
      const subagents = await ctx.subagentResolver.resolveSubagents(
        selectedProjectId,
        sessionId,
        parsed.taskCalls,
        parsed.messages,
      );

      // 3. Build chunks
      const chunks = ctx.chunkBuilder.buildChunks(parsed.messages, subagents);

      // 4. Detect ongoing status
      const session = get().sessions.find((s) => s.id === sessionId);
      const isOngoing = session?.isOngoing ?? false;

      // 5. Transform to conversation
      const conversation = transformChunksToConversation(chunks, subagents, isOngoing);

      // 6. Enhance AI groups
      const enhancedItems: ChatItem[] = conversation.items.map((item) => {
        if (item.type === 'ai') {
          return { ...item, group: enhanceAIGroup(item.group) };
        }
        return item;
      });

      // 7. Compute context stats
      const projectRoot = decodePath(extractBaseDir(selectedProjectId));
      const { statsMap, phaseInfo } = processSessionContextWithPhases(enhancedItems, projectRoot);

      set({
        chatItems: enhancedItems,
        chatLoading: false,
        sessionIsOngoing: isOngoing,
        contextStatsMap: statsMap,
        contextPhaseInfo: phaseInfo,
      });
    } catch (error) {
      set({
        chatError: error instanceof Error ? error.message : String(error),
        chatLoading: false,
      });
    }
  },

  refreshCurrentSession: async (): Promise<void> => {
    const {
      selectedSessionId, chatScrollOffset, expandedAIGroupIds,
      expandedToolIds, expandedUserIds, expandedSystemIds, showContextPanel, chatItems, sessionIsOngoing,
    } = get();
    if (!selectedSessionId) return;

    // Preserve scroll, expansion, and UI state across refresh
    const savedOffset = chatScrollOffset;
    const savedExpanded = new Set(expandedAIGroupIds);
    const savedToolExpanded = new Set(expandedToolIds);
    const savedUserExpanded = new Set(expandedUserIds);
    const savedSystemExpanded = new Set(expandedSystemIds);
    const savedSystemScrollOffsets = new Map(get().expandedSystemScrollOffsets);
    const savedShowContext = showContextPanel;
    const prevItemCount = chatItems.length;

    // Check if user was near the bottom before refresh
    const maxOffset = Math.max(0, prevItemCount - 1);
    const wasNearBottom = savedOffset >= maxOffset - 3;

    // Clear subagent stack — refresh reloads from root session
    set({ subagentStack: [], subagentLabel: null });

    await get().selectSession(selectedSessionId);

    const newItemCount = get().chatItems.length;

    // Auto-scroll to bottom if ongoing session and user was near the bottom
    const restoreState = {
      expandedAIGroupIds: savedExpanded,
      expandedToolIds: savedToolExpanded,
      expandedUserIds: savedUserExpanded,
      expandedSystemIds: savedSystemExpanded,
      expandedSystemScrollOffsets: savedSystemScrollOffsets,
      showContextPanel: savedShowContext,
    };
    if (sessionIsOngoing && wasNearBottom && newItemCount > prevItemCount) {
      set({ chatScrollOffset: Math.max(0, newItemCount - 1), ...restoreState });
    } else {
      set({ chatScrollOffset: savedOffset, ...restoreState });
    }
  },

  refreshSessionList: async (): Promise<void> => {
    const { selectedProjectId, selectedSessionIndex } = get();
    if (!selectedProjectId) return;

    try {
      const ctx = getServiceContext();
      const sessions = await ctx.projectScanner.listSessions(selectedProjectId);
      sessions.sort((a, b) => b.createdAt - a.createdAt);

      // Preserve selection index (clamped to new list size)
      const clampedIndex = Math.min(selectedSessionIndex, Math.max(0, sessions.length - 1));
      set({ sessions, selectedSessionIndex: clampedIndex });
    } catch {
      // Silently ignore — session list refresh is non-critical
    }
  },

  setFocusMode: (mode: FocusMode): void => {
    set({ focusMode: mode });
  },

  goBackToProjects: (): void => {
    set({
      focusMode: 'projects',
      selectedProjectId: null,
      sessions: [],
      selectedSessionIndex: 0,
      selectedSessionId: null,
      chatItems: [],
      chatScrollOffset: 0,
      expandedToolIds: new Set<string>(),
      expandedUserIds: new Set<string>(),
      expandedSystemIds: new Set<string>(),
      chatError: null,
      sessionIsOngoing: false,
      subagentStack: [],
      subagentLabel: null,
      contextStatsMap: new Map(),
      contextPhaseInfo: null,
      showContextPanel: false,
      sessionFilterActive: false,
      sessionFilter: '',
      chatSearchActive: false,
      chatSearchQuery: '',
      chatSearchMatches: [],
      currentChatSearchIndex: -1,
      contextPanelCursorIndex: 0,
      expandedContextCategory: null,
      contextPanelScrollOffset: 0,
    });
  },

  goBackToSessions: (): void => {
    set({
      focusMode: 'sessions',
      selectedSessionId: null,
      chatItems: [],
      chatScrollOffset: 0,
      expandedAIGroupIds: new Set<string>(),
      expandedAIGroupScrollOffsets: new Map(),
      expandedToolIds: new Set<string>(),
      expandedUserIds: new Set<string>(),
      expandedSystemIds: new Set<string>(),
      chatError: null,
      sessionIsOngoing: false,
      subagentStack: [],
      subagentLabel: null,
      contextStatsMap: new Map(),
      contextPhaseInfo: null,
      showContextPanel: false,
      sessionFilterActive: false,
      sessionFilter: '',
      chatSearchActive: false,
      chatSearchQuery: '',
      chatSearchMatches: [],
      currentChatSearchIndex: -1,
      contextPanelCursorIndex: 0,
      expandedContextCategory: null,
      contextPanelScrollOffset: 0,
    });
  },

  drillDownSubagent: async (process: Process): Promise<void> => {
    const {
      chatItems, chatScrollOffset, expandedAIGroupIds, expandedAIGroupScrollOffsets,
      expandedToolIds, expandedUserIds, expandedSystemIds, contextStatsMap, contextPhaseInfo, sessionIsOngoing,
      selectedProjectId, subagentStack, subagentLabel, sessions, selectedSessionId,
    } = get();

    // Build breadcrumb label for current level
    const currentLabel = subagentLabel
      ?? sessions.find((s) => s.id === selectedSessionId)?.firstMessage?.slice(0, 50)
      ?? selectedSessionId
      ?? 'Session';

    // Build label for the subagent we're about to enter
    const typeLabel = process.subagentType ?? 'Task';
    const desc = process.description ? ` — ${process.description.slice(0, 50)}` : '';
    const newSubagentLabel = `${typeLabel}${desc}`;

    // Push current state onto the stack
    const entry: SubagentStackEntry = {
      chatItems,
      chatScrollOffset,
      expandedAIGroupIds: new Set(expandedAIGroupIds),
      expandedAIGroupScrollOffsets: new Map(expandedAIGroupScrollOffsets),
      expandedToolIds: new Set(expandedToolIds),
      expandedUserIds: new Set(expandedUserIds),
      expandedSystemIds: new Set(expandedSystemIds),
      expandedSystemScrollOffsets: new Map(get().expandedSystemScrollOffsets),
      contextStatsMap: new Map(contextStatsMap),
      contextPhaseInfo,
      sessionIsOngoing,
      label: currentLabel,
    };

    set({
      subagentStack: [...subagentStack, entry],
      subagentLabel: newSubagentLabel,
      chatLoading: true,
      chatError: null,
    });

    try {
      const ctx = getServiceContext();
      const messages = process.messages;

      // Extract task calls for nested subagent resolution
      const taskCalls = getTaskCalls(messages);

      // Resolve nested subagents (if any)
      let nestedSubagents: Process[] = [];
      if (taskCalls.length > 0 && selectedProjectId) {
        try {
          nestedSubagents = await ctx.subagentResolver.resolveSubagents(
            selectedProjectId,
            process.id,
            taskCalls,
            messages,
          );
        } catch {
          // Non-critical — proceed without nested subagents
        }
      }

      // Build chunks
      const chunks = ctx.chunkBuilder.buildChunks(messages, nestedSubagents);

      // Transform to conversation
      const isOngoing = process.isOngoing ?? false;
      const conversation = transformChunksToConversation(chunks, nestedSubagents, isOngoing);

      // Enhance AI groups
      const enhancedItems: ChatItem[] = conversation.items.map((item) => {
        if (item.type === 'ai') {
          return { ...item, group: enhanceAIGroup(item.group) };
        }
        return item;
      });

      // Compute context stats
      const projectRoot = selectedProjectId
        ? decodePath(extractBaseDir(selectedProjectId))
        : '';
      const { statsMap, phaseInfo } = processSessionContextWithPhases(enhancedItems, projectRoot);

      set({
        chatItems: enhancedItems,
        chatScrollOffset: 0,
        expandedAIGroupIds: new Set<string>(),
        expandedAIGroupScrollOffsets: new Map(),
        expandedToolIds: new Set<string>(),
        expandedUserIds: new Set<string>(),
        expandedSystemIds: new Set<string>(),
        expandedSystemScrollOffsets: new Map(),
        chatLoading: false,
        sessionIsOngoing: isOngoing,
        contextStatsMap: statsMap,
        contextPhaseInfo: phaseInfo,
        showContextPanel: false,
      });
    } catch (error) {
      // On error, pop the stack entry we just pushed and restore previous label
      set({
        subagentStack: get().subagentStack.slice(0, -1),
        subagentLabel, // restore from closure (value before drill-down)
        chatLoading: false,
        chatError: error instanceof Error ? error.message : String(error),
      });
    }
  },

  goBackFromSubagent: (): void => {
    const { subagentStack } = get();
    if (subagentStack.length === 0) return;

    const newStack = subagentStack.slice(0, -1);
    const entry = subagentStack[subagentStack.length - 1];

    // entry.label = label of the level we're restoring.
    // If restoring to root (empty stack), subagentLabel = null.
    // If still in a subagent, subagentLabel = the popped entry's label.
    const restoredSubagentLabel = newStack.length > 0 ? entry.label : null;

    set({
      chatItems: entry.chatItems,
      chatScrollOffset: entry.chatScrollOffset,
      expandedAIGroupIds: entry.expandedAIGroupIds,
      expandedAIGroupScrollOffsets: entry.expandedAIGroupScrollOffsets,
      expandedToolIds: entry.expandedToolIds,
      expandedUserIds: entry.expandedUserIds,
      expandedSystemIds: entry.expandedSystemIds,
      expandedSystemScrollOffsets: entry.expandedSystemScrollOffsets,
      contextStatsMap: entry.contextStatsMap,
      contextPhaseInfo: entry.contextPhaseInfo,
      sessionIsOngoing: entry.sessionIsOngoing,
      subagentStack: newStack,
      subagentLabel: restoredSubagentLabel,
      showContextPanel: false,
    });
  },

  scrollChat: (delta: number): void => {
    set((state) => {
      const maxOffset = Math.max(0, state.chatItems.length - 1);
      const newOffset = Math.max(0, Math.min(state.chatScrollOffset + delta, maxOffset));
      return { chatScrollOffset: newOffset };
    });
  },

  toggleAIGroupExpanded: (id: string): void => {
    set((state) => {
      const next = new Set(state.expandedAIGroupIds);
      const nextOffsets = new Map(state.expandedAIGroupScrollOffsets);
      if (next.has(id)) {
        next.delete(id);
        nextOffsets.delete(id);
      } else {
        next.add(id);
      }
      return { expandedAIGroupIds: next, expandedAIGroupScrollOffsets: nextOffsets };
    });
  },

  toggleUserExpanded: (id: string): void => {
    set((state) => {
      const next = new Set(state.expandedUserIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { expandedUserIds: next };
    });
  },

  toggleSystemExpanded: (id: string): void => {
    set((state) => {
      const next = new Set(state.expandedSystemIds);
      const nextOffsets = new Map(state.expandedSystemScrollOffsets);
      if (next.has(id)) {
        next.delete(id);
        nextOffsets.delete(id);
      } else {
        next.add(id);
      }
      return { expandedSystemIds: next, expandedSystemScrollOffsets: nextOffsets };
    });
  },

  toggleHelp: (): void => {
    set((state) => ({ showHelp: !state.showHelp }));
  },

  toggleToolExpanded: (id: string): void => {
    set((state) => {
      const next = new Set(state.expandedToolIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { expandedToolIds: next };
    });
  },

  toggleContextPanel: (): void => {
    set((state) => ({
      showContextPanel: !state.showContextPanel,
      contextPanelCursorIndex: 0,
      expandedContextCategory: null,
      contextPanelScrollOffset: 0,
    }));
  },

  navigateList: (panel: 'projects' | 'sessions', delta: number, listLength?: number): void => {
    set((state) => {
      if (panel === 'projects') {
        const max = Math.max(0, (listLength ?? state.projects.length) - 1);
        const newIndex = Math.max(0, Math.min(state.selectedProjectIndex + delta, max));
        return { selectedProjectIndex: newIndex };
      } else {
        const max = Math.max(0, (listLength ?? state.sessions.length) - 1);
        const newIndex = Math.max(0, Math.min(state.selectedSessionIndex + delta, max));
        return { selectedSessionIndex: newIndex };
      }
    });
  },

  // ─── Session filter ───

  activateSessionFilter: (): void => {
    set({ sessionFilterActive: true, sessionFilter: '', selectedSessionIndex: 0 });
  },

  deactivateSessionFilter: (): void => {
    set({ sessionFilterActive: false, sessionFilter: '', selectedSessionIndex: 0 });
  },

  setSessionFilter: (text: string): void => {
    set({ sessionFilter: text, selectedSessionIndex: 0 });
  },

  // ─── Chat search ───

  activateChatSearch: (): void => {
    set({
      chatSearchActive: true,
      chatSearchQuery: '',
      chatSearchMatches: [],
      currentChatSearchIndex: -1,
    });
  },

  deactivateChatSearch: (): void => {
    set({
      chatSearchActive: false,
      chatSearchQuery: '',
      chatSearchMatches: [],
      currentChatSearchIndex: -1,
    });
  },

  setChatSearchQuery: (query: string): void => {
    if (!query) {
      set({
        chatSearchQuery: '',
        chatSearchMatches: [],
        currentChatSearchIndex: -1,
      });
      return;
    }

    const { chatItems } = get();
    const matches: ChatSearchMatch[] = [];
    const lowerQuery = query.toLowerCase();
    let globalIdx = 0;

    for (let i = 0; i < chatItems.length; i++) {
      const item = chatItems[i];
      let text = '';

      if (item.type === 'user') {
        text = item.group.content.rawText ?? item.group.content.text ?? '';
      } else if (item.type === 'ai') {
        const enhanced = item.group as import('@renderer/types/groups').EnhancedAIGroup;
        if (enhanced.lastOutput?.type === 'text' && enhanced.lastOutput.text) {
          text = enhanced.lastOutput.text;
        }
      } else if (item.type === 'system') {
        text = item.group.commandOutput ?? '';
      }

      if (!text) continue;

      const lowerText = text.toLowerCase();
      let searchPos = 0;
      let matchInItem = 0;

      while (true) {
        const idx = lowerText.indexOf(lowerQuery, searchPos);
        if (idx === -1) break;
        matches.push({
          itemIndex: i,
          itemId: item.group.id,
          matchIndexInItem: matchInItem,
          globalIndex: globalIdx,
        });
        globalIdx++;
        matchInItem++;
        searchPos = idx + 1;
      }
    }

    const newState: Partial<TuiState> = {
      chatSearchQuery: query,
      chatSearchMatches: matches,
      currentChatSearchIndex: matches.length > 0 ? 0 : -1,
    };

    // Auto-scroll to first match
    if (matches.length > 0) {
      newState.chatScrollOffset = matches[0].itemIndex;
    }

    set(newState);
  },

  nextChatSearchMatch: (): void => {
    set((state) => {
      if (state.chatSearchMatches.length === 0) return {};
      const next = (state.currentChatSearchIndex + 1) % state.chatSearchMatches.length;
      const match = state.chatSearchMatches[next];
      return {
        currentChatSearchIndex: next,
        chatScrollOffset: match.itemIndex,
      };
    });
  },

  previousChatSearchMatch: (): void => {
    set((state) => {
      if (state.chatSearchMatches.length === 0) return {};
      const prev = (state.currentChatSearchIndex - 1 + state.chatSearchMatches.length) % state.chatSearchMatches.length;
      const match = state.chatSearchMatches[prev];
      return {
        currentChatSearchIndex: prev,
        chatScrollOffset: match.itemIndex,
      };
    });
  },

  // ─── Context panel navigation ───

  navigateContextPanel: (delta: number): void => {
    set((state) => {
      const maxIndex = 5; // 6 categories (0-5)
      const next = Math.max(0, Math.min(state.contextPanelCursorIndex + delta, maxIndex));
      return { contextPanelCursorIndex: next };
    });
  },

  toggleContextCategory: (category: string): void => {
    set((state) => ({
      expandedContextCategory: state.expandedContextCategory === category ? null : category,
      contextPanelScrollOffset: 0,
    }));
  },

  scrollContextPanel: (delta: number): void => {
    set((state) => ({
      contextPanelScrollOffset: Math.max(0, state.contextPanelScrollOffset + delta),
    }));
  },
}));
