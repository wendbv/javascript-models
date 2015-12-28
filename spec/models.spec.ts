/// <reference path="./jasmine.d.ts" />


/**********
 * EVENTS *
 **********/
import {Events} from '../bin/models';

describe('Events', () => {
    var events: Events;

    beforeEach(() => {
        this.events = new Events();
    });

    it('should instantiate properly', () => {
        expect(this.events).toEqual(jasmine.anything());
    });

    it('should allow me to bind events', () => {
        var cb = jasmine.createSpy('bar');
        var index = this.events.on('foo', cb);
        expect(index).toEqual(jasmine.any(Number));
    });

    it('should work if I trigger that event', () => {
        var cb = jasmine.createSpy('bar');

        this.events.on('foo', cb);
        this.events.trigger('foo');

        expect(cb).toHaveBeenCalled();
    });

    it('should let me bind multiple callbacks on one event', () => {
        var cb1 = jasmine.createSpy('fooCallback1');
        var cb2 = jasmine.createSpy('fooCallback2');

        this.events.on('foo', cb1);
        this.events.on('foo', cb2);
        this.events.trigger('foo');

        expect(cb1).toHaveBeenCalled();
        expect(cb2).toHaveBeenCalled();
    });

    it('should let me bind multiple events', () => {
        var fooCb = jasmine.createSpy('fooCallback');
        var barCb = jasmine.createSpy('barCallback');

        this.events.on('foo', fooCb);
        this.events.on('bar', barCb);

        this.events.trigger('foo');
        expect(fooCb).toHaveBeenCalled();
        expect(barCb).not.toHaveBeenCalled();

        this.events.trigger('bar');
        expect(barCb).toHaveBeenCalled();
    });

    it('should allow me to unbind from an event', () => {
        var cb = jasmine.createSpy('bar');

        var index = this.events.on('foo', cb);
        this.events.off('foo', index);

        this.events.trigger('foo');
        expect(cb).not.toHaveBeenCalled();
    });
});





/**********
 * MODELS *
 **********/

import {field, Model, Collection} from '../bin/models';

class FooModel extends Model {
    @field bar: string;
    @field qux: number = 5;
}

class FooCollection extends Collection<FooModel> { }
class CollectedModel extends Model {
    @field foos: FooCollection;
}

var intCounter = 0;
var intIncremental = () => String(intCounter += 1);


describe('Model', () => {
    var model: FooModel;

    beforeEach(() => {
        intCounter = 0;
        this.model = new FooModel(intIncremental());
    });
    afterEach(() => {
        this.model = undefined;
        this.collected = undefined;
    });

    it('should construct properly', () => {
        expect(this.model).toEqual(jasmine.any(FooModel));

        expect(this.model.clean).toBe(false);
        expect(this.model.qux).toEqual(5);
    });

    it('should allow me to change values', () => {
        this.model.bar = 'foo';
        expect(this.model.bar).toEqual('foo');
    });

    it('should track its cleanliness', () => {
        this.model.bar = 'foo';
        expect(this.model.clean).toBe(false);
    });

    it('should show me changed values', () => {
        this.model.bar = 'foo';
        expect(this.model.changed).toEqual(['pk', 'bar', 'qux']);
    });

    it('should tell me when I change values', () => {
        var spy = jasmine.createSpy('changeCb');
        var specificSpy = jasmine.createSpy('specificChangeCb');
        this.model.on('change', spy);
        this.model.on('change:bar', specificSpy);

        this.model.bar = 'foo';
        expect(spy).toHaveBeenCalled();
        expect(specificSpy).toHaveBeenCalled();
    });

    it('should persist itself nicely', () => {
        var spy = jasmine.createSpy('persistCb');
        this.model.on('persist', spy);

        this.model.bar = 'foo';
        expect(spy).not.toHaveBeenCalled();

        this.model.persist();
        expect(spy).toHaveBeenCalled();

        expect(this.model.changed).toEqual([]);
    });

    it('should convert to JSON properly', () => {
        expect(JSON.stringify(this.model)).toEqual('{"pk":"1","qux":5}');
    });
});





