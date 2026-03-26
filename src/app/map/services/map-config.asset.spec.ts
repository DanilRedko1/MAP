import mapConfig from '../../../assets/config/map-config.json';

import { MapConfig } from '../models/layer-config.model';
import { validateMapConfig } from '../utils/map-config.utils';

describe('map-config.json', () => {
  it('matches the map config contract', () => {
    expect(() => validateMapConfig(mapConfig as unknown as MapConfig)).not.toThrow();
  });
});
