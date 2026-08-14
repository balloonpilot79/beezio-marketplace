import { describe, expect, it } from 'vitest';
import {
  buildCJCreateOrderV2Payload,
  buildCJFreightRequest,
  normalizeCJFreightOptions,
  normalizeCJVideoAssets,
  parseCJUsd,
} from './cjContract';

describe('CJ API contract', () => {
  it('treats documented CJ money as dollars without a cents heuristic', () => {
    expect(parseCJUsd(12.99)).toBe(12.99);
    expect(parseCJUsd(1299)).toBe(1299);
    expect(parseCJUsd('12.99-14.50')).toBe(14.5);
  });

  it('builds freight requests from exact VIDs only', () => {
    expect(buildCJFreightRequest({
      originCountryCode: 'cn',
      destinationCountryCode: 'us',
      destinationZip: '60601',
      items: [{ vid: 'VID-RED-L', quantity: 2 }],
    })).toEqual({
      startCountryCode: 'CN',
      endCountryCode: 'US',
      zip: '60601',
      products: [{ vid: 'VID-RED-L', quantity: 2 }],
    });

    expect(() => buildCJFreightRequest({
      originCountryCode: 'CN',
      destinationCountryCode: 'US',
      items: [{ vid: '', quantity: 1 }],
    })).toThrow(/exact CJ VID/i);
  });

  it('uses CJ total postage when taxes and clearance are included', () => {
    const options = normalizeCJFreightOptions({
      data: [{
        logisticName: 'USPS+',
        logisticAging: '2-5',
        logisticPrice: 4.71,
        taxesFee: 0.5,
        clearanceOperationFee: 0.25,
        totalPostageFee: 5.46,
      }],
    });
    expect(options[0]).toMatchObject({
      logisticName: 'USPS+',
      logisticPrice: 4.71,
      totalPostageFee: 5.46,
    });
  });

  it('creates an unpaid V2 order with flat address fields and exact VIDs', () => {
    const payload = buildCJCreateOrderV2Payload({
      orderNumber: 'BZ-123',
      logisticName: 'USPS+',
      fromCountryCode: 'CN',
      address: {
        countryCode: 'US',
        country: 'United States',
        province: 'Illinois',
        city: 'Chicago',
        postalCode: '60601',
        customerName: 'Bee Buyer',
        address1: '1 Market St',
        email: 'buyer@example.com',
      },
      items: [{ vid: 'VID-BLUE-M', quantity: 1, storeLineItemId: 'item-1' }],
    });

    expect(payload).toMatchObject({
      payType: 3,
      orderFlow: 1,
      platform: 'Api',
      shippingAddress: '1 Market St',
      products: [{ vid: 'VID-BLUE-M', quantity: 1, storeLineItemId: 'item-1' }],
    });
    expect((payload as any).shippingAddress).not.toBeTypeOf('object');
  });

  it('normalizes playable video metadata without duplicates', () => {
    const assets = normalizeCJVideoAssets({ data: [{
      id: 'video-1',
      videoUrl: 'https://download-only-api.cjdropshipping.com/video-1/demo.mp4',
      coverURL: 'https://download-only-api.cjdropshipping.com/video-1/cover.jpg',
      videoSize: '4689615',
      duration: 39.521,
    }] });

    expect(assets).toEqual([expect.objectContaining({
      id: 'video-1',
      videoSize: 4689615,
      duration: 39.521,
    })]);
  });
});