describe('Collection', () => {
    var collection: FooCollection;

    beforeEach(() => {
        intCounter = 0;
        this.collection = new FooCollection();
    });
    afterEach(() => {
        this.collection = undefined;
    });

    it('should construct properly', () => {
        expect(this.collection).toEqual(jasmine.any(FooCollection));
        expect(this.collection.clean).toBe(false);
    });

    it('should allow appending', () => {
        this.collection.add(new FooModel(intIncremental()));
        expect(this.collection.length).toEqual(1);
    });

    function adder() {
        this.pk = intIncremental();
        this.model = new FooModel(this.pk);

        this.collection.add(this.model);
    }

    describe('should allow lookups', () => {
        beforeEach(adder.bind(this));

        it('by public key', () => {
            expect(this.collection.get(this.pk)).toEqual(this.model);
        });

        it('by public key', () => {
            expect(this.collection.get(this.pk)).toEqual(this.model);
        });
    });

    describe('should allow removing', () => {
        var model: FooModel;
        var pk: number;

        beforeEach(adder.bind(this));

        it('by object', () => {
            this.collection.remove(this.model);
            expect(this.collection.length).toEqual(0);
        });

        it('by id', () => {
            this.collection.removeAt(0);
            expect(this.collection.length).toEqual(0);
        });

        it('by pk', () => {
            this.collection.removeBy(this.pk);
            expect(this.collection.length).toEqual(0);
        });

        it('by filter', () => {
            this.collection.removeWhere((m: FooModel) => m.qux == 5);
            expect(this.collection.length).toEqual(0);
        });
    });

    describe('should allow moving', () => {
        beforeEach(() => {
            this.model1 = new FooModel(intIncremental());
            this.model2 = new FooModel(intIncremental());
            this.model3 = new FooModel(intIncremental());
            this.model4 = new FooModel(intIncremental());

            this.collection.add(this.model1);
            this.collection.add(this.model2);
            this.collection.add(this.model3);
            this.collection.add(this.model4);
        });

        it('forwards', () => {
            this.collection.move(this.model1, +1);

            expect(this.collection.all().map((m: FooModel) => m.pk))
                .toEqual([this.model2.pk, this.model1.pk, this.model3.pk, this.model4.pk]);
        });

        it('backwards', () => {
            this.collection.move(this.model2, -1);

            expect(this.collection.all().map((m: FooModel) => m.pk))
                .toEqual([this.model2.pk, this.model1.pk, this.model3.pk, this.model4.pk]);
        });

        it('but not go beyond the lower bound', () => {
            this.collection.move(this.model2, -3);

            expect(this.collection.all().map((m: FooModel) => m.pk))
                .toEqual([this.model2.pk, this.model1.pk, this.model3.pk, this.model4.pk]);
        });

        it('but not go beyond the upper bound', () => {
            this.collection.move(this.model2, +3);

            expect(this.collection.all().map((m: FooModel) => m.pk))
                .toEqual([this.model1.pk, this.model3.pk, this.model4.pk, this.model2.pk]);
        });

        it('by index', () => {
            this.collection.moveAt(0, +1);

            expect(this.collection.all().map((m: FooModel) => m.pk))
                .toEqual([this.model2.pk, this.model1.pk, this.model3.pk, this.model4.pk]);
        });

        it('by pk', () => {
            this.collection.moveBy(this.model1.pk, +1);

            expect(this.collection.all().map((m: FooModel) => m.pk))
                .toEqual([this.model2.pk, this.model1.pk, this.model3.pk, this.model4.pk]);
        });
    });

    it('should tell me when I append or remove', () => {
        var appendSpy = jasmine.createSpy('persistCb');
        var removeSpy = jasmine.createSpy('appendCb');

        this.collection.on('append', appendSpy);
        this.collection.on('remove', removeSpy);

        var model = new FooModel(intIncremental());

        this.collection.add(model);
        expect(appendSpy).toHaveBeenCalled();
        expect(removeSpy).not.toHaveBeenCalled();

        this.collection.remove(model);
        expect(removeSpy).toHaveBeenCalled();
    });

    it('should track changes', () => {
        var model = new FooModel(intIncremental());
        this.collection.add(model);

        model.bar = 'foo';
        this.collection.changed = [];
    });

    it('should notify me when a child model changes', () => {
        var model = new FooModel(intIncremental());
        this.collection.add(model);

        var spy = jasmine.createSpy('changeCb');
        this.collection.on('change', spy);

        model.bar = 'foo';
        expect(spy).toHaveBeenCalled();
    });

    it('should persist properly', () => {
        var model = new FooModel(intIncremental());
        var pk = this.collection.add(model);
        this.collection.persist();

        model.bar = 'foo';
        this.collection.changed = [pk];
    });

    it('should allow filtering', () => {
        var model = new FooModel(intIncremental());
        model.bar = 'foo';

        this.collection.add(model);
        this.collection.add(new FooModel(intIncremental()));

        expect(this.collection.filter((m: FooModel) => m.bar == 'foo')).toEqual([model]);
    });

    it('should convert to JSON properly', () => {
        this.collection.add(new FooModel(intIncremental()));
        expect(JSON.stringify(this.collection)).toEqual('[{"pk":"1","qux":5}]');
    });
});





describe('A model with a collection field', () => {
    var model: FooModel;
    var collected: CollectedModel;

    beforeEach(() => {
        intCounter = 0;
        this.model = new FooModel(intIncremental());
        this.collected = new CollectedModel(intIncremental());
    });
    afterEach(() => {
        this.model = undefined;
        this.collected = undefined;
    });

    it('should work nicely', () => {
        this.collected.foos = new FooCollection();
        this.collected.persist();

        this.collected.foos.add(this.model);

        expect(this.collected.clean).toBe(false);
    });

    it('should listen to collection changes', () => {
        this.collected.foos = new FooCollection();
        this.collected.foos.add(this.model);
        this.collected.persist();

        this.collected.foos.add(new FooModel(intIncremental()));
        expect(this.collected.clean).toBe(false);
    });

    it('should unbind collection listeners', () => {
        var collection = new FooCollection()

        this.collected.foos = collection;
        this.collected.foos = undefined;
        this.collected.persist();

        collection.add(new FooModel(intIncremental()));

        expect(this.collected.clean).toBe(true);
    });

    it('should convert to JSON properly', () => {
        this.collected.foos = new FooCollection();
        this.collected.foos.add(this.model);

        expect(JSON.stringify(this.collected)).toEqual('{"pk":"2","foos":[{"pk":"1","qux":5}]}');
    });
});
