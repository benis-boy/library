import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  staticDirs: ['../public', { from: '../book-data', to: '/storybook-book-data' }],
  viteFinal: async (config) => {
    return mergeConfig(config, {
      base: '/',
    });
  },
};

export default config;
