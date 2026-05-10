import { useEffect } from 'react'
import { useMirrorBrain } from '../contexts/MirrorBrainContext'
import type { MirrorBrainWebAppApi } from '../api/client'
import { MEMORY_PAGE_SIZE } from '../components/memory/memory-page-config'

export function useMirrorBrainState(api: MirrorBrainWebAppApi) {
  const { state, dispatch } = useMirrorBrain()

  // Load initial data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [health, memory, knowledge, topics, skills] = await Promise.all([
          api.getHealth(),
          api.listMemory(1, MEMORY_PAGE_SIZE),
          api.listKnowledge(),
          api.listKnowledgeTopics(),
          api.listSkills(),
        ])

        dispatch({ type: 'SET_SERVICE_STATUS', payload: health.status })
        dispatch({ type: 'LOAD_MEMORY_EVENTS', payload: memory })
        dispatch({ type: 'LOAD_KNOWLEDGE', payload: knowledge })
        dispatch({ type: 'LOAD_KNOWLEDGE_TOPICS', payload: topics })
        dispatch({ type: 'LOAD_SKILLS', payload: skills })
      } catch (error) {
        console.error('Failed to load initial data:', error)
      }
    }

    loadData()
  }, [api, dispatch])

  return { state, dispatch }
}
