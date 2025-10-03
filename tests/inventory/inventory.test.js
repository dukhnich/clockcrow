const { Item, TraitItem, Inventory } = require('../../src/inventory/inventory.js');

describe('Inventory', () => {
    let inventory;
    beforeEach(() => {
        inventory = new Inventory();
    });

    test('adds and retrieves items', () => {
        const item = new Item('Bag', 'A sturdy bag');
        inventory.add(item);
        expect(inventory.getAll()).toContain(item);
        expect(inventory.get(0)).toBe(item);
    });

    test('removes items', () => {
        const item = new Item('Bag', 'A sturdy bag');
        inventory.add(item);
        expect(inventory.remove(item)).toBe(true);
        expect(inventory.getAll()).not.toContain(item);
    });

    test('resetInventory clears items', () => {
        inventory.add(new Item('Bag', 'A sturdy bag'));
        inventory.add(new Item('Key', 'A shiny key'));
        inventory.resetInventory();
        expect(inventory.getAll()).toEqual([]);
    });

    test('only Item instances allowed', () => {
        expect(() => inventory.add({})).toThrow(TypeError);
        expect(() => inventory.set(0, {})).toThrow(TypeError);
    });

    test('TraitItem triggers trait events', () => {
        const traitItem = new TraitItem('Amulet', 'Gives wisdom', [{ traitName: 'Wisdom', value: 2 }]);
        const events = [];
        inventory.subscribe(e => events.push(e));
        inventory.add(traitItem);
        expect(events).toEqual([
            { type: 'traitItemAdded', item: traitItem },
            { type: 'itemAdded', item: traitItem }
        ]);
        inventory.remove(traitItem);
        expect(events.slice(2)).toEqual([
            { type: 'traitItemRemoved', item: traitItem },
            { type: 'itemRemoved', item: traitItem }
        ]);
    });
});