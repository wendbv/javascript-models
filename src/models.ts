/************
 *  EVENTS  *
 ************/
export type Event = () => void;
interface eventIndexedEvents {
    [eventIndex: number]: Event;
}
interface EventsMap {
    [name: string]: number[];
}


/**
* A very simple event class, made pretty much only to extend upon for other
* classes.
*/
export class Events {
    private eventIndex: number = 0;

    private map: EventsMap = {};
    private events: eventIndexedEvents = {};

    /**
    * Trigger the event name. If there's nothing to trigger, this'll... well,
    * just do nothing. It's fine, no worries.
    * @param name Event name.
    */
    public trigger(name: string) {
        var evts = this.map[name] || [];
        evts.forEach((eventIndex) => this.events[eventIndex]());
    }

    /**
    * Register an event.
    * @param name The event name, this can be anything you like.
    * @param func Callback function, will be called when the event is
    *             triggered.
    * @returns    An eventIndex with which you can deregister the event, with off.
    */
    public on(name: string, func: Event) {
        var evts = this.map[name];
        if(!evts) {
            this.map[name] = evts = [];
        }

        this.eventIndex += 1;
        evts.push(this.eventIndex);

        this.events[this.eventIndex] = func;

        return this.eventIndex;
    }

    /**
    * Deregister an event.
    * @param name  The event name.
    * @param eventIndex Registration eventIndex, which you get from the on method.
    */
    public off(name: string, eventIndex: number) {
        var evts = this.map[name];
        if(!evts) return;

        evts.splice(evts.indexOf(eventIndex), 1);
        delete this.events[eventIndex];
    }
}





/************
 *  MODELS  *
 ************/
export type Fields = {[index: string]: any};
// I'd originally intended this to be `string | number`, since I don't care
// much what the index type is. Apparently Typescript does, though.
export type PK = string;


/**
 * The field decorator is my favourite piece of magic. Since we want to keep
 * track of every change to a model, but we also want to keep the wonderful
 * abilities of Typescript's type checking AND we want to set fields as class
 * properties, we can decorate them with @field name: type = default. This'll
 * create a strongly typed, controlled getter/setter on the model.
 */
export function field<T>(target: Model, property: string) {
    var getter = function() {
        return this.get(property);
    };
    var setter = function(value: T) {
        this.set(property, value);
    };

    if (delete this[property]) {
        Object.defineProperty(target, property, {
            set: setter,
            get: getter,
            enumerable: true,
            configurable: true,
        });
    }

    target.fieldNames = target.fieldNames || [];
    target.fieldNames.push(property);
}


/**
 * This is a fairly simple Model, but it's able to have default values and it
 * tracks field changes (with events!). You can see which values have changed,
 * choose when to set them as "persisted"... All that jazz.
 */
export abstract class Model extends Events {
    fieldNames: string[];

    private fields: Fields = {};
    private mappedEvents: {[field: string]: Number[]} = {};
    persisted: Fields = {};

    /**
     * Note that models start out dirty, we assume they haven't been persisted.
     */
    clean = false;

    @field pk: PK;


    constructor(pk: PK) {
        super();
        this.fieldNames.forEach((name) => {
            this.fields[name] = this.persisted[name] = undefined;
            this.mappedEvents[name] = [];
        });

        this.pk = pk;
    }

    get changed(): Fields {
        return Object.keys(this.fields).filter((field) => {
            return this.fields[field] != this.persisted[field];
        });
    }

    get(property: string) {
        return this.fields[property];
    }

    set(property: string, value: any) {
        var current = this.get(property);
        if(current instanceof Events) {
            this.mappedEvents[property].forEach(
                    (e) => current.off('change', e));

            this.mappedEvents[property] = [];
        }
        if(value instanceof Events) {
            this.mappedEvents[property].push(value.on('change', () => {
                this.clean = false;
                this.trigger('change');
                this.trigger(`change:${property}`);
            }));
        }

        this.fields[property] = value;
        this.clean = false;

        this.trigger('change');
        this.trigger(`change:${property}`);
    }

    /**
     * Set the model data as "persisted". You'd do this, for example, after
     * successfully completing an Ajax POST to the server, which would then
     * save the information - persist it!
     */
    persist() {
        if(this.clean) return false;

        this.clean = true;
        Object.keys(this.fields).map((field) => {
            this.persisted[field] = this.fields[field];
        });
        this.trigger('persist');
        return true;
    }

