# Delete Candidates After Knowledge/Skill Approve Design

**Date:** 2026-04-29  
**Status:** Draft

## Overview

当用户在Review tab中approve knowledge或skill draft后，当前kept candidates仍保留在列表中。本设计实现approve成功后自动删除被引用的candidates，释放存储空间并清理UI状态。

**核心需求：**
- Approve knowledge/skill后，删除该draft直接引用的candidates
- Candidate文件从磁盘彻底删除（非仅UI状态移除）
- UI列表同步更新，candidates从列表消失
- 错误处理：删除失败不影响approve成功状态

**约束：**
- 只删除被approve draft直接引用的candidates（其他kept candidates保留）
- 删除操作幂等（candidate已不存在视为成功）
- Approve是主要操作，删除是辅助清理

## Architecture

### Backend API

**HTTP Endpoint:**
```
DELETE /candidate-memories/:id
```

**Path Parameter:**
- `id`: Candidate memory ID (格式: `candidate:2026-04-29:activitywatch-browser:...`)

**Response Codes:**
- 204 No Content: 删除成功（包括candidate已不存在）
- 400 Bad Request: ID格式非法（ValidationError）
- 500 Internal Server Error: 权限错误、IO错误

**Service Interface:**
```typescript
deleteCandidateMemory(candidateMemoryId: string): Promise<void>
```

**Implementation Location:**
- Service: `src/apps/mirrorbrain-service/index.ts`
- HTTP route: `src/apps/mirrorbrain-http-server/index.ts`

