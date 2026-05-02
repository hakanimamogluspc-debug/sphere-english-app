const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
const NOTION_API_BASE = 'https://api.notion.com/v1';

const notionHeaders = {
  'Authorization': `Bearer ${NOTION_API_KEY}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  summary: string;
  category: string;
  status: string;
  cover: string;
  date: string;
  author: string;
}

export interface BlogBlock {
  id: string;
  type: string;
  content: string;
  items?: string[];
  level?: number;
  language?: string;
}

function extractRichText(richText: any[]): string {
  if (!richText || !Array.isArray(richText)) return '';
  return richText.map((t: any) => t?.plain_text || t?.text?.content || '').join('');
}

/**
 * Sanitize cover URLs from Notion DB.
 * Legacy Notion entries store URLs like `/api/media/file/...` that pointed to a
 * previous Payload media setup; those files no longer exist (return 500), so
 * drop them and let the page fall back to the default SVG cover.
 */
function sanitizeCover(url: string | undefined | null): string {
  const u = (url || '').trim();
  if (!u) return '';
  if (u.startsWith('/api/media/file/')) return '';
  if (u.startsWith('/api/media/')) return '';
  return u;
}

function pageToPost(page: any): BlogPost {
  const props = page.properties || {};
  return {
    id: page.id,
    title: extractRichText(props.Name?.title || []),
    slug: props.Slug?.rich_text?.[0]?.plain_text || page.id,
    summary: props.Summary?.rich_text?.[0]?.plain_text || '',
    category: props.Category?.select?.name || '',
    status: props.Status?.select?.name || 'Draft',
    cover: sanitizeCover(props.Cover?.url),
    date: props.Date?.date?.start || '',
    author: props.Author?.rich_text?.[0]?.plain_text || 'Sphere English',
  };
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
    throw new Error('Notion API key or Database ID is not configured.');
  }

  const response = await fetch(`${NOTION_API_BASE}/databases/${NOTION_DATABASE_ID}/query`, {
    method: 'POST',
    headers: notionHeaders,
    body: JSON.stringify({
      filter: {
        property: 'Status',
        select: { equals: 'Published' },
      },
      sorts: [{ property: 'Date', direction: 'descending' }],
    }),
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Notion API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return (data.results || []).map(pageToPost);
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
    throw new Error('Notion API key or Database ID is not configured.');
  }

  const response = await fetch(`${NOTION_API_BASE}/databases/${NOTION_DATABASE_ID}/query`, {
    method: 'POST',
    headers: notionHeaders,
    body: JSON.stringify({
      filter: {
        property: 'Slug',
        rich_text: { equals: slug },
      },
    }),
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Notion API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  if (!data.results || data.results.length === 0) return null;
  return pageToPost(data.results[0]);
}

export async function getPageBlocks(pageId: string): Promise<BlogBlock[]> {
  if (!NOTION_API_KEY) {
    throw new Error('Notion API key is not configured.');
  }

  const response = await fetch(`${NOTION_API_BASE}/blocks/${pageId}/children?page_size=100`, {
    method: 'GET',
    headers: notionHeaders,
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Notion API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return (data.results || []).map((block: any): BlogBlock => {
    const type = block.type;
    const blockData = block[type] || {};
    const richText = blockData.rich_text || [];
    const content = extractRichText(richText);

    if (type === 'bulleted_list_item' || type === 'numbered_list_item') {
      return { id: block.id, type, content, items: [content] };
    }
    if (type === 'heading_1') return { id: block.id, type, content, level: 1 };
    if (type === 'heading_2') return { id: block.id, type, content, level: 2 };
    if (type === 'heading_3') return { id: block.id, type, content, level: 3 };
    if (type === 'code') {
      return { id: block.id, type, content, language: blockData.language || 'text' };
    }
    return { id: block.id, type, content };
  });
}
