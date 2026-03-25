import { MapConfig } from '../models/layer-config.model';
import { sortByOrder, validateMapConfig } from './map-config.utils';

describe('map-config.utils', () => {
  it('sorts by explicit order and preserves author order for ties and undefined values', () => {
    const sorted = sortByOrder([
      { id: 'third', order: 30 },
      { id: 'first', order: 10 },
      { id: 'fourth' },
      { id: 'second', order: 10 }
    ]);

    expect(sorted.map((item) => item.id)).toEqual(['first', 'second', 'third', 'fourth']);
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
          kind: 'group',
          children: [
            {
              id: 'duplicate-layer',
              title: 'First Layer',
              kind: 'graphics'
            },
            {
              id: 'duplicate-layer',
              title: 'Second Layer',
              kind: 'graphics'
            }
          ]
        }
      ]
    };

    expect(() => validateMapConfig(config)).toThrowError('Duplicate config id "duplicate-layer" found in group("group-a").children.');
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
});