**Service Implementation Logic:**
1. 验证ID格式（必须以`candidate:`开头，不含`..`、`/`、`\`）
2. 构建文件路径：`workspaceDir/mirrorbrain/candidate-memories/${candidateMemoryId}.json`
3. 调用`unlink()`删除文件
4. 捕获ENOENT错误（文件已不存在），视为成功返回
5. 捕获其他错误（EACCES、磁盘错误），抛出异常
6. 记录审计日志（删除操作、成功/失败状态）

**Idempotency Guarantee:**
如果candidate文件已不存在，不抛出错误，返回成功状态。这确保并发approve操作不会因重复删除失败。

### Frontend Changes

**API Client Extension:**
在`src/apps/mirrorbrain-web-react/src/api/client.ts`添加：

```typescript
async deleteCandidateMemory(candidateMemoryId: string): Promise<void> {
  const response = await fetch(`${this.baseUrl}/candidate-memories/${candidateMemoryId}`, {
    method: 'DELETE',
  })
  
  if (!response.ok) {
    if (response.status === 404) {
      // 文件已不存在，视为成功
      return
    }
    
    let errorMessage = 'Failed to delete candidate memory'
    try {
      const body = await response.json()
      errorMessage = body.message || body.error || errorMessage
    } catch {
      errorMessage += `: ${response.statusText}`
    }
    throw new Error(errorMessage)
  }
}
```

**ReviewPanel Handler Changes:**
修改`handleApproveKnowledge`和`handleApproveSkill`，approve成功后批量删除candidates：

```typescript
const handleApproveKnowledge = async () => {
  if (!knowledgeDraft?.id || !approveKnowledge) return
  
  try {
    const result = await approveKnowledge(knowledgeDraft)
    if (result) {
      // Knowledge approve成功 - 主要操作
      
      // 提取candidate IDs from sourceReviewedMemoryIds
      const sourceReviewedIds = knowledgeDraft.sourceReviewedMemoryIds || []
      const candidateIds = sourceReviewedIds
        .map(id => id.replace(/^reviewed:/, 'candidate:'))
        .filter(id => id.startsWith('candidate:')) // 验证转换结果
      
      // 批量删除candidates
      const deletionErrors: Array<{ candidateId: string; error: Error }> = []
      for (const candidateId of candidateIds) {
        try {
          await api.deleteCandidateMemory(candidateId)
          dispatch({ type: 'REMOVE_CANDIDATE', payload: candidateId })
        } catch (error) {
          deletionErrors.push({ candidateId, error: error as Error })
        }
      }
      
      // 显示反馈
      if (deletionErrors.length > 0) {
        setFeedback({
          kind: 'error',
          message: `Knowledge approved, but ${deletionErrors.length} candidate deletion(s) failed`
        })
      } else {
        setFeedback({
          kind: 'success',
          message: 'Knowledge approved and candidates deleted'
        })
      }
      
      // 清理draft状态
      dispatch({ type: 'SET_KNOWLEDGE_DRAFT', payload: null })
      dispatch({ type: 'CLEAR_KEPT_REVIEWED_MEMORIES' })
      setViewingMode('kept-list')
    }
  } catch (error) {
    // Approve失败 - 不尝试删除candidates
    setFeedback({ kind: 'error', message: 'Knowledge approval failed' })
  }
}
```

类似逻辑添加到`handleApproveSkill`（如果存在）。

**State Management:**
- `REMOVE_CANDIDATE` action已存在（在keep/undo功能中实现）
- 每删除一个candidate，立即dispatch更新`candidateMemories` state
- UI列表实时反映删除结果

### HTTP Server Route Implementation

**Route Location:**
在`src/apps/mirrorbrain-http-server/index.ts`的candidate-memories路由组添加：

```typescript
app.delete<{ Params: { id: string } }>(
  '/candidate-memories/:id',
  {
    schema: {
      summary: 'Delete a candidate memory by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      response: {
        204: {
          type: 'null',
          description: 'Candidate memory deleted successfully',
        },
        400: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
    },
  },
  async (request, reply) => {
    const candidateId = request.params.id
    
    try {
      await input.service.deleteCandidateMemory(candidateId)
      reply.code(204).send()
    } catch (error) {
      if (error instanceof ValidationError) {
        reply.code(400).send({ message: error.message })
      } else if (error instanceof NotFoundError) {
        reply.code(404).send({ message: error.message })
      } else {
        console.error('Error deleting candidate memory:', error)
        reply.code(500).send({ message: 'Internal server error' })
      }
    }
  }
)
```

**Route Organization:**
添加在现有candidate-memories路由之后，保持路由组顺序：
1. `GET /candidate-memories` - list candidates
2. `POST /candidate-memories/daily` - create daily candidates
3. `DELETE /candidate-memories/:id` - delete candidate (新增)

## Data Flow

### Approve Knowledge Flow with Candidate Deletion

```mermaid
sequenceDiagram
    User>>SelectedCandidate: Click Approve button
    SelectedCandidate>>ReviewPanel: onApproveKnowledge()
    ReviewPanel>>useArtifacts: approveKnowledge(draft)
    useArtifacts>>Backend: POST /knowledge/approve
    Backend>>Storage: Publish knowledge artifact
    Backend>>ReviewPanel: Success + published artifact
    ReviewPanel>>ReviewPanel: Extract candidate IDs from sourceReviewedMemoryIds
    ReviewPanel>>Backend: DELETE /candidate-memories/:id1
    Backend>>Storage: unlink candidate1.json
    Backend>>ReviewPanel: 204 Success
    ReviewPanel>>MirrorBrainContext: REMOVE_CANDIDATE id1
    ReviewPanel>>Backend: DELETE /candidate-memories/:id2
    Backend>>Storage: unlink candidate2.json
    Backend>>ReviewPanel: 204 Success
    ReviewPanel>>MirrorBrainContext: REMOVE_CANDIDATE id2
    ReviewPanel>>MirrorBrainContext: CLEAR_KEPT_REVIEWED_MEMORIES
    ReviewPanel>>SelectedCandidate: setViewingMode('kept-list')
    SelectedCandidate>>UI: Show updated kept-list (candidates removed)
```

### Error Scenarios

**Approve失败 - 不删除candidates:**
```mermaid
sequenceDiagram
    User>>SelectedCandidate: Click Approve
    ReviewPanel>>Backend: POST /knowledge/approve
    Backend>>ReviewPanel: Error 500
    ReviewPanel>>UI: Show error feedback
    Note over ReviewPanel: No deletion attempted
