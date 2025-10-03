const { Trait, TraitsManager } = require('../../src/core/traitsManager.js');

describe('Trait', () => {
    test('should clamp value between MIN and MAX', () => {
        const trait = new Trait('Bravery', 'Test', 'light', 15);
        expect(trait.value).toBe(Trait.MAX);
        trait.value = -5;
        expect(trait.value).toBe(Trait.MIN);
    });

    test('should increment and decrement value', () => {
        const trait = new Trait('Wisdom', 'Test', 'dark', 5);
        trait.increment(3);
        expect(trait.value).toBe(8);
        trait.decrement(10);
        expect(trait.value).toBe(Trait.MIN);
    });
});

describe('TraitsManager', () => {
    let traits, manager;
    beforeEach(() => {
        traits = [
            new Trait('Bravery', 'desc', 'light', 5),
            new Trait('Wisdom', 'desc', 'dark', 3),
            new Trait('Kindness', 'desc', 'light', 2)
        ];
        manager = new TraitsManager(traits);
    });

    test('should get trait by name', () => {
        expect(manager.getTraitByName('Bravery')).toBe(traits[0]);
        expect(manager.getTraitByName('Unknown')).toBeUndefined();
    });

    test('should get traits by side', () => {
        expect(manager.getTraitsBySide('light').length).toBe(2);
        expect(manager.getTraitsBySide('dark').length).toBe(1);
    });

    test('should get total by side', () => {
        expect(manager.getTotalBySide('light')).toBe(7);
        expect(manager.getTotalBySide('dark')).toBe(3);
    });

    test('should update trait value and notify with description', () => {
        const notifications = [];
        manager.subscribe(data => notifications.push(data));
        expect(manager.updateTraitValue('Bravery', 9)).toBe(true);
        expect(manager.getTraitByName('Bravery').value).toBe(9);
        expect(notifications[0]).toEqual({
            name: 'Bravery',
            description: 'desc',
            side: 'light',
            value: 9
        });
        expect(manager.updateTraitValue('Unknown', 5)).toBe(false);
    });

    test('should increment and decrement trait and notify with description', () => {
        const notifications = [];
        manager.subscribe(data => notifications.push(data));
        expect(manager.incrementTrait('Wisdom', 2)).toBe(true);
        expect(manager.getTraitByName('Wisdom').value).toBe(5);
        expect(notifications[0]).toEqual({
            name: 'Wisdom',
            description: 'desc',
            side: 'dark',
            value: 5
        });
        expect(manager.decrementTrait('Kindness', 1)).toBe(true);
        expect(manager.getTraitByName('Kindness').value).toBe(1);
        expect(notifications[1]).toEqual({
            name: 'Kindness',
            description: 'desc',
            side: 'light',
            value: 1
        });
    });

    test('should reset traits and notify with description', () => {
        const notifications = [];
        manager.subscribe(data => notifications.push(data));
        manager.resetTraits();
        expect(manager.getTraitByName('Bravery').value).toBe(0);
        expect(manager.getTraitByName('Wisdom').value).toBe(0);
        expect(manager.getTraitByName('Kindness').value).toBe(0);
        expect(notifications).toEqual([
            {
                name: 'Bravery',
                description: 'desc',
                side: 'light',
                value: 0
            },
            {
                name: 'Wisdom',
                description: 'desc',
                side: 'dark',
                value: 0
            },
            {
                name: 'Kindness',
                description: 'desc',
                side: 'light',
                value: 0
            }
        ]);
    });
});