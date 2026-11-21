import { motionDuration } from '@/utils/motion';

describe('motionDuration', () => {
  it('conserva la duración cuando no hay preferencia de movimiento reducido', () => {
    expect(motionDuration(false, 400)).toBe(400);
    expect(motionDuration(false, 0)).toBe(0);
  });

  it('anula la duración cuando el sistema pide reducir movimiento', () => {
    expect(motionDuration(true, 400)).toBe(0);
    expect(motionDuration(true, 120)).toBe(0);
  });
});
