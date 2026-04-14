import { createContext, useContext, useReducer, Dispatch, ReactNode } from 'react'
import type {
  MemoryEvent,
  CandidateMemory,
  KnowledgeArtifact,
  SkillArtifact,
  BrowserSyncSummary,
} from '../types/index'

type ServiceStatus = 'running' | 'stopped' | 'unknown'

interface MirrorBrainState {
  // Service status
  serviceStatus: ServiceStatus

  // Memory events
  memoryEvents: MemoryEvent[]
  hasLoadedMemoryEvents: boolean

  // Review workflow
  reviewWindowDate: string | null
  reviewWindowEventCount: number
  candidateMemories: CandidateMemory[]
  selectedCandidateId: string | null

  // Knowledge artifacts
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
  skillArtifacts: SkillArtifact[]

  // Sync state
  lastSyncSummary: BrowserSyncSummary | null
}

type MirrorBrainAction =
  | { type: 'SET_SERVICE_STATUS'; payload: ServiceStatus }
  | { type: 'LOAD_MEMORY_EVENTS'; payload: MemoryEvent[] }
  | { type: 'SYNC_BROWSER'; payload: BrowserSyncSummary }
  | { type: 'SYNC_SHELL'; payload: BrowserSyncSummary }
  | { type: 'LOAD_KNOWLEDGE'; payload: KnowledgeArtifact[] }
  | { type: 'LOAD_KNOWLEDGE_TOPICS'; payload: MirrorBrainState['knowledgeTopics'] }
  | { type: 'LOAD_SKILLS'; payload: SkillArtifact[] }
  | { type: 'SET_CANDIDATES'; payload: CandidateMemory[] }
  | { type: 'SET_SELECTED_CANDIDATE'; payload: string | null }
  | { type: 'SET_REVIEW_WINDOW'; payload: { date: string; eventCount: number } }

const initialState: MirrorBrainState = {
  serviceStatus: 'unknown',
  memoryEvents: [],
  hasLoadedMemoryEvents: false,
  reviewWindowDate: null,
  reviewWindowEventCount: 0,
  candidateMemories: [],
  selectedCandidateId: null,
  knowledgeArtifacts: [],
  knowledgeTopics: [],
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
        memoryEvents: action.payload,
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

    case 'LOAD_SKILLS':
      return { ...state, skillArtifacts: action.payload }

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

export type { MirrorBrainState, MirrorBrainAction, ServiceStatus }
