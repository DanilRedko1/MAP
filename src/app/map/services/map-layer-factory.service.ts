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
  BasemapLayerConfig,
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
    switch (config.type) {
      case 'feature':
      case 'map-image':
      case 'tile':
      case 'vector-tile':
        return this.createUrlLayer(
          config.type,
          this.buildUrlLayerProps(config, resolved, authContext, {
            errorLabel: 'Layer',
            title: resolved?.title ?? config.title,
            visible: config.visible ?? true,
            listMode: config.listMode ?? DEFAULT_LAYER_LIST_MODE
          })
        );
      case 'graphics':
        return this.createGraphicsLayer(config, resolved);
    }
  }

  createBasemapLayer(
    config: BasemapLayerConfig,
    resolved?: ResolvedLayerDefinition,
    authContext?: PreparedAuthContext
  ): Layer {
    return this.createUrlLayer(
      config.type,
      this.buildUrlLayerProps(config, resolved, authContext, {
        errorLabel: 'Basemap layer',
        title: config.title ?? resolved?.title
      })
    );
  }

  private createGraphicsLayer(config: GraphicsLayerConfig, resolved?: ResolvedLayerDefinition): GraphicsLayer {
    const layer = new GraphicsLayer(this.buildGraphicsLayerProps(config, resolved) as __esri.GraphicsLayerProperties);
    const graphics = resolved?.graphics ?? config.graphics ?? [];
    const sourceGraphics = graphics.map((graphic) => this.createGraphic(graphic));

    (layer as GraphicsLayer & { __sourceGraphics?: Graphic[] }).__sourceGraphics = sourceGraphics.map((graphic) => graphic.clone());

    if (sourceGraphics.length > 0) {
      layer.addMany(sourceGraphics);
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

  private createUrlLayer(
    type: Exclude<LeafLayerConfig['type'], 'graphics'>,
    props: Record<string, unknown>
  ): Layer {
    switch (type) {
      case 'feature':
        return new FeatureLayer(props as __esri.FeatureLayerProperties);
      case 'map-image':
        return new MapImageLayer(props as __esri.MapImageLayerProperties);
      case 'tile':
        return new TileLayer(props as __esri.TileLayerProperties);
      case 'vector-tile':
        return new VectorTileLayer(props as __esri.VectorTileLayerProperties);
    }
  }

  private buildUrlLayerProps(
    config: Exclude<LeafLayerConfig, GraphicsLayerConfig> | BasemapLayerConfig,
    resolved: ResolvedLayerDefinition | undefined,
    authContext: PreparedAuthContext | undefined,
    options: {
      errorLabel: string;
      title?: string;
      visible?: boolean;
      listMode?: string;
    }
  ): Record<string, unknown> {
    const url = resolved?.url ?? config.url;

    if (!url) {
      throw new Error(`${options.errorLabel} "${config.id}" could not be created because no url was resolved.`);
    }

    const customParameters = this.getLayerCustomParameters(authContext);

    return {
      ...(config.layerProps ?? {}),
      ...(resolved?.layerProps ?? {}),
      id: config.id,
      title: options.title,
      url,
      ...(options.visible !== undefined ? { visible: options.visible } : {}),
      ...(options.listMode !== undefined ? { listMode: options.listMode } : {}),
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
