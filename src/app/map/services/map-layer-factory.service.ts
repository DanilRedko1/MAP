import { Injectable } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Layer from '@arcgis/core/layers/Layer';
import MapImageLayer from '@arcgis/core/layers/MapImageLayer';
import TileLayer from '@arcgis/core/layers/TileLayer';
import VectorTileLayer from '@arcgis/core/layers/VectorTileLayer';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';

import {
  DEFAULT_LAYER_LIST_MODE,
  GraphicItemConfig,
  GraphicsLayerConfig,
  LeafLayerConfig,
  PreparedAuthContext,
  ResolvedLayerDefinition
} from '../models/layer-config.model';

@Injectable({
  providedIn: 'root'
})
export class MapLayerFactoryService {
  createLayer(
    config: LeafLayerConfig,
    resolved?: ResolvedLayerDefinition,
    authContext?: PreparedAuthContext
  ): Layer {
    switch (config.kind) {
      case 'feature':
        return new FeatureLayer(this.buildUrlLayerProps(config, resolved, authContext) as __esri.FeatureLayerProperties);
      case 'map-image':
        return new MapImageLayer(this.buildUrlLayerProps(config, resolved, authContext) as __esri.MapImageLayerProperties);
      case 'tile':
        return new TileLayer(this.buildUrlLayerProps(config, resolved, authContext) as __esri.TileLayerProperties);
      case 'vector-tile':
        return new VectorTileLayer(this.buildUrlLayerProps(config, resolved, authContext) as __esri.VectorTileLayerProperties);
      case 'graphics':
        return this.createGraphicsLayer(config, resolved);
    }
  }

  private createGraphicsLayer(config: GraphicsLayerConfig, resolved?: ResolvedLayerDefinition): GraphicsLayer {
    const layer = new GraphicsLayer(this.buildGraphicsLayerProps(config, resolved) as __esri.GraphicsLayerProperties);
    const graphics = resolved?.graphics ?? config.graphics ?? [];

    if (graphics.length > 0) {
      layer.addMany(graphics.map((graphic) => this.createGraphic(graphic)));
    }

    return layer;
  }

  private createGraphic(config: GraphicItemConfig): Graphic {
    return new Graphic({
      geometry: new Point({
        longitude: config.geometry.longitude,
        latitude: config.geometry.latitude
      }),
      symbol: this.createSymbol(config.symbol),
      attributes: config.attributes,
      popupTemplate: config.popupTemplate
    });
  }

  private createSymbol(config?: GraphicItemConfig['symbol']): SimpleMarkerSymbol {
    return new SimpleMarkerSymbol({
      color: config?.color ?? '#0b6e4f',
      size: config?.size ?? 10,
      outline: {
        color: config?.outline?.color ?? '#ffffff',
        width: config?.outline?.width ?? 1.5
      }
    });
  }

  private buildGraphicsLayerProps(
    config: GraphicsLayerConfig,
    resolved?: ResolvedLayerDefinition
  ): Record<string, unknown> {
    return {
      ...(config.layerProps ?? {}),
      ...(resolved?.layerProps ?? {}),
      id: config.id,
      title: resolved?.title ?? config.title,
      visible: config.visible ?? true,
      listMode: config.listMode ?? DEFAULT_LAYER_LIST_MODE,
      ...(typeof config.opacity === 'number' ? { opacity: config.opacity } : {})
    };
  }

  private buildUrlLayerProps(
    config: Exclude<LeafLayerConfig, GraphicsLayerConfig>,
    resolved: ResolvedLayerDefinition | undefined,
    authContext: PreparedAuthContext | undefined
  ): Record<string, unknown> {
    const url = resolved?.url ?? config.url;

    if (!url) {
      throw new Error(`Layer "${config.id}" could not be created because no url was resolved.`);
    }

    const customParameters = this.getLayerCustomParameters(authContext);

    return {
      ...(config.layerProps ?? {}),
      ...(resolved?.layerProps ?? {}),
      id: config.id,
      title: resolved?.title ?? config.title,
      url,
      visible: config.visible ?? true,
      listMode: config.listMode ?? DEFAULT_LAYER_LIST_MODE,
      ...(typeof config.opacity === 'number' ? { opacity: config.opacity } : {}),
      ...(customParameters ? { customParameters } : {})
    };
  }

  private getLayerCustomParameters(authContext: PreparedAuthContext | undefined): Record<string, string> | undefined {
    if (!authContext?.auth || authContext.auth.mode !== 'token') {
      return undefined;
    }

    if (authContext.auth.appliesTo === 'resolver') {
      return undefined;
    }

    return Object.keys(authContext.query).length > 0 ? authContext.query : undefined;
  }
}