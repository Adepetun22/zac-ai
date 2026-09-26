import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, Send, Trash2, Reply, Pencil, Check } from 'lucide-react'

const POPOVER_WIDTH = 320
const LIST_MAX_HEIGHT = 256
const MAX_CHARS = 2000
const COUNTER_WARN_AT = 1800
const VIEWPORT_MARGIN = 8

function formatTime(iso) {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = (Date.now() - then) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return new Date(iso).toLocaleDateString()
}

// Build the thread shape in a single pass: roots in render order, a
// parent_id -> children index for descending the tree, and an id -> comment
// map for resolving ancestor author names on deep replies.
function buildThread(comments) {
  const byId = new Map()
  const childrenByParentId = new Map()
  const roots = []

  for (const comment of comments) {
    byId.set(comment.id, comment)
    if (comment.parent_id) {
      const siblings = childrenByParentId.get(comment.parent_id)
      if (siblings) siblings.push(comment)
      else childrenByParentId.set(comment.parent_id, [comment])
    } else {
      roots.push(comment)
    }
  }

  return { byId, childrenByParentId, roots }
}

export default function WidgetCommentsPopover({
  anchorRef,
  comments,
  currentUserId,
  onAdd,
  onUpdate,
  onDelete,
  onClose,
}) {
  const [position, setPosition] = useState(null)
  const [replyingTo, setReplyingTo] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState('')
  const [writePending, setWritePending] = useState(false)
  const popoverRef = useRef(null)
  const listRef = useRef(null)
  const composerRef = useRef(null)

  const { byId, childrenByParentId, roots } = useMemo(
    () => buildThread(comments),
    [comments]
  )

  const positionPopover = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) {
      onClose()
      return
    }

    const rect = anchor.getBoundingClientRect()
    const offscreen =
      rect.bottom < 0 ||
      rect.top > window.innerHeight ||
      rect.right < 0 ||
      rect.left > window.innerWidth
    if (offscreen) {
      onClose()
      return
    }

    const maxLeft = window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(rect.left + rect.width / 2 - POPOVER_WIDTH / 2, maxLeft)
    )

    // Flip above the anchor when there is not enough room below.
    const roomBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN
    const estimatedHeight = LIST_MAX_HEIGHT + 130
    const top =
      roomBelow >= estimatedHeight
        ? rect.bottom + VIEWPORT_MARGIN
        : Math.max(VIEWPORT_MARGIN, rect.top - estimatedHeight - VIEWPORT_MARGIN)

    setPosition(prev =>
      prev && prev.top === top && prev.left === left ? prev : { top, left }
    )
  }, [anchorRef, onClose])

  useEffect(() => {
    positionPopover()
    window.addEventListener('scroll', positionPopover, true)
    window.addEventListener('resize', positionPopover)
    return () => {
      window.removeEventListener('scroll', positionPopover, true)
      window.removeEventListener('resize', positionPopover)
    }
  }, [positionPopover])

  useEffect(() => {
    const onMouseDown = (e) => {
      if (popoverRef.current?.contains(e.target)) return
      if (anchorRef.current?.contains(e.target)) return
      onClose()
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [anchorRef, onClose])

  useEffect(() => {
    if (replyingTo || editingId) composerRef.current?.focus()
  }, [replyingTo, editingId])

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [comments.length])

  const cancelComposer = useCallback(() => {
    setDraft('')
    setReplyingTo(null)
    setEditingId(null)
  }, [])

  const submit = useCallback(async () => {
    const content = draft.trim()
    if (!content || content.length > MAX_CHARS || writePending) return

    setWritePending(true)
    try {
      if (editingId) {
        await onUpdate(editingId, content)
      } else {
        await onAdd({ parentId: replyingTo?.id || null, content })
      }
      setDraft('')
      setReplyingTo(null)
      setEditingId(null)
    } catch {
      // The caller already surfaced the failure via addNotification; keep the
      // draft in place so the text is not lost.
    } finally {
      setWritePending(false)
    }
  }, [draft, writePending, editingId, onUpdate, onAdd, replyingTo])

  const onComposerKeyDown = (e) => {
    // Escape is handled by the document-level listener, which closes the
    // popover outright — no branch needed here.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const startReply = (comment) => {
    setEditingId(null)
    setDraft('')
    setReplyingTo(comment)
  }

  const startEdit = (comment) => {
    setReplyingTo(null)
    setDraft(comment.content)
    setEditingId(comment.id)
  }

  const handleDelete = async (comment) => {
    if (writePending) return
    setWritePending(true)
    try {
      await onDelete(comment)
      if (editingId === comment.id) setEditingId(null)
    } catch {
      // Notification already raised by the caller.
    } finally {
      setWritePending(false)
    }
  }

  // Flatten depth-first so depth >= 2 replies can render at root alignment
  // with a "Replying to <name>" prefix instead of a third indent level.
  const flattened = useMemo(() => {
    const rows = []
    const walk = (comment, depth) => {
      rows.push({ comment, depth })
      for (const child of childrenByParentId.get(comment.id) || []) {
        walk(child, depth + 1)
      }
    }
    for (const root of roots) walk(root, 0)
    return rows
  }, [roots, childrenByParentId])

  const counterLabel = `${draft.length}/${MAX_CHARS}`
  const counterColor =
    draft.length > COUNTER_WARN_AT ? '#f59e0b' : 'var(--color-text-muted)'

  const renderRow = ({ comment, depth }) => {
    const isAuthor = comment.user_id === currentUserId
    const isEditing = editingId === comment.id
    const isDeep = depth >= 2
    const hasChildren = (childrenByParentId.get(comment.id) || []).length > 0
    const ancestorName = isDeep ? byId.get(comment.parent_id)?.author_name : null

    return (
      <div
        key={comment.id}
        className={depth === 1 ? 'ml-3' : ''}
      >
        {isDeep && (
          <p
            className="mt-2 text-[10px]"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Replying to {ancestorName || 'a comment'}
          </p>
        )}
        <div
          className="group mt-1.5 rounded-lg border p-2"
          style={{
            borderColor: 'var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-canvas)',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-baseline gap-1.5">
              <span
                className="truncate text-[11px] font-semibold"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {comment.author_name}
              </span>
              <span
                className="shrink-0 text-[10px]"
                style={{ color: 'var(--color-text-muted)' }}
                title={comment.created_at}
              >
                {formatTime(comment.created_at)}
              </span>
            </div>
            {isAuthor && !isEditing && (
              <div
                className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
              >
                <button
                  type="button"
                  onClick={() => startReply(comment)}
                  disabled={writePending}
                  className="rounded p-1 cursor-pointer transition-colors hover:opacity-70 disabled:opacity-40"
                  style={{ color: 'var(--color-text-muted)' }}
                  title="Reply"
                >
                  <Reply className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(comment)}
                  disabled={writePending}
                  className="rounded p-1 cursor-pointer transition-colors hover:opacity-70 disabled:opacity-40"
                  style={{ color: 'var(--color-text-muted)' }}
                  title="Edit"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(comment)}
                  disabled={writePending}
                  className="rounded p-1 cursor-pointer transition-colors hover:opacity-70 disabled:opacity-40"
                  style={{
                    color: hasChildren ? '#ef4444' : 'var(--color-text-muted)',
                  }}
                  title={
                    hasChildren
                      ? 'Delete comment and its replies'
                      : 'Delete comment'
                  }
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHARS))}
                onKeyDown={onComposerKeyDown}
                rows={2}
                maxLength={MAX_CHARS}
                className="w-full resize-none rounded border px-2 py-1.5 text-xs outline-none focus:ring-1 disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--color-bg-surface)',
                  borderColor: 'var(--color-border-subtle)',
                  color: 'var(--color-text-primary)',
                }}
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px]" style={{ color: counterColor }}>
                  {counterLabel}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={cancelComposer}
                    className="cursor-pointer rounded px-2 py-1 text-xs"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={!draft.trim() || writePending}
                    className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-white transition-opacity disabled:opacity-40"
                    style={{ backgroundColor: 'var(--color-brand-500)' }}
                  >
                    <Check className="w-3 h-3" />
                    Save
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p
              className="mt-1 text-xs leading-relaxed whitespace-pre-wrap break-words"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {comment.content}
            </p>
          )}
        </div>
      </div>
    )
  }

  if (!position) return null

  return createPortal(
    <div
      ref={popoverRef}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className="fixed z-50 overflow-hidden rounded-xl border shadow-2xl"
      style={{
        top: position.top,
        left: position.left,
        width: POPOVER_WIDTH,
        backgroundColor: 'var(--color-bg-surface)',
        borderColor: 'var(--color-border-subtle)',
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        <span
          className="text-xs font-semibold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Comments
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 cursor-pointer transition-colors hover:opacity-70"
          style={{ color: 'var(--color-text-muted)' }}
          title="Close comments"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        ref={listRef}
        className="overflow-y-auto px-3 py-2"
        style={{ maxHeight: LIST_MAX_HEIGHT }}
      >
        {flattened.length === 0 ? (
          <p
            className="py-4 text-center text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            No comments yet
          </p>
        ) : (
          flattened.map(renderRow)
        )}
      </div>

      {replyingTo && (
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 border-t"
          style={{
            borderColor: 'var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-canvas)',
          }}
        >
          <span className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
            Replying to
          </span>
          <span
            className="truncate text-[11px] font-medium"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {replyingTo.author_name}
          </span>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="ml-auto cursor-pointer rounded p-1 transition-colors hover:opacity-70"
            style={{ color: 'var(--color-text-muted)' }}
            title="Cancel reply"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div
        className="px-3 py-2 border-t"
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        <textarea
          ref={composerRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHARS))}
          onKeyDown={onComposerKeyDown}
          placeholder={
            editingId
              ? 'Edit your comment…'
              : replyingTo
                ? 'Write a reply…'
                : 'Add a comment…'
          }
          rows={2}
          maxLength={MAX_CHARS}
          disabled={writePending || Boolean(editingId)}
          className="w-full resize-none rounded border px-2 py-1.5 text-xs outline-none focus:ring-1 disabled:opacity-50"
          style={{
            backgroundColor: 'var(--color-bg-canvas)',
            borderColor: 'var(--color-border-subtle)',
            color: 'var(--color-text-primary)',
          }}
        />
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[10px]" style={{ color: counterColor }}>
            {counterLabel}
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim() || writePending || Boolean(editingId)}
            className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--color-brand-500)' }}
          >
            <Send className="w-3 h-3" />
            Send
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
