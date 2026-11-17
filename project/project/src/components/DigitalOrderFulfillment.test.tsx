import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import DigitalOrderFulfillment from './DigitalOrderFulfillment';

it('shows the real download history without physical fulfillment controls', () => {
  const html = renderToStaticMarkup(<DigitalOrderFulfillment order={{ orderNumber: 'BZO-TEST', items: [{ id: 'item', title: 'Digital test', digitalDeliveryStatus: 'Downloaded', downloadCount: 1 }] }} />);
  expect(html).toContain('Downloaded');
  expect(html).toContain('Downloads recorded: 1');
  expect(html).not.toContain('<button');
  expect(html).not.toContain('Ready To Ship');
  expect(html).not.toContain('Tracking: Pending');
  expect(html).not.toContain('Mark Shipped');
});