```

**Approve成功 + 删除失败:**
```mermaid
sequenceDiagram
    ReviewPanel>>Backend: POST /knowledge/approve
    Backend>>ReviewPanel: Success
    ReviewPanel>>Backend: DELETE /candidate-memories/:id
    Backend>>ReviewPanel: Error 500
    ReviewPanel>>UI: Show warning feedback
    Note over ReviewPanel: Knowledge approved, candidate remains
```

## Error Handling

### Backend Error Classification

**Level 1: Input Validation Errors**
- **触发条件:** Candidate ID格式非法
  - 不以`candidate:`开头
  - 包含路径遍历字符：`..`, `/`, `\`
- **异常类型:** ValidationError
- **HTTP状态:** 400 Bad Request
- **日志:** 警告级别，记录非法ID和调用来源
- **消息:** "Invalid candidate memory ID format: {id}"

**Level 2: File System Errors**

*ENOENT (文件不存在):*
- **触发条件:** Candidate文件已删除或从未存在
- **处理策略:** 视为成功（幂等性）
- **返回:** 正常完成，不抛出异常
- **日志:** 信息级别，"Candidate already deleted: {id}"

*EACCES (权限错误):*
- **触发条件:** 无写入权限或文件被锁定
- **异常类型:** Error (原生)
- **HTTP状态:** 500 Internal Server Error
- **日志:** 错误级别，完整堆栈跟踪
- **消息:** "Permission denied: {filePath}"

*其他IO错误:*
- **触发条件:** 磁盘满、文件系统损坏等
- **异常类型:** Error (原生)
- **HTTP状态:** 500 Internal Server Error
- **日志:** 错误级别，系统级错误详情

**Level 3: Concurrent Access Conflicts**
- **场景:** 两个approve操作同时删除同一candidate
- **第一个请求:** 成功删除文件
- **第二个请求:** 遇到ENOENT，返回204（幂等）
- **结果:** 无冲突，两次操作都视为成功

### Frontend Error Handling Strategy

**Primary vs Secondary Operations:**
- **Primary operation:** Approve knowledge/skill draft
  - 成功才继续删除candidates
  - 失败则终止流程，不删除candidates
- **Secondary operation:** Delete candidates
  - 失败不影响approve成功状态
  - 收集所有删除错误，汇总反馈给用户

**Error Accumulation Pattern:**
```typescript
const deletionErrors = []
for (const candidateId of candidateIds) {
  try {
    await api.deleteCandidateMemory(candidateId)
    dispatch({ type: 'REMOVE_CANDIDATE', payload: candidateId })
  } catch (error) {
    deletionErrors.push({ candidateId, error })
    console.warn(`Failed to delete candidate ${candidateId}:`, error)
  }
}
```

**Feedback Strategy:**
- **完全成功:** "Knowledge approved and candidates deleted"
- **部分失败:** "Knowledge approved, but 2 candidate deletion(s) failed"
- **完全失败:** "Knowledge approved, but all candidate deletions failed" (warning level)
- **Approve失败:** "Knowledge approval failed" (error level，不提及candidates)

**User Recovery Path:**
如果删除失败，用户可以：
- 手动刷新页面，candidates重新加载（如果文件仍存在）
- 未来功能：提供"手动清理candidates"按钮

## Edge Cases

### 1. Empty SourceReviewedMemoryIds

**场景:** KnowledgeDraft未引用任何reviewed memories  
**触发:** sourceReviewedMemoryIds数组为空或不存在  
**处理:** 
```typescript
const candidateIds = knowledgeDraft.sourceReviewedMemoryIds?.map(...) || []
if (candidateIds.length === 0) {
  // Skip deletion, proceed to clear draft state
}
```
**结果:** Approve成功，无candidates被删除

### 2. Candidate Already Deleted Manually

**场景:** 用户或其他操作已删除candidate文件  
**Backend:** 遇到ENOENT，返回204  
**Frontend:** 
- API调用成功（204视为成功）
- Dispatch `REMOVE_CANDIDATE`（如果candidate仍在state中）
- 如果candidate已不在state，dispatch无效果（无害）

**结果:** 幂等操作，无副作用

### 3. Malformed SourceReviewedMemoryIds

**场景:** ID格式异常，不符合`reviewed:xxx`模式  
**示例:** `sourceReviewedMemoryIds: ["unknown-format", "malformed"]`  
**处理:**
```typescript
const candidateIds = sourceReviewedIds
  .map(id => id.replace(/^reviewed:/, 'candidate:'))
  .filter(id => id.startsWith('candidate:')) // 验证转换结果
