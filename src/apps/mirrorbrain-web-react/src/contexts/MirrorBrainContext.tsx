import { createContext, useContext, useReducer, Dispatch, ReactNode } from 'react'
import type {
  MemoryEvent,
  CandidateMemory,
  KnowledgeArtifact,
  SkillArtifact,
  BrowserSyncSummary,
  ReviewedMemory,
} from '../types/index'
import type { PaginatedMemoryEvents } from '../api/client'

type ServiceStatus = 'running' | 'stopped' | 'unknown'

interface MirrorBrainState {
  // Service status
  serviceStatus: ServiceStatus

  // Memory events
  memoryEvents: MemoryEvent[]
  memoryPagination?: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
  hasLoadedMemoryEvents: boolean

  // Review workflow
  reviewWindowDate: string | null
  reviewWindowEventCount: number
  candidateMemories: CandidateMemory[]
  selectedCandidateId: string | null
  reviewedMemories: ReviewedMemory[]

  // Knowledge artifacts
  knowledgeDraft: KnowledgeArtifact | null
  knowledgeArtifacts: KnowledgeArtifact[]
  knowledgeTopics: Array<{
    topicKey: string
    title: string
    summary: string
    currentBestKnowledgeId: string
    updatedAt?: string
    recencyLabel: string
  }>

  // Skill artifacts
  skillDraft: SkillArtifact | null
  skillArtifacts: SkillArtifact[]

  // Sync state
  lastSyncSummary: BrowserSyncSummary | null
}

type MirrorBrainAction =
  | { type: 'SET_SERVICE_STATUS'; payload: ServiceStatus }
  | { type: 'LOAD_MEMORY_EVENTS'; payload: PaginatedMemoryEvents }
  | { type: 'SYNC_BROWSER'; payload: BrowserSyncSummary }
  | { type: 'SYNC_SHELL'; payload: BrowserSyncSummary }
  | { type: 'LOAD_KNOWLEDGE'; payload: KnowledgeArtifact[] }
  | { type: 'LOAD_KNOWLEDGE_TOPICS'; payload: MirrorBrainState['knowledgeTopics'] }
  | { type: 'SET_KNOWLEDGE_DRAFT'; payload: KnowledgeArtifact | null }
  | { type: 'LOAD_SKILLS'; payload: SkillArtifact[] }
  | { type: 'SET_SKILL_DRAFT'; payload: SkillArtifact | null }
  | { type: 'SET_CANDIDATES'; payload: CandidateMemory[] }
  | { type: 'SET_SELECTED_CANDIDATE'; payload: string | null }
  | { type: 'SET_REVIEW_WINDOW'; payload: { date: string; eventCount: number } }
  | { type: 'ADD_REVIEWED_MEMORY'; payload: ReviewedMemory }
  | { type: 'REMOVE_CANDIDATE'; payload: string }
  | { type: 'CLEAR_KEPT_REVIEWED_MEMORIES' }

const initialState: MirrorBrainState = {
  serviceStatus: 'unknown',
  memoryEvents: [],
  memoryPagination: undefined,
  hasLoadedMemoryEvents: false,
  reviewWindowDate: null,
  reviewWindowEventCount: 0,
  candidateMemories: [],
  selectedCandidateId: null,
  reviewedMemories: [],
  knowledgeDraft: null,
  knowledgeArtifacts: [],
  knowledgeTopics: [],
  skillDraft: null,
  skillArtifacts: [],
  lastSyncSummary: null,
}

function mirrorBrainReducer(state: MirrorBrainState, action: MirrorBrainAction): MirrorBrainState {
  switch (action.type) {
    case 'SET_SERVICE_STATUS':
      return { ...state, serviceStatus: action.payload }

    case 'LOAD_MEMORY_EVENTS':
      return {
        ...state,
        memoryEvents: action.payload.items,
        memoryPagination: action.payload.pagination,
        hasLoadedMemoryEvents: true,
      }

    case 'SYNC_BROWSER':
    case 'SYNC_SHELL':
      return {
        ...state,
        lastSyncSummary: action.payload,
        hasLoadedMemoryEvents: true,
        // Merge imported events if present
        memoryEvents: action.payload.importedEvents
          ? [...action.payload.importedEvents, ...state.memoryEvents]
          : state.memoryEvents,
      }

    case 'LOAD_KNOWLEDGE':
      return { ...state, knowledgeArtifacts: action.payload }

    case 'LOAD_KNOWLEDGE_TOPICS':
      return { ...state, knowledgeTopics: action.payload }

    case 'SET_KNOWLEDGE_DRAFT':
      return { ...state, knowledgeDraft: action.payload }

    case 'LOAD_SKILLS':
      return { ...state, skillArtifacts: action.payload }

    case 'SET_SKILL_DRAFT':
      return { ...state, skillDraft: action.payload }

    case 'SET_CANDIDATES':
      return { ...state, candidateMemories: action.payload }

    case 'SET_SELECTED_CANDIDATE':
      return { ...state, selectedCandidateId: action.payload }

    case 'SET_REVIEW_WINDOW':
      return {
        ...state,
        reviewWindowDate: action.payload.date,
        reviewWindowEventCount: action.payload.eventCount,
      }

    case 'ADD_REVIEWED_MEMORY':
      return {
        ...state,
        reviewedMemories: [...state.reviewedMemories, action.payload],
      }

    case 'REMOVE_CANDIDATE':
      return {
        ...state,
        candidateMemories: state.candidateMemories.filter(
          (candidate) => candidate.id !== action.payload
        ),
      }

    case 'CLEAR_KEPT_REVIEWED_MEMORIES':
      return {
        ...state,
        reviewedMemories: state.reviewedMemories.filter(
          (memory) => memory.decision !== 'keep'
        ),
      }

    default:
      return state
  }
}

interface MirrorBrainContextValue {
  state: MirrorBrainState
  dispatch: Dispatch<MirrorBrainAction>
}

const MirrorBrainContext = createContext<MirrorBrainContextValue | undefined>(undefined)

interface MirrorBrainProviderProps {
  children: ReactNode
}

export function MirrorBrainProvider({ children }: MirrorBrainProviderProps) {
  const [state, dispatch] = useReducer(mirrorBrainReducer, initialState)

  return (
    <MirrorBrainContext.Provider value={{ state, dispatch }}>
      {children}
    </MirrorBrainContext.Provider>
  )
}

export function useMirrorBrain() {
  const context = useContext(MirrorBrainContext)

  if (context === undefined) {
    throw new Error('useMirrorBrain must be used within a MirrorBrainProvider')
  }

  return context
}

export { mirrorBrainReducer, initialState }
export type { MirrorBrainState, MirrorBrainAction, ServiceStatus }
