import { defineConfig } from 'tinacms';

const branch =
  process.env.GITHUB_BRANCH ||
  process.env.CF_PAGES_BRANCH ||
  process.env.HEAD ||
  'main';

export default defineConfig({
  branch,
  clientId: process.env.TINA_PUBLIC_CLIENT_ID || '',
  token: process.env.TINA_TOKEN || '',

  build: {
    outputFolder: 'admin',
    publicFolder: 'public',
  },

  media: {
    tina: {
      mediaRoot: 'uploads',
      publicFolder: 'public',
    },
  },

  schema: {
    collections: [
      {
        name: 'page',
        label: 'Pages',
        path: 'content/pages',
        format: 'mdx',
        fields: [
          {
            type: 'string',
            name: 'title',
            label: 'Title',
            isTitle: true,
            required: true,
          },
          {
            type: 'string',
            name: 'description',
            label: 'Meta Description',
          },
          {
            type: 'string',
            name: 'locale',
            label: 'Language',
            options: ['de', 'en'],
            required: true,
          },
          {
            type: 'string',
            name: 'slug',
            label: 'Slug',
            required: true,
          },
          {
            type: 'object',
            name: 'pageHeader',
            label: 'Page Header',
            fields: [
              {
                type: 'string',
                name: 'title',
                label: 'Header Title',
              },
              {
                type: 'string',
                name: 'subtitle',
                label: 'Header Subtitle',
              },
            ],
          },
          {
            type: 'rich-text',
            name: 'body',
            label: 'Body',
            isBody: true,
          },
          {
            type: 'object',
            name: 'cta',
            label: 'Call to Action',
            fields: [
              {
                type: 'string',
                name: 'title',
                label: 'CTA Title',
              },
              {
                type: 'string',
                name: 'text',
                label: 'CTA Text',
              },
              {
                type: 'string',
                name: 'buttonLabel',
                label: 'Button Label',
              },
              {
                type: 'string',
                name: 'buttonHref',
                label: 'Button Link',
              },
            ],
          },
        ],
      },
      {
        name: 'news',
        label: 'News',
        path: 'content/news',
        format: 'mdx',
        fields: [
          {
            type: 'string',
            name: 'title',
            label: 'Title',
            isTitle: true,
            required: true,
          },
          {
            type: 'string',
            name: 'excerpt',
            label: 'Excerpt',
            ui: {
              component: 'textarea',
            },
          },
          {
            type: 'datetime',
            name: 'date',
            label: 'Date',
            required: true,
          },
          {
            type: 'string',
            name: 'category',
            label: 'Category',
            options: ['club', 'volleyball', 'basketball'],
          },
          {
            type: 'string',
            name: 'locale',
            label: 'Language',
            options: ['de', 'en'],
            required: true,
          },
          {
            type: 'image',
            name: 'image',
            label: 'Featured Image',
          },
          {
            type: 'rich-text',
            name: 'body',
            label: 'Body',
            isBody: true,
          },
        ],
      },
      {
        name: 'boardMember',
        label: 'Board Members',
        path: 'content/board-members',
        format: 'md',
        fields: [
          {
            type: 'string',
            name: 'name',
            label: 'Name',
            isTitle: true,
            required: true,
          },
          {
            type: 'string',
            name: 'initials',
            label: 'Initials',
          },
          {
            type: 'string',
            name: 'role_de',
            label: 'Role (German)',
            required: true,
          },
          {
            type: 'string',
            name: 'role_en',
            label: 'Role (English)',
            required: true,
          },
          {
            type: 'image',
            name: 'photo',
            label: 'Photo',
          },
          {
            type: 'number',
            name: 'order',
            label: 'Sort Order',
            required: true,
          },
        ],
      },
    ],
  },
});
