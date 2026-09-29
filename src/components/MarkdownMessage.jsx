import React from 'react'
import ReactMarkdown from 'react-markdown'

/**
 * Renders markdown content inside a chat bubble.
 *
 * LLMs return markdown-formatted text (headings, bold, lists, code blocks,
 * etc.) but the ChatPanel was rendering it as raw plain text — so users saw
 * literal `**bold**` and `## Heading` tokens in the chat bubbles.
 *
 * This component bridges the gap by parsing markdown and rendering it with
 * theme-aware CSS variables so it blends with the rest of the UI.
 */
export default function MarkdownMessage({ children, isUser = false }) {
  return (
    <ReactMarkdown
      components={{
        // --- Headings ---
        h1: ({ node, ...props }) => (
          <h1 className="text-sm font-semibold mt-2 mb-1" style={{ color: 'var(--color-text-primary)' }} {...props} />
        ),
        h2: ({ node, ...props }) => (
          <h2 className="text-sm font-semibold mt-2 mb-1" style={{ color: 'var(--color-text-primary)' }} {...props} />
        ),
        h3: ({ node, ...props }) => (
          <h3 className="text-xs font-semibold mt-2 mb-1" style={{ color: 'var(--color-text-primary)' }} {...props} />
        ),
        h4: ({ node, ...props }) => (
          <h4 className="text-xs font-semibold mt-2 mb-1" style={{ color: 'var(--color-text-primary)' }} {...props} />
        ),

        // --- Paragraphs ---
        p: ({ node, ...props }) => (
          <p className="mb-2 last:mb-0" style={{ color: isUser ? '#fff' : 'inherit' }} {...props} />
        ),

        // --- Inline code ---
        code: ({ node, inline, ...props }) => {
          if (inline) {
            return (
              <code
                className="px-1.5 py-0.5 rounded text-xs font-mono"
                style={{
                  backgroundColor: isUser ? 'rgba(255,255,255,0.15)' : 'var(--color-bg-surface)',
                  color: isUser ? '#fff' : 'var(--color-text-primary)',
                }}
                {...props}
              />
            )
          }
          // Fenced code block — render as pre
          return (
            <pre
              className="overflow-x-auto rounded-lg my-2 p-2 text-xs font-mono"
              style={{
                backgroundColor: isUser ? 'rgba(255,255,255,0.1)' : 'var(--color-bg-surface)',
                color: isUser ? '#fff' : 'var(--color-text-secondary)',
              }}
            >
              <code {...props} />
            </pre>
          )
        },

        // --- Lists ---
        ul: ({ node, ...props }) => (
          <ul className="list-disc list-inside mb-2 pl-0 space-y-0.5" {...props} />
        ),
        ol: ({ node, ...props }) => (
          <ol className="list-decimal list-inside mb-2 pl-0 space-y-0.5" {...props} />
        ),
        li: ({ node, ...props }) => (
          <li style={{ color: isUser ? '#fff' : 'var(--color-text-secondary)' }} {...props} />
        ),

        // --- Blockquote ---
        blockquote: ({ node, ...props }) => (
          <blockquote
            className="border-l-2 pl-2 py-1 italic text-xs my-2 rounded"
            style={{
              borderColor: isUser ? 'rgba(255,255,255,0.3)' : 'var(--color-border-subtle)',
              color: isUser ? '#fff' : 'var(--color-text-secondary)',
            }}
            {...props}
          />
        ),

        // --- Tables ---
        table: ({ node, ...props }) => (
          <div className="overflow-x-auto my-2">
            <table className="border-collapse text-xs" {...props} />
          </div>
        ),
        th: ({ node, ...props }) => (
          <th
            className="px-2 py-1 text-left font-semibold border-b whitespace-nowrap"
            style={{
              borderColor: 'var(--color-border-subtle)',
              color: isUser ? '#fff' : 'var(--color-text-primary)',
            }}
            {...props}
          />
        ),
        td: ({ node, ...props }) => (
          <td
            className="px-2 py-1 border-b whitespace-nowrap"
            style={{
              borderColor: 'var(--color-border-subtle)',
              color: isUser ? '#fff' : 'var(--color-text-secondary)',
            }}
            {...props}
          />
        ),

        // --- Em/Del ---
        em: ({ node, ...props }) => (
          <em style={{ color: isUser ? '#fff' : 'inherit' }} {...props} />
        ),
        strong: ({ node, ...props }) => (
          <strong style={{ color: isUser ? '#fff' : 'var(--color-text-primary)' }} {...props} />
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  )
}
