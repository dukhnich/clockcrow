const { TimeManager, DaySettings } = require('../../src/core/timeManager.js');

describe('TimeManager', () => {
    let tm;
    beforeEach(() => {
        tm = new TimeManager(9, 5, new DaySettings(0, 24, 21, 5));
    });

    test('initializes with correct start time', () => {
        expect(tm.currentTime).toBe(9);
    });

    test('tick advances time by 1 hour', () => {
        tm.tick();
        expect(tm.currentTime).toBe(10);
    });

    test('time wraps correctly at 24', () => {
        tm.currentTime = 23;
        tm.tick();
        expect(tm.currentTime).toBe(0);
    });

    test('game over triggers at endTime', () => {
        let notified = null;
        tm.subscribe(data => { notified = data; });
        tm.currentTime = 5;
        expect(notified.gameOver).toBe(true);
        expect(tm.currentTime).toBe(5);
    });

    test('observer notifies on time change', () => {
        let notified = null;
        tm.subscribe(data => { notified = data; });
        tm.tick();
        expect(notified.time).toBe(10);
        expect(notified.gameOver).toBe(false);
    });

    test('isDay and isNight work as expected', () => {
        tm.currentTime = 10;
        expect(tm.isDay()).toBe(true);
        expect(tm.isNight()).toBe(false);
        tm.currentTime = 22;
        expect(tm.isDay()).toBe(false);
        expect(tm.isNight()).toBe(true);
    });

    test('reset sets time and clears observers', () => {
        let called = false;
        tm.subscribe(() => { called = true; });
        tm.reset();
        called = false;
        tm.tick();
        expect(called).toBe(false);
    });
});

describe('DaySettings', () => {
    const ds = new DaySettings(0, 24, 21, 5);

    test('isDayHour returns true for day hours', () => {
        expect(ds.isDayHour(10)).toBe(true);
        expect(ds.isDayHour(20)).toBe(true);
    });

    test('isDayHour returns false for night hours', () => {
        expect(ds.isDayHour(22)).toBe(false);
        expect(ds.isDayHour(4)).toBe(false);
    });

    test('isNightHour returns correct value', () => {
        expect(ds.isNightHour(22)).toBe(true);
        expect(ds.isNightHour(10)).toBe(false);
    });
});