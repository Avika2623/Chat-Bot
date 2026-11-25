import { useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react';

marked.setOptions({
  gfm: true,
  breaks: true,
});

function splitThinkTags(raw: string): { reasoningFromTags: string; cleanContent: string } {
  const thinkMatches: string[] = [];
  const cleanContent = raw
    .replace(/<think>([\s\S]*?)<\/think>/gi, (_match, inner: string) => {
      if (inner.trim()) thinkMatches.push(inner.trim());
      return '';
    })
    .trim();

  return {
    reasoningFromTags: thinkMatches.join('\n\n'),
    cleanContent,
  };
}

interface MarkdownContentProps {
  content: string;
  reasoning?: string;
}

export function MarkdownContent({ content, reasoning }: MarkdownContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showReasoning, setShowReasoning] = useState(false);

  const { cleanContent, combinedReasoning } = useMemo(() => {
    const { reasoningFromTags, cleanContent: stripped } = splitThinkTags(content);
    const mergedReasoning = [reasoning?.trim(), reasoningFromTags].filter(Boolean).join('\n\n');
    return {
      cleanContent: stripped || (content.includes('<think>') ? '' : content),
      combinedReasoning: mergedReasoning,
    };
  }, [content, reasoning]);

  const sanitizedHtml = useMemo(() => {
    const html = marked.parse(cleanContent || '') as string;
    return DOMPurify.sanitize(html);
  }, [cleanContent]);

  // Enhance rendered <pre><code> blocks with a header + Copy button
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const preElements = Array.from(root.querySelectorAll('pre'));
    for (const pre of preElements) {
      if (pre.parentElement?.classList.contains('code-block-wrapper')) continue;

      const codeEl = pre.querySelector('code');
      const classMatch = codeEl?.className.match(/language-([a-zA-Z0-9_-]+)/);
      const language = classMatch?.[1] ?? 'code';

      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';

      const header = document.createElement('div');
      header.className = 'code-block-header';

      const langLabel = document.createElement('span');
      langLabel.textContent = language;

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'code-block-copy';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', async () => {
        const text = codeEl?.textContent ?? pre.textContent ?? '';
        try {
          await navigator.clipboard.writeText(text);
          copyBtn.textContent = 'Copied';
          setTimeout(() => {
            copyBtn.textContent = 'Copy';
          }, 1600);
        } catch {
          copyBtn.textContent = 'Failed';
        }
      });

      header.append(langLabel, copyBtn);
      pre.parentNode?.insertBefore(wrapper, pre);
      wrapper.append(header, pre);
    }
  }, [sanitizedHtml]);

  return (
    <div>
      {combinedReasoning ? (
        <div
          style={{
            marginBottom: cleanContent ? '10px' : 0,
            borderRadius: '8px',
            border: '1px solid rgba(129, 140, 248, 0.25)',
            background: 'rgba(15, 23, 42, 0.65)',
          }}
        >
          <button
            type="button"
            onClick={() => setShowReasoning((prev) => !prev)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '7px 11px',
              background: 'transparent',
              border: 'none',
              color: '#c7d2fe',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            {showReasoning ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Sparkles size={13} />
            <span>Reasoning trace</span>
          </button>
          {showReasoning ? (
            <div
              style={{
                padding: '0 12px 10px',
                fontSize: '13px',
                lineHeight: 1.55,
                color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap',
                borderTop: '1px solid rgba(129, 140, 248, 0.16)',
                paddingTop: '8px',
              }}
            >
              {combinedReasoning}
            </div>
          ) : null}
        </div>
      ) : null}

      {cleanContent ? (
        <div
          ref={containerRef}
          className="markdown-body"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      ) : null}
    </div>
  );
}
