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

  it('accepts layer exploration metadata for filters and details', () => {
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
          ui: {
            legendTitle: 'Sample city markers',
            enableExtentFilter: true,
            filterableFields: [
              {
                field: 'region',
                label: 'Region',
                type: 'select',
                options: [
                  {
                    label: 'East',
                    value: 'East'
                  }
                ]
              }
            ],
            displayFields: [
              {
                field: 'title',
                label: 'City'
              }
            ],
            clustering: {
              enabled: false
            },
            timeAware: false
          },
          graphics: [
            {
              geometry: {
                type: 'point',
                longitude: -74.006,
                latitude: 40.7128
              }
            }
          ]
        }
      ]
    };

    expect(() => validateMapConfig(config)).not.toThrow();
  });

  it('rejects invalid exploration metadata', () => {
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
          ui: {
            filterableFields: [
              {
                field: 'region',
                label: 'Region',
                type: 'range'
              } as unknown as Record<string, unknown>
            ]
          }
        } as unknown as MapConfig['operationalLayers'][number]
      ]
    };

    expect(() => validateMapConfig(config)).toThrowError(
      'layer("sample-locations").ui.filterableFields[0].type must be either "text" or "select" when provided.'
    );
  });

  it('accepts fallbackLayers for URL-backed operational layers and basemap sublayers', () => {
    const config: MapConfig = {
      basemap: {
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
                type: 'map-image',
                url: 'https://backup.example.com/base'
              }
            ]
          }
        ]
      },
      operationalLayers: [
        {
          id: 'roads',
          title: 'Roads',
          type: 'feature',
          source: {
            mode: 'resolved',
            resolverKey: 'roads',
            endpoint: '/resolve/roads'
          },
          fallbackLayers: [
            {
              source: {
                mode: 'direct'
              },
              url: 'https://backup.example.com/roads/FeatureServer/0'
            }
          ]
        }
      ]
    };

    expect(() => validateMapConfig(config)).not.toThrow();
  });

  it('rejects empty fallback layer arrays', () => {
    const config: MapConfig = {
      ...createValidConfig(),
      operationalLayers: [
        {
          id: 'roads',
          title: 'Roads',
          type: 'feature',
          url: 'https://example.com/roads',
          fallbackLayers: []
        }
      ]
    };

    expect(() => validateMapConfig(config)).toThrowError(
      'layer("roads").fallbackLayers must contain at least one entry when provided.'
    );
  });

  it('rejects fallbackLayers on group layers', () => {
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
          fallbackLayers: [
            {
              type: 'feature',
              url: 'https://backup.example.com/group'
            }
          ],
          layers: []
        } as unknown as MapConfig['operationalLayers'][number]
      ]
    };

    expect(() => validateMapConfig(config)).toThrowError(
      'Layer "group-a" does not support fallbackLayers because only URL-backed leaf layers can define them.'
    );
  });

  it('rejects fallbackLayers on graphics layers', () => {
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
          fallbackLayers: [
            {
              type: 'feature',
              url: 'https://backup.example.com/locations'
            }
          ]
        } as unknown as MapConfig['operationalLayers'][number]
      ]
    };

    expect(() => validateMapConfig(config)).toThrowError(
      'Layer "sample-locations" does not support fallbackLayers because graphics layers are not supported.'
    );
  });

  it('rejects invalid fallback entries that do not resolve to a usable url source', () => {
    const config: MapConfig = {
      basemap: {
        mode: 'well-known',
        id: 'arcgis-topographic'
      },
      operationalLayers: [
        {
          id: 'roads',
          title: 'Roads',
          type: 'feature',
          source: {
            mode: 'resolved',
            resolverKey: 'roads',
            endpoint: '/resolve/roads'
          },
          fallbackLayers: [
            {
              source: {
                mode: 'direct'
              }
            }
          ]
        }
      ]
    };

    expect(() => validateMapConfig(config)).toThrowError(
      'layer("roads").fallbackLayers[0] requires a url or a resolved source.'
    );
  });

  it('rejects nested fallback recursion in fallback entries', () => {
    const config: MapConfig = {
      basemap: {
        mode: 'well-known',
        id: 'arcgis-topographic'
      },
      operationalLayers: [
        {
          id: 'roads',
          title: 'Roads',
          type: 'feature',
          url: 'https://example.com/roads',
          fallbackLayers: [
            {
              url: 'https://backup.example.com/roads',
              fallbackLayers: [
                {
                  url: 'https://nested.example.com/roads'
                }
              ]
            } as unknown as Record<string, unknown>
          ]
        } as unknown as MapConfig['operationalLayers'][number]
      ]
    };

    expect(() => validateMapConfig(config)).toThrowError(
      'layer("roads").fallbackLayers[0] cannot define nested fallbackLayers.'
    );
  });

  it('rejects unsupported identity properties in fallback entries', () => {
    const config: MapConfig = {
      basemap: {
        mode: 'well-known',
        id: 'arcgis-topographic'
      },
      operationalLayers: [
        {
          id: 'roads',
          title: 'Roads',
          type: 'feature',
          url: 'https://example.com/roads',
          fallbackLayers: [
            {
              title: 'Backup Roads',
              url: 'https://backup.example.com/roads'
            } as unknown as Record<string, unknown>
          ]
        } as unknown as MapConfig['operationalLayers'][number]
      ]
    };

    expect(() => validateMapConfig(config)).toThrowError(
      'layer("roads").fallbackLayers[0] contains unsupported property "title".'
    );
  });
});
