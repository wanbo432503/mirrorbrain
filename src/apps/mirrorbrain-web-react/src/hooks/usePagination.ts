import { useState, useCallback } from 'react'

export function usePagination(totalPages: number, initialPage = 1) {
  const [currentPage, setCurrentPage] = useState(initialPage)

  const goToPage = useCallback(
    (page: number) => {
      const clampedPage = Math.max(1, Math.min(page, totalPages))
      setCurrentPage(clampedPage)
    },
    [totalPages]
  )

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1)
  }, [currentPage, goToPage])

  const previousPage = useCallback(() => {
    goToPage(currentPage - 1)
  }, [currentPage, goToPage])

  const canGoNext = currentPage < totalPages
  const canGoPrevious = currentPage > 1

  return {
    currentPage,
    totalPages,
    goToPage,
    nextPage,
    previousPage,
    canGoNext,
    canGoPrevious,
  }
}