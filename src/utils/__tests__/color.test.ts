import { lerpColor, parseColor, toRgbaString } from '@/utils/color';

describe('parseColor', () => {
  it('entiende hexadecimal corto y largo', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('#0B0B0F')).toEqual({ r: 11, g: 11, b: 15, a: 1 });
  });

  it('entiende rgb y rgba', () => {
    expect(parseColor('rgb(10, 20, 30)')).toEqual({ r: 10, g: 20, b: 30, a: 1 });
    expect(parseColor('rgba(26, 5, 6, 0.6)')).toEqual({ r: 26, g: 5, b: 6, a: 0.6 });
  });

  it('rechaza formatos desconocidos', () => {
    expect(parseColor('red')).toBeNull();
    expect(parseColor('#12')).toBeNull();
    expect(parseColor('rgba(1,2)')).toBeNull();
  });
});

describe('lerpColor', () => {
  it('devuelve los extremos en t=0 y t=1', () => {
    expect(lerpColor('#000000', '#ffffff', 0)).toBe('rgba(0, 0, 0, 1)');
    expect(lerpColor('#000000', '#ffffff', 1)).toBe('rgba(255, 255, 255, 1)');
  });

  it('interpola el punto medio y respeta el alpha', () => {
    expect(lerpColor('rgba(0, 0, 0, 0.2)', 'rgba(100, 200, 255, 1)', 0.5)).toBe(
      'rgba(50, 100, 128, 0.6)'
    );
  });

  it('recorta t fuera de rango y degrada a destino si no parsea', () => {
    expect(lerpColor('#000', '#fff', -5)).toBe('rgba(0, 0, 0, 1)');
    expect(lerpColor('#000', '#fff', 5)).toBe('rgba(255, 255, 255, 1)');
    expect(lerpColor('nope', '#abc', 0.5)).toBe('#abc');
  });

  it('serializa con tres decimales de alpha', () => {
    expect(toRgbaString({ r: 1.4, g: 2.6, b: 3, a: 0.12345 })).toBe(
      'rgba(1, 3, 3, 0.123)'
    );
  });
});