```
**结果:** 异常ID被过滤，只删除合法candidate IDs  
**日志:** 警告级别，记录被跳过的异常ID

### 4. Network Interruption

**场景:** Approve API成功，删除API请求超时  
**Frontend:**
```typescript
try {
  await api.deleteCandidateMemory(candidateId)
} catch (error) {
  if (error.message.includes('timeout')) {
    deletionErrors.push({ candidateId, error })
    // Continue with next candidate
  }
}
```
**结果:** Candidate可能仍在磁盘，但UI已移除（state更新失败）  
**恢复:** 用户刷新页面，candidate重新出现

### 5. Partial State Consistency

**场景:** 
- Candidate文件已删除（backend成功）
- Frontend dispatch失败（context error）
- UI仍显示candidate

**处理:** Frontend dispatch失败抛出异常，加入deletionErrors  
**结果:** Candidate已删除，但UI状态不一致  
**恢复:** 用户刷新页面，candidate消失（文件不存在，backend返回空列表）

### 6. Skill Draft Approval

**差异:** Skill artifact结构不同
- `workflowEvidenceRefs: string[]` - 引用reviewed memory IDs
- 无`sourceReviewedMemoryIds`字段

**处理:**
```typescript
const handleApproveSkill = async () => {
  // Extract from workflowEvidenceRefs
  const reviewedIds = skillDraft?.workflowEvidenceRefs || []
  const candidateIds = reviewedIds
    .map(id => id.replace(/^reviewed:/, 'candidate:'))
    .filter(id => id.startsWith('candidate:'))
  
  // Same deletion logic as knowledge
}
```

## Testing Strategy

### Backend Unit Tests

**Location:** `src/apps/mirrorbrain-service/index.test.ts`

**Test Suite:**
```typescript
describe('deleteCandidateMemory', () => {
  it('should delete existing candidate memory file', async () => {
    // Setup: Create test candidate file in workspace
    const candidateId = 'candidate:test-delete'
    const filePath = join(workspaceDir, 'mirrorbrain/candidate-memories', `${candidateId}.json`)
    await writeFile(filePath, JSON.stringify({ id: candidateId }))
    
    // Call
    await service.deleteCandidateMemory(candidateId)
    
    // Verify
    expect(await access(filePath)).rejects.toThrow('ENOENT')
  })
  
  it('should succeed if file already deleted (idempotent)', async () => {
    // Call: Delete non-existent candidate
    const candidateId = 'candidate:non-existent'
    
    // Verify: No error thrown
    await service.deleteCandidateMemory(candidateId)
  })
  
  it('should reject invalid candidate ID format', async () => {
    // Call: Invalid ID (no 'candidate:' prefix)
    const invalidId = 'invalid-id-format'
    
    // Verify
    await expect(service.deleteCandidateMemory(invalidId))
      .rejects.toThrow(ValidationError)
  })
  
  it('should reject path traversal in candidate ID', async () => {
    // Call: ID with path traversal
    const maliciousId = 'candidate:../secret-file'
    
    // Verify
    await expect(service.deleteCandidateMemory(maliciousId))
      .rejects.toThrow(ValidationError)
  })
  
  it('should handle permission errors gracefully', async () => {
    // Setup: Create locked/permission-denied file
    // Call
    // Verify: Error thrown, logged appropriately
  })
})
```

### HTTP Server Integration Tests

**Location:** `src/apps/mirrorbrain-http-server/index.test.ts`

**Test Suite:**
```typescript
describe('DELETE /candidate-memories/:id', () => {
  it('should return 204 when candidate deleted successfully', async () => {
    // Setup: Create candidate file
    const candidate = await createTestCandidate()
    
    // Request
    const response = await fetch(`${server.origin}/candidate-memories/${candidate.id}`, {
      method: 'DELETE'
    })
    
    // Verify
    expect(response.status).toBe(204)
    expect(await fileExists(candidate.filePath)).toBe(false)
  })
  
  it('should return 204 if candidate not found (idempotent)', async () => {
    // Request: Delete non-existent candidate
    const response = await fetch(`${server.origin}/candidate-memories/candidate:non-existent`, {
      method: 'DELETE'
    })
    
    // Verify
    expect(response.status).toBe(204)
  })
  
  it('should return 400 for invalid ID format', async () => {
    // Request
    const response = await fetch(`${server.origin}/candidate-memories/invalid-id`, {
      method: 'DELETE'
    })
    
    // Verify
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.message).toContain('Invalid candidate memory ID format')
  })
})
```

### Frontend Component Tests

**Location:** `src/apps/mirrorbrain-web-react/src/components/review/ReviewPanel.test.tsx`

**Test Suite:**
```typescript
describe('approve knowledge and delete candidates', () => {
  it('should delete candidates after approve knowledge success', async () => {
    // Setup mocks
    const mockKnowledgeDraft = {
      id: 'knowledge:test',
      sourceReviewedMemoryIds: [
        'reviewed:candidate:1',
        'reviewed:candidate:2'
      ]
    }
    
    const mockApproveKnowledge = vi.fn().mockResolvedValue({
      publishedArtifact: {},
      assignedTopic: { title: 'Test Topic' }
    })
    
    const mockDeleteCandidate = vi.fn().mockResolvedValue(undefined)
    
    // Render component with mocks
    render(<ReviewPanel ... />)
    
    // Action: Click approve button
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    
    // Verify deleteCandidateMemory called twice
    expect(mockDeleteCandidate).toHaveBeenCalledTimes(2)
    expect(mockDeleteCandidate).toHaveBeenCalledWith('candidate:1')
    expect(mockDeleteCandidate).toHaveBeenCalledWith('candidate:2')
    
    // Verify REMOVE_CANDIDATE dispatched twice
    expect(dispatch).toHaveBeenCalledWith({ type: 'REMOVE_CANDIDATE', payload: 'candidate:1' })
    expect(dispatch).toHaveBeenCalledWith({ type: 'REMOVE_CANDIDATE', payload: 'candidate:2' })
  })
  
  it('should handle candidate deletion failure gracefully', async () => {
    // Setup: approve succeeds, delete fails
    mockApproveKnowledge.mockResolvedValue({ success: true })
    mockDeleteCandidate.mockRejectedValue(new Error('Network error'))
    
    // Action: Click approve
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    
    // Verify: Approve still marked as success, feedback shows deletion error
    expect(screen.getByText(/Knowledge approved, but.*deletion.*failed/)).toBeInTheDocument()
  })
  
  it('should not delete candidates if approve fails', async () => {
    // Setup: approve fails
    mockApproveKnowledge.mockRejectedValue(new Error('Approval failed'))
    
    // Action: Click approve
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    
    // Verify: deleteCandidateMemory not called
    expect(mockDeleteCandidate).not.toHaveBeenCalled()
    
    // Verify: Error feedback shows approval failure only
    expect(screen.getByText(/Knowledge approval failed/)).toBeInTheDocument()
  })
})
```

### End-to-End Integration Tests

**Location:** `tests/integration/review-to-artifacts.test.ts`

**Extended Test:**
```typescript
it('should remove candidates from list after approve', async () => {
  // Setup: Backend server + workspace
  const workspace = await createTestWorkspace()
  
  // Flow
  // 1. Create daily candidates
  const candidates = await api.createDailyCandidates('2026-04-29')
  expect(candidates.length).toBeGreaterThan(0)
  
  // 2. Keep candidates
  const keptCandidateIds = candidates.slice(0, 2).map(c => c.id)
  for (const id of keptCandidateIds) {
    await api.reviewCandidateMemory(id, 'keep')
  }
  
  // 3. Generate knowledge draft
  const reviewedMemories = await api.listReviewedMemories()
  const knowledgeDraft = await api.generateKnowledge(reviewedMemories)
  
  // 4. Approve knowledge
  const approveResult = await api.approveKnowledge(knowledgeDraft)
  expect(approveResult.publishedArtifact).toBeDefined()
  
  // 5. Verify candidates deleted
  const remainingCandidates = await api.listCandidateMemoriesByDate('2026-04-29')
  for (const deletedId of keptCandidateIds) {
    expect(remainingCandidates.find(c => c.id === deletedId)).toBeUndefined()
  }
  
  // 6. Verify candidate files deleted from workspace
  for (const deletedId of keptCandidateIds) {
    const filePath = join(workspace, 'mirrorbrain/candidate-memories', `${deletedId}.json`)
    expect(await fileExists(filePath)).toBe(false)
  }
})
```

## Implementation Steps

**Phase 1: Backend Service**
1. Add `deleteCandidateMemory` service function to `mirrorbrain-service/index.ts`
2. Implement validation + file deletion logic
3. Add unit tests for service function
4. Verify error handling and logging

**Phase 2: HTTP Server**
1. Add DELETE route to `mirrorbrain-http-server/index.ts`
2. Add route validation and error handling
3. Add integration tests for HTTP endpoint
4. Verify idempotency and error responses

**Phase 3: Frontend API Client**
1. Add `deleteCandidateMemory` method to `api/client.ts`
2. Handle 204/404 responses
3. Add error parsing logic
4. Add API client tests

**Phase 4: Frontend Handlers**
1. Update `handleApproveKnowledge` in ReviewPanel
2. Update `handleApproveSkill` (if applicable)
3. Add candidate deletion logic after approve success
4. Add error accumulation and feedback
5. Add component tests for handler changes

**Phase 5: Integration Testing**
1. Extend `review-to-artifacts.test.ts` with approve+delete scenario
2. Verify full flow: create → keep → generate → approve → delete
3. Verify candidate files deleted from workspace
4. Verify UI state updated correctly

**Phase 6: Manual Testing**
1. Test approve knowledge with 2+ kept candidates
2. Test approve skill with workflow evidence
3. Verify candidates disappear from UI list
4. Test error scenario: approve success + network failure during delete
5. Test idempotency: approve twice (should succeed both times)

## Success Criteria

1. ✅ Approve knowledge后，sourceReviewedMemoryIds对应的candidates被删除
2. ✅ Candidate文件从磁盘删除（非仅UI移除）
3. ✅ Candidates列表实时更新，删除的candidates消失
4. ✅ 删除操作幂等（重复删除不报错）
5. ✅ 删除失败不影响approve成功状态
6. ✅ 其他kept candidates保留（只删除被引用的）
7. ✅ 所有单元测试、集成测试、E2E测试通过
8. ✅ 错误处理完善，用户收到清晰反馈

## Risks and Mitigations

**Risk 1: 文件删除失败但UI已更新**
- **影响:** Candidate显示在列表中但backend无法操作
- **缓解:** Frontend捕获错误，显示警告反馈
- **恢复:** 用户刷新页面，candidate消失（文件已不存在）

**Risk 2: 并发approve操作删除同一candidate**
- **影响:** 第二次删除遇到ENOENT
- **缓解:** Backend幂等处理，ENOENT视为成功
- **结果:** 无副作用

**Risk 3: Candidate ID转换错误**
- **影响:** 尝试删除错误ID的candidate
- **缓解:** Frontend验证转换结果，过滤非法ID
- **日志:** 警告级别，记录跳过的ID

**Risk 4: Approve成功但所有candidates删除失败**
- **影响:** Knowledge已发布，candidates仍占用磁盘
- **缓解:** 用户收到警告反馈，可手动清理
- **未来功能:** 提供"清理已approve candidates"批量操作

## Future Enhancements

- 批量清理功能：列出所有已approve但未删除的candidates
- 删除进度指示器：显示"Deleting candidate 1 of 3..."
- 删除撤销：允许用户恢复误删的candidates（如果文件备份）
- 历史记录：记录approve操作关联的candidate IDs（审计追踪）