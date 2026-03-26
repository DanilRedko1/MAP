import { Injectable } from '@angular/core';
import GroupLayer from '@arcgis/core/layers/GroupLayer';
import Layer from '@arcgis/core/layers/Layer';

import {
  DEFAULT_GROUP_VISIBILITY_MODE,
  DEFAULT_LAYER_LIST_MODE,
  LayerConfig
} from '../models/layer-config.model';
import { sortByOrder } from '../utils/map-config.utils';
import { MapLayerFactoryService } from './map-layer-factory.service';
import { MapLayerRegistryService } from './map-layer-registry.service';
import { MapResourceAuthService } from './map-resource-auth.service';
import { MapResourceResolverService } from './map-resource-resolver.service';

@Injectable({
  providedIn: 'root'
})
export class MapLayerLoaderService {
  constructor(
    private readonly authService: MapResourceAuthService,
    private readonly resolverService: MapResourceResolverService,
    private readonly layerFactory: MapLayerFactoryService,
    private readonly layerRegistry: MapLayerRegistryService
  ) {}

  async loadLayers(configs: LayerConfig[]): Promise<Layer[]> {
    this.layerRegistry.clear();

    const layers = await Promise.all(sortByOrder(configs).map((config) => this.buildLayer(config)));
    return layers.filter((layer): layer is Layer => layer !== null);
  }

  private async buildLayer(config: LayerConfig): Promise<Layer | null> {
    this.layerRegistry.start(config);

    try {
      if (config.type === 'group') {
        const children = await Promise.all(sortByOrder(config.layers).map((child) => this.buildLayer(child)));
        const groupLayer = new GroupLayer({
          id: config.id,
          title: config.title,
          visible: config.visible ?? true,
          listMode: config.listMode ?? DEFAULT_LAYER_LIST_MODE,
          visibilityMode: config.visibilityMode ?? DEFAULT_GROUP_VISIBILITY_MODE,
          ...(typeof config.opacity === 'number' ? { opacity: config.opacity } : {})
        });
        const childLayers = children.filter((layer): layer is Layer => layer !== null);

        if (childLayers.length > 0) {
          groupLayer.addMany(childLayers);
        }

        this.layerRegistry.markLoaded(config, groupLayer);
        return groupLayer;
      }

      const authContext = await this.authService.prepare(config);
      const resolved = await this.resolverService.resolveLayerDefinition(config, authContext);
      const layer = this.layerFactory.createLayer(config, resolved, authContext);

      this.layerRegistry.markLoaded(config, layer);
      return layer;
    } catch (error) {
      this.layerRegistry.markFailed(config, error);
      return null;
    }
  }
}
