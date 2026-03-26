import { MapConfig } from '../models/layer-config.model';
import { sortByOrder, validateMapConfig } from './map-config.utils';

describe('map-config.utils', () => {
  function createValidConfig(): MapConfig {
    return {
      basemap: {
        mode: 'well-known',
        id: 'arcgis-topographic'
      },
      operationalLayers: [
        {
          id: 'sample-locations',
          title: 'Sample Locations',
          type: 'graphics'
        }
      ]
    };
  }

  it('sorts by explicit order and preserves author order for ties and undefined values', () => {
    const sorted = sortByOrder([
      { id: 'third', order: 30 },
      { id: 'first', order: 10 },
      { id: 'fourth' },
      { id: 'second', order: 10 }
    ]);

    expect(sorted.map((item) => item.id)).toEqual(['first', 'second', 'third', 'fourth']);
  });

  it('does not mutate fallbackBasemap during validation', () => {
    const config = createValidConfig();

    validateMapConfig(config);

    expect(config.fallbackBasemap).toBeUndefined();
  });

  it('rejects invalid fallback basemaps', () => {
    const config: MapConfig = {
      ...createValidConfig(),
      fallbackBasemap: '   '
    };

    expect(() => validateMapConfig(config)).toThrowError('Expected a non-empty string at fallbackBasemap.');
  });

  it('rejects duplicate nested layer ids', () => {
    const config: MapConfig = {
      basemap: {
        mode: 'well-known',
        id: 'arcgis-topographic'
      },
      operationalLayers: [
        {
          id: 'group-a',
          title: 'Group A',
          type: 'group',
          layers: [
            {
              id: 'duplicate-layer',
              title: 'First Layer',
              type: 'graphics'
            },
            {
              id: 'duplicate-layer',
              title: 'Second Layer',
              type: 'graphics'
            }
          ]
        }
      ]
    };

    expect(() => validateMapConfig(config)).toThrowError('Duplicate config id "duplicate-layer" found in group("group-a").layers.');
  });

  it('rejects unsupported basemap modes', () => {
    const config: MapConfig = {
      ...createValidConfig(),
      basemap: {
        mode: 'webmap',
        id: 'bad-basemap'
      } as unknown as MapConfig['basemap']
    };

    expect(() => validateMapConfig(config)).toThrowError('Unsupported basemap mode "webmap".');
  });

  it('rejects custom basemaps without base layers', () => {
    const config: MapConfig = {
      basemap: {
        mode: 'custom',
        id: 'custom-basemap',
        title: 'Custom Basemap',
        baseLayers: []
      },
      operationalLayers: []
    };

    expect(() => validateMapConfig(config)).toThrowError('Custom basemap "custom-basemap" must define at least one base layer.');
  });

  it('rejects group layers with non-array layers', () => {
    const config: MapConfig = {
      basemap: {
        mode: 'well-known',
        id: 'arcgis-topographic'
      },
      operationalLayers: [
        {
          id: 'group-a',
          title: 'Group A',
          type: 'group',
          layers: {} as unknown as []
        } as unknown as MapConfig['operationalLayers'][number]
      ]
    };

    expect(() => validateMapConfig(config)).toThrowError('Expected an array at group("group-a").layers.');
  });

  it('rejects unsupported layer types', () => {
    const config: MapConfig = {
      basemap: {
        mode: 'well-known',
        id: 'arcgis-topographic'
      },
      operationalLayers: [
        {
          id: 'invalid-layer',
          title: 'Invalid Layer',
          type: 'csv'
        } as unknown as MapConfig['operationalLayers'][number]
      ]
    };

    expect(() => validateMapConfig(config)).toThrowError('Layer "invalid-layer" has unsupported type "csv".');
  });

  it('rejects url layers without a url or resolved source', () => {
    const config: MapConfig = {
      basemap: {
        mode: 'well-known',
        id: 'arcgis-topographic'
      },
      operationalLayers: [
        {
          id: 'feature-layer',
          title: 'Feature Layer',
          type: 'feature'
        }
      ]
    };

    expect(() => validateMapConfig(config)).toThrowError('Layer "feature-layer" requires a url or a resolved source.');
  });

  it('rejects graphics layers with non-array graphics', () => {
    const config: MapConfig = {
      basemap: {
        mode: 'well-known',
        id: 'arcgis-topographic'
      },
      operationalLayers: [
        {
          id: 'sample-locations',
          title: 'Sample Locations',
          type: 'graphics',
          graphics: {} as unknown as []
        }
      ]
    };

    expect(() => validateMapConfig(config)).toThrowError('Expected an array at graphic layer "sample-locations".graphics.');
  });

  it('rejects graphics with invalid geometry', () => {
    const config: MapConfig = {
      basemap: {
        mode: 'well-known',
        id: 'arcgis-topographic'
      },
      operationalLayers: [
        {
          id: 'sample-locations',
          title: 'Sample Locations',
          type: 'graphics',
          graphics: [
            {
              geometry: {
                type: 'polygon'
              }
            } as unknown as { geometry: { type: 'point'; longitude: number; latitude: number } }
          ]
        }
      ]
    };

    expect(() => validateMapConfig(config)).toThrowError(
      'Graphic layer "sample-locations" only supports point geometries in this implementation.'
    );
  });
});
