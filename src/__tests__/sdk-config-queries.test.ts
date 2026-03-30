import { describe, it, expect } from 'vitest';
import { SDK_CONFIG } from '../lib/sdk-config';

/**
 * Dependency search queries must be scoped to package-dependency declaration
 * files (requirements.txt, pyproject.toml) so that documentation, markdown
 * notes, and unrelated source files do not inflate the dependent-repos count.
 *
 * GitHub Search API uses `-qualifier:value` for negation (e.g. `-org:OpenHands`).
 * Using `NOT qualifier:value` is invalid — qualifiers require the dash prefix.
 */
describe('SDK_CONFIG.dependencySearches', () => {
  it('contains at least one query', () => {
    expect(SDK_CONFIG.dependencySearches.length).toBeGreaterThan(0);
  });

  it.each(SDK_CONFIG.dependencySearches)(
    'query "%s" does not use NOT as a qualifier negation operator',
    (query) => {
      // "NOT qualifier:value" is invalid GitHub search syntax for qualifier negation.
      // The correct form is "-qualifier:value".
      expect(query).not.toMatch(/\bNOT\s+\w+:/);
    }
  );

  it.each(SDK_CONFIG.dependencySearches)(
    'query "%s" is scoped to a dependency declaration filename',
    (query) => {
      // Every query must target a package-dependency file so we only count
      // repos that actually declare OpenHands as a dependency.
      const scopedToDependencyFile = query.includes('filename:requirements.txt')
        || query.includes('filename:pyproject.toml')
        || query.includes('filename:setup.py')
        || query.includes('filename:setup.cfg');
      expect(scopedToDependencyFile).toBe(true);
    }
  );

  it.each(SDK_CONFIG.dependencySearches)(
    'query "%s" excludes the OpenHands org to avoid self-referential noise',
    (query) => {
      expect(query).toContain('-org:OpenHands');
    }
  );

  it('searches for the PyPI distribution name "openhands-ai" in requirements.txt', () => {
    const hasRequirementsTxt = SDK_CONFIG.dependencySearches.some(
      q => q.includes('"openhands-ai"') && q.includes('filename:requirements.txt')
    );
    expect(hasRequirementsTxt).toBe(true);
  });

  it('searches for "openhands-ai" in pyproject.toml', () => {
    const hasPyproject = SDK_CONFIG.dependencySearches.some(
      q => q.includes('"openhands-ai"') && q.includes('filename:pyproject.toml')
    );
    expect(hasPyproject).toBe(true);
  });
});
