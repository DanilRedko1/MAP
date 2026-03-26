import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import {
  BasemapLayerConfig,
  BasemapLayerRuntimeRecord,
  BasemapLayerSlot,
  BasemapRuntimeState,
  LayerLoadMetadata
} from '../models/layer-config.model';

const DEFAULT_BASEMAP_RUNTIME_STATE: BasemapRuntimeState = {
  fallbackBasemapActive: false
};

@Injectable({
  providedIn: 'root'
})
export class MapBasemapStatusService {
  private readonly records = new Map<string, BasemapLayerRuntimeRecord>();
  private readonly recordsSubject = new BehaviorSubject<BasemapLayerRuntimeRecord[]>([]);
  private readonly stateSubject = new BehaviorSubject<BasemapRuntimeState>({ ...DEFAULT_BASEMAP_RUNTIME_STATE });

  readonly records$ = this.recordsSubject.asObservable();
  readonly state$ = this.stateSubject.asObservable();

  clear(): void {
    this.records.clear();
    this.recordsSubject.next([]);
    this.stateSubject.next({ ...DEFAULT_BASEMAP_RUNTIME_STATE });
  }

  start(config: BasemapLayerConfig, slot: BasemapLayerSlot): void {
    this.records.set(config.id, {
      id: config.id,
      title: config.title ?? config.id,
      slot,
      config,
      status: 'loading'
    });
    this.emitRecords();
  }

  markLoaded(config: BasemapLayerConfig, slot: BasemapLayerSlot, metadata?: LayerLoadMetadata): void {
    this.records.set(config.id, {
      id: config.id,
      title: config.title ?? config.id,
      slot,
      config,
      status: 'loaded',
      loadedViaFallback: metadata?.loadedViaFallback === true,
      ...(typeof metadata?.fallbackIndex === 'number' ? { fallbackIndex: metadata.fallbackIndex } : {}),
      attemptErrors: this.normalizeAttemptErrors(metadata?.attemptErrors)
    });
    this.emitRecords();
  }

  markFailed(
    config: BasemapLayerConfig,
    slot: BasemapLayerSlot,
    error: unknown,
    metadata?: Pick<LayerLoadMetadata, 'attemptErrors'>
  ): void {
    this.records.set(config.id, {
      id: config.id,
      title: config.title ?? config.id,
      slot,
      config,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      loadedViaFallback: false,
      attemptErrors: this.normalizeAttemptErrors(metadata?.attemptErrors)
    });
    this.emitRecords();
  }

  markFallbackBasemap(basemapId: string, reason?: unknown): void {
    this.stateSubject.next({
      fallbackBasemapActive: true,
      fallbackBasemapId: basemapId,
      ...(reason !== undefined ? { fallbackReason: this.toErrorMessage(reason) } : {})
    });
  }

  getRecordsSnapshot(): BasemapLayerRuntimeRecord[] {
    return Array.from(this.records.values());
  }

  getStateSnapshot(): BasemapRuntimeState {
    return this.stateSubject.value;
  }

  private emitRecords(): void {
    this.recordsSubject.next(this.getRecordsSnapshot());
  }

  private normalizeAttemptErrors(attemptErrors?: string[]): string[] {
    return attemptErrors ? [...attemptErrors] : [];
  }

  private toErrorMessage(error: unknown): string {
    return error instanceof Error && error.message.trim() ? error.message : String(error);
  }
}
