import { LayerConfig } from '../models/layer-config.model';
import {
  buildFeatureDetails,
  countActiveFilters,
  deserializeShareState,
  findLeafLayerConfig,
  flattenLeafLayers,
  serializeShareState
} from './map-explorer.utils';

describe('map-explorer.utils', () => {
  it('flattens nested leaf layers and finds them by id', () => {
    const layers: LayerConfig[] = [
      {
        id: 'group-a',
        title: 'Group A',
        type: 'group',
        layers: [
          {
            id: 'cities',
            title: 'Cities',
            type: 'graphics'
          }
        ]
      }
    ];

    expect(flattenLeafLayers(layers).map((layer) => layer.id)).toEqual(['cities']);
    expect(findLeafLayerConfig(layers, 'cities')?.title).toBe('Cities');
  });

  it('counts active field filters and extent filtering together', () => {
    expect(countActiveFilters({
      cities: {
        region: 'West',
        title: ''
      }
    }, true)).toBe(2);
  });

  it('serializes and restores share state from the hash', () => {
    const hash = serializeShareState({
      extent: {
        xmin: 1,
        ymin: 2,
        xmax: 3,
        ymax: 4
      },
      visibleLayerIds: ['cities'],
      filters: {
        cities: {
          region: 'West'
        }
      },
      extentFilterEnabled: true
    });

    expect(deserializeShareState(hash)).toEqual({
      extent: {
        xmin: 1,
        ymin: 2,
        xmax: 3,
        ymax: 4
      },
      visibleLayerIds: ['cities'],
      filters: {
        cities: {
          region: 'West'
        }
      },
      extentFilterEnabled: true
    });
  });

  it('builds feature details from configured display fields', () => {
    const details = buildFeatureDetails(
      {
        id: 'cities',
        title: 'Cities',
        type: 'graphics',
        ui: {
          displayFields: [
            {
              field: 'title',
              label: 'City'
            },
            {
              field: 'region',
              label: 'Region'
            }
          ]
        }
      },
      {
        title: 'Denver',
        region: 'Mountain'
      }
    );

    expect(details.title).toBe('Denver');
    expect(details.entries).toEqual([
      {
        label: 'City',
        value: 'Denver'
      },
      {
        label: 'Region',
        value: 'Mountain'
      }
    ]);
  });
});
