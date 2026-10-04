import type { TestRunnerConfig } from '@storybook/test-runner';

const portraitViewportsByStory: Record<string, { width: number; height: number }> = {
  'app-whole-app--touch-header-controls-match-at-375-x-812': { width: 375, height: 812 },
  'app-whole-app--touch-header-controls-match-at-390-x-844': { width: 390, height: 844 },
};
const defaultViewport = { width: 1280, height: 720 };

const config: TestRunnerConfig = {
  async preVisit(page, context) {
    await page.setViewportSize(portraitViewportsByStory[context.id] ?? defaultViewport);
  },
};

export default config;
