import type { CollectionConfig } from 'payload';
import { lexicalEditor } from '@payloadcms/richtext-lexical';

export const BlogPosts: CollectionConfig = {
  slug: 'blog-posts',
  labels: { singular: 'Blog Yazısı', plural: 'Blog Yazıları' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'status', 'date', 'updatedAt'],
    group: 'Pazarlama İçeriği',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Başlık',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'URL Slug',
    },
    {
      name: 'summary',
      type: 'textarea',
      required: true,
      label: 'Özet (kart altında ve SEO meta description)',
    },
    {
      name: 'category',
      type: 'select',
      required: true,
      label: 'Kategori',
      options: [
        { label: 'İngilizce', value: 'İngilizce' },
        { label: 'Eğitim', value: 'Eğitim' },
        { label: 'Kariyer', value: 'Kariyer' },
        { label: 'Haberler', value: 'Haberler' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'Draft',
      label: 'Durum',
      options: [
        { label: 'Taslak', value: 'Draft' },
        { label: 'Yayımlanmış', value: 'Published' },
      ],
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      label: 'Yayın Tarihi',
      admin: { date: { pickerAppearance: 'dayOnly' } },
    },
    {
      name: 'author',
      type: 'text',
      defaultValue: 'Sphere English',
      label: 'Yazar',
    },
    {
      name: 'cover',
      type: 'upload',
      relationTo: 'media',
      label: 'Kapak Görseli (boş bırakılırsa varsayılan kullanılır)',
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
      label: 'Yazı İçeriği',
      editor: lexicalEditor({}),
    },
  ],
};