    /**
     * Return an object that can be used to render a JSON representation of the
     * model.
     */
    toJSON() {
        return this.fields;
    }
}


interface ModelMeta {
    index: number;
    change: number;
    changePK: number;
}
interface ModelMap {
    [pk: string]: ModelMeta;
}

/**
 * This is really just a list of models. We need to be able to track both
 * appending and subtracting from model lists, so we could just do @field m:
 * Model[]. We needed a collection type.
 * There's a bunch of alias/convenience methods that basically allow chaining
 * together a few methods together as one call. For these, it's important to
 * know the meaning of a few keywords:
 * - at:           select model by index.
 * - get/by:       select model by PK.
 * - filter/where: select model by a given filter method in the style of
 *                 `(m: Model) => boolean`
 */
export abstract class Collection<T extends Model> extends Events {
    index = 0;

    // This index signature should be pk: PK, but that's not allowed.
    // See https://github.com/Microsoft/TypeScript/issues/6011
    private modelMap: ModelMap = {};
    private models: T[] = [];
    private persisted: PK[] = [];
    clean = false;


    get length() {
        return this.models.length;
    }

    get changed(): PK[] {
        var pks = this.models.map((m) => m.pk);

        return pks.filter((pk) => this.persisted.indexOf(pk) == -1);
    }


    /**
     * Rebuild the model.pk -> index map.
     */
    private rebuildMap() {
        var newMap: ModelMap = {};
        this.models.forEach((m, index) => {
            newMap[m.pk] = this.modelMap[m.persisted['pk'] || m.pk];
            newMap[m.pk].index = index;
        });
        this.modelMap = newMap;
    }


    /**
     * Get all items
     */
    all() {
        return this.models;
    }

    /**
     * Get a model by its pk. This is fast operation because we're doing the
     * lookup through a pk->index map.
     */
    get(pk: PK) {
        return this.models[this.modelMap[pk].index];
    }

    /**
     * Get a model by its index.
     */
    at(index: number) {
        return this.models[index];
    }

    /**
     * This one is just a wrapper guys, sorry. this.models is a private
     * property, so this had to be done.
     */
    filter(key: (model: T) => boolean) {
        return this.models.filter(key);
    }


    /**
     * Add a model to the collection.
     */
    add(model: T) {
        var map: ModelMeta = {
            index: this.models.push(model) - 1,
            change: model.on('change', () => {
                this.clean = false;
                this.persisted.splice(this.persisted.indexOf(model.pk), 1);
                this.trigger('change');
            }),
            changePK: model.on('change:pk', () => {
                this.rebuildMap();
            }),
        }
        this.modelMap[model.pk] = map;

        this.clean = false;

        this.trigger('change');
        this.trigger('append');
    }


    /**
     * Remove a model from the collection.
     * Note: Requires rebuilding the model map!
     */
    remove(model: T) {
        this.clean = false;

        this.models.splice(this.models.indexOf(model), 1);
        delete this.modelMap[model.pk];
        this.persisted.splice(this.persisted.indexOf(model.pk), 1);

        this.rebuildMap();

        this.trigger('change');
        this.trigger('remove');
    }
    removeAt(index: number) {
        this.remove(this.at(index));
    }
    removeBy(pk: PK) {
        this.remove(this.get(pk));
    }
    removeWhere(key: (model: T) => boolean) {
        this.filter(key).forEach((model) => this.remove(model));
    }


    /**
     * Move a model by an offset.
     * Note: Requires rebuilding the model map!
     */
    move(model: T, offset: number) {
        this.moveAt(this.models.indexOf(model), offset);
    }
    moveAt(index: number, offset: number) {
        var model = this.at(index);
        var newIndex = index + offset;

        if(newIndex < 0) {
            newIndex = 0;
        } else if(newIndex > this.length - 1) {
            newIndex = this.length - 1;
        }

        this.models.splice(index, 1);
        this.models.splice(newIndex, 0, model);

        this.rebuildMap();

        this.trigger('change');
    }
    moveBy(pk: PK, offset: number) {
        this.moveAt(this.modelMap[pk].index, offset);
    }


    /**
     * Note that in the collections we don't actually keep track of every
     * individual model's changes, you can do that in the model itself. We just
     * keep a list of models that have changed.
     */
    persist() {
        if(this.clean) return false;

        this.clean = true;
        this.persisted = [];
        this.models.forEach((model: T) => this.persisted.push(model.pk));

        this.trigger('persist');
        return true;
    }

    toJSON() {
        return this.models;
    }
}
