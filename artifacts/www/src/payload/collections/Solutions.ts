import type { CollectionConfig } from 'payload';

export const Solutions: CollectionConfig = {
  slug: 'solutions',
  labels: { singular: 'Çözüm Sayfası', plural: 'Çözüm Sayfaları' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'slug', 'updatedAt'],
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
      label: 'URL Slug (örn: toplanti-ingilizcesi)',
      admin: {
        description: 'URL\'de görünecek kısa kod. Türkçe karakter ve boşluk kullanmayın.',
      },
    },
    {
      name: 'category',
      type: 'select',
      required: true,
      label: 'Kategori',
      options: [
        { label: 'Beceriye Göre', value: 'Beceriye Göre' },
        { label: 'Rolüne Göre', value: 'Rolüne Göre' },
        { label: 'Sektöre Göre', value: 'Sektöre Göre' },
      ],
    },
    {
      name: 'description',
      type: 'textarea',
      required: true,
      label: 'Kısa Açıklama (Hero ve SEO meta description)',
    },
    {
      name: 'body',
      type: 'array',
      label: 'İçerik Paragrafları',
      minRows: 1,
      labels: { singular: 'Paragraf', plural: 'Paragraflar' },
      fields: [
        {
          name: 'paragraph',
          type: 'textarea',
          required: true,
          label: 'Paragraf Metni',
        },
      ],
    },
    {
      name: 'highlights',
      type: 'array',
      label: 'Program İçeriği Maddeleri',
      minRows: 1,
      labels: { singular: 'Madde', plural: 'Maddeler' },
      fields: [
        {
          name: 'item',
          type: 'text',
          required: true,
          label: 'Madde',
        },
      ],
    },
    {
      name: 'ctaText',
      type: 'text',
      required: true,
      label: 'Buton Metni',
      defaultValue: 'Programı Keşfet',
    },
  ],
};
