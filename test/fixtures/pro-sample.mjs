import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

export function proSample(html) {
  function slots(markup) {
    return ['PREVIEW', 'CARD'].map(role => {
      const start = '<!-- PRO_SAMPLE_' + role + '_START -->';
      const end = '<!-- PRO_SAMPLE_' + role + '_END -->';
      assert.equal(markup.split(start).length, 2);
      assert.equal(markup.split(end).length, 2);
      return markup.split(start)[1].split(end)[0].trim();
    });
  }
  const [preview, source] = slots(html);
  assert.equal(Boolean(preview), Boolean(source), 'the public sample and its full report must be published together');
  return preview ? [preview, source] : slots(readFileSync(new URL('pro-sample.html', import.meta.url), 'utf8'));
}
