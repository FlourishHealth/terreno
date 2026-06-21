import {$} from "@wdio/globals";

import {byTestId, type DevStoryTarget, openDevStory} from "../helpers/navigation";

const CARD_COMPONENT = "Card";

// Mirrors every story registered in demo/story-config/Card.config.tsx. Each entry's
// testId matches the root Box testID added to the matching render in
// demo/stories/Card.stories.tsx so Appium can confirm the story mounted.
const CARD_STORIES: Omit<DevStoryTarget, "component">[] = [
  {story: "Plain", testId: "card-story-plain"},
  {story: "Display", testId: "card-story-display"},
  {story: "Variants", testId: "card-story-variants"},
  {story: "LightAndDark", testId: "card-story-light-and-dark"},
  {story: "DisplaySizes", testId: "card-story-display-sizes"},
  {story: "WithImage", testId: "card-story-with-image"},
];

describe("Card dev stories render correctly", () => {
  for (const {story, testId} of CARD_STORIES) {
    it(`renders the ${story} story without errors`, async () => {
      await openDevStory({component: CARD_COMPONENT, story, testId});

      const storyRoot = await $(byTestId(testId));
      await expect(storyRoot).toBeDisplayed();
    });
  }
});
