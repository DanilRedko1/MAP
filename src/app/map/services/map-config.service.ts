import { Injectable } from '@angular/core';

import {
  DEFAULT_FALLBACK_BASEMAP,
  GraphicItemConfig,
  MapConfig
} from '../models/layer-config.model';

const SAMPLE_LOCATION_GRAPHICS: GraphicItemConfig[] = [
  {
    geometry: {
      type: 'point',
      longitude: -74.006,
      latitude: 40.7128
    },
    symbol: {
      type: 'simple-marker',
      color: '#0b6e4f',
      size: 10,
      outline: {
        color: '#ffffff',
        width: 1.5
      }
    },
    attributes: {
      title: 'New York City',
      description: 'Sample marker with popup content in Lower Manhattan.'
    },
    popupTemplate: {
      title: '{title}',
      content: '{description}'
    }
  },
  {
    geometry: {
      type: 'point',
      longitude: -104.9903,
      latitude: 39.7392
    },
    symbol: {
      type: 'simple-marker',
      color: '#0b6e4f',
      size: 10,
      outline: {
        color: '#ffffff',
        width: 1.5
      }
    },
    attributes: {
      title: 'Denver',
      description: 'A second graphic to demonstrate multiple features on the map.'
    },
    popupTemplate: {
      title: '{title}',
      content: '{description}'
    }
  },
  {
    geometry: {
      type: 'point',
      longitude: -122.4194,
      latitude: 37.7749
    },
    symbol: {
      type: 'simple-marker',
      color: '#0b6e4f',
      size: 10,
      outline: {
        color: '#ffffff',
        width: 1.5
      }
    },
    attributes: {
      title: 'San Francisco',
      description: 'West coast sample point with a consistent popup template.'
    },
    popupTemplate: {
      title: '{title}',
      content: '{description}'
    }
  }
];

@Injectable({
  providedIn: 'root'
})
export class MapConfigService {
  getConfig(): MapConfig {
    return {
      fallbackBasemap: DEFAULT_FALLBACK_BASEMAP,
      basemap: {
        mode: 'well-known',
        id: 'arcgis-navigation'
      },
      operationalLayers: [
        {
          id: 'demo-operational-layers',
          title: 'Demo Operational Layers',
          kind: 'group',
          visible: true,
          order: 10,
          listMode: 'show',
          visibilityMode: 'independent',
          children: [
            {
              id: 'sample-locations',
              title: 'Sample Locations',
              kind: 'graphics',
              visible: true,
              order: 10,
              listMode: 'show',
              layerProps: {
                title: 'Sample Locations'
              },
              graphics: SAMPLE_LOCATION_GRAPHICS
            }
          ]
        }
      ]
    };
  }
}