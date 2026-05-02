/* Minimal Lexical → JSX renderer for Payload's richText output.
 * Supports the common nodes used by the BlogPosts collection.
 */
import React from 'react';

type LexicalNode = any;

function renderTextNode(node: LexicalNode, key: string | number): React.ReactNode {
  let el: React.ReactNode = node.text ?? '';
  const format = node.format || 0;
  if (format & 1) el = <strong key={`b-${key}`}>{el}</strong>;
  if (format & 2) el = <em key={`i-${key}`}>{el}</em>;
  if (format & 4) el = <s key={`s-${key}`}>{el}</s>;
  if (format & 8) el = <u key={`u-${key}`}>{el}</u>;
  if (format & 16) el = <code key={`c-${key}`} className="px-1.5 py-0.5 rounded bg-gray-100 text-pink-600 text-sm">{el}</code>;
  return <React.Fragment key={key}>{el}</React.Fragment>;
}

function renderChildren(children: LexicalNode[] | undefined): React.ReactNode {
  if (!Array.isArray(children)) return null;
  return children.map((child, i) => renderNode(child, i));
}

function renderNode(node: LexicalNode, key: string | number): React.ReactNode {
  if (!node) return null;
  switch (node.type) {
    case 'text':
      return renderTextNode(node, key);
    case 'linebreak':
      return <br key={key} />;
    case 'paragraph':
      return (
        <p key={key} className="text-gray-700 leading-relaxed mb-4">
          {renderChildren(node.children)}
        </p>
      );
    case 'heading': {
      const tag = (node.tag || 'h2') as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      const cls: Record<string, string> = {
        h1: 'text-3xl font-bold text-gray-900 mt-10 mb-4',
        h2: 'text-2xl font-bold text-gray-900 mt-8 mb-3',
        h3: 'text-xl font-semibold text-gray-800 mt-6 mb-2',
        h4: 'text-lg font-semibold text-gray-800 mt-5 mb-2',
        h5: 'text-base font-semibold text-gray-800 mt-4 mb-2',
        h6: 'text-base font-semibold text-gray-700 mt-4 mb-2',
      };
      return React.createElement(tag, { key, className: cls[tag] }, renderChildren(node.children));
    }
    case 'list': {
      const Tag = node.listType === 'number' ? 'ol' : 'ul';
      const cls = node.listType === 'number'
        ? 'list-decimal pl-6 mb-4 text-gray-700 space-y-1'
        : 'list-disc pl-6 mb-4 text-gray-700 space-y-1';
      return React.createElement(Tag, { key, className: cls }, renderChildren(node.children));
    }
    case 'listitem':
      return <li key={key} className="leading-relaxed">{renderChildren(node.children)}</li>;
    case 'quote':
      return (
        <blockquote key={key} className="border-l-4 border-blue-400 pl-5 py-2 my-6 bg-blue-50 rounded-r-lg">
          <div className="text-gray-700 italic leading-relaxed">{renderChildren(node.children)}</div>
        </blockquote>
      );
    case 'horizontalrule':
      return <hr key={key} className="my-8 border-gray-200" />;
    case 'link': {
      const url = node.fields?.url || node.url || '#';
      const newTab = node.fields?.newTab;
      return (
        <a
          key={key}
          href={url}
          target={newTab ? '_blank' : undefined}
          rel={newTab ? 'noopener noreferrer' : undefined}
          className="text-[#0ea5e9] hover:text-[#00BCD4] underline underline-offset-2"
        >
          {renderChildren(node.children)}
        </a>
      );
    }
    case 'upload': {
      const media = node.value;
      if (!media || !media.url) return null;
      return (
        <figure key={key} className="my-8">
          <img src={media.url} alt={media.alt || ''} className="w-full rounded-xl object-cover" />
          {media.alt && <figcaption className="text-center text-sm text-gray-400 mt-2">{media.alt}</figcaption>}
        </figure>
      );
    }
    default:
      // Fallback: render children if any, otherwise nothing
      if (Array.isArray(node.children) && node.children.length > 0) {
        return <React.Fragment key={key}>{renderChildren(node.children)}</React.Fragment>;
      }
      return null;
  }
}

export function LexicalContent({ content }: { content: any }) {
  if (!content || !content.root) return null;
  return <>{renderChildren(content.root.children)}</>;
}
