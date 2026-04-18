import { fetchItems, assetUrl } from '../directus'

interface DirectusNews {
  id: number; title: string; title_en: string | null; slug: string;
  excerpt: string | null; body: string; category: string; author: string;
  published_at: string; is_published: boolean; image: string | null; date_created: string;
}

export interface NewsArticle {
  id: string; title: string; titleEn: string | null; slug: string;
  excerpt: string | null; body: string; category: string; author: string;
  date: string; imageUrl: string | null;
}

function mapNews(n: DirectusNews): NewsArticle {
  return {
    id: String(n.id), title: n.title, titleEn: n.title_en, slug: n.slug,
    excerpt: n.excerpt, body: n.body, category: n.category, author: n.author,
    date: n.published_at || n.date_created,
    imageUrl: assetUrl(n.image, 'width=800&quality=80'),
  }
}

export async function getLatestNews(limit = 6): Promise<NewsArticle[]> {
  // Published-only is enforced by the Directus Public role permission; is_published is not readable anonymously.
  const items = await fetchItems<DirectusNews>('news', {
    sort: ['-published_at'],
    fields: ['id', 'title', 'title_en', 'slug', 'excerpt', 'body', 'category', 'author', 'published_at', 'image', 'date_created'],
    limit,
  })
  return items.map(mapNews)
}
