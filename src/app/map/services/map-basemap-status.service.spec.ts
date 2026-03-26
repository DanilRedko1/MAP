import { BasemapLayerConfig } from '../models/layer-config.model';

import { MapBasemapStatusService } from './map-basemap-status.service';

describe('MapBasemapStatusService', () => {
  it('tracks basemap layer load state and fallback basemap usage', () => {
    const service = new MapBasemapStatusService();
    const config: BasemapLayerConfig = {
      id: 'world-imagery',
      title: 'World Imagery',
      type: 'tile',
      url: 'https://example.invalid/imagery'
    };

    service.start(config, 'base');
    service.markLoaded(config, 'base', {
      loadedViaFallback: true,
      fallbackIndex: 0,
      attemptErrors: ['Primary basemap layer unavailable']
    });
    service.markFallbackBasemap('arcgis-navigation', new Error('Custom basemap failed.'));

    expect(service.getRecordsSnapshot()).toEqual([
      {
        id: 'world-imagery',
        title: 'World Imagery',
        slot: 'base',
        config,
        status: 'loaded',
        loadedViaFallback: true,
        fallbackIndex: 0,
        attemptErrors: ['Primary basemap layer unavailable']
      }
    ]);
    expect(service.getStateSnapshot()).toEqual({
      fallbackBasemapActive: true,
      fallbackBasemapId: 'arcgis-navigation',
      fallbackReason: 'Custom basemap failed.'
    });
  });

  it('clears record and fallback state', () => {
    const service = new MapBasemapStatusService();
    const config: BasemapLayerConfig = {
      id: 'world-imagery',
      type: 'tile',
      url: 'https://example.invalid/imagery'
    };

    service.start(config, 'base');
    service.markFallbackBasemap('arcgis-navigation');

    service.clear();

    expect(service.getRecordsSnapshot()).toEqual([]);
    expect(service.getStateSnapshot()).toEqual({
      fallbackBasemapActive: false
    });
  });
});
