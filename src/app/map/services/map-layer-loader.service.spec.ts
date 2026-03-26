import TileLayer from '@arcgis/core/layers/TileLayer';
import MapImageLayer from '@arcgis/core/layers/MapImageLayer';

import {
  LayerLoadMetadata,
  PreparedAuthContext,
  UrlLeafLayerConfig
} from '../models/layer-config.model';
import { MapLayerFactoryService } from './map-layer-factory.service';
import { MapLayerLoaderService } from './map-layer-loader.service';
import { MapLayerRegistryService } from './map-layer-registry.service';
import { MapResourceAuthService } from './map-resource-auth.service';
import { MapResourceResolverService } from './map-resource-resolver.service';

describe('MapLayerLoaderService', () => {
  let service: MapLayerLoaderService;
  let authService: jasmine.SpyObj<MapResourceAuthService>;
  let resolverService: jasmine.SpyObj<MapResourceResolverService>;
  let layerFactory: jasmine.SpyObj<MapLayerFactoryService>;
  let layerRegistry: jasmine.SpyObj<MapLayerRegistryService>;

  beforeEach(() => {
    authService = jasmine.createSpyObj<MapResourceAuthService>('MapResourceAuthService', ['prepare']);
    resolverService = jasmine.createSpyObj<MapResourceResolverService>('MapResourceResolverService', ['resolveLayerDefinition']);
    layerFactory = jasmine.createSpyObj<MapLayerFactoryService>('MapLayerFactoryService', ['createLayer']);
    layerRegistry = jasmine.createSpyObj<MapLayerRegistryService>('MapLayerRegistryService', [
      'clear',
      'start',
      'markLoaded',
      'markFailed'
    ]);
    service = new MapLayerLoaderService(authService, resolverService, layerFactory, layerRegistry);
  });

  it('loads a primary operational layer without using backups', async () => {
    const config = createUrlLayerConfig();
    const layer = createLoadableTileLayer(config.url!, config.id, config.title);

    authService.prepare.and.returnValue(Promise.resolve(undefined));
    resolverService.resolveLayerDefinition.and.returnValue(Promise.resolve(undefined));
    layerFactory.createLayer.and.returnValue(layer);

    const layers = await service.loadLayers([config]);
    const loadMeta = readLoadMeta(layerRegistry.markLoaded);

    expect(layers).toEqual([layer]);
    expect(layerRegistry.clear).toHaveBeenCalledTimes(1);
    expect(authService.prepare).toHaveBeenCalledTimes(1);
    expect(layerFactory.createLayer.calls.argsFor(0)[0]).toEqual(jasmine.objectContaining({
      id: config.id,
      title: config.title,
      type: config.type,
      url: config.url
    }));
    expect(layer.load).toHaveBeenCalledTimes(1);
    expect(loadMeta).toEqual({
      loadedViaFallback: false,
      attemptErrors: []
    });
  });

  it('uses the first successful backup layer source while preserving the primary identity', async () => {
    const config = createUrlLayerConfig({
      visible: false,
      listMode: 'hide',
      fallbackLayers: [
        {
          type: 'tile',
          url: 'https://backup.example.com/roads/MapServer',
          auth: {
            mode: 'token',
            token: 'backup-token'
          }
        }
      ]
    });
    const backupAuthContext: PreparedAuthContext = {
      headers: {},
      query: {
        token: 'backup-token'
      },
      auth: {
        mode: 'token'
      }
    };
    const primaryLayer = createLoadableTileLayer(config.url!, config.id, config.title, new Error('Primary source unavailable'));
    const layer = createLoadableTileLayer('https://backup.example.com/roads/MapServer', config.id, config.title);

    authService.prepare.and.returnValues(Promise.resolve(undefined), Promise.resolve(backupAuthContext));
    resolverService.resolveLayerDefinition.and.returnValues(Promise.resolve(undefined), Promise.resolve(undefined));
    layerFactory.createLayer.and.callFake((candidate) => {
      if (candidate.url === config.url) {
        return primaryLayer;
      }

      return layer;
    });

    const layers = await service.loadLayers([config]);
    const fallbackCandidate = layerFactory.createLayer.calls.argsFor(1)[0];
    const loadMeta = readLoadMeta(layerRegistry.markLoaded);

    expect(layers).toEqual([layer]);
    expect(fallbackCandidate).toEqual(jasmine.objectContaining({
      id: config.id,
      title: config.title,
      type: 'tile',
      url: 'https://backup.example.com/roads/MapServer',
      visible: false,
      listMode: 'hide'
    }));
    expect(primaryLayer.load).toHaveBeenCalledTimes(1);
    expect(layer.load).toHaveBeenCalledTimes(1);
    expect(loadMeta).toEqual({
      loadedViaFallback: true,
      fallbackIndex: 0,
      attemptErrors: ['Primary source unavailable']
    });
  });

  it('tries backup candidates in order until one succeeds', async () => {
    const config = createUrlLayerConfig({
      fallbackLayers: [
        {
          url: 'https://backup.example.com/roads/first'
        },
        {
          type: 'map-image',
          url: 'https://backup.example.com/roads/second'
        }
      ]
    });
    const primaryLayer = createLoadableTileLayer(config.url!, config.id, config.title, new Error(`Could not load ${config.url}`));
    const firstBackupLayer = createLoadableTileLayer(
      'https://backup.example.com/roads/first',
      config.id,
      config.title,
      new Error('Could not load https://backup.example.com/roads/first')
    );
    const layer = createLoadableMapImageLayer('https://backup.example.com/roads/second', config.id, config.title);

    authService.prepare.and.returnValues(Promise.resolve(undefined), Promise.resolve(undefined), Promise.resolve(undefined));
    resolverService.resolveLayerDefinition.and.returnValues(
      Promise.resolve(undefined),
      Promise.resolve(undefined),
      Promise.resolve(undefined)
    );
    layerFactory.createLayer.and.callFake((candidate) => {
      if (candidate.url === config.url) {
        return primaryLayer;
      }

      if (candidate.url === 'https://backup.example.com/roads/first') {
        return firstBackupLayer;
      }

      if (candidate.url === 'https://backup.example.com/roads/second') {
        return layer;
      }

      throw new Error(`Unexpected candidate ${candidate.url}`);
    });

    await service.loadLayers([config]);

    expect(layerFactory.createLayer.calls.count()).toBe(3);
    expect(primaryLayer.load).toHaveBeenCalledTimes(1);
    expect(firstBackupLayer.load).toHaveBeenCalledTimes(1);
    expect(layer.load).toHaveBeenCalledTimes(1);
    expect(layerFactory.createLayer.calls.argsFor(2)[0]).toEqual(jasmine.objectContaining({
      id: config.id,
      title: config.title,
      type: 'map-image',
      url: 'https://backup.example.com/roads/second'
    }));
    expect(readLoadMeta(layerRegistry.markLoaded)).toEqual({
      loadedViaFallback: true,
      fallbackIndex: 1,
      attemptErrors: [
        `Could not load ${config.url}`,
        'Could not load https://backup.example.com/roads/first'
      ]
    });
  });

  it('marks the layer as failed when all primary and backup candidates fail', async () => {
    const config = createUrlLayerConfig({
      fallbackLayers: [
        {
          url: 'https://backup.example.com/roads/first'
        },
        {
          url: 'https://backup.example.com/roads/second'
        }
      ]
    });
    const primaryLayer = createLoadableTileLayer(config.url!, config.id, config.title, new Error(`Could not load ${config.url}`));
    const firstBackupLayer = createLoadableTileLayer(
      'https://backup.example.com/roads/first',
      config.id,
      config.title,
      new Error('Could not load https://backup.example.com/roads/first')
    );
    const secondBackupLayer = createLoadableTileLayer(
      'https://backup.example.com/roads/second',
      config.id,
      config.title,
      new Error('Could not load https://backup.example.com/roads/second')
    );

    authService.prepare.and.returnValues(Promise.resolve(undefined), Promise.resolve(undefined), Promise.resolve(undefined));
    resolverService.resolveLayerDefinition.and.returnValues(
      Promise.resolve(undefined),
      Promise.resolve(undefined),
      Promise.resolve(undefined)
    );
    layerFactory.createLayer.and.callFake((candidate) => {
      if (candidate.url === config.url) {
        return primaryLayer;
      }

      if (candidate.url === 'https://backup.example.com/roads/first') {
        return firstBackupLayer;
      }

      if (candidate.url === 'https://backup.example.com/roads/second') {
        return secondBackupLayer;
      }

      throw new Error(`Unexpected candidate ${candidate.url}`);
    });

    const layers = await service.loadLayers([config]);
    const markFailedArgs = layerRegistry.markFailed.calls.mostRecent().args;

    expect(layers).toEqual([]);
    expect(layerFactory.createLayer.calls.count()).toBe(3);
    expect(markFailedArgs[0]).toBe(config);
    expect((markFailedArgs[1] as Error).message).toBe('Could not load https://backup.example.com/roads/second');
    expect(markFailedArgs[2]).toEqual({
      attemptErrors: [
        `Could not load ${config.url}`,
        'Could not load https://backup.example.com/roads/first',
        'Could not load https://backup.example.com/roads/second'
      ]
    });
  });

  function createUrlLayerConfig(overrides?: Partial<UrlLeafLayerConfig>): UrlLeafLayerConfig {
    return {
      id: 'roads',
      title: 'Roads',
      type: 'feature',
      url: 'https://example.com/roads/FeatureServer/0',
      ...overrides
    };
  }

  function readLoadMeta(markLoadedSpy: jasmine.Spy): LayerLoadMetadata | undefined {
    return markLoadedSpy.calls.mostRecent().args[2] as LayerLoadMetadata | undefined;
  }

  function createLoadableTileLayer(url: string, id: string, title: string, loadError?: Error): TileLayer {
    const layer = new TileLayer({
      id,
      title,
      url
    });

    spyOn(layer, 'load').and.returnValue(loadError ? Promise.reject(loadError) : Promise.resolve(layer));
    return layer;
  }

  function createLoadableMapImageLayer(url: string, id: string, title: string, loadError?: Error): MapImageLayer {
    const layer = new MapImageLayer({
      id,
      title,
      url
    });

    spyOn(layer, 'load').and.returnValue(loadError ? Promise.reject(loadError) : Promise.resolve(layer));
    return layer;
  }
});
