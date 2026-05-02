import type { CollectionConfig } from 'payload';

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    group: 'Sistem',
  },
  auth: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Ad Soyad',
    },
  ],
};
