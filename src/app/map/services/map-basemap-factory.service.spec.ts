import Basemap from '@arcgis/core/Basemap';
import MapImageLayer from '@arcgis/core/layers/MapImageLayer';
import TileLayer from '@arcgis/core/layers/TileLayer';

import {
  BasemapConfig,
  PreparedAuthContext,
  ResolvedLayerDefinition,
  ResolvedBasemapDefinition
} from '../models/layer-config.model';
import { MapBasemapStatusService } from './map-basemap-status.service';
import { MapBasemapFactoryService } from './map-basemap-factory.service';
import { MapLayerFactoryService } from './map-layer-factory.service';
import { MapResourceAuthService } from './map-resource-auth.service';
import { MapResourceResolverService } from './map-resource-resolver.service';

describe('MapBasemapFactoryService', () => {
  let service: MapBasemapFactoryService;
  let basemapStatus: jasmine.SpyObj<MapBasemapStatusService>;
  let authService: jasmine.SpyObj<MapResourceAuthService>;
  let resolverService: jasmine.SpyObj<MapResourceResolverService>;
  let layerFactory: jasmine.SpyObj<MapLayerFactoryService>;

  beforeEach(() => {
    basemapStatus = jasmine.createSpyObj<MapBasemapStatusService>('MapBasemapStatusService', [
      'start',
      'markLoaded',
      'markFailed'
    ]);
    authService = jasmine.createSpyObj<MapResourceAuthService>('MapResourceAuthService', ['prepare']);
    resolverService = jasmine.createSpyObj<MapResourceResolverService>(
      'MapResourceResolverService',
      ['resolveLayerDefinition', 'resolveBasemapDefinition']
    );
    layerFactory = jasmine.createSpyObj<MapLayerFactoryService>('MapLayerFactoryService', ['createBasemapLayer']);
    service = new MapBasemapFactoryService(basemapStatus, authService, resolverService, layerFactory);
  });

  it('delegates custom basemap layer creation to MapLayerFactoryService', async () => {
    const customBasemap: Extract<BasemapConfig, { mode: 'custom' }> = {
      mode: 'custom',
      id: 'custom-basemap',
      title: 'Custom Basemap',
      baseLayers: [
        {
          id: 'base-layer',
          type: 'tile',
          url: 'https://example.com/base'
        }
      ],
      referenceLayers: [
        {
          id: 'reference-layer',
          type: 'map-image',
          url: 'https://example.com/reference'
        }
      ]
    };
    const baseAuthContext: PreparedAuthContext = {
      headers: {},
      query: {
        token: 'base-token'
      },
      auth: {
        mode: 'token'
      }
    };
    const baseResolved: ResolvedLayerDefinition = {
      id: 'base-layer',
      url: 'https://resolved.example.com/base'
    };
    const baseLayer = new TileLayer({
      url: 'https://resolved.example.com/base'
    });
    const referenceLayer = new MapImageLayer({
      url: 'https://example.com/reference'
    });
    spyOn(baseLayer, 'load').and.returnValue(Promise.resolve(baseLayer));
    spyOn(referenceLayer, 'load').and.returnValue(Promise.resolve(referenceLayer));

    authService.prepare.and.returnValues(Promise.resolve(baseAuthContext), Promise.resolve(undefined));
    resolverService.resolveLayerDefinition.and.returnValues(Promise.resolve(baseResolved), Promise.resolve(undefined));
    layerFactory.createBasemapLayer.and.returnValues(baseLayer, referenceLayer);

    const basemap = await service.createBasemap(customBasemap) as Basemap;

    expect(layerFactory.createBasemapLayer.calls.count()).toBe(2);
    expect(layerFactory.createBasemapLayer.calls.argsFor(0)).toEqual([customBasemap.baseLayers[0], baseResolved, baseAuthContext]);
    expect(layerFactory.createBasemapLayer.calls.argsFor(1)).toEqual([customBasemap.referenceLayers![0], undefined, undefined]);
    expect(baseLayer.load).toHaveBeenCalledTimes(1);
    expect(referenceLayer.load).toHaveBeenCalledTimes(1);
    expect(basemapStatus.start.calls.argsFor(0)).toEqual([customBasemap.baseLayers[0], 'base']);
    expect(basemapStatus.start.calls.argsFor(1)).toEqual([customBasemap.referenceLayers![0], 'reference']);
    expect(basemap.baseLayers.getItemAt(0)).toBe(baseLayer);
    expect(basemap.referenceLayers.getItemAt(0)).toBe(referenceLayer);
  });

  it('returns well-known basemap ids without calling collaborators', async () => {
    const basemap = await service.createBasemap({
      mode: 'well-known',
      id: 'arcgis-navigation'
    });

    expect(basemap).toBe('arcgis-navigation');
    expect(authService.prepare).not.toHaveBeenCalled();
    expect(resolverService.resolveBasemapDefinition).not.toHaveBeenCalled();
    expect(layerFactory.createBasemapLayer).not.toHaveBeenCalled();
  });

  it('preserves portal-item basemap creation behavior', async () => {
    const authContext: PreparedAuthContext = {
      headers: {},
      query: {},
      auth: {
        mode: 'identity-manager'
      }
    };
    const resolvedBasemap: ResolvedBasemapDefinition = {
      id: 'portal-basemap',
      portalItemId: 'resolved-portal-item',
      title: 'Resolved Portal Title'
    };

    authService.prepare.and.returnValue(Promise.resolve(authContext));
    resolverService.resolveBasemapDefinition.and.returnValue(Promise.resolve(resolvedBasemap));

    const basemap = await service.createBasemap({
      mode: 'portal-item',
      id: 'portal-basemap',
      title: 'Configured Portal Title',
      source: {
        mode: 'resolved',
        resolverKey: 'basemap',
        endpoint: '/resolve/basemap'
      }
    });

    expect(basemap instanceof Basemap).toBeTrue();
    expect((basemap as Basemap).portalItem?.id).toBe('resolved-portal-item');
    expect((basemap as Basemap).title).toBe('Resolved Portal Title');
    expect(layerFactory.createBasemapLayer).not.toHaveBeenCalled();
  });

  it('falls back to the first working basemap sublayer source while preserving the primary identity', async () => {
    const customBasemap: Extract<BasemapConfig, { mode: 'custom' }> = {
      mode: 'custom',
      id: 'custom-basemap',
      title: 'Custom Basemap',
      baseLayers: [
        {
          id: 'base-layer',
          title: 'Configured Basemap Layer',
          type: 'tile',
          url: 'https://example.com/base',
          fallbackLayers: [
            {
              type: 'map-image',
              url: 'https://backup.example.com/base'
            }
          ]
        }
      ]
    };
    const primaryLayer = new TileLayer({
      id: 'base-layer',
      title: 'Configured Basemap Layer',
      url: 'https://example.com/base'
    });
    const backupLayer = new MapImageLayer({
      id: 'base-layer',
      title: 'Configured Basemap Layer',
      url: 'https://backup.example.com/base'
    });
    spyOn(primaryLayer, 'load').and.returnValue(Promise.reject(new Error('Primary basemap layer unavailable')));
    spyOn(backupLayer, 'load').and.returnValue(Promise.resolve(backupLayer));

    authService.prepare.and.returnValues(Promise.resolve(undefined), Promise.resolve(undefined));
    resolverService.resolveLayerDefinition.and.returnValues(Promise.resolve(undefined), Promise.resolve(undefined));
    layerFactory.createBasemapLayer.and.callFake((config) => {
      if (config.url === 'https://example.com/base') {
        return primaryLayer;
      }

      return backupLayer;
    });

    const basemap = await service.createBasemap(customBasemap) as Basemap;
    const fallbackCandidate = layerFactory.createBasemapLayer.calls.argsFor(1)[0];

    expect(layerFactory.createBasemapLayer.calls.count()).toBe(2);
    expect(fallbackCandidate).toEqual(jasmine.objectContaining({
      id: 'base-layer',
      title: 'Configured Basemap Layer',
      type: 'map-image',
      url: 'https://backup.example.com/base'
    }));
    expect(basemapStatus.markLoaded).toHaveBeenCalledOnceWith(customBasemap.baseLayers[0], 'base', {
      loadedViaFallback: true,
      fallbackIndex: 0,
      attemptErrors: ['Primary basemap layer unavailable']
    });
    expect(basemap.baseLayers.getItemAt(0)).toBe(backupLayer);
  });

  it('rejects custom basemap creation when every sublayer candidate fails', async () => {
    const customBasemap: Extract<BasemapConfig, { mode: 'custom' }> = {
      mode: 'custom',
      id: 'custom-basemap',
      title: 'Custom Basemap',
      baseLayers: [
        {
          id: 'base-layer',
          type: 'tile',
          url: 'https://example.com/base',
          fallbackLayers: [
            {
              url: 'https://backup.example.com/base'
            }
          ]
        }
      ]
    };
    const primaryLayer = new TileLayer({
      id: 'base-layer',
      url: 'https://example.com/base'
    });
    const backupLayer = new TileLayer({
      id: 'base-layer',
      url: 'https://backup.example.com/base'
    });
    spyOn(primaryLayer, 'load').and.returnValue(Promise.reject(new Error(`Could not load ${customBasemap.baseLayers[0].url}`)));
    spyOn(backupLayer, 'load').and.returnValue(Promise.reject(new Error('Could not load https://backup.example.com/base')));

    authService.prepare.and.returnValues(Promise.resolve(undefined), Promise.resolve(undefined));
    resolverService.resolveLayerDefinition.and.returnValues(Promise.resolve(undefined), Promise.resolve(undefined));
    layerFactory.createBasemapLayer.and.callFake((config) => {
      if (config.url === customBasemap.baseLayers[0].url) {
        return primaryLayer;
      }

      return backupLayer;
    });

    await expectAsync(service.createBasemap(customBasemap)).toBeRejectedWithError(
      'Could not load https://backup.example.com/base'
    );
    expect(layerFactory.createBasemapLayer.calls.count()).toBe(2);
    expect(basemapStatus.markFailed).toHaveBeenCalledOnceWith(customBasemap.baseLayers[0], 'base', jasmine.any(Error), {
      attemptErrors: [
        `Could not load ${customBasemap.baseLayers[0].url}`,
        'Could not load https://backup.example.com/base'
      ]
    });
  });
});
