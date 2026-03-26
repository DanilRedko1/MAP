import { Injectable } from '@angular/core';
import GroupLayer from '@arcgis/core/layers/GroupLayer';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Layer from '@arcgis/core/layers/Layer';
import { BehaviorSubject } from 'rxjs';

import { LayerConfig, LayerLoadMetadata, LayerRuntimeRecord } from '../models/layer-config.model';

@Injectable({
  providedIn: 'root'
})
export class MapLayerRegistryService {
  private readonly records = new Map<string, LayerRuntimeRecord>();
  private readonly recordsSubject = new BehaviorSubject<LayerRuntimeRecord[]>([]);

  readonly records$ = this.recordsSubject.asObservable();

  clear(): void {
    this.records.clear();
    this.emitSnapshot();
  }

  start(config: LayerConfig): void {
    this.records.set(config.id, {
      id: config.id,
      config,
      status: 'loading',
      childIds: this.readChildIds(config)
    });
    this.emitSnapshot();
  }

  markLoaded(config: LayerConfig, layer: Layer, metadata?: LayerLoadMetadata): void {
    const itemCount = this.readItemCount(config, layer);

    this.records.set(config.id, {
      id: config.id,
      config,
      layer,
      status: 'loaded',
      childIds: this.readChildIds(config),
      itemCount,
      isEmpty: itemCount === 0,
      loadedViaFallback: metadata?.loadedViaFallback === true,
      ...(typeof metadata?.fallbackIndex === 'number' ? { fallbackIndex: metadata.fallbackIndex } : {}),
      attemptErrors: this.normalizeAttemptErrors(metadata?.attemptErrors)
    });
    this.emitSnapshot();
  }

  markFailed(config: LayerConfig, error: unknown, metadata?: Pick<LayerLoadMetadata, 'attemptErrors'>): void {
    this.records.set(config.id, {
      id: config.id,
      config,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      childIds: this.readChildIds(config),
      loadedViaFallback: false,
      attemptErrors: this.normalizeAttemptErrors(metadata?.attemptErrors)
    });
    this.emitSnapshot();
  }

  getSnapshot(): LayerRuntimeRecord[] {
    return Array.from(this.records.values());
  }

  private readChildIds(config: LayerConfig): string[] {
    return config.type === 'group' ? config.layers.map((child) => child.id) : [];
  }

  private readItemCount(config: LayerConfig, layer: Layer): number | undefined {
    if (config.type === 'graphics' && layer instanceof GraphicsLayer) {
      return layer.graphics.length;
    }

    if (config.type === 'group' && layer instanceof GroupLayer) {
      return layer.layers.length;
    }

    return undefined;
  }

  private normalizeAttemptErrors(attemptErrors?: string[]): string[] {
    return attemptErrors ? [...attemptErrors] : [];
  }

  private emitSnapshot(): void {
    this.recordsSubject.next(this.getSnapshot());
  }
}
