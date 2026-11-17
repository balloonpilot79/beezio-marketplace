import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import InfluencerRecruitPromoStudio from './InfluencerRecruitPromoStudio';

vi.mock('../utils/clipboard', () => ({ copyTextToClipboard: vi.fn() }));

describe('invite preview captions', () => {
  it('renders the name and caption as one text node with a space on all 14 cards', () => {
    const html = renderToStaticMarkup(<InfluencerRecruitPromoStudio code="JASO7554" influencerName="Jason Loving" />);
    expect(html.match(/>Jason Loving shared this invite<\/div>/g)).toHaveLength(14);
    expect(html).not.toContain('Jason Lovingshared');
  });
});
