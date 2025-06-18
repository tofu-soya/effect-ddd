import { extractExamplesFromComments } from 'effect-ddd/docs-utils';

// Verify all code examples in documentation
beforeAll(async () => {
  const { checkDocumentationExamples } = await import('effect-ddd/docs-utils');
  await checkDocumentationExamples();
});

// Custom matcher for documentation verification
expect.extend({
  toHaveDocumentation(received) {
    if (!received || !received.jsDoc) {
      return {
        message: () => `Expected ${received?.name || 'item'} to have documentation`,
        pass: false
      };
    }
    return { pass: true, message: () => '' };
  }
});
