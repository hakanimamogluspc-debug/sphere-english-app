import type { GlobalConfig } from 'payload';

export const HomePage: GlobalConfig = {
  slug: 'home-page',
  label: 'Ana Sayfa',
  admin: {
    group: 'Pazarlama İçeriği',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Hero',
          fields: [
            { name: 'heroLine1', type: 'text', required: true, label: 'Başlık Satır 1', defaultValue: 'Kurumsal' },
            { name: 'heroLine2', type: 'text', required: true, label: 'Başlık Satır 2', defaultValue: 'İş İngilizcesi' },
            { name: 'heroLine3', type: 'text', required: true, label: 'Başlık Satır 3 (Vurgu - mavi)', defaultValue: 'Eğitim Programı' },
            {
              name: 'heroSubtitle',
              type: 'textarea',
              required: true,
              label: 'Alt Açıklama',
              defaultValue:
                'Çalışanlarınız için ölçülebilir, raporlanabilir ve hedef odaklı İngilizce eğitimi. Global rekabet gücünüzü artırın.',
            },
            { name: 'heroCta1Text', type: 'text', required: true, label: 'Buton 1 Metni', defaultValue: 'HEMEN TEKLİF AL' },
            { name: 'heroCta2Text', type: 'text', required: true, label: 'Buton 2 Metni', defaultValue: 'ÜCRETSİZ DEMO RANDEVUSU' },
            { name: 'heroBadge', type: 'text', required: true, label: 'Görsel Üstü Etiket', defaultValue: 'Canlı Ders Devam Ediyor' },
            { name: 'heroStatValue', type: 'text', required: true, label: 'Görsel Altı İstatistik (örn: +2)', defaultValue: '+2' },
            { name: 'heroStatLabel', type: 'text', required: true, label: 'İstatistik Açıklama', defaultValue: 'Seviye' },
            { name: 'heroStatNote', type: 'text', required: true, label: 'İstatistik Alt Notu', defaultValue: '6 aylık program sonrası' },
          ],
        },
        {
          label: 'Neden Biz',
          fields: [
            { name: 'whyKicker', type: 'text', required: true, label: 'Üst Etiket', defaultValue: 'NEDEN SPHERE ENGLISH?' },
            { name: 'whyTitle1', type: 'text', required: true, label: 'Başlık Satır 1', defaultValue: 'Şirketinizi global arenada' },
            { name: 'whyTitle2', type: 'text', required: true, label: 'Başlık Satır 2 (Vurgu)', defaultValue: 'rekabetçi kılan eğitim.' },
            {
              name: 'whySubtitle',
              type: 'textarea',
              required: true,
              label: 'Alt Açıklama',
              defaultValue:
                'Sadece dil öğretmiyoruz. Çalışanlarınıza iş dünyasında fark yaratan iletişim gücü kazandırıyoruz.',
            },
            {
              name: 'whyCards',
              type: 'array',
              label: 'Kartlar',
              minRows: 1,
              fields: [
                {
                  name: 'icon',
                  type: 'select',
                  required: true,
                  label: 'İkon',
                  options: [
                    'GlobeAltIcon',
                    'PresentationChartBarIcon',
                    'EnvelopeOpenIcon',
                    'ChartBarSquareIcon',
                    'BuildingOffice2Icon',
                    'AcademicCapIcon',
                    'BookOpenIcon',
                    'VideoCameraIcon',
                  ].map((v) => ({ label: v, value: v })),
                },
                { name: 'title', type: 'text', required: true, label: 'Başlık' },
                { name: 'description', type: 'textarea', required: true, label: 'Açıklama' },
                { name: 'tag', type: 'text', required: true, label: 'Etiket' },
              ],
            },
          ],
        },
        {
          label: 'Modüller',
          fields: [
            { name: 'modulesKicker', type: 'text', required: true, label: 'Üst Etiket', defaultValue: 'DERS İÇERİKLERİ' },
            { name: 'modulesTitle1', type: 'text', required: true, label: 'Başlık Satır 1', defaultValue: 'İş hayatında gerçekten' },
            { name: 'modulesTitle2', type: 'text', required: true, label: 'Başlık Satır 2 (Vurgu)', defaultValue: 'kullandığınız İngilizce.' },
            {
              name: 'modules',
              type: 'array',
              label: 'Ders Modülleri',
              minRows: 1,
              fields: [
                {
                  name: 'icon',
                  type: 'select',
                  required: true,
                  label: 'İkon',
                  options: [
                    'EnvelopeIcon',
                    'PresentationChartLineIcon',
                    'ChatBubbleLeftRightIcon',
                    'PhoneIcon',
                    'DocumentTextIcon',
                    'UserGroupIcon',
                  ].map((v) => ({ label: v, value: v })),
                },
                { name: 'title', type: 'text', required: true, label: 'Başlık' },
                { name: 'description', type: 'textarea', required: true, label: 'Açıklama' },
              ],
            },
          ],
        },
        {
          label: 'AI Koçlar',
          fields: [
            { name: 'aiKicker', type: 'text', required: true, label: 'Üst Etiket', defaultValue: 'YAPAY ZEKA KOÇLARIMIZ' },
            { name: 'aiTitle1', type: 'text', required: true, label: 'Başlık Satır 1', defaultValue: '7/24 yanında olan' },
            { name: 'aiTitle2', type: 'text', required: true, label: 'Başlık Satır 2 (Vurgu)', defaultValue: 'kişisel İngilizce koçu.' },
            { name: 'aiSubtitle', type: 'textarea', required: true, label: 'Alt Açıklama' },
            {
              name: 'coaches',
              type: 'array',
              label: 'AI Koçlar',
              minRows: 1,
              fields: [
                { name: 'tag', type: 'text', required: true, label: 'Etiket', defaultValue: 'Yapay Zeka' },
                { name: 'title', type: 'text', required: true, label: 'Başlık' },
                { name: 'subtitle', type: 'text', required: true, label: 'Alt Başlık' },
                { name: 'description', type: 'textarea', required: true, label: 'Açıklama' },
                { name: 'color', type: 'text', required: true, label: 'Renk (HEX, örn: #0ea5e9)' },
                { name: 'bgColor', type: 'text', required: true, label: 'Arkaplan Renk (HEX)' },
                {
                  name: 'features',
                  type: 'array',
                  label: 'Özellikler',
                  minRows: 1,
                  fields: [{ name: 'feature', type: 'text', required: true, label: 'Özellik' }],
                },
                { name: 'statValue', type: 'text', required: true, label: 'İstatistik Değer' },
                { name: 'statLabel', type: 'text', required: true, label: 'İstatistik Açıklama' },
              ],
            },
          ],
        },
        {
          label: 'SSS',
          fields: [
            { name: 'faqKicker', type: 'text', required: true, label: 'Üst Etiket', defaultValue: 'SIKÇA SORULAN SORULAR' },
            { name: 'faqTitle1', type: 'text', required: true, label: 'Başlık Satır 1', defaultValue: 'Aklınızdaki soruları' },
            { name: 'faqTitle2', type: 'text', required: true, label: 'Başlık Satır 2 (Vurgu)', defaultValue: 'yanıtlıyoruz.' },
            { name: 'faqSubtitle', type: 'textarea', required: true, label: 'Alt Açıklama' },
            {
              name: 'faqs',
              type: 'array',
              label: 'Sorular',
              minRows: 1,
              fields: [
                { name: 'question', type: 'text', required: true, label: 'Soru' },
                { name: 'answer', type: 'textarea', required: true, label: 'Cevap' },
              ],
            },
          ],
        },
      ],
    },
  ],
};
