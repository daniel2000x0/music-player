import { addListener } from 'expo-media-library';
import { AppState } from 'react-native';

import { logError } from '@/services/error-log.service';
import {
  MEDIA_OBSERVER_DEBOUNCE_MS,
  watchMediaLibraryChanges,
} from '@/services/media-library-observer.service';

jest.mock('@/services/error-log.service', () => ({ logError: jest.fn() }));

const mockSubscription = { remove: jest.fn() } as unknown as { remove: jest.Mock };

jest.mock('expo-media-library', () => ({
  addListener: jest.fn(() => mockSubscription),
}));

jest.mock('react-native', () => ({ AppState: { currentState: 'active' } }));

const mockAppState = AppState as unknown as { currentState: string };

const mockedAddListener = jest.mocked(addListener);
const mockedLogError = jest.mocked(logError);

function emit(): void {
  const listener = mockedAddListener.mock.calls[0][0];
  listener({ hasIncrementalChanges: false });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockAppState.currentState = 'active';
});

afterEach(() => {
  jest.useRealTimers();
});

describe('watchMediaLibraryChanges', () => {
  it('agrupa las ráfagas de eventos en una sola sincronización', () => {
    const onChange = jest.fn();
    const stop = watchMediaLibraryChanges(onChange);

    emit();
    jest.advanceTimersByTime(MEDIA_OBSERVER_DEBOUNCE_MS - 1);
    emit();
    jest.advanceTimersByTime(MEDIA_OBSERVER_DEBOUNCE_MS - 1);
    expect(onChange).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
  });

  it('no sincroniza en segundo plano', () => {
    const onChange = jest.fn();
    const stop = watchMediaLibraryChanges(onChange);
    mockAppState.currentState = 'background';

    emit();
    jest.advanceTimersByTime(MEDIA_OBSERVER_DEBOUNCE_MS);

    expect(onChange).not.toHaveBeenCalled();
    stop();
  });

  it('cancela el temporizador y la suscripción al desmontar', () => {
    const onChange = jest.fn();
    const stop = watchMediaLibraryChanges(onChange);

    emit();
    stop();
    jest.advanceTimersByTime(MEDIA_OBSERVER_DEBOUNCE_MS);

    expect(onChange).not.toHaveBeenCalled();
    expect(mockSubscription.remove).toHaveBeenCalledTimes(1);
  });

  it('no tumba la app si el callback falla', () => {
    const stop = watchMediaLibraryChanges(() => {
      throw new Error('boom');
    });

    emit();
    jest.advanceTimersByTime(MEDIA_OBSERVER_DEBOUNCE_MS);
    expect(mockedLogError).toHaveBeenCalled();

    stop();
  });

  it('sobrevive a un proveedor sin eventos', () => {
    mockedAddListener.mockImplementationOnce(() => {
      throw new Error('sin eventos');
    });

    const stop = watchMediaLibraryChanges(jest.fn());
    expect(mockedLogError).toHaveBeenCalled();
    expect(() => stop()).not.toThrow();
  });
});
