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

import { enhanceAIGroup } from '@renderer/utils/aiGroupEnhancer';
import { transformChunksToConversation } from '@renderer/utils/groupTransformer';
import { create } from 'zustand';

import type { ServiceContext } from '@main/services';
import type { Project, Session } from '@main/types/domain';
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
  chatLoading: boolean;
  chatError: string | null;
  sessionIsOngoing: boolean;

  // Actions
  loadProjects: () => Promise<void>;
  selectProject: (projectId: string) => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  refreshCurrentSession: () => Promise<void>;
  refreshSessionList: () => Promise<void>;
  setFocusMode: (mode: FocusMode) => void;
  goBackToProjects: () => void;
  goBackToSessions: () => void;
  scrollChat: (delta: number) => void;
  toggleAIGroupExpanded: (id: string) => void;
  navigateList: (panel: 'projects' | 'sessions', delta: number) => void;
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
  chatLoading: false,
  chatError: null,
  sessionIsOngoing: false,

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
      focusMode: 'chat',
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

      set({
        chatItems: enhancedItems,
        chatLoading: false,
        sessionIsOngoing: isOngoing,
      });
    } catch (error) {
      set({
        chatError: error instanceof Error ? error.message : String(error),
        chatLoading: false,
      });
    }
  },

  refreshCurrentSession: async (): Promise<void> => {
    const { selectedSessionId, chatScrollOffset, expandedAIGroupIds, chatItems, sessionIsOngoing } =
      get();
    if (!selectedSessionId) return;

    // Preserve scroll and expansion state across refresh
    const savedOffset = chatScrollOffset;
    const savedExpanded = new Set(expandedAIGroupIds);
    const prevItemCount = chatItems.length;

    // Check if user was near the bottom before refresh
    const maxOffset = Math.max(0, prevItemCount - 1);
    const wasNearBottom = savedOffset >= maxOffset - 3;

    await get().selectSession(selectedSessionId);

    const newItemCount = get().chatItems.length;

    // Auto-scroll to bottom if ongoing session and user was near the bottom
    if (sessionIsOngoing && wasNearBottom && newItemCount > prevItemCount) {
      set({
        chatScrollOffset: Math.max(0, newItemCount - 1),
        expandedAIGroupIds: savedExpanded,
      });
    } else {
      set({
        chatScrollOffset: savedOffset,
        expandedAIGroupIds: savedExpanded,
      });
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
      chatError: null,
      sessionIsOngoing: false,
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
      chatError: null,
      sessionIsOngoing: false,
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

  navigateList: (panel: 'projects' | 'sessions', delta: number): void => {
    set((state) => {
      if (panel === 'projects') {
        const max = Math.max(0, state.projects.length - 1);
        const newIndex = Math.max(0, Math.min(state.selectedProjectIndex + delta, max));
        return { selectedProjectIndex: newIndex };
      } else {
        const max = Math.max(0, state.sessions.length - 1);
        const newIndex = Math.max(0, Math.min(state.selectedSessionIndex + delta, max));
        return { selectedSessionIndex: newIndex };
      }
    });
  },
}));
