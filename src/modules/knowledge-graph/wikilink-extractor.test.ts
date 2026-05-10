/**
 * Wikilink Extractor Tests
 */

import { describe, it, expect } from 'vitest';
import { extractWikilinks, getUniqueTopicKeys } from './wikilink-extractor.js';

describe('extractWikilinks', () => {
  it('extracts simple wikilinks', () => {
    const content = 'This is a [[simple-link]] in text.';
    const links = extractWikilinks(content);

    expect(links).toHaveLength(1);
    expect(links[0].targetTopicKey).toBe('simple-link');
    expect(links[0].displayText).toBeNull();
    expect(links[0].position.start).toBe(10);
    expect(links[0].position.end).toBe(25); // "[[simple-link]]" is 15 chars
  });

  it('extracts wikilinks with aliases', () => {
    const content = 'Check [[topic-key|Display Text]] for details.';
    const links = extractWikilinks(content);

    expect(links).toHaveLength(1);
    expect(links[0].targetTopicKey).toBe('topic-key');
    expect(links[0].displayText).toBe('Display Text');
    expect(links[0].position.start).toBe(6);
    expect(links[0].position.end).toBe(32); // "[[topic-key|Display Text]]" is 26 chars
  });

  it('extracts multiple wikilinks', () => {
    const content = 'See [[first]] and [[second|Alias]] then [[third]].';
    const links = extractWikilinks(content);

    expect(links).toHaveLength(3);
    expect(links[0].targetTopicKey).toBe('first');
    expect(links[1].targetTopicKey).toBe('second');
    expect(links[1].displayText).toBe('Alias');
    expect(links[2].targetTopicKey).toBe('third');
  });

  it('handles empty content', () => {
    const content = '';
    const links = extractWikilinks(content);

    expect(links).toHaveLength(0);
  });

  it('handles content without wikilinks', () => {
    const content = 'Regular text without any links.';
    const links = extractWikilinks(content);

    expect(links).toHaveLength(0);
  });

  it('trims whitespace from topic keys', () => {
    const content = '[[ topic-with-spaces ]]';
    const links = extractWikilinks(content);

    expect(links).toHaveLength(1);
    expect(links[0].targetTopicKey).toBe('topic-with-spaces');
  });

  it('trims whitespace from display text', () => {
    const content = '[[key| display text ]]';
    const links = extractWikilinks(content);

    expect(links).toHaveLength(1);
    expect(links[0].displayText).toBe('display text');
  });

  it('skips empty topic keys', () => {
    const content = '[[ ]] and [[]]';
    const links = extractWikilinks(content);

    expect(links).toHaveLength(0);
  });

  it('handles topic keys with special characters', () => {
    const content = '[[example.com-tasks]] and [[foo_bar-baz]]';
    const links = extractWikilinks(content);

    expect(links).toHaveLength(2);
    expect(links[0].targetTopicKey).toBe('example.com-tasks');
    expect(links[1].targetTopicKey).toBe('foo_bar-baz');
  });

  it('handles unicode topic keys', () => {
    const content = '[[中文主题]] and [[日本語-トピック]]';
    const links = extractWikilinks(content);

    expect(links).toHaveLength(2);
    expect(links[0].targetTopicKey).toBe('中文主题');
    expect(links[1].targetTopicKey).toBe('日本語-トピック');
  });

  it('extracts wikilinks adjacent to each other', () => {
    const content = '[[first]][[second]]';
    const links = extractWikilinks(content);

    expect(links).toHaveLength(2);
    expect(links[0].position.end).toBe(links[1].position.start);
  });
});

describe('getUniqueTopicKeys', () => {
  it('returns unique topic keys', () => {
    const links = [
      { targetTopicKey: 'a', displayText: null, position: { start: 0, end: 5 } },
      { targetTopicKey: 'b', displayText: null, position: { start: 5, end: 10 } },
      { targetTopicKey: 'a', displayText: null, position: { start: 10, end: 15 } },
    ];

    const uniqueKeys = getUniqueTopicKeys(links);

    expect(uniqueKeys.size).toBe(2);
    expect(uniqueKeys.has('a')).toBe(true);
    expect(uniqueKeys.has('b')).toBe(true);
  });

  it('handles empty list', () => {
    const uniqueKeys = getUniqueTopicKeys([]);

    expect(uniqueKeys.size).toBe(0);
  });
});