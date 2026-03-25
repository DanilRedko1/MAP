import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  BasemapLayerConfig,
  GraphicItemConfig,
  LeafLayerConfig,
  PortalItemBasemapConfig,
  PreparedAuthContext,
  PrimitiveValue,
  ResolvedBasemapDefinition,
  ResolvedLayerDefinition,
  ResourceSourceConfig
} from '../models/layer-config.model';
import { toStringRecord } from '../utils/map-config.utils';

@Injectable({
  providedIn: 'root'
})
export class MapResourceResolverService {
  constructor(private readonly http: HttpClient) {}

  async resolveLayerDefinition(
    config: LeafLayerConfig | BasemapLayerConfig,
    authContext?: PreparedAuthContext
  ): Promise<ResolvedLayerDefinition | undefined> {
    if (!config.source || config.source.mode !== 'resolved') {
      return undefined;
    }

    const payload = await this.request(config.source, authContext);
    return this.normalizeResolvedLayerDefinition(config.id, payload);
  }

  async resolveBasemapDefinition(
    config: PortalItemBasemapConfig,
    authContext?: PreparedAuthContext
  ): Promise<ResolvedBasemapDefinition | undefined> {
    if (!config.source || config.source.mode !== 'resolved') {
      return undefined;
    }

    const payload = await this.request(config.source, authContext);
    return this.normalizeResolvedBasemapDefinition(config.id, payload);
  }

  private async request(source: ResourceSourceConfig, authContext?: PreparedAuthContext): Promise<unknown> {
    if (source.mode !== 'resolved') {
      return undefined;
    }

    const applyAuthToResolver = !authContext?.auth?.appliesTo
      || authContext.auth.appliesTo === 'resolver'
      || authContext.auth.appliesTo === 'both';
    const headers = new HttpHeaders(applyAuthToResolver ? authContext?.headers : undefined);
    const params = new HttpParams({
      fromObject: {
        ...toStringRecord(source.params),
        ...(applyAuthToResolver ? authContext?.query : {})
      }
    });

    return firstValueFrom(
      this.http.request<unknown>(source.method ?? 'GET', source.endpoint, {
        body: source.method === 'POST' ? source.body : undefined,
        headers,
        params
      })
    );
  }

  private normalizeResolvedLayerDefinition(id: string, payload: unknown): ResolvedLayerDefinition {
    const record = readRecord(payload);

    return {
      id: readString(record['id']) ?? id,
      title: readString(record['title']),
      url: readString(record['url']),
      layerProps: readOptionalRecord(record['layerProps']) ?? readOptionalRecord(record['properties']),
      auth: readOptionalRecord(record['auth']) as Partial<ResolvedLayerDefinition['auth']>,
      graphics: readGraphics(record['graphics'])
    };
  }

  private normalizeResolvedBasemapDefinition(id: string, payload: unknown): ResolvedBasemapDefinition {
    const record = readRecord(payload);

    return {
      id: readString(record['id']) ?? id,
      title: readString(record['title']),
      portalItemId: readString(record['portalItemId']) ?? readString(record['id']),
      baseLayers: readOptionalArray(record['baseLayers']) as BasemapLayerConfig[] | undefined,
      referenceLayers: readOptionalArray(record['referenceLayers']) as BasemapLayerConfig[] | undefined,
      spatialReferenceWkid: readNumber(record['spatialReferenceWkid'])
    };
  }
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error('Resolved resource payload must be an object.');
  }

  return value;
}

function readOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function readOptionalArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function readGraphics(value: unknown): GraphicItemConfig[] | undefined {
  return Array.isArray(value) ? value as GraphicItemConfig[] : undefined;
}

function isRecord(value: unknown): value is Record<string, PrimitiveValue | unknown> {
  return typeof value === 'object' && value !== null;
}