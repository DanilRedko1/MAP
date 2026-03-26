import {
  hasOwn,
  isPlainObject,
  readNumber,
  readOptionalArray,
  readOptionalPlainObject,
  readPlainObject,
  readString
} from './map-object.utils';

describe('map-object.utils', () => {
  it('reads required plain objects and rejects non-objects', () => {
    const record = readPlainObject({ a: 1 }, 'bad object');

    expect(record).toEqual({ a: 1 });
    expect(() => readPlainObject([], 'bad object')).toThrowError('bad object');
    expect(() => readPlainObject(null, 'bad object')).toThrowError('bad object');
  });

  it('detects plain objects only', () => {
    expect(isPlainObject({ a: 1 })).toBeTrue();
    expect(isPlainObject([])).toBeFalse();
    expect(isPlainObject('value')).toBeFalse();
  });

  it('reads optional plain objects and arrays', () => {
    expect(readOptionalPlainObject({ a: 1 })).toEqual({ a: 1 });
    expect(readOptionalPlainObject(['a'])).toBeUndefined();
    expect(readOptionalArray(['a', 'b'])).toEqual(['a', 'b']);
    expect(readOptionalArray({ a: 1 })).toBeUndefined();
  });

  it('reads primitive strings and numbers', () => {
    expect(readString('value')).toBe('value');
    expect(readString(10)).toBeUndefined();
    expect(readNumber(10)).toBe(10);
    expect(readNumber('10')).toBeUndefined();
  });

  it('checks own properties without matching inherited ones', () => {
    const record = Object.create({ inherited: true }) as Record<string, unknown>;

    record['own'] = true;

    expect(hasOwn(record, 'own')).toBeTrue();
    expect(hasOwn(record, 'inherited')).toBeFalse();
  });
});
