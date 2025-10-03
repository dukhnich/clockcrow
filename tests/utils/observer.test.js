
const { Observer } = require('../../src/utils/observer.js');

describe('Observer', () => {
    let observer;
    beforeEach(() => {
        observer = new Observer();
    });

    test('should subscribe and notify listeners', () => {
        const mockListener = jest.fn();
        observer.subscribe(mockListener);
        observer.notify('data');
        expect(mockListener).toHaveBeenCalledWith('data');
    });

    test('should unsubscribe listeners', () => {
        const mockListener = jest.fn();
        observer.subscribe(mockListener);
        observer.unsubscribe(mockListener);
        observer.notify('data');
        expect(mockListener).not.toHaveBeenCalled();
    });

    test('should not fail if listener throws', () => {
        const errorListener = jest.fn(() => { throw new Error('fail'); });
        const safeListener = jest.fn();
        observer.subscribe(errorListener);
        observer.subscribe(safeListener);
        expect(() => observer.notify('data')).not.toThrow();
        expect(safeListener).toHaveBeenCalledWith('data');
    });

    test('should clear all listeners', () => {
        const l1 = jest.fn();
        const l2 = jest.fn();
        observer.subscribe(l1);
        observer.subscribe(l2);
        observer.clear();
        observer.notify('data');
        expect(l1).not.toHaveBeenCalled();
        expect(l2).not.toHaveBeenCalled();
    });

    test('listeners getter returns a Set', () => {
        expect(observer.listeners instanceof Set).toBe(true);
    });
